-- Lava Floor, rebuilt around towers. Every correct answer lays one brick on the
-- player's tower; the lava rises under every tower and whichever one it catches
-- is dunked until its members answer their way back out.
--
-- One tower table covers all three setups the teacher picks from
-- (settings.lfMode): 'class' = one tower for everyone, 'teams' = one per team,
-- 'solo' = one per student. A tower is `width` bricks wide (its member count
-- when the game started), so a course of a 30-wide class wall needs 30 bricks
-- and every setup climbs at about one course per student-answer rate.
--
-- Height in meters = base + floor(bricks / width). `base` only moves when a
-- dunked tower is rescued: it is set so the tower lands just above the lava.
--
-- The shop, tiers and lava_floor_builds from the previous version are left in
-- place (unused) so old sessions still load.

create table if not exists public.lava_towers (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.game_sessions(id) on delete cascade,
  idx         int  not null,
  name        text,
  width       int  not null default 1,
  bricks      int  not null default 0,
  base        int  not null default 3,
  dunked      boolean not null default false,
  climb       int  not null default 0,
  dunks       int  not null default 0,
  created_at  timestamptz not null default now(),
  unique (session_id, idx)
);

alter table public.lava_towers enable row level security;
create policy "lava_towers_select" on public.lava_towers for select using (true);
alter table public.lava_towers replica identity full;

-- The lava itself. Kept out of game_sessions.settings on purpose: the projector
-- writes it every few seconds, and a whole-settings write that often would race
-- the pause control's own settings writes.
create table if not exists public.lava_state (
  session_id  uuid primary key references public.game_sessions(id) on delete cascade,
  level       double precision not null default -1.5,
  at          timestamptz not null default now(),
  rate        double precision not null default 0.03,
  erupt_at    timestamptz
);

alter table public.lava_state enable row level security;
create policy "lava_state_select" on public.lava_state for select using (true);
create policy "lava_state_insert" on public.lava_state for insert with check (true);
create policy "lava_state_update" on public.lava_state for update using (true);
alter table public.lava_state replica identity full;

alter table public.game_students
  add column if not exists lf_tower uuid references public.lava_towers(id) on delete set null;

do $$ begin
  perform 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='lava_towers';
  if not found then execute 'alter publication supabase_realtime add table public.lava_towers'; end if;
  perform 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='lava_state';
  if not found then execute 'alter publication supabase_realtime add table public.lava_state'; end if;
end $$;

-- Put every student who has no tower yet on one. Called by the host at Start
-- (everyone at once, so widths match the roster) and by a phone that joins
-- late and finds itself without a tower. Widths are only set for towers made
-- here: a late joiner adds bricks to their team but never makes its courses
-- wider, since that would drop the team's height mid-game.
create or replace function public.lava_floor_assign(p_session_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_mode  text;
  v_teams int;
  v_names text[];
  s       record;
  t_id    uuid;
  v_new   int;
  v_next  int;
begin
  select coalesce(settings->>'lfMode', 'class'), greatest(2, least(4, coalesce((settings->>'lfTeams')::int, 2)))
    into v_mode, v_teams
    from game_sessions where id = p_session_id;
  if v_mode is null then return; end if;

  -- serialize assignment per session so two late joiners can't race the same slot
  perform pg_advisory_xact_lock(hashtext(p_session_id::text));

  if v_mode = 'solo' then
    for s in select id, name from game_students where session_id = p_session_id and lf_tower is null order by joined_at loop
      select coalesce(max(idx) + 1, 0) into v_next from lava_towers where session_id = p_session_id;
      insert into lava_towers (session_id, idx, name, width) values (p_session_id, v_next, s.name, 1) returning id into t_id;
      update game_students set lf_tower = t_id where id = s.id;
    end loop;
    return;
  end if;

  if v_mode = 'class' then
    if not exists (select 1 from lava_towers where session_id = p_session_id) then
      select count(*) into v_new from game_students where session_id = p_session_id;
      insert into lava_towers (session_id, idx, width) values (p_session_id, 0, greatest(1, v_new));
    end if;
    select id into t_id from lava_towers where session_id = p_session_id and idx = 0;
    update game_students set lf_tower = t_id where session_id = p_session_id and lf_tower is null;
    return;
  end if;

  -- teams: create them on first call, then fill the smallest team first
  if not exists (select 1 from lava_towers where session_id = p_session_id) then
    for i in 0 .. v_teams - 1 loop
      insert into lava_towers (session_id, idx, width) values (p_session_id, i, 1);
    end loop;
    v_new := 1;
  else
    v_new := 0;
  end if;
  for s in select id from game_students where session_id = p_session_id and lf_tower is null order by random() loop
    select t.id into t_id
      from lava_towers t
      left join game_students g on g.lf_tower = t.id
      where t.session_id = p_session_id
      group by t.id, t.idx
      order by count(g.id), t.idx
      limit 1;
    update game_students set lf_tower = t_id where id = s.id;
  end loop;
  if v_new = 1 then
    update lava_towers t set width = greatest(1, (select count(*) from game_students g where g.lf_tower = t.id))
      where t.session_id = p_session_id;
  end if;
end $$;

-- A phone's answer. A correct one lays a brick, or, while the tower is under
-- the lava, counts toward climbing out instead.
create or replace function public.lava_floor_answer(p_student_id uuid, p_correct boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare v_tower uuid;
begin
  update game_students
     set total_answers   = total_answers + 1,
         correct_answers = correct_answers + (case when p_correct then 1 else 0 end),
         crypto          = crypto + (case when p_correct then 1 else 0 end),
         streak          = case when p_correct then streak + 1 else 0 end
   where id = p_student_id
   returning lf_tower into v_tower;
  if p_correct and v_tower is not null then
    update lava_towers
       set bricks = bricks + (case when dunked then 0 else 1 end),
           climb  = climb  + (case when dunked then 1 else 0 end)
     where id = v_tower;
  end if;
end $$;

-- The projector is the referee: it sees the lava and calls this when a tower
-- has gone under or has earned its way out. Both checks are repeated here
-- against the live row, so a stale call does nothing.
create or replace function public.lava_floor_referee(p_tower uuid, p_lava double precision, p_need int)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update lava_towers
     set dunked = true, climb = 0, dunks = dunks + 1
   where id = p_tower and not dunked and base + bricks / width < p_lava;
  update lava_towers
     set dunked = false, climb = 0, base = ceil(p_lava)::int + 1 - bricks / width
   where id = p_tower and dunked and climb >= greatest(1, p_need);
end $$;

grant execute on function public.lava_floor_assign(uuid) to anon, authenticated;
grant execute on function public.lava_floor_answer(uuid, boolean) to anon, authenticated;
grant execute on function public.lava_floor_referee(uuid, double precision, int) to anon, authenticated;
