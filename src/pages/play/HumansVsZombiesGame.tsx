import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/ui/sonner";
import { Store, Syringe, Wind, Zap, Users, Biohazard, Snowflake, TrendingUp, Lock, ArrowUpCircle, Crosshair, Coins, CloudFog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { PixelShield, PixelFlame, PixelSkull } from "@/components/PixelIcons";
import {
  INCOME_TIERS, ZOMBIE_INCOME_NAMES, STREAK_DRAIN_TIERS, CASH_INSURANCE_TIERS,
  BATTLE_ACTIONS, battleActionsForTeam, streakMultiplier, START_HEALTH, HEALTH_DRAIN_PER_SEC, WIN_DAYS,
  type Team, type BattleActionKey,
} from "@/lib/humansVsZombies";

type Q = { id: string; text: string; options: string[]; correct_index: number; image_url?: string };
type Phase = "waiting" | "question" | "answered" | "done";
type EffectPayload = {
  damage?: { targetTeam: Team; amount: number };
  steal?: { targetTeam: Team; pct: number; ms: number; beneficiaryId: string; beneficiaryTeam: Team };
  incomeDebuff?: { targetTeam: Team; tiers: number; ms: number };
  drainBoost?: { targetTeam: Team; extraRate: number; ms: number };
};
type ActionRow = {
  id: string; student_id: string; student_name: string; team: Team; action_key: BattleActionKey;
  health_delta: number; max_health_delta: number;
  freeze_target_team: Team | null; freeze_ms: number | null;
  blur_target_team: Team | null; blur_ms: number | null;
  buff_type: "cash_mult" | "streak_lock" | null; buff_team: Team | null; buff_ms: number | null;
  effect: EffectPayload; cost: number; created_at: string;
};
type ShopTab = "upgrades" | "battle";
type DrainBoostEvent = { team: Team; startMs: number; extraRate: number; ms: number };
type StealEvent = { targetTeam: Team; pct: number; startMs: number; ms: number; beneficiaryId: string };

const ACTION_ICON: Record<BattleActionKey, React.ComponentType<any>> = {
  vaccine_dose: Syringe, fortified_wall: PixelShield, expand_outpost: ArrowUpCircle, emp_blast: Zap, vaccine_surge: Snowflake,
  biological_strike: Crosshair, multiplier_thief: Coins, health_decay: CloudFog,
  airborne_strain: Wind, horde_rush: Biohazard, apex_evolution: ArrowUpCircle, smoke_grenade: Wind, alpha_mutation: PixelSkull,
  horde_breach: Crosshair, resource_sabotage: Coins, toxic_cloud: CloudFog,
  cash_multiplier: TrendingUp, streak_lock: Lock,
};

const TEAM_COLOR: Record<Team, string> = { human: "hsl(210 70% 55%)", zombie: "hsl(100 55% 45%)" };
const zero = (): Record<Team, number> => ({ human: 0, zombie: 0 });

const av = (name: string, team?: Team) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  const bg = team ? TEAM_COLOR[team] : ["#2563eb","#16a34a","#b45309","#dc2626","#7c3aed"][Math.abs(h) % 5];
  return { bg, letter: (name.charAt(0) || "?").toUpperCase() };
};
const Avatar = ({ name, team, size = "md" }: { name: string; team?: Team; size?: "sm" | "md" | "xl" }) => {
  const { bg, letter } = av(name, team);
  const cls = size === "xl" ? "h-16 w-16 text-2xl" : size === "md" ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs";
  return (
    <div style={{ background: bg, borderColor: bg }}
      className={cn("pixel-avatar flex items-center justify-center font-black text-white select-none shrink-0", cls)}>
      {letter}
    </div>
  );
};

interface Props { sessionId: string; studentId: string; }

const HumansVsZombiesGame = ({ sessionId, studentId }: Props) => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const [session, setSession]     = useState<any>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [me, setMe]               = useState<any>(null);
  const [students, setStudents]   = useState<any[]>([]);
  const [phase, setPhase]         = useState<Phase>("waiting");
  const [currentQ, setCurrentQ]   = useState<Q | null>(null);
  const [picked, setPicked]       = useState<number | null>(null);
  const [timeLeft, setTimeLeft]   = useState(20);
  const [qSeed, setQSeed]         = useState(0);
  const [showShop, setShowShop]   = useState(false);
  const [shopTab, setShopTab]     = useState<ShopTab>("battle");
  const [now, setNow]             = useState(Date.now());
  const [recentActions, setRecentActions] = useState<ActionRow[]>([]);

  // Running aggregates derived from the hvz_actions log, seeded on mount then
  // kept in sync via realtime INSERTs — same pattern as Lava Floor's tower height.
  const [healthDeltaSum, setHealthDeltaSum]       = useState<Record<Team, number>>(zero());
  const [maxHealthDeltaSum, setMaxHealthDeltaSum] = useState<Record<Team, number>>(zero());
  const [freezeUntil, setFreezeUntil]             = useState<Record<Team, number>>(zero());
  const [blurUntil, setBlurUntil]                 = useState<Record<Team, number>>(zero());
  const [cashMultUntil, setCashMultUntil]         = useState<Record<Team, number>>(zero());
  const [streakLockUntil, setStreakLockUntil]     = useState<Record<Team, number>>(zero());
  const [drainBoosts, setDrainBoosts]             = useState<DrainBoostEvent[]>([]);
  const [incomeDebuffs, setIncomeDebuffs]         = useState<{ team: Team; tiers: number; until: number }[]>([]);
  const [stealActive, setStealActive]             = useState<StealEvent[]>([]);

  const qStartRef  = useRef(Date.now());
  const askedRef   = useRef(0);
  const pickedRef  = useRef<number | null>(null);
  const buyingRef  = useRef(false);
  const localWriteAtRef = useRef(0);

  const settings = session?.settings ?? {};
  const ar    = (settings.lang ?? i18n.language) === "ar";
  const cash  = me?.crypto ?? 0;
  const team  = (me?.team ?? "human") as Team;
  const enemyTeam: Team = team === "human" ? "zombie" : "human";
  const isFrozen  = now < freezeUntil[team];
  const isBlurred = now < blurUntil[team];
  const cashMultActive   = now < cashMultUntil[team];
  const streakLockActive = now < streakLockUntil[team];

  // ── Health: passive drain is a pure function of elapsed time, no writes needed ──
  const startedAtMs = session?.started_at ? new Date(session.started_at).getTime() : 0;
  const elapsedSec  = startedAtMs ? Math.max(0, (now - startedAtMs) / 1000) : 0;
  const extraDrainFor = (t: Team) => drainBoosts.filter(b => b.team === t)
    .reduce((sum, b) => sum + b.extraRate * Math.max(0, Math.min(now, b.startMs + b.ms) - b.startMs) / 1000, 0);
  const drain: Record<Team, number> = {
    human:  elapsedSec * HEALTH_DRAIN_PER_SEC + extraDrainFor("human"),
    zombie: elapsedSec * HEALTH_DRAIN_PER_SEC + extraDrainFor("zombie"),
  };
  const maxHealth: Record<Team, number> = { human: START_HEALTH + maxHealthDeltaSum.human, zombie: START_HEALTH + maxHealthDeltaSum.zombie };
  const health: Record<Team, number> = {
    human:  Math.max(0, Math.min(maxHealth.human,  START_HEALTH - drain.human + healthDeltaSum.human)),
    zombie: Math.max(0, Math.min(maxHealth.zombie, START_HEALTH - drain.zombie + healthDeltaSum.zombie)),
  };
  const incomeDebuffActive = incomeDebuffs.filter(d => d.team === team && now < d.until).reduce((max, d) => Math.max(max, d.tiers), 0);
  const activeStealOnMyTeam = stealActive.find(s => s.targetTeam === team && now < s.startMs + s.ms);

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from("game_sessions").select("*, quizzes(id,title)").eq("id", sessionId).maybeSingle();
      setSession(s);
      if (s?.quiz_id) {
        const { data: qs } = await supabase.from("questions").select("*").eq("quiz_id", s.quiz_id).order("position");
        setQuestions((qs ?? []).map((q: any) => ({ ...q, options: Array.isArray(q.options) ? q.options : [] })));
      }
      const { data: ss } = await supabase.from("game_students").select("*").eq("session_id", sessionId);
      const sorted = (ss ?? []).sort((a: any, b: any) => (b.crypto ?? 0) - (a.crypto ?? 0));
      setStudents(sorted);
      setMe(sorted.find((x: any) => x.id === studentId) ?? null);

      const { data: actions } = await supabase.from("hvz_actions").select("*")
        .eq("session_id", sessionId).order("created_at", { ascending: true });
      applyActions((actions ?? []) as ActionRow[]);
      setRecentActions(((actions ?? []) as ActionRow[]).slice(-8).reverse());
    })();
  }, [sessionId, studentId]);

  const applyActions = (rows: ActionRow[]) => {
    const hSum = zero(), mSum = zero(), fUntil = zero(), bUntil = zero(), cUntil = zero(), sUntil = zero();
    const boosts: DrainBoostEvent[] = [], debuffs: { team: Team; tiers: number; until: number }[] = [], steals: StealEvent[] = [];
    const created = new Date().getTime();
    for (const r of rows) {
      hSum[r.team] += r.health_delta;
      mSum[r.team] += r.max_health_delta;
      if (r.freeze_target_team && r.freeze_ms) fUntil[r.freeze_target_team] = Math.max(fUntil[r.freeze_target_team], new Date(r.created_at).getTime() + r.freeze_ms);
      if (r.blur_target_team && r.blur_ms) bUntil[r.blur_target_team] = Math.max(bUntil[r.blur_target_team], new Date(r.created_at).getTime() + r.blur_ms);
      if (r.buff_type === "cash_mult" && r.buff_team && r.buff_ms) cUntil[r.buff_team] = Math.max(cUntil[r.buff_team], new Date(r.created_at).getTime() + r.buff_ms);
      if (r.buff_type === "streak_lock" && r.buff_team && r.buff_ms) sUntil[r.buff_team] = Math.max(sUntil[r.buff_team], new Date(r.created_at).getTime() + r.buff_ms);
      const eff = r.effect || {};
      if (eff.damage) hSum[eff.damage.targetTeam] -= eff.damage.amount;
      if (eff.drainBoost) {
        // Kept forever, not just while active: the piecewise formula naturally caps
        // extra drain at the full window once it's passed, same as a permanent health_delta.
        boosts.push({ team: eff.drainBoost.targetTeam, startMs: new Date(r.created_at).getTime(), extraRate: eff.drainBoost.extraRate, ms: eff.drainBoost.ms });
      }
      if (eff.incomeDebuff) {
        const end = new Date(r.created_at).getTime() + eff.incomeDebuff.ms;
        if (end > created) debuffs.push({ team: eff.incomeDebuff.targetTeam, tiers: eff.incomeDebuff.tiers, until: end });
      }
      if (eff.steal) {
        const end = new Date(r.created_at).getTime() + eff.steal.ms;
        if (end > created) steals.push({ targetTeam: eff.steal.targetTeam, pct: eff.steal.pct, startMs: new Date(r.created_at).getTime(), ms: eff.steal.ms, beneficiaryId: eff.steal.beneficiaryId });
      }
    }
    setHealthDeltaSum(hSum); setMaxHealthDeltaSum(mSum);
    setFreezeUntil(fUntil); setBlurUntil(bUntil);
    setCashMultUntil(cUntil); setStreakLockUntil(sUntil);
    setDrainBoosts(boosts); setIncomeDebuffs(debuffs); setStealActive(steals);
  };

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel(`hvz-game-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_sessions", filter: `id=eq.${sessionId}` },
        (p: any) => setSession((prev: any) => ({ ...prev, ...p.new })))
      .on("postgres_changes", { event: "*", schema: "public", table: "game_students", filter: `session_id=eq.${sessionId}` },
        async () => {
          const { data: ss } = await supabase.from("game_students").select("*").eq("session_id", sessionId);
          const sorted = (ss ?? []).sort((a: any, b: any) => (b.crypto ?? 0) - (a.crypto ?? 0));
          setStudents(sorted);
          if (Date.now() - localWriteAtRef.current < 2000) return;
          const m = sorted.find((x: any) => x.id === studentId);
          if (m) setMe(m);
        })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "hvz_actions", filter: `session_id=eq.${sessionId}` },
        (p: any) => {
          const row = p.new as ActionRow;
          setHealthDeltaSum(prev => ({ ...prev, [row.team]: prev[row.team] + row.health_delta }));
          setMaxHealthDeltaSum(prev => ({ ...prev, [row.team]: prev[row.team] + row.max_health_delta }));
          if (row.freeze_target_team && row.freeze_ms) {
            const end = new Date(row.created_at).getTime() + row.freeze_ms;
            setFreezeUntil(prev => ({ ...prev, [row.freeze_target_team as Team]: Math.max(prev[row.freeze_target_team as Team], end) }));
          }
          if (row.blur_target_team && row.blur_ms) {
            const end = new Date(row.created_at).getTime() + row.blur_ms;
            setBlurUntil(prev => ({ ...prev, [row.blur_target_team as Team]: Math.max(prev[row.blur_target_team as Team], end) }));
          }
          if (row.buff_type === "cash_mult" && row.buff_team && row.buff_ms) {
            const end = new Date(row.created_at).getTime() + row.buff_ms;
            setCashMultUntil(prev => ({ ...prev, [row.buff_team as Team]: Math.max(prev[row.buff_team as Team], end) }));
          }
          if (row.buff_type === "streak_lock" && row.buff_team && row.buff_ms) {
            const end = new Date(row.created_at).getTime() + row.buff_ms;
            setStreakLockUntil(prev => ({ ...prev, [row.buff_team as Team]: Math.max(prev[row.buff_team as Team], end) }));
          }
          const eff = row.effect || {};
          if (eff.damage) {
            setHealthDeltaSum(prev => ({ ...prev, [eff.damage!.targetTeam]: prev[eff.damage!.targetTeam] - eff.damage!.amount }));
          }
          if (eff.drainBoost) {
            const b = eff.drainBoost;
            setDrainBoosts(prev => [...prev, { team: b.targetTeam, startMs: new Date(row.created_at).getTime(), extraRate: b.extraRate, ms: b.ms }]);
          }
          if (eff.incomeDebuff) {
            const d = eff.incomeDebuff;
            const end = new Date(row.created_at).getTime() + d.ms;
            setIncomeDebuffs(prev => [...prev, { team: d.targetTeam, tiers: d.tiers, until: end }]);
          }
          if (eff.steal) {
            const s = eff.steal;
            setStealActive(prev => [...prev, { targetTeam: s.targetTeam, pct: s.pct, startMs: new Date(row.created_at).getTime(), ms: s.ms, beneficiaryId: s.beneficiaryId }]);
          }
          setRecentActions(list => [row, ...list].slice(0, 8));
          const action = BATTLE_ACTIONS.find(a => a.key === row.action_key && a.team === row.team);
          if (action) toast(`${row.student_name}: ${ar ? action.nameAr : action.nameEn}`);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, studentId, ar]);

  // ── Fast local clock — drives health drain, freeze/blur/buff countdowns ───
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // ── Status sync ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    if (session.status === "lobby")          setPhase("waiting");
    else if (session.status === "finished")  setPhase("done");
    else if (session.status === "running")
      setPhase(prev => prev === "waiting" ? "question" : prev);
    else if (session.status === "cancelled") {
      toast.error(ar ? "أغلق المعلّم الردهة" : "The teacher closed the lobby");
      navigate("/join");
    }
  }, [session?.status]);

  // ── Pick question ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "question" || questions.length === 0) return;
    const next = questions[Math.floor(Math.random() * questions.length)];
    setCurrentQ(next);
    setPicked(null);
    pickedRef.current = null;
    askedRef.current += 1;
    qStartRef.current = Date.now();
  }, [phase, qSeed, questions.length]);

  // ── Countdown ─────────────────────────────────────────────────────────────
  // Opt-in per session (HostGame): absent/null timePerQ means no countdown runs
  // and a question never expires on its own.
  const timerEnabled = typeof settings.timePerQ === "number" && settings.timePerQ > 0;
  const duration = settings.timePerQ ?? 20;
  useEffect(() => {
    if (!timerEnabled || phase !== "question" || !currentQ) return;
    const t = setInterval(() => {
      const elapsed = (Date.now() - qStartRef.current) / 1000;
      const left = Math.max(0, Math.ceil(duration - elapsed));
      setTimeLeft(left);
      if (left <= 0 && pickedRef.current === null) { clearInterval(t); handleAnswer(-1); }
    }, 200);
    return () => clearInterval(t);
  }, [timerEnabled, phase, currentQ, duration]);

  // ── Auto-advance after answered ───────────────────────────────────────────
  useEffect(() => {
    if (phase !== "answered") return;
    const t = setTimeout(() => { setQSeed(s => s + 1); setPhase("question"); }, 1500);
    return () => clearTimeout(t);
  }, [phase]);

  // ── Answer handler ────────────────────────────────────────────────────────
  const handleAnswer = useCallback((idx: number) => {
    if (!currentQ || !me) return;
    if (pickedRef.current !== null) return;
    pickedRef.current = idx;
    const correct = idx === currentQ.correct_index;
    setPicked(idx);
    setTimeout(() => setPhase("answered"), 700);

    const rawIncomeTier = INCOME_TIERS.find(t => t.level === (me.income_tier ?? 1)) ?? INCOME_TIERS[0];
    const effectiveLevel = Math.max(1, rawIncomeTier.level - incomeDebuffActive);
    const incomeTier = INCOME_TIERS.find(t => t.level === effectiveLevel) ?? rawIncomeTier;
    const drainTier   = STREAK_DRAIN_TIERS.find(t => t.level === (me.streak_drain_tier ?? 1)) ?? STREAK_DRAIN_TIERS[0];
    const insuranceTier = CASH_INSURANCE_TIERS.find(t => t.level === (me.cash_insurance_tier ?? 1)) ?? CASH_INSURANCE_TIERS[0];

    // Predicted streak/cash for the toast + optimistic local UI only — the
    // actual write is atomic server-side (see hvz_apply_answer migration) so
    // a stale `me` here can't clobber a concurrent shop purchase or steal
    // credit landing on the same row.
    let newStreak: number;
    let newCash: number;
    let stolen = 0;
    let cashDelta = 0;
    if (correct) {
      newStreak = (me.streak ?? 0) + 1;
      let payout = incomeTier.payout * streakMultiplier(newStreak) * (cashMultActive ? 2 : 1);
      if (activeStealOnMyTeam) {
        stolen = Math.floor(payout * activeStealOnMyTeam.pct / 100);
        payout -= stolen;
      }
      cashDelta = payout;
      newCash = (me.crypto ?? 0) + payout;
    } else if (streakLockActive) {
      newStreak = me.streak ?? 0; // team buff — no streak loss on wrong answer
      newCash = Math.floor((me.crypto ?? 0) * (1 - insuranceTier.lossPct / 100));
    } else {
      const curStreak = me.streak ?? 0;
      newStreak = drainTier.dropBy === null ? 0 : Math.max(0, curStreak - drainTier.dropBy);
      newCash = Math.floor((me.crypto ?? 0) * (1 - insuranceTier.lossPct / 100));
    }

    const updates: any = { total_answers: (me.total_answers ?? 0) + 1, streak: newStreak, crypto: newCash };
    if (correct) updates.correct_answers = (me.correct_answers ?? 0) + 1;

    localWriteAtRef.current = Date.now();
    setMe((prev: any) => ({ ...prev, ...updates }));
    if (correct) {
      const mult = streakMultiplier(newStreak) * (cashMultActive ? 2 : 1);
      const payout = incomeTier.payout * mult - stolen;
      const stolenNote = stolen > 0 ? ` (${ar ? `سُرق $${stolen}` : `$${stolen} stolen`})` : "";
      toast.success(mult > 1 ? `+$${payout}  (×${mult}${cashMultActive ? " " + (ar ? "مضاعف" : "boosted") : ""})${stolenNote}` : `+$${payout}${stolenNote}`);
    } else {
      const lost = (me.crypto ?? 0) - newCash;
      const msg = lost > 0 ? (ar ? `-$${lost} من المحفظة` : `-$${lost} from wallet`) : (ar ? "إجابة خاطئة" : "Wrong answer");
      toast.error(streakLockActive ? `${msg} (${ar ? "السلسلة محمية" : "streak protected"})` : msg);
    }
    supabase.rpc("hvz_apply_answer", {
      p_student_id: me.id, p_correct: correct, p_streak_protected: streakLockActive,
      p_drop_by: drainTier.dropBy, p_cash_delta: cashDelta, p_loss_pct: insuranceTier.lossPct,
    }).then(undefined, () => {});
    if (stolen > 0 && activeStealOnMyTeam) {
      supabase.rpc("hvz_credit_cash", { p_student_id: activeStealOnMyTeam.beneficiaryId, p_amount: stolen }).then(undefined, () => {});
    }
    supabase.from("question_responses").insert({
      session_id: sessionId, student_id: me.id, question_id: currentQ.id,
      question_index: askedRef.current, answer_index: idx, is_correct: correct,
    }).then(undefined, () => {});
  }, [currentQ, me, sessionId, ar, cashMultActive, streakLockActive, incomeDebuffActive, activeStealOnMyTeam]);

  const submit = (idx: number) => {
    if (pickedRef.current !== null || isFrozen) return;
    handleAnswer(idx);
  };

  // ── Upgrade purchases (income / streak-drain / cash-insurance) ────────────
  const incomeTier     = INCOME_TIERS.find(t => t.level === (me?.income_tier ?? 1)) ?? INCOME_TIERS[0];
  const drainTier      = STREAK_DRAIN_TIERS.find(t => t.level === (me?.streak_drain_tier ?? 1)) ?? STREAK_DRAIN_TIERS[0];
  const insuranceTier  = CASH_INSURANCE_TIERS.find(t => t.level === (me?.cash_insurance_tier ?? 1)) ?? CASH_INSURANCE_TIERS[0];
  const nextIncome     = INCOME_TIERS.find(t => t.level === incomeTier.level + 1);
  const nextDrain      = STREAK_DRAIN_TIERS.find(t => t.level === drainTier.level + 1);
  const nextInsurance  = CASH_INSURANCE_TIERS.find(t => t.level === insuranceTier.level + 1);
  const streak = me?.streak ?? 0;
  const mult   = streakMultiplier(streak) * (cashMultActive ? 2 : 1);
  const incomeName = (t: typeof INCOME_TIERS[number]) =>
    team === "zombie" ? (ar ? ZOMBIE_INCOME_NAMES[t.level].nameAr : ZOMBIE_INCOME_NAMES[t.level].nameEn) : (ar ? t.nameAr : t.nameEn);

  const buyUpgrade = (kind: "income" | "drain" | "insurance") => {
    const t = kind === "income" ? nextIncome : kind === "drain" ? nextDrain : nextInsurance;
    if (!me || !t || cash < t.cost || buyingRef.current) return;
    buyingRef.current = true;
    const remaining = Math.max(0, cash - t.cost);
    const patch = kind === "income" ? { crypto: remaining, income_tier: t.level }
      : kind === "drain" ? { crypto: remaining, streak_drain_tier: t.level }
      : { crypto: remaining, cash_insurance_tier: t.level };
    localWriteAtRef.current = Date.now();
    setMe((prev: any) => ({ ...prev, ...patch }));
    toast.success(ar ? `تمت الترقية: ${t.nameAr}` : `Upgraded: ${t.nameEn}`);
    // Atomic + affordability-checked server-side (hvz_spend_cash): the local
    // `cash < t.cost` check above can pass on a stale balance (e.g. right
    // after being stolen from), so the DB re-checks at write time and simply
    // returns no rows if it's no longer affordable.
    supabase.rpc("hvz_spend_cash", {
      p_student_id: me.id, p_cost: t.cost,
      p_income_tier: kind === "income" ? t.level : null,
      p_streak_drain_tier: kind === "drain" ? t.level : null,
      p_cash_insurance_tier: kind === "insurance" ? t.level : null,
    }).then(({ data, error }: any) => {
      if (!error && (!data || data.length === 0)) toast.error(ar ? "لم تعد تملك ما يكفي" : "No longer affordable");
    }, () => {});
    setTimeout(() => { buyingRef.current = false; }, 500);
  };

  // ── Battle shop purchases ──────────────────────────────────────────────────
  const myActions = battleActionsForTeam(team);
  const buyBattleAction = (key: BattleActionKey) => {
    const action = myActions.find(a => a.key === key);
    if (!me || !action || cash < action.cost || buyingRef.current) return;
    buyingRef.current = true;
    const remaining = Math.max(0, cash - action.cost);
    localWriteAtRef.current = Date.now();
    setMe((prev: any) => ({ ...prev, crypto: remaining }));
    supabase.rpc("hvz_spend_cash", { p_student_id: me.id, p_cost: action.cost }).then(({ data, error }: any) => {
      if (!error && (!data || data.length === 0)) toast.error(ar ? "لم تعد تملك ما يكفي" : "No longer affordable");
    }, () => {});
    const effect: any = {};
    if (action.damageAmount) effect.damage = { targetTeam: enemyTeam, amount: action.damageAmount };
    if (action.stealPct) effect.steal = { targetTeam: enemyTeam, pct: action.stealPct, ms: action.stealMs, beneficiaryId: me.id, beneficiaryTeam: team };
    if (action.incomeDebuffTiers) effect.incomeDebuff = { targetTeam: enemyTeam, tiers: action.incomeDebuffTiers, ms: action.incomeDebuffMs };
    if (action.drainBoostMs) effect.drainBoost = { targetTeam: enemyTeam, extraRate: HEALTH_DRAIN_PER_SEC, ms: action.drainBoostMs };
    supabase.from("hvz_actions").insert({
      session_id: sessionId, student_id: me.id, student_name: me.name, team,
      action_key: key, cost: action.cost,
      health_delta: action.healthDelta ?? 0, max_health_delta: action.maxHealthDelta ?? 0,
      freeze_target_team: action.freezeMs ? enemyTeam : null, freeze_ms: action.freezeMs ?? null,
      blur_target_team: action.blurMs ? enemyTeam : null, blur_ms: action.blurMs ?? null,
      buff_type: action.buffType ?? null, buff_team: action.buffType ? team : null, buff_ms: action.buffMs ?? null,
      effect,
    }).then(undefined, () => {});
    toast.success(ar ? action.nameAr : action.nameEn);
    setTimeout(() => { buyingRef.current = false; }, 500);
  };

  const timerFrac  = timeLeft / duration;
  const timerColor = timerFrac > 0.5 ? "#e67e22" : timerFrac > 0.25 ? "#e74c3c" : "#ff3322";
  const daysSurvived = settings.daysSurvived ?? 1;
  const dayCycleEndsAt = settings.dayCycleEndsAt ? new Date(settings.dayCycleEndsAt).getTime() : 0;
  const daySecsLeft = dayCycleEndsAt ? Math.max(0, Math.ceil((dayCycleEndsAt - now) / 1000)) : 60;
  const winner = settings.winner as ("humans" | "zombies" | null | undefined);

  const actionDetail = (a: typeof BATTLE_ACTIONS[number]) => {
    const parts: string[] = [];
    if (a.healthDelta) parts.push(`+${a.healthDelta}% ${ar ? "صحة" : "health"}`);
    if (a.maxHealthDelta) parts.push(`+${a.maxHealthDelta}% ${ar ? "حد أقصى" : "max"}`);
    if (a.freezeMs) parts.push(`${ar ? "تجميد" : "freeze"} ${a.freezeMs / 1000}s`);
    if (a.blurMs) parts.push(`${ar ? "تشويش" : "blur"} ${a.blurMs / 1000}s`);
    if (a.buffType === "cash_mult") parts.push(ar ? `مضاعف 2x للفريق (${a.buffMs! / 1000}ث)` : `team 2x cash (${a.buffMs! / 1000}s)`);
    if (a.buffType === "streak_lock") parts.push(ar ? `حماية السلسلة للفريق (${a.buffMs! / 1000}ث)` : `team streak lock (${a.buffMs! / 1000}s)`);
    if (a.damageAmount) parts.push(ar ? `-${a.damageAmount}% لصحة العدو فوراً` : `-${a.damageAmount}% enemy health instantly`);
    if (a.stealPct) parts.push(ar ? `يسرق ${a.stealPct}% من أرباح العدو (${a.stealMs! / 1000}ث)` : `steals ${a.stealPct}% of enemy earnings (${a.stealMs! / 1000}s)`);
    if (a.incomeDebuffTiers) parts.push(ar ? `يخفّض دخل العدو ${a.incomeDebuffTiers} مستويات (${a.incomeDebuffMs! / 1000}ث)` : `enemy income −${a.incomeDebuffTiers} tiers (${a.incomeDebuffMs! / 1000}s)`);
    if (a.drainBoostMs) parts.push(ar ? `يضاعف استنزاف صحة العدو (${a.drainBoostMs / 1000}ث)` : `doubles enemy health drain (${a.drainBoostMs / 1000}s)`);
    return parts.join(" · ");
  };

  return (
    <div className="theme-hvz fixed inset-0 text-foreground overflow-hidden"
      style={{ fontFamily: "'JetBrains Mono', monospace", background: "#0A0F0A" }}>

      {/* ── BLUR OVERLAY — full viewport, driven by hvz_actions log ──────── */}
      {isBlurred && (
        <div className="pointer-events-none fixed inset-0 z-50" style={{ backdropFilter: "blur(9px)" }} />
      )}

      {/* ── SHOP TRIGGER ─────────────────────────────────────────────────── */}
      {(phase === "question" || phase === "answered") && (
        <button
          onClick={() => setShowShop(true)}
          className="fixed right-3 z-30 flex flex-col items-center gap-1 rounded-2xl px-3 py-2.5 transition-all active:scale-95"
          style={{ top: "50%", transform: "translateY(-50%)", background: "hsl(150 30% 8%)", border: `2px solid ${TEAM_COLOR[team]}`, color: TEAM_COLOR[team], minWidth: 56 }}>
          <Store className="h-5 w-5 shrink-0" />
          <span className="text-[9px] font-black tracking-wide leading-none">{ar ? "متجر" : "SHOP"}</span>
        </button>
      )}

      {/* ── SHOP PANEL ────────────────────────────────────────────────────── */}
      {showShop && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4"
          style={{ background: "hsl(0 0% 0% / 0.75)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowShop(false)}>
          <div className="pixel-panel w-full max-w-sm p-4 max-h-[85vh] overflow-y-auto"
            style={{ background: "hsl(0 0% 6%)", borderColor: TEAM_COLOR[team] }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-black tracking-widest" style={{ color: "hsl(90 10% 88%)" }}>
                {ar ? "المتجر" : "SHOP"}
              </span>
              <div className="flex items-center gap-1.5">
                <PixelShield className="h-4 w-4" color="hsl(45 76% 58%)" />
                <span className="font-black tabular-nums text-sm" style={{ color: "hsl(45 76% 64%)" }}>${cash}</span>
              </div>
            </div>

            <div className="flex gap-2 mb-3">
              {(["battle", "upgrades"] as ShopTab[]).map(tab => (
                <button key={tab} onClick={() => setShopTab(tab)}
                  className="pixel-button flex-1 py-2 text-xs font-black transition-all"
                  style={{
                    background: shopTab === tab ? "hsl(150 25% 10%)" : "hsl(0 0% 5%)",
                    borderColor: shopTab === tab ? TEAM_COLOR[team] : "hsl(0 0% 15%)",
                    color: shopTab === tab ? "hsl(90 10% 88%)" : "hsl(90 6% 40%)",
                  }}>
                  {tab === "battle" ? (ar ? "المعركة" : "BATTLE") : (ar ? "الترقيات" : "UPGRADES")}
                </button>
              ))}
            </div>

            {/* BATTLE TAB */}
            {shopTab === "battle" && (
              <div className="space-y-2">
                <div className="text-[10px] text-center pb-1" style={{ color: "hsl(90 8% 55%)" }}>
                  {ar ? "اشترِ عافية لفريقك أو خرّب الفريق الآخر" : "Heal your team, or sabotage the other side"}
                </div>
                {myActions.map(a => {
                  const Icon = ACTION_ICON[a.key];
                  const affordable = cash >= a.cost;
                  return (
                    <button key={a.key} disabled={!affordable} onClick={() => buyBattleAction(a.key)}
                      className="pixel-button w-full flex items-center gap-3 px-3 py-2.5 text-start transition-all"
                      style={{
                        background: affordable ? "hsl(150 25% 8%)" : "hsl(0 0% 5%)",
                        borderColor: affordable ? TEAM_COLOR[team] : "hsl(0 0% 15%)",
                        color: affordable ? "hsl(90 10% 88%)" : "hsl(90 6% 35%)",
                      }}>
                      <Icon className="h-6 w-6 shrink-0" color={affordable ? TEAM_COLOR[team] : "currentColor"} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{ar ? a.nameAr : a.nameEn}</div>
                        <div className="text-[10px] opacity-70">{actionDetail(a)}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 font-black tabular-nums text-sm">
                        <PixelShield className="h-3.5 w-3.5" color="currentColor" />
                        {a.cost}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* UPGRADES TAB */}
            {shopTab === "upgrades" && (
              <div className="space-y-3">
                <div className="pixel-panel px-3 py-2.5 flex items-center gap-3"
                  style={{ background: "hsl(150 20% 7%)", borderColor: TEAM_COLOR[team] }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] tracking-widest uppercase" style={{ color: "hsl(90 8% 55%)" }}>
                      {ar ? "دخلك لكل إجابة" : "your payout / answer"}
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: "hsl(90 10% 75%)" }}>
                      ${incomeTier.payout} × {mult} <span className="opacity-60">· {ar ? "سلسلة" : "streak"} {streak}</span>
                    </div>
                  </div>
                  <div className="font-black tabular-nums text-xl" style={{ color: TEAM_COLOR[team] }}>${incomeTier.payout * mult}</div>
                </div>

                <UpgradeRow
                  labelEn="INCOME" labelAr="الدخل" color={TEAM_COLOR[team]}
                  currentName={incomeName(incomeTier)}
                  next={nextIncome} nextName={nextIncome ? incomeName(nextIncome) : ""}
                  detail={nextIncome ? `$${incomeTier.payout} → $${nextIncome.payout}` : ""}
                  cash={cash} ar={ar} onBuy={() => buyUpgrade("income")}
                />
                <UpgradeRow
                  labelEn="STREAK PROTECTION" labelAr="حماية السلسلة" color={TEAM_COLOR[team]}
                  currentName={ar ? drainTier.nameAr : drainTier.nameEn}
                  next={nextDrain} nextName={nextDrain ? (ar ? nextDrain.nameAr : nextDrain.nameEn) : ""}
                  detail={nextDrain ? (ar ? `تفقد ${nextDrain.dropBy ?? "الكل"} فقط عند الخطأ` : `lose only ${nextDrain.dropBy} on a wrong answer`) : ""}
                  cash={cash} ar={ar} onBuy={() => buyUpgrade("drain")}
                />
                <UpgradeRow
                  labelEn="CASH INSURANCE" labelAr="تأمين المحفظة" color={TEAM_COLOR[team]}
                  currentName={ar ? insuranceTier.nameAr : insuranceTier.nameEn}
                  next={nextInsurance} nextName={nextInsurance ? (ar ? nextInsurance.nameAr : nextInsurance.nameEn) : ""}
                  detail={nextInsurance ? (ar ? `تفقد ${nextInsurance.lossPct}% فقط عند الخطأ` : `lose only ${nextInsurance.lossPct}% on a wrong answer`) : ""}
                  cash={cash} ar={ar} onBuy={() => buyUpgrade("insurance")}
                />
              </div>
            )}

            <button onClick={() => setShowShop(false)}
              className="pixel-button w-full mt-3 py-2 text-xs font-bold"
              style={{ background: "hsl(0 0% 8%)", borderColor: "hsl(0 0% 22%)", color: "hsl(90 8% 60%)" }}>
              {ar ? "إغلاق" : "CLOSE"}
            </button>
          </div>
        </div>
      )}

      {/* ── CONTENT LAYER ─────────────────────────────────────────────────── */}
      <div className="absolute inset-0 flex flex-col" style={{ zIndex: 2 }}>

        {/* HEADER */}
        <header className="shrink-0 flex items-center justify-between px-4 py-2.5 safe-top gap-2"
          style={{ borderBottom: `1px solid hsl(150 20% 20% / 0.5)`, background: "hsl(0 0% 4% / 0.9)", backdropFilter: "blur(10px)" }}>
          <div className="flex items-center gap-2 min-w-0">
            <Avatar name={me?.name ?? "?"} team={team} size="sm" />
            <span className="text-sm font-bold truncate" style={{ color: "hsl(90 10% 82%)" }}>{me?.name ?? "—"}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0" style={{ color: TEAM_COLOR[team] }}>
            {team === "human" ? <Users className="h-3.5 w-3.5" /> : <Biohazard className="h-3.5 w-3.5" />}
            <span className="text-[10px] font-black tracking-widest uppercase">
              {ar ? (team === "human" ? "البشر" : "الزومبي") : team}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {(cashMultActive || streakLockActive) && (
              <div className="flex items-center gap-1">
                {cashMultActive && <TrendingUp className="h-3.5 w-3.5" style={{ color: "hsl(45 78% 60%)" }} />}
                {streakLockActive && <Lock className="h-3.5 w-3.5" style={{ color: "hsl(200 70% 60%)" }} />}
              </div>
            )}
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded"
              style={{ color: streak >= 2 ? "hsl(45 78% 66%)" : "hsl(90 8% 45%)", background: streak >= 2 ? "hsl(45 72% 52% / 0.14)" : "transparent" }}>
              <PixelFlame className="h-3.5 w-3.5" color="currentColor" />
              <span className="font-black tabular-nums text-xs">{streak}</span>
              <span className="font-black tabular-nums text-xs opacity-80">×{mult}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <PixelShield className="h-3.5 w-3.5" color="hsl(45 76% 58%)" />
              <span className="font-black tabular-nums text-sm" style={{ color: "hsl(45 76% 64%)" }}>${cash}</span>
            </div>
          </div>
        </header>

        {/* DUAL HEALTH BARS + DAY COUNTER */}
        <div className="shrink-0 px-3 py-2 space-y-1.5" style={{ background: "hsl(0 0% 4% / 0.7)", borderBottom: "1px solid hsl(150 20% 18% / 0.4)" }}>
          <div className="text-center text-[10px] font-black tracking-widest" style={{ color: "hsl(90 8% 55%)" }}>
            {ar ? `يوم ${daysSurvived}/${WIN_DAYS} · ${daySecsLeft}ث` : `DAY ${daysSurvived}/${WIN_DAYS} · ${daySecsLeft}s`}
          </div>
          {(["human", "zombie"] as Team[]).map(t => (
            <div key={t} className="flex items-center gap-2">
              {t === "human" ? <Users className="h-3 w-3 shrink-0" style={{ color: TEAM_COLOR.human }} /> : <Biohazard className="h-3 w-3 shrink-0" style={{ color: TEAM_COLOR.zombie }} />}
              <div className="relative h-2.5 flex-1 overflow-hidden rounded" style={{ background: "hsl(0 0% 10%)" }}>
                <div className="absolute inset-y-0 left-0 transition-all duration-500" style={{ width: `${Math.min(100, (health[t] / maxHealth[t]) * 100)}%`, background: TEAM_COLOR[t] }} />
              </div>
              <span className="text-[9px] font-black tabular-nums w-16 text-end shrink-0" style={{ color: TEAM_COLOR[t] }}>
                {Math.round(health[t])}/{Math.round(maxHealth[t])}%
              </span>
            </div>
          ))}
        </div>

        {/* ACTION FEED */}
        {recentActions.length > 0 && (
          <div className="shrink-0 flex items-center gap-2 px-3 py-1 overflow-x-auto" style={{ background: "hsl(0 0% 4% / 0.7)", borderBottom: "1px solid hsl(150 20% 18% / 0.4)" }}>
            {recentActions.slice(0, 6).map(a => {
              const Icon = ACTION_ICON[a.action_key];
              return (
                <div key={a.id} className="flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded" style={{ background: "hsl(150 20% 15% / 0.4)" }}>
                  <Icon className="h-3 w-3" color={TEAM_COLOR[a.team]} />
                  <span className="text-[9px] font-bold truncate max-w-[64px]" style={{ color: "hsl(90 8% 70%)" }}>{a.student_name}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* FROZEN BANNER */}
        {isFrozen && (phase === "question" || phase === "answered") && (
          <div className="shrink-0 flex items-center justify-center gap-2 px-3 py-2" style={{ background: "hsl(200 70% 15%)", color: "hsl(200 80% 75%)" }}>
            <Snowflake className="h-4 w-4 animate-pulse" />
            <span className="text-xs font-black tracking-widest">
              {ar ? `مجمّد! ${Math.ceil((freezeUntil[team] - now) / 1000)}ث` : `FROZEN! ${Math.ceil((freezeUntil[team] - now) / 1000)}s`}
            </span>
          </div>
        )}

        {/* MAIN */}
        <main className="flex-1 flex flex-col px-3 py-3 pb-safe overflow-hidden min-h-0">

          {/* WAITING */}
          {phase === "waiting" && (
            <div className="max-w-3xl mx-auto w-full py-4 px-1 overflow-y-auto">
              <div className="text-center mb-5">
                <div className="text-[10px] tracking-[0.55em] uppercase mb-2" style={{ color: "hsl(90 8% 50%)" }}>
                  {ar ? "البشر ضد الزومبي" : "HUMANS VS ZOMBIES"}
                </div>
                <Avatar name={me?.name ?? "?"} team={team} size="xl" />
                <div className="font-black text-base tracking-tight mt-2" style={{ color: "hsl(90 10% 85%)" }}>{me?.name ?? "—"}</div>
                <div className="text-xs mt-1 font-black tracking-widest" style={{ color: TEAM_COLOR[team] }}>
                  {ar ? (team === "human" ? "أنت من البشر" : "أنت من الزومبي") : (team === "human" ? "YOU ARE HUMAN" : "YOU ARE ZOMBIE")}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(["human", "zombie"] as Team[]).map(t => (
                  <div key={t} className="pixel-panel p-2" style={{ borderColor: TEAM_COLOR[t] }}>
                    <div className="flex items-center gap-1.5 mb-2 text-xs font-black tracking-widest" style={{ color: TEAM_COLOR[t] }}>
                      {t === "human" ? <Users className="h-3.5 w-3.5" /> : <Biohazard className="h-3.5 w-3.5" />}
                      {ar ? (t === "human" ? "البشر" : "الزومبي") : t.toUpperCase()}
                    </div>
                    <div className="space-y-1.5">
                      {students.filter(s => s.team === t).map(s => (
                        <div key={s.id} className="flex items-center gap-2">
                          <Avatar name={s.name} team={t} size="sm" />
                          <span className="text-xs font-bold truncate" style={{ color: s.id === studentId ? TEAM_COLOR[t] : "hsl(90 10% 75%)" }}>
                            {s.name}{s.id === studentId && " ←"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DONE */}
          {phase === "done" && (() => {
            const myWon = (winner === "humans" && team === "human") || (winner === "zombies" && team === "zombie");
            return (
              <div className="max-w-md mx-auto w-full px-4 py-8 flex flex-col items-center gap-4">
                {winner === "humans" ? <Users className="h-20 w-20" style={{ color: TEAM_COLOR.human }} /> : <Biohazard className="h-20 w-20" style={{ color: TEAM_COLOR.zombie }} />}
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-black tracking-tight" style={{ color: myWon ? "hsl(45 76% 56%)" : "hsl(90 10% 70%)" }}>
                    {winner === "humans" ? (ar ? "فاز البشر! نجا العالم" : "Humans Win! You survived the apocalypse.")
                      : (ar ? "فاز الزومبي! انتشرت العدوى بالكامل" : "Zombies Win! The infection took over.")}
                  </div>
                  <div className="text-xs mt-2 tracking-[0.3em]" style={{ color: TEAM_COLOR[team] }}>
                    {myWon ? (ar ? "أنت من الفائزين" : "YOU WERE ON THE WINNING SIDE") : (ar ? "أنت من الخاسرين" : "YOU WERE ON THE LOSING SIDE")}
                  </div>
                </div>
                <div className="pixel-panel p-4 flex items-center gap-4 w-full" style={{ borderColor: TEAM_COLOR[team] }}>
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[9px] tracking-widest" style={{ color: "hsl(90 8% 55%)" }}>{ar ? "النقود" : "CASH"}</div>
                      <div className="text-xl font-black tabular-nums" style={{ color: "hsl(45 76% 64%)" }}>${cash}</div>
                    </div>
                    <div>
                      <div className="text-[9px] tracking-widest" style={{ color: "hsl(90 8% 55%)" }}>{ar ? "صحيح" : "CORRECT"}</div>
                      <div className="text-xl font-black tabular-nums" style={{ color: "hsl(142 50% 62%)" }}>{me?.correct_answers ?? 0}</div>
                    </div>
                  </div>
                </div>
                <button onClick={() => navigate("/join")} className="pixel-button mt-2 px-6 py-3"
                  style={{ background: `${TEAM_COLOR[team]}22`, borderColor: TEAM_COLOR[team], color: TEAM_COLOR[team] }}>
                  {ar ? "خروج" : "EXIT"}
                </button>
              </div>
            );
          })()}

          {/* QUESTION */}
          {(phase === "question" || phase === "answered") && currentQ && (
            <div className="flex-1 flex flex-col gap-2.5 max-w-2xl mx-auto w-full min-h-0 pe-[72px] lg:pe-0">
              <div className="pixel-panel shrink-0 px-4 py-4 relative" style={{ background: "hsl(0 0% 7%)", borderColor: TEAM_COLOR[team] }}>
                {currentQ.image_url && (
                  <img src={currentQ.image_url} alt="" className="mx-auto max-h-[24vh] w-auto object-contain mb-3 border-2 border-white/20" />
                )}
                <p className="text-base md:text-lg font-bold leading-snug text-center" style={{ color: "hsl(90 10% 88%)" }}>{currentQ.text}</p>
                {timerEnabled && (
                  <>
                    <div className="pixel-progress mt-3 h-2" style={{ background: "hsl(0 0% 10%)", borderColor: timerColor }}>
                      <div className="pixel-progress-fill" style={{ width: `${timerFrac * 100}%`, background: timerColor, transition: "width 0.2s linear, background 0.5s" }} />
                    </div>
                    <div className="mt-1.5 text-right text-[10px] font-black tabular-nums" style={{ color: timerColor }}>{timeLeft}s</div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
                {currentQ.options.map((opt, i) => {
                  const isCorrect = i === currentQ.correct_index;
                  const isPicked  = picked === i;
                  const show      = picked !== null;
                  let bg = "hsl(0 0% 7%)", borderColor = "hsl(150 20% 18% / 0.6)", color = "hsl(90 10% 80%)";
                  if (show && isCorrect)      { bg = "hsl(142 55% 9%)"; borderColor = "hsl(142 60% 38%)"; color = "hsl(142 80% 72%)"; }
                  else if (show && isPicked)  { bg = "hsl(0 55% 10%)";  borderColor = "hsl(0 65% 48%)";   color = "hsl(0 80% 70%)"; }
                  else if (show && !isCorrect){ bg = "hsl(0 0% 5%)";    borderColor = "hsl(0 0% 12%)";    color = "hsl(90 6% 35%)"; }
                  return (
                    <button key={i} disabled={picked !== null || isFrozen} onClick={() => submit(i)}
                      className="pixel-button relative flex items-center justify-center px-3 py-3 text-sm font-bold text-center transition-all duration-200"
                      style={{ minHeight: "72px", background: bg, borderColor, color, opacity: isFrozen ? 0.4 : 1 }}>
                      <span className="absolute top-2 left-2.5 text-[9px] font-black opacity-35 tracking-widest">{["A","B","C","D"][i]}</span>
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

const UpgradeRow = ({ labelEn, labelAr, color, currentName, next, nextName, detail, cash, ar, onBuy }: {
  labelEn: string; labelAr: string; color: string; currentName: string;
  next: { level: number; cost: number } | undefined; nextName: string; detail: string;
  cash: number; ar: boolean; onBuy: () => void;
}) => (
  <div>
    <div className="flex items-center justify-between px-1 pb-1.5 text-[10px] tracking-widest uppercase" style={{ color: "hsl(90 8% 50%)" }}>
      <span>{ar ? labelAr : labelEn}</span>
      <span style={{ color }}>{currentName}</span>
    </div>
    {next ? (
      <button disabled={cash < next.cost} onClick={onBuy}
        className="pixel-button w-full flex items-center gap-3 px-3 py-2.5 text-start transition-all"
        style={{
          background: cash >= next.cost ? "hsl(150 25% 8%)" : "hsl(0 0% 5%)",
          borderColor: cash >= next.cost ? color : "hsl(0 0% 15%)",
          color: cash >= next.cost ? "hsl(90 10% 88%)" : "hsl(90 6% 35%)",
        }}>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold truncate">{nextName}</div>
          <div className="text-[10px] opacity-70">{detail}</div>
        </div>
        <div className="flex items-center gap-1 shrink-0 font-black tabular-nums text-sm">
          <PixelShield className="h-3.5 w-3.5" color="currentColor" />
          {next.cost}
        </div>
      </button>
    ) : (
      <div className="text-center text-xs py-2" style={{ color: "hsl(45 76% 56%)" }}>{ar ? "أقصى مستوى!" : "MAX LEVEL"}</div>
    )}
  </div>
);

export default HumansVsZombiesGame;
