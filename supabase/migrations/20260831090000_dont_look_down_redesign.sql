-- Don't Look Down redesign: the climb is now an infinite procedural level
-- (generated client-side, see src/lib/dontLookDownLevel.ts) with no shop, no
-- money, no streak multiplier, no checkpoints, and double jump on for
-- everyone by default. Drop the columns this mode no longer uses — these
-- were added specifically for it in 20260807161414_dont_look_down.sql and
-- aren't shared with any other mode. `crypto`/`streak`/`income_tier`/
-- `streak_drain_tier`/`cash_insurance_tier` stay: those are the generic
-- progression columns other modes (Lava Floor, Humans vs Zombies) still use.
ALTER TABLE game_students
  DROP COLUMN IF EXISTS energy_tier,
  DROP COLUMN IF EXISTS battery_tier,
  DROP COLUMN IF EXISTS double_jump,
  DROP COLUMN IF EXISTS checkpoint_index;

-- Simplified atomic answer RPC: no more crypto/streak math, just the shared
-- correct/total counters the results screen reads.
drop function if exists public.dld_apply_answer(uuid, boolean, smallint, bigint, numeric);

create or replace function public.dld_apply_answer(
  p_student_id uuid,
  p_correct boolean
) returns table(correct_answers int, total_answers int) as $$
  update public.game_students
  set
    total_answers   = total_answers + 1,
    correct_answers = correct_answers + (case when p_correct then 1 else 0 end)
  where id = p_student_id
  returning correct_answers, total_answers;
$$ language sql volatile;

grant execute on function public.dld_apply_answer(uuid, boolean) to anon, authenticated;

-- No shop and no void-fall cash penalty anymore — nothing calls these.
drop function if exists public.dld_void_fall(uuid, numeric);
drop function if exists public.dld_spend(uuid, bigint, smallint, smallint, smallint, smallint, smallint, boolean);
