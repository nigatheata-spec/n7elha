-- Dodgeball: atomic life adjustments.
--
-- DodgeballGame.tsx cannot await these writes before transitioning phase
-- (awaiting DB before a phase change was tried before and froze the game
-- when Supabase was slow — see CLAUDE.md). The client previously computed
-- the new `lives` value from its own React state and wrote that number back,
-- which is a read-modify-write race: a wrong answer (decrementing) and a
-- life gift (incrementing) landing within the same realtime round-trip can
-- silently clobber each other, leaving a player's life count wrong on
-- screen for the rest of the match. Moving the read-modify-write into a
-- single UPDATE statement makes it atomic under Postgres's row lock,
-- without requiring the client to await anything.

create or replace function public.dodgeball_apply_answer(p_student_id uuid, p_correct boolean)
returns table(lives smallint, eliminated boolean) as $$
  update public.game_students
  set
    total_answers   = total_answers + 1,
    correct_answers = correct_answers + (case when p_correct then 1 else 0 end),
    lives           = case when p_correct then lives else greatest(0, lives - 1) end,
    eliminated      = eliminated or (not p_correct and lives <= 1),
    eliminated_at   = case
      when p_correct or eliminated then eliminated_at
      when lives <= 1 then now()
      else eliminated_at
    end
  where id = p_student_id
  returning lives, eliminated;
$$ language sql volatile;

-- Shared by "keep the bonus life" and "gift it to someone else": reviving an
-- eliminated player resets them to 1 life, otherwise it's a plain +1.
create or replace function public.dodgeball_add_life(p_student_id uuid)
returns table(lives smallint, eliminated boolean) as $$
  update public.game_students
  set
    lives         = case when eliminated then 1 else lives + 1 end,
    eliminated    = false,
    eliminated_at = case when eliminated then null else eliminated_at end
  where id = p_student_id
  returning lives, eliminated;
$$ language sql volatile;

grant execute on function public.dodgeball_apply_answer(uuid, boolean) to anon, authenticated;
grant execute on function public.dodgeball_add_life(uuid) to anon, authenticated;
