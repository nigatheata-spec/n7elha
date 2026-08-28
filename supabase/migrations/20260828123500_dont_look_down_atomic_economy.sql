-- Don't Look Down: atomic wallet writes — same shape as the other three
-- modes. This one has the widest race window of the four: the shop and the
-- quiz aren't phase-gated (the 60fps physics loop keeps running underneath
-- both), so a void-fall cash penalty, a trivia answer, and a shop purchase
-- can all fire for the same player within the same second and each used to
-- compute its new crypto/streak from the same stale local snapshot.

create or replace function public.dld_apply_answer(
  p_student_id uuid,
  p_correct boolean,
  p_drop_by smallint,      -- null = reset streak to 0 on a wrong answer; ignored when correct
  p_cash_delta bigint,     -- payout to add, only applied when correct
  p_loss_pct numeric       -- percent of current balance to deduct, only applied when wrong
) returns table(crypto bigint, streak smallint, correct_answers int, total_answers int) as $$
  update public.game_students
  set
    total_answers   = total_answers + 1,
    correct_answers = correct_answers + (case when p_correct then 1 else 0 end),
    streak = case
      when p_correct then streak + 1
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

create or replace function public.dld_void_fall(p_student_id uuid, p_loss_pct numeric)
returns table(crypto bigint) as $$
  update public.game_students
  set crypto = greatest(0, floor(crypto * (1 - p_loss_pct / 100.0)))::bigint
  where id = p_student_id
  returning crypto;
$$ language sql volatile;

-- Shared by every shop row (income/streak/insurance/energy/battery tiers,
-- double jump) and Feather Fall (cost-only, no columns to bump). Affordability
-- is re-checked against the live balance, not the client's cached `cash`.
create or replace function public.dld_spend(
  p_student_id uuid,
  p_cost bigint,
  p_income_tier smallint default null,
  p_streak_drain_tier smallint default null,
  p_cash_insurance_tier smallint default null,
  p_energy_tier smallint default null,
  p_battery_tier smallint default null,
  p_double_jump boolean default null
) returns table(
  crypto bigint, income_tier smallint, streak_drain_tier smallint, cash_insurance_tier smallint,
  energy_tier smallint, battery_tier smallint, double_jump boolean
) as $$
  update public.game_students
  set
    crypto               = crypto - p_cost,
    income_tier          = coalesce(p_income_tier, income_tier),
    streak_drain_tier    = coalesce(p_streak_drain_tier, streak_drain_tier),
    cash_insurance_tier  = coalesce(p_cash_insurance_tier, cash_insurance_tier),
    energy_tier          = coalesce(p_energy_tier, energy_tier),
    battery_tier         = coalesce(p_battery_tier, battery_tier),
    double_jump          = coalesce(p_double_jump, double_jump)
  where id = p_student_id and crypto >= p_cost
  returning crypto, income_tier, streak_drain_tier, cash_insurance_tier, energy_tier, battery_tier, double_jump;
$$ language sql volatile;

grant execute on function public.dld_apply_answer(uuid, boolean, smallint, bigint, numeric) to anon, authenticated;
grant execute on function public.dld_void_fall(uuid, numeric) to anon, authenticated;
grant execute on function public.dld_spend(uuid, bigint, smallint, smallint, smallint, smallint, smallint, boolean) to anon, authenticated;
