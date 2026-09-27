-- Crypto Rush: atomic balance writes.
--
-- Game.tsx and HackingFlow.tsx computed balances from locally cached rows and
-- wrote the absolute result back. A hacker's phone wrote the victim's balance
-- from its own stale copy, so coins the victim earned a moment earlier were
-- erased; the victim's own reward write could likewise undo a hack that had
-- just landed. These functions do the arithmetic against the live row.

create or replace function public.crypto_rush_answer(p_student_id uuid, p_correct boolean)
returns table(correct_answers int, total_answers int) as $$
  update public.game_students
  set total_answers   = total_answers + 1,
      correct_answers = correct_answers + (case when p_correct then 1 else 0 end)
  where id = p_student_id
  returning correct_answers, total_answers;
$$ language sql volatile;

-- A reward card: multiply what the row holds now, then add the flat amount.
create or replace function public.crypto_rush_reward(p_student_id uuid, p_flat bigint, p_mult numeric)
returns table(crypto bigint) as $$
  update public.game_students
  set crypto = floor(crypto * p_mult)::bigint + p_flat
  where id = p_student_id
  returning crypto;
$$ language sql volatile;

-- One hack attempt, decided against the target's password as it is now (it
-- may have been changed mid-hack). Moves the coins and logs the event in one
-- transaction; the event insert is what tells the victim's phone.
create or replace function public.crypto_rush_hack(
  p_hacker_id uuid,
  p_target_id uuid,
  p_password text,
  p_pct numeric
) returns table(success boolean, transferred bigint) as $$
declare
  t record;
  h record;
  ok boolean;
  amount bigint := 0;
begin
  select id, session_id, password, crypto into t from public.game_students where id = p_target_id for update;
  select id, session_id into h from public.game_students where id = p_hacker_id;
  if t.id is null or h.id is null or t.session_id <> h.session_id or t.id = h.id then
    return query select false, 0::bigint;
    return;
  end if;
  ok := t.password is not null and t.password = p_password;
  if ok then
    amount := floor(t.crypto * least(greatest(p_pct, 0), 1))::bigint;
    update public.game_students
      set crypto = crypto - amount, is_breached = true, hacks_received = hacks_received + 1
      where id = t.id;
    update public.game_students
      set crypto = crypto + amount, hacks_made = hacks_made + 1
      where id = h.id;
  end if;
  insert into public.hack_events (session_id, hacker_id, target_id, password_attempted, success, crypto_transferred)
    values (t.session_id, h.id, t.id, p_password, ok, amount);
  return query select ok, amount;
end;
$$ language plpgsql volatile;

grant execute on function public.crypto_rush_answer(uuid, boolean) to anon, authenticated;
grant execute on function public.crypto_rush_reward(uuid, bigint, numeric) to anon, authenticated;
grant execute on function public.crypto_rush_hack(uuid, uuid, text, numeric) to anon, authenticated;
