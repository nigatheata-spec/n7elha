-- Lava Floor: atomic wallet writes — same shape as the Dodgeball and Humans
-- vs Zombies fixes. handleAnswer, buyBlock, and buyTierUpgrade each computed
-- `crypto`/`streak` from locally-cached state and wrote the absolute result
-- back. The shop isn't phase-gated, so a block/tier purchase can race a
-- concurrent answer write for the same player; whichever lands last used to
-- silently clobber the other's crypto change.

create or replace function public.lava_floor_apply_answer(p_student_id uuid, p_correct boolean, p_payout bigint)
returns table(crypto bigint, streak smallint, correct_answers int, total_answers int, hacks_received int) as $$
  update public.game_students
  set
    total_answers   = total_answers + 1,
    correct_answers = correct_answers + (case when p_correct then 1 else 0 end),
    hacks_received  = hacks_received + (case when p_correct then 0 else 1 end),
    streak          = case when p_correct then streak + 1 else 0 end,
    crypto          = case when p_correct then crypto + p_payout else crypto end
  where id = p_student_id
  returning crypto, streak, correct_answers, total_answers, hacks_received;
$$ language sql volatile;

-- Shared by buyBlock (no tier args) and buyTierUpgrade. `where crypto >= p_cost`
-- rejects the purchase server-side (zero rows back) if the balance has
-- already dropped below the price by write time, instead of trusting the
-- same stale `bricks` value the client used for its own affordability check.
create or replace function public.lava_floor_spend(
  p_student_id uuid,
  p_cost bigint,
  p_income_tier smallint default null,
  p_streak_tier smallint default null
) returns table(crypto bigint, income_tier smallint, streak_tier smallint) as $$
  update public.game_students
  set
    crypto      = crypto - p_cost,
    income_tier = coalesce(p_income_tier, income_tier),
    streak_tier = coalesce(p_streak_tier, streak_tier)
  where id = p_student_id and crypto >= p_cost
  returning crypto, income_tier, streak_tier;
$$ language sql volatile;

grant execute on function public.lava_floor_apply_answer(uuid, boolean, bigint) to anon, authenticated;
grant execute on function public.lava_floor_spend(uuid, bigint, smallint, smallint) to anon, authenticated;
