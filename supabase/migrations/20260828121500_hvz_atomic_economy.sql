-- Humans vs Zombies: atomic wallet/streak writes.
--
-- HumansVsZombiesGame.tsx computed `crypto`/`streak` from locally-cached
-- React state and wrote the absolute result back — the same read-modify-write
-- race fixed for Dodgeball. Here it's worse in two ways:
--   1. The shop (buyUpgrade/buyBattleAction) isn't phase-gated, so a player
--      can tap "buy" while an answer write for the same row is still in
--      flight — a purely self-inflicted race.
--   2. The steal power-up writes to a DIFFERENT player's row
--      (activeStealOnMyTeam.beneficiaryId) computed from a value it just
--      fetched — still a classic TOCTOU window, and the one place this bug
--      could cost a player OTHER than the one who caused it.
--
-- These functions take the numbers the client already computed from its
-- (non-racy, purely local) tier-lookup tables — payout, loss %, drop-by —
-- and apply them to whatever the row's crypto/streak value actually is at
-- write time, inside one UPDATE. No game-balance logic is duplicated in SQL;
-- only the arithmetic that has to see the live row moves server-side.

create or replace function public.hvz_apply_answer(
  p_student_id uuid,
  p_correct boolean,
  p_streak_protected boolean,
  p_drop_by smallint,      -- null = reset streak to 0 on a wrong answer; ignored when correct/protected
  p_cash_delta bigint,     -- payout to add, only applied when correct (already net of any steal)
  p_loss_pct numeric       -- percent of current balance to deduct, only applied when wrong
) returns table(crypto bigint, streak smallint, correct_answers int, total_answers int) as $$
  update public.game_students
  set
    total_answers   = total_answers + 1,
    correct_answers = correct_answers + (case when p_correct then 1 else 0 end),
    streak = case
      when p_correct then streak + 1
      when p_streak_protected then streak
      when p_drop_by is null then 0
      else greatest(0, streak - p_drop_by)
    end,
    crypto = case
      when p_correct then crypto + p_cash_delta
      else greatest(0, floor(crypto * (1 - p_loss_pct / 100.0)))::bigint
    end
  where id = p_student_id
  returning crypto, streak, correct_answers, total_answers;
$$ language sql volatile;

-- Shared by buyUpgrade and buyBattleAction. The `where crypto >= p_cost` guard
-- also closes a real overspend hole: the client's own affordability check
-- read the same stale `cash` value, so a purchase could clear even after the
-- player's balance had already dropped below the price (e.g. just got
-- stolen from). Returns zero rows when unaffordable at write time — the
-- caller checks for that instead of trusting its own optimistic UI.
create or replace function public.hvz_spend_cash(
  p_student_id uuid,
  p_cost bigint,
  p_income_tier smallint default null,
  p_streak_drain_tier smallint default null,
  p_cash_insurance_tier smallint default null
) returns table(crypto bigint, income_tier smallint, streak_drain_tier smallint, cash_insurance_tier smallint) as $$
  update public.game_students
  set
    crypto               = crypto - p_cost,
    income_tier          = coalesce(p_income_tier, income_tier),
    streak_drain_tier    = coalesce(p_streak_drain_tier, streak_drain_tier),
    cash_insurance_tier  = coalesce(p_cash_insurance_tier, cash_insurance_tier)
  where id = p_student_id and crypto >= p_cost
  returning crypto, income_tier, streak_drain_tier, cash_insurance_tier;
$$ language sql volatile;

create or replace function public.hvz_credit_cash(p_student_id uuid, p_amount bigint)
returns table(crypto bigint) as $$
  update public.game_students set crypto = crypto + p_amount where id = p_student_id returning crypto;
$$ language sql volatile;

grant execute on function public.hvz_apply_answer(uuid, boolean, boolean, smallint, bigint, numeric) to anon, authenticated;
grant execute on function public.hvz_spend_cash(uuid, bigint, smallint, smallint, smallint) to anon, authenticated;
grant execute on function public.hvz_credit_cash(uuid, bigint) to anon, authenticated;
