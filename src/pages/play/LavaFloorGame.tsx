import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/ui/sonner";
import { Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { PixelShield, PixelFlame, PixelPlank, PixelBrick, PixelStaircase, PixelHouse } from "@/components/PixelIcons";
import { PixelVolcano } from "@/components/PixelVolcano";
import { PixelLavaCrest, PixelLavaBody } from "@/components/PixelLava";
import { PixelRockCeiling } from "@/components/PixelRockCeiling";
import logoLight from "@/assets/logo-light.png";
import { playSelect, playCorrect, playWrong, playBrick, playGameOver, primeAudio } from "@/lib/sound";
import { useFloatingRewards } from "@/components/game/GameFeedback";
import {
  BLOCK_TYPES, BLOCK_BY_KEY, BLOCK_SPRITES, spriteRuns,
  INCOME_TIERS, STREAK_TIERS, streakMultiplier, type BlockKey,
} from "@/lib/lavaFloorBlocks";

type Q = { id: string; text: string; options: string[]; correct_index: number; image_url?: string };
type Phase = "waiting" | "question" | "answered" | "done";
type Build = { id: string; student_id: string; student_name: string; block_type: BlockKey; height_added: number; cost: number; created_at: string };
type ShopTab = "upgrades" | "build";

const BLOCK_ICON: Record<BlockKey, typeof PixelPlank> = {
  plank: PixelPlank, brick: PixelBrick, staircase: PixelStaircase, house: PixelHouse,
};

const AV_COLORS = ["#2563eb","#16a34a","#b45309","#dc2626","#7c3aed","#0891b2","#c2410c","#0f766e"];
const av = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return { bg: AV_COLORS[Math.abs(h) % AV_COLORS.length], letter: (name.charAt(0) || "?").toUpperCase() };
};
const Avatar = ({ name, size = "md" }: { name: string; size?: "sm" | "md" | "xl" }) => {
  const { bg, letter } = av(name);
  const cls = size === "xl" ? "h-16 w-16 text-2xl" : size === "md" ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs";
  return (
    <div style={{ background: bg, borderColor: bg }}
      className={cn("pixel-avatar flex items-center justify-center font-black text-white select-none shrink-0", cls)}>
      {letter}
    </div>
  );
};

// ── Tower ───────────────────────────────────────────────────────────────────
// Same drawn platforms as the projector, at phone scale: a buy puts a real
// block on the stack rather than printing a line of text about it.
// Streak lengths worth a toast — the rungs where the multiplier ladder steps
// up. Everything between them is covered by the flame chip in the header.
const STREAK_MILESTONES = [5, 8, 15, 25];

const TOWER_MAX = 18;      // a phone only has room for the top of the stack
const TOWER_PX  = 2;         // fixed small scale — the strip is only ~40px wide

const TowerBlock = ({ type, landing }: { type: BlockKey; landing: boolean }) => {
  const s = BLOCK_SPRITES[type];
  return (
    <div
      className={cn("relative shrink-0", landing && "animate-lf-block-land")}
      style={{ width: s.cols * TOWER_PX, height: s.rows * TOWER_PX }}
      aria-hidden>
      {spriteRuns(type).map((r, i) => (
        <div key={i} className="absolute"
          style={{ left: r.x * TOWER_PX, top: r.y * TOWER_PX, width: r.w * TOWER_PX, height: TOWER_PX, background: r.color }} />
      ))}
    </div>
  );
};

// Pre-computed ember positions — stable, no random in render
const EMBERS = [
  { left: 7,  delay: 0,    dur: 1.9, size: 3, bright: true  },
  { left: 19, delay: 0.65, dur: 2.3, size: 2, bright: false },
  { left: 34, delay: 1.15, dur: 1.7, size: 4, bright: true  },
  { left: 49, delay: 0.35, dur: 2.0, size: 2, bright: false },
  { left: 63, delay: 0.9,  dur: 1.8, size: 3, bright: true  },
  { left: 77, delay: 0.2,  dur: 2.4, size: 2, bright: false },
  { left: 89, delay: 1.45, dur: 1.6, size: 3, bright: true  },
];

interface Props { sessionId: string; studentId: string; }

const LavaFloorGame = ({ sessionId, studentId }: Props) => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const [session, setSession]         = useState<any>(null);
  const [questions, setQuestions]     = useState<Q[]>([]);
  const [me, setMe]                   = useState<any>(null);
  const [students, setStudents]       = useState<any[]>([]);
  const [phase, setPhase]             = useState<Phase>("waiting");
  const [currentQ, setCurrentQ]       = useState<Q | null>(null);
  const [picked, setPicked]           = useState<number | null>(null);
  const [timeLeft, setTimeLeft]       = useState(20);
  const [qSeed, setQSeed]             = useState(0);
  const [displayLava, setDisplayLava] = useState(0);
  const [showShop, setShowShop]       = useState(false);
  const [shopTab, setShopTab]         = useState<ShopTab>("build");
  const [towerHeight, setTowerHeight] = useState(0);
  const [recentBuilds, setRecentBuilds] = useState<Build[]>([]);
  const [buyFlash, setBuyFlash]       = useState<BlockKey | null>(null);
  // Stack is stored bottom-of-tower first; `landingId` is the block currently
  // playing its drop-and-squash landing.
  const [towerStack, setTowerStack]   = useState<{ id: string; type: BlockKey }[]>([]);
  const [landingId, setLandingId]     = useState<string | null>(null);

  // Routine income is shown as a number floating off the brick counter, not a
  // toast — the counter right above it already moved, so a popup per correct
  // answer is pure noise (and buries the screen when the class is on a roll).
  const reward = useFloatingRewards();

  const qStartRef  = useRef(Date.now());
  const askedRef   = useRef(0);
  const pickedRef  = useRef<number | null>(null);
  const buyingRef  = useRef(false);
  const localWriteAtRef = useRef(0);

  const settings = session?.settings ?? {};
  const bricks   = me?.crypto ?? 0;
  const lavaPct  = Math.min(100, displayLava);
  const danger   = lavaPct > 60;
  const critical = lavaPct > 82;

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    // Prime audio on first user gesture (required by iOS Safari)
    const onFirstTouch = () => { primeAudio(); window.removeEventListener("pointerdown", onFirstTouch); };
    window.addEventListener("pointerdown", onFirstTouch, { once: true });

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
    })();

    return () => { window.removeEventListener("pointerdown", onFirstTouch); };
  }, [sessionId, studentId]);

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel(`lf-game-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_sessions", filter: `id=eq.${sessionId}` },
        (p: any) => setSession((prev: any) => ({ ...prev, ...p.new })))
      .on("postgres_changes", { event: "*", schema: "public", table: "game_students", filter: `session_id=eq.${sessionId}` },
        async () => {
          const { data: ss } = await supabase.from("game_students").select("*").eq("session_id", sessionId);
          const sorted = (ss ?? []).sort((a: any, b: any) => (b.crypto ?? 0) - (a.crypto ?? 0));
          setStudents(sorted);
          // Another player's change also fires this. Skip adopting the server copy of
          // my own row while a local write is still in flight, or it reverts the HUD.
          if (Date.now() - localWriteAtRef.current < 2000) return;
          const m = sorted.find((x: any) => x.id === studentId);
          if (m) setMe(m);
        })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "lava_floor_builds", filter: `session_id=eq.${sessionId}` },
        (p: any) => {
          const b = p.new as Build;
          setTowerHeight(h => h + b.height_added);
          setRecentBuilds(list => [b, ...list].slice(0, 12));
          setTowerStack(list => [...list, { id: b.id, type: b.block_type }].slice(-TOWER_MAX));
          // No toast: the block lands on the tower strip and the feed names the
          // builder — one build by one classmate does not deserve a popup.
          setLandingId(b.id);
          setTimeout(() => setLandingId(cur => (cur === b.id ? null : cur)), 500);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, studentId]);

  // ── Load existing tower state ───────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("lava_floor_builds").select("*")
        .eq("session_id", sessionId).order("created_at", { ascending: false });
      const rows = (data ?? []) as Build[];
      setTowerHeight(rows.reduce((a, r) => a + r.height_added, 0));
      setRecentBuilds(rows.slice(0, 12));
      // rows are newest-first; the strip stacks bottom-up, so reverse the most
      // recent slice to put the oldest of them at the base.
      setTowerStack(rows.slice(0, TOWER_MAX).reverse().map(r => ({ id: r.id, type: r.block_type })));
    })();
  }, [sessionId]);

  // ── Status sync ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    if (session.status === "lobby")          setPhase("waiting");
    else if (session.status === "finished")  setPhase("done");
    else if (session.status === "running")
      setPhase(prev => prev === "waiting" ? "question" : prev);
    else if (session.status === "cancelled") {
      const arLang = (session.settings?.lang ?? i18n.language) === "ar";
      toast.error(arLang ? "أغلق المعلّم الردهة" : "The teacher closed the lobby");
      navigate("/join");
    }
  }, [session?.status]);

  // Play game-over fanfare once when teacher ends the session
  useEffect(() => {
    if (phase === "done") playGameOver();
  }, [phase]);

  // ── Lava interpolation ────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => {
      if (!session || session.status !== "running") return;
      const base   = settings.lavaLevel ?? 0;
      const snapAt = settings.lavaSnapshotAt;
      const rate   = settings.lavaRate ?? 0.08;
      if (!snapAt) { setDisplayLava(base); return; }
      const elapsed = (Date.now() - new Date(snapAt).getTime()) / 1000;
      setDisplayLava(Math.min(100, base + rate * elapsed));
    }, 300);
    return () => clearInterval(t);
  }, [session?.settings?.lavaLevel, session?.settings?.lavaSnapshotAt, session?.settings?.lavaRate, session?.status]);

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
  // The per-question timer is off unless the teacher enabled it: `timePerQ` is
  // null/undefined when off, a positive seconds count when on. When off there
  // is no countdown UI and a question never expires on its own.
  const timerEnabled = typeof settings.timePerQ === "number" && settings.timePerQ > 0;
  const duration = timerEnabled ? settings.timePerQ : 0;
  useEffect(() => {
    if (!timerEnabled) return;
    if (phase !== "question" || !currentQ) return;
    const t = setInterval(() => {
      const elapsed = (Date.now() - qStartRef.current) / 1000;
      const left = Math.max(0, Math.ceil(duration - elapsed));
      setTimeLeft(left);
      if (left <= 0 && pickedRef.current === null) { clearInterval(t); handleAnswer(-1); }
    }, 200);
    return () => clearInterval(t);
  }, [phase, currentQ, duration, timerEnabled]);

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
    playSelect();
    if (correct) { playCorrect(); playBrick(); } else playWrong();
    setPicked(idx);
    setTimeout(() => setPhase("answered"), 700);

    const tier = INCOME_TIERS.find(t => t.level === (me.income_tier ?? 1)) ?? INCOME_TIERS[0];
    const newStreak = correct ? (me.streak ?? 0) + 1 : 0;
    const newMult = streakMultiplier(newStreak, me.streak_tier ?? 1);
    const payout = correct ? tier.payout * newMult : 0;

    const updates: any = { total_answers: (me.total_answers ?? 0) + 1, streak: newStreak };
    if (correct) {
      updates.correct_answers = (me.correct_answers ?? 0) + 1;
      updates.crypto = (me.crypto ?? 0) + payout;
    } else {
      updates.hacks_received = (me.hacks_received ?? 0) + 1;
    }
    // Reflect locally right away — realtime echo can lag, and the HUD must not wait on it
    localWriteAtRef.current = Date.now();
    setMe((prev: any) => ({ ...prev, ...updates }));
    if (correct) {
      // Small number floating off the brick counter it just changed. A toast
      // per answer was both too frequent and too tall for a routine +$1.
      reward.fire(`+$${payout}`, newMult > 1 ? "hsl(14 78% 66%)" : "hsl(33 78% 64%)");
      // A toast is reserved for the rare, genuinely notable moment: hitting a
      // streak rung the HUD cannot announce on its own.
      if (STREAK_MILESTONES.includes(newStreak)) {
        toast.success(ar
          ? `سلسلة ${newStreak}! ×${newMult} لكل إجابة`
          : `${newStreak} streak! ×${newMult} per answer`);
      }
    } else if ((me.streak ?? 0) >= 5) {
      // Only a long streak's loss is worth interrupting for — the flame chip
      // in the header already shows short streaks resetting to zero.
      toast.error(ar ? "انقطعت السلسلة!" : "Streak broken!");
    }
    // Atomic server-side (see lava_floor_apply_answer migration) so this can't
    // race a concurrent shop purchase for the same player and clobber it.
    supabase.rpc("lava_floor_apply_answer", { p_student_id: me.id, p_correct: correct, p_payout: payout }).then(undefined, () => {});
    supabase.from("question_responses").insert({
      session_id: sessionId, student_id: me.id, question_id: currentQ.id,
      question_index: askedRef.current, answer_index: idx, is_correct: correct,
    }).then(undefined, () => {});
    // `ar` is intentionally not a dependency — it is declared further down the
    // component body, so listing it here would evaluate it inside its TDZ.
  }, [currentQ, me, sessionId, reward.fire]);

  const submit = (idx: number) => { if (pickedRef.current !== null) return; handleAnswer(idx); };

  // ── Build shop: buy a block ──────────────────────────────────────────────
  const buyBlock = (key: BlockKey) => {
    const block = BLOCK_BY_KEY[key];
    if (!me || bricks < block.cost || buyingRef.current) return;
    buyingRef.current = true;
    const remaining = Math.max(0, bricks - block.cost);
    localWriteAtRef.current = Date.now();
    setMe((prev: any) => ({ ...prev, crypto: remaining }));
    supabase.rpc("lava_floor_spend", { p_student_id: me.id, p_cost: block.cost }).then(({ data, error }: any) => {
      if (!error && (!data || data.length === 0)) toast.error(ar ? "لم تعد تملك ما يكفي" : "No longer affordable");
    }, () => {});
    supabase.from("lava_floor_builds").insert({
      session_id: sessionId, student_id: me.id, student_name: me.name,
      block_type: key, height_added: block.height, cost: block.cost,
    }).then(undefined, () => {});
    playBrick();
    setBuyFlash(key);
    setTimeout(() => { setBuyFlash(null); buyingRef.current = false; }, 500);
  };

  // ── Upgrades shop: income tier (payout) and streak tier (multiplier ladder) ──
  const incomeTier    = INCOME_TIERS.find(t => t.level === (me?.income_tier ?? 1)) ?? INCOME_TIERS[0];
  const streak        = me?.streak ?? 0;
  const streakTierLvl = me?.streak_tier ?? 1;
  const streakTier    = STREAK_TIERS.find(t => t.level === streakTierLvl) ?? STREAK_TIERS[0];
  const nextTier      = INCOME_TIERS.find(t => t.level === incomeTier.level + 1);
  const nextStreakTier = STREAK_TIERS.find(t => t.level === streakTier.level + 1);
  const mult          = streakMultiplier(streak, streakTierLvl);

  // Both upgrade tracks buy the same way: pay, bump the tier, reflect locally at once.
  const buyTierUpgrade = (kind: "income" | "streak") => {
    const t = kind === "income" ? nextTier : nextStreakTier;
    if (!me || !t || bricks < t.cost || buyingRef.current) return;
    buyingRef.current = true;
    const remaining = Math.max(0, bricks - t.cost);
    const patch = kind === "income"
      ? { crypto: remaining, income_tier: t.level }
      : { crypto: remaining, streak_tier: t.level };
    localWriteAtRef.current = Date.now();
    setMe((prev: any) => ({ ...prev, ...patch }));
    toast.success(ar ? `تمت الترقية: ${t.nameAr}` : `Upgraded: ${t.nameEn}`);
    supabase.rpc("lava_floor_spend", {
      p_student_id: me.id, p_cost: t.cost,
      p_income_tier: kind === "income" ? t.level : null,
      p_streak_tier: kind === "streak" ? t.level : null,
    }).then(({ data, error }: any) => {
      if (!error && (!data || data.length === 0)) toast.error(ar ? "لم تعد تملك ما يكفي" : "No longer affordable");
    }, () => {});
    playBrick();
    setTimeout(() => { buyingRef.current = false; }, 500);
  };

  // Derived visual values
  const timerFrac    = timerEnabled ? timeLeft / duration : 0;
  const timerColor   = timerFrac > 0.5 ? "#e67e22" : timerFrac > 0.25 ? "#e74c3c" : "#ff3322";
  const glowStrength = Math.min(1, lavaPct / 55); // 0→1 as lava rises
  const ar = (session?.settings?.lang ?? i18n.language) === "ar";

  return (
    <div className="theme-lavafloor fixed inset-0 text-foreground overflow-hidden"
      style={{ fontFamily: "'JetBrains Mono', monospace", background: "#0A0610",
        boxShadow: danger ? `inset 0 0 ${critical ? 80 : 40}px hsl(14 100% ${critical ? 45 : 35}% / ${critical ? 0.6 : 0.35})` : "none",
        transition: "box-shadow 0.8s ease" }}>

      {/* ── CAVE ROCK CEILING — static pixel-art background ──────────── */}
      <PixelRockCeiling className="absolute inset-0" />

      {/* ── SHOP — fixed floating trigger, always visible + labeled during play ── */}
      {(phase === "question" || phase === "answered") && (
        <button
          onClick={() => setShowShop(true)}
          className="fixed right-3 z-30 flex flex-col items-center gap-1 rounded-2xl px-3 py-2.5 transition-all active:scale-95"
          style={{
            top: "50%", transform: "translateY(-50%)",
            background: "hsl(142 40% 8%)",
            border: "2px solid hsl(142 45% 35%)",
            color: "hsl(142 65% 60%)",
            minWidth: 56,
          }}>
          <Store className="h-5 w-5 shrink-0" />
          <span className="text-[9px] font-black tracking-wide leading-none">{ar ? "متجر" : "SHOP"}</span>
        </button>
      )}

      {/* ── SHOP PANEL — Upgrades / Build tabs ──────────────────────────── */}
      {showShop && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4"
          style={{ background: "hsl(0 0% 0% / 0.75)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowShop(false)}>
          <div className="pixel-panel w-full max-w-sm p-4"
            style={{ background: "hsl(0 0% 6%)", borderColor: "hsl(14 60% 40%)" }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-black tracking-widest" style={{ color: "hsl(30 18% 85%)" }}>
                {ar ? "المتجر" : "SHOP"}
              </span>
              <div className="flex items-center gap-1.5">
                <PixelShield className="h-4 w-4" color="hsl(33 78% 58%)" />
                <span className="font-black tabular-nums text-sm" style={{ color: "hsl(33 78% 64%)" }}>{bricks}</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-3">
              {(["upgrades", "build"] as ShopTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setShopTab(tab)}
                  className="pixel-button flex-1 py-2 text-xs font-black transition-all"
                  style={{
                    background: shopTab === tab ? "hsl(142 30% 8%)" : "hsl(0 0% 5%)",
                    borderColor: shopTab === tab ? "hsl(142 45% 35%)" : "hsl(0 0% 15%)",
                    color: shopTab === tab ? "hsl(30 18% 88%)" : "hsl(30 8% 40%)",
                  }}>
                  {tab === "upgrades" ? (ar ? "الأدوات" : "UPGRADES") : (ar ? "البناء" : "BUILD")}
                </button>
              ))}
            </div>

            {/* UPGRADES TAB — two tracks: payout per answer, and streak multiplier */}
            {shopTab === "upgrades" && (
              <div className="space-y-3">
                {/* Live earnings readout */}
                <div className="pixel-panel px-3 py-2.5 flex items-center gap-3"
                  style={{ background: "hsl(142 20% 7%)", borderColor: "hsl(142 30% 25%)" }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] tracking-widest uppercase" style={{ color: "hsl(30 25% 55%)" }}>
                      {ar ? "دخلك لكل إجابة" : "your payout / answer"}
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: "hsl(30 18% 75%)" }}>
                      ${incomeTier.payout} × {mult}
                      <span className="opacity-60"> · {ar ? "سلسلة" : "streak"} {streak}</span>
                    </div>
                  </div>
                  <div className="font-black tabular-nums text-xl" style={{ color: "hsl(142 65% 60%)" }}>
                    ${incomeTier.payout * mult}
                  </div>
                </div>

                {/* ── TOOL track (base payout) ── */}
                <div>
                  <div className="flex items-center justify-between px-1 pb-1.5 text-[10px] tracking-widest uppercase"
                    style={{ color: "hsl(30 25% 50%)" }}>
                    <span>{ar ? "الأداة" : "TOOL"}</span>
                    <span style={{ color: "hsl(33 78% 60%)" }}>{ar ? incomeTier.nameAr : incomeTier.nameEn}</span>
                  </div>
                  {nextTier ? (
                    <button
                      disabled={bricks < nextTier.cost}
                      onClick={() => buyTierUpgrade("income")}
                      className="pixel-button w-full flex items-center gap-3 px-3 py-2.5 text-start transition-all"
                      style={{
                        background: bricks >= nextTier.cost ? "hsl(142 30% 8%)" : "hsl(0 0% 5%)",
                        borderColor: bricks >= nextTier.cost ? "hsl(142 45% 35%)" : "hsl(0 0% 15%)",
                        color: bricks >= nextTier.cost ? "hsl(30 18% 88%)" : "hsl(30 8% 35%)",
                      }}>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{ar ? nextTier.nameAr : nextTier.nameEn}</div>
                        <div className="text-[10px] opacity-70">
                          ${incomeTier.payout} → ${nextTier.payout} {ar ? "لكل إجابة" : "per answer"}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 font-black tabular-nums text-sm">
                        <PixelShield className="h-3.5 w-3.5" color="currentColor" />
                        {nextTier.cost}
                      </div>
                    </button>
                  ) : (
                    <div className="text-center text-xs py-2" style={{ color: "hsl(45 76% 56%)" }}>
                      {ar ? "أقصى مستوى!" : "MAX LEVEL"}
                    </div>
                  )}
                </div>

                {/* ── STREAK track (multiplier ladder) ── */}
                <div>
                  <div className="flex items-center justify-between px-1 pb-1.5 text-[10px] tracking-widest uppercase"
                    style={{ color: "hsl(30 25% 50%)" }}>
                    <span className="flex items-center gap-1">
                      <PixelFlame className="h-3 w-3" color="hsl(14 72% 62%)" />
                      {ar ? "السلسلة" : "STREAK"}
                    </span>
                    <span style={{ color: "hsl(14 72% 62%)" }}>{ar ? streakTier.nameAr : streakTier.nameEn}</span>
                  </div>

                  {/* current ladder */}
                  <div className="flex gap-1 mb-1.5">
                    {([[0, "0-1"], [1, "2-4"], [2, "5-7"], [3, "8+"]] as const).map(([i, label]) => {
                      const active =
                        (i === 0 && streak < 2) || (i === 1 && streak >= 2 && streak < 5) ||
                        (i === 2 && streak >= 5 && streak < 8) || (i === 3 && streak >= 8);
                      return (
                        <div key={label} className="flex-1 text-center py-1 rounded"
                          style={{
                            background: active ? "hsl(14 72% 52% / 0.18)" : "hsl(0 0% 8%)",
                            border: `1px solid ${active ? "hsl(14 72% 52%)" : "hsl(0 0% 14%)"}`,
                            color: active ? "hsl(14 78% 68%)" : "hsl(30 10% 42%)",
                          }}>
                          <div className="text-[9px] opacity-70">{label}</div>
                          <div className="text-xs font-black">×{streakTier.ladder[i]}</div>
                        </div>
                      );
                    })}
                  </div>

                  {nextStreakTier ? (
                    <button
                      disabled={bricks < nextStreakTier.cost}
                      onClick={() => buyTierUpgrade("streak")}
                      className="pixel-button w-full flex items-center gap-3 px-3 py-2.5 text-start transition-all"
                      style={{
                        background: bricks >= nextStreakTier.cost ? "hsl(14 40% 9%)" : "hsl(0 0% 5%)",
                        borderColor: bricks >= nextStreakTier.cost ? "hsl(14 60% 42%)" : "hsl(0 0% 15%)",
                        color: bricks >= nextStreakTier.cost ? "hsl(30 18% 88%)" : "hsl(30 8% 35%)",
                      }}>
                      <PixelFlame className="h-5 w-5 shrink-0"
                        color={bricks >= nextStreakTier.cost ? "hsl(14 72% 62%)" : "currentColor"} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{ar ? nextStreakTier.nameAr : nextStreakTier.nameEn}</div>
                        <div className="text-[10px] opacity-70">
                          ×{streakTier.ladder.slice(1).join("/")} → ×{nextStreakTier.ladder.slice(1).join("/")}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 font-black tabular-nums text-sm">
                        <PixelShield className="h-3.5 w-3.5" color="currentColor" />
                        {nextStreakTier.cost}
                      </div>
                    </button>
                  ) : (
                    <div className="text-center text-xs py-2" style={{ color: "hsl(45 76% 56%)" }}>
                      {ar ? "أقصى مستوى!" : "MAX LEVEL"}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* BUILD TAB */}
            {shopTab === "build" && (
              <div className="space-y-2">
                {BLOCK_TYPES.map(b => {
                  const Icon = BLOCK_ICON[b.key];
                  const affordable = bricks >= b.cost;
                  const flashing = buyFlash === b.key;
                  return (
                    <button
                      key={b.key}
                      disabled={!affordable}
                      onClick={() => buyBlock(b.key)}
                      className="pixel-button w-full flex items-center gap-3 px-3 py-2.5 text-start transition-all"
                      style={{
                        background: flashing ? "hsl(142 55% 12%)" : affordable ? "hsl(142 30% 8%)" : "hsl(0 0% 5%)",
                        borderColor: affordable ? "hsl(142 45% 35%)" : "hsl(0 0% 15%)",
                        color: affordable ? "hsl(30 18% 88%)" : "hsl(30 8% 35%)",
                      }}>
                      <Icon className="h-6 w-6 shrink-0" color={affordable ? "hsl(33 78% 64%)" : "currentColor"} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{ar ? b.labelAr : b.labelEn}</div>
                        <div className="text-[10px] opacity-70">+{b.height} {ar ? "ارتفاع" : "height"}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 font-black tabular-nums text-sm">
                        <PixelShield className="h-3.5 w-3.5" color="currentColor" />
                        {b.cost}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => setShowShop(false)}
              className="pixel-button w-full mt-3 py-2 text-xs font-bold"
              style={{ background: "hsl(0 0% 8%)", borderColor: "hsl(0 0% 22%)", color: "hsl(30 14% 60%)" }}>
              {ar ? "إغلاق" : "CLOSE"}
            </button>
          </div>
        </div>
      )}

      {/* ── RISING LAVA BODY (GPU: transform translateY) ──────────────── */}
      <div className="absolute inset-x-0 bottom-0 h-full pointer-events-none"
        style={{ transform: `translateY(${100 - lavaPct}%)`, transition: "transform 0.55s cubic-bezier(0.25,0.46,0.45,0.94)", willChange: "transform" }}>

        <PixelLavaCrest className="absolute inset-x-0 -top-16 h-16" />
        <PixelLavaBody className="absolute inset-0" />
      </div>

      {/* ── EMBER PARTICLES (rise from surface) ──────────────────────── */}
      {lavaPct > 4 && EMBERS.map((e, i) => (
        <div key={i} className="absolute pointer-events-none rounded-full"
          style={{
            left: `${e.left}%`,
            bottom: `${Math.max(0, lavaPct - 1)}%`,
            width:  `${e.size}px`,
            height: `${e.size}px`,
            background: e.bright ? "#ff9500" : "#ffdd44",
            boxShadow: `0 0 ${e.size * 2}px ${e.bright ? "#ff7700" : "#ffaa00"}`,
            animation: `ember-float ${e.dur}s ease-out ${e.delay}s infinite`,
          }} />
      ))}

      {/* ── TOWER STRIP — the class's real platform, riding the lava line ──
          Anchored at the same percentage as the lava layer so its base always
          sits on the molten surface. Lives in the left gutter the main column
          reserves with ps-[52px], so the question card never covers it. */}
      {(phase === "question" || phase === "answered") && towerStack.length > 0 && (
        <div className="absolute left-2 z-[1] flex flex-col-reverse items-center pointer-events-none"
          style={{ bottom: `${lavaPct}%`, transition: "bottom 0.55s cubic-bezier(0.25,0.46,0.45,0.94)" }}>
          {towerStack.map(b => (
            <TowerBlock key={b.id} type={b.type} landing={b.id === landingId} />
          ))}
          <div className="flex items-center gap-0.5 pb-1">
            <PixelHouse className="h-2.5 w-2.5" color="hsl(200 60% 55%)" />
            <span className="text-[9px] font-black tabular-nums" style={{ color: "hsl(200 60% 70%)" }}>
              {towerHeight}
            </span>
          </div>
        </div>
      )}

      {/* ── LAVA HEAT GLOW — floods upward into content ───────────────── */}
      <div className="absolute inset-x-0 pointer-events-none transition-all duration-500"
        style={{
          bottom: 0,
          height: `${Math.min(55, lavaPct * 0.75)}%`,
          background: "linear-gradient(to top, hsl(14 90% 18% / 0.65), hsl(14 80% 10% / 0.2), transparent)",
          opacity: lavaPct > 5 ? 1 : 0,
        }} />

      {/* ── DANGER FLICKER overlay ────────────────────────────────────── */}
      {critical && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "hsl(0 90% 45% / 0.06)", animation: "heat-flicker 1.2s ease-in-out infinite" }} />
      )}

      {/* ── CONTENT LAYER ─────────────────────────────────────────────── */}
      <div className="absolute inset-0 flex flex-col" style={{ zIndex: 2 }}>

        {/* HEADER */}
        <header className="shrink-0 flex items-center justify-between px-4 py-2.5 safe-top"
          style={{
            borderBottom: `1px solid hsl(14 ${danger ? 90 : 40}% ${danger ? 40 : 20}% / ${danger ? 0.55 : 0.3})`,
            background: "hsl(0 0% 4% / 0.9)",
            backdropFilter: "blur(10px)",
            transition: "border-color 0.4s",
          }}>
          <div className="flex items-center gap-2 min-w-0">
            <img src={logoLight} alt="nefelha" className="h-6 w-6 object-contain shrink-0" />
            <Avatar name={me?.name ?? "?"} size="sm" />
            <span className="text-sm font-bold truncate" style={{ color: "hsl(30 18% 82%)" }}>
              {me?.name ?? "—"}
            </span>
          </div>

          {/* Danger label — always in DOM, visibility toggled to prevent layout shift */}
          <div className="flex items-center gap-1 text-[10px] font-black tracking-[0.35em] uppercase"
            style={{ color: "hsl(14 72% 62%)", animation: danger ? "heat-flicker 0.7s ease-in-out infinite" : "none", visibility: danger ? "visible" : "hidden" }}>
            <PixelFlame className="h-3 w-3" color="currentColor" />
            {ar ? (critical ? "حرج" : "خطر") : (critical ? "CRITICAL" : "DANGER")}
          </div>

          {/* Streak + Tower + Bricks */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Streak — always shown so the multiplier ladder is legible from turn one */}
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded"
              style={{
                color: streak >= 2 ? "hsl(14 78% 66%)" : "hsl(30 14% 45%)",
                background: streak >= 2 ? "hsl(14 72% 52% / 0.14)" : "transparent",
                animation: streak >= 5 ? "heat-flicker 0.9s ease-in-out infinite" : "none",
              }}>
              <PixelFlame className="h-3.5 w-3.5" color="currentColor" />
              <span className="font-black tabular-nums text-xs">{streak}</span>
              <span className="font-black tabular-nums text-xs opacity-80">×{mult}</span>
            </div>
            <div className="flex items-center gap-1.5" style={{ color: "hsl(200 60% 65%)" }}>
              <PixelHouse className="h-3.5 w-3.5" color="currentColor" />
              <span className="font-black tabular-nums text-sm">{towerHeight}</span>
            </div>
            {/* relative wrapper: floating +$ rewards rise out of this counter */}
            <div className="relative flex items-center gap-1.5">
              <PixelShield className="h-3.5 w-3.5" color="hsl(33 78% 58%)" />
              <span className="font-black tabular-nums text-sm" style={{ color: "hsl(33 78% 64%)" }}>{bricks}</span>
              {/* Zero-height anchor a little below the counter: the number
                  starts under the header line and rises through the counter
                  instead of flying off the top edge of the screen. */}
              <div className="absolute inset-x-0 top-7 h-0">
                <reward.Layer />
              </div>
            </div>
          </div>
        </header>

        {/* BUILD FEED — recent tower contributions, newest first */}
        {recentBuilds.length > 0 && (
          <div className="shrink-0 flex items-center gap-2 px-3 py-1 overflow-x-auto"
            style={{ background: "hsl(0 0% 4% / 0.7)", borderBottom: "1px solid hsl(200 30% 20% / 0.4)" }}>
            {recentBuilds.slice(0, 6).map(b => {
              const Icon = BLOCK_ICON[b.block_type];
              return (
                <div key={b.id}
                  className="flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded"
                  style={{
                    background: "hsl(200 40% 15% / 0.4)",
                    animation: "fade-up 0.35s cubic-bezier(0.16,1,0.3,1) both",
                  }}>
                  <Icon className="h-3 w-3" color="hsl(200 60% 65%)" />
                  <span className="text-[9px] font-bold truncate max-w-[64px]" style={{ color: "hsl(200 30% 75%)" }}>
                    {b.student_name}
                  </span>
                  <span className="text-[9px] font-black tabular-nums" style={{ color: "hsl(200 60% 65%)" }}>
                    +{b.height_added}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* LAVA LEVEL STRIP */}
        <div className="shrink-0 relative h-1.5 w-full overflow-hidden" style={{ background: "hsl(0 0% 7%)" }}>
          <div className="absolute inset-y-0 left-0 lava-fill transition-all duration-500"
            style={{ width: `${lavaPct}%` }} />
          {lavaPct > 0 && (
            <div className="absolute inset-y-0 right-0 flex items-center pe-2">
              <span className="text-[8px] font-black tabular-nums" style={{ color: danger ? "hsl(14 72% 62%)" : "hsl(14 60% 50%)" }}>
                {Math.round(lavaPct)}%
              </span>
            </div>
          )}
        </div>

        {/* MAIN */}
        <main className="flex-1 flex flex-col px-3 py-3 pb-safe overflow-hidden min-h-0">

          {/* WAITING */}
          {phase === "waiting" && (
            <div className="max-w-3xl mx-auto w-full py-4 px-1 overflow-y-auto">
              {/* header */}
              <div className="text-center mb-5">
                <div className="text-[10px] tracking-[0.55em] uppercase mb-2" style={{ color: "hsl(14 60% 50%)" }}>
                  {ar ? "الأرضية حمم" : "THE FLOOR IS LAVA"}
                </div>
                <Avatar name={me?.name ?? "?"} size="xl" />
                <div className="font-black text-base tracking-tight mt-2" style={{ color: "hsl(30 18% 85%)" }}>
                  {me?.name ?? "—"}
                </div>
              </div>

              {/* counter strip */}
              <div
                className="flex items-center justify-between text-xs font-mono px-3 py-2 mb-3"
                style={{
                  borderTop: "1px solid hsl(14 50% 35%)",
                  borderBottom: "1px solid hsl(14 50% 35%)",
                  color: "hsl(14 50% 60%)",
                }}
              >
                <span className="tracking-widest">{ar ? "الناجون" : "SURVIVORS"}</span>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: "hsl(14 72% 52%)" }} />
                  <span className="font-bold tabular-nums text-sm" style={{ color: "hsl(30 80% 75%)" }}>
                    {students.length.toString().padStart(2, "0")}
                  </span>
                </span>
              </div>

              {/* roster grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {students.map((s, i) => {
                  const isMe = s.id === studentId;
                  return (
                    <div
                      key={s.id}
                      className="pixel-panel flex items-center gap-2.5 p-2 transition-all"
                      style={{
                        background: isMe ? "hsl(14 72% 52% / 0.14)" : "hsl(14 60% 35% / 0.10)",
                        borderColor: `hsl(14 72% 52% / ${isMe ? 0.55 : 0.25})`,
                        animation: `fade-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${Math.min(i * 60, 600)}ms both`,
                      }}
                    >
                      <Avatar name={s.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold truncate" style={{ color: isMe ? "hsl(30 62% 80%)" : "hsl(30 18% 75%)" }}>
                          {s.name}
                        </div>
                        {isMe && (
                          <div className="font-mono text-[9px]" style={{ color: "hsl(14 80% 65%)" }}>{ar ? "أنت" : "you"}</div>
                        )}
                      </div>
                      {isMe && <PixelFlame className="h-3.5 w-3.5 shrink-0" color="hsl(14 72% 62%)" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* DONE */}
          {phase === "done" && (() => {
            const myRank  = students.findIndex(s => s.id === studentId) + 1 || 1;
            const total   = students.length || 1;
            const top3    = students.slice(0, 3);
            const survived = myRank <= 3;
            const verdict = ar
              ? (myRank === 1 ? "سيد البركان" : survived ? "نجوت من الحمم" : "التهمتك الحمم")
              : (myRank === 1 ? "VOLCANO MASTER" : survived ? "ESCAPED THE LAVA" : "CONSUMED BY LAVA");
            const subtitle = ar
              ? (myRank === 1 ? "تحدّيت الحمم" : survived ? "نجوت من الحريق" : "ابتلعتك الحمم")
              : (myRank === 1 ? "YOU DEFIED THE LAVA" : survived ? "YOU SURVIVED THE FIRE" : "THE LAVA GOT YOU");
            const rankColor = myRank === 1 ? "hsl(45 76% 56%)"
              : survived    ? "hsl(30 80% 65%)"
              :               "hsl(14 80% 55%)";
            return (
              <div className="max-w-md mx-auto w-full px-4 py-5 flex flex-col gap-4 overflow-y-auto">
                {/* hero: erupting volcano */}
                <div className="relative flex flex-col items-center pt-2">
                  {/* heat halo */}
                  <div
                    className="absolute top-0 w-44 h-44 rounded-full"
                    style={{
                      background: "radial-gradient(circle, hsl(14 72% 52% / 0.22) 0%, transparent 65%)",
                      animation: "heat-flicker 2s ease-in-out infinite",
                    }}
                  />
                  <div
                    className="relative"
                    style={{
                      color: rankColor,
                      animation: "fade-up 0.6s cubic-bezier(0.34,1.4,0.64,1) both",
                    }}
                  >
                    <PixelVolcano size={120} />
                  </div>
                  <div className="text-center mt-3">
                    <div
                      className="text-2xl md:text-3xl font-black tracking-tight"
                      style={{ color: rankColor }}
                    >
                      {verdict}
                    </div>
                    <div className="text-xs mt-1.5 tracking-[0.3em]" style={{ color: "hsl(30 30% 60%)" }}>
                      {ar ? subtitle : subtitle.toUpperCase()}
                    </div>
                  </div>
                </div>

                {/* rank tile */}
                <div
                  className="pixel-panel p-4 flex items-center gap-4"
                  style={{
                    background: `${rankColor}10`,
                    borderColor: `${rankColor}`,
                  }}
                >
                  <div className="flex flex-col items-center justify-center min-w-[3.5rem]">
                    <div className="text-3xl font-pixel font-black tabular-nums leading-none" style={{ color: rankColor }}>
                      #{myRank}
                    </div>
                    <div className="text-[9px] tracking-widest mt-1" style={{ color: "hsl(30 25% 55%)" }}>
                      {ar ? `من ${total}` : `OF ${total}`}
                    </div>
                  </div>
                  <div className="h-12 w-px" style={{ background: `${rankColor}30` }} />
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[9px] tracking-widest" style={{ color: "hsl(30 25% 55%)" }}>{ar ? "الطوب" : "BRICKS"}</div>
                      <div className="flex items-center gap-1">
                        <PixelShield className="h-3.5 w-3.5" color="hsl(33 78% 58%)" />
                        <span className="text-xl font-black tabular-nums" style={{ color: "hsl(33 78% 66%)" }}>{bricks}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] tracking-widest" style={{ color: "hsl(30 25% 55%)" }}>{ar ? "صحيح" : "CORRECT"}</div>
                      <div className="text-xl font-black tabular-nums" style={{ color: "hsl(142 50% 62%)" }}>
                        {me?.correct_answers ?? 0}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Survivor stack — top 3 + you */}
                {total > 1 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] tracking-[0.3em] uppercase pb-1 text-center" style={{ color: "hsl(30 30% 55%)" }}>
                      {ar ? "━ الناجون ━" : "━ SURVIVORS ━"}
                    </div>
                    {top3.map((s: any, i: number) => {
                      const mc = i === 0 ? "hsl(45 76% 56%)" : i === 1 ? "hsl(220 12% 76%)" : "hsl(24 70% 56%)";
                      const isMe = s.id === studentId;
                      return (
                        <div
                          key={s.id}
                          className="pixel-panel flex items-center gap-2.5 px-3 py-2"
                          style={{
                            background: isMe ? `${mc}18` : "hsl(14 35% 9%)",
                            borderColor: isMe ? `${mc}` : "hsl(14 25% 18%)",
                          }}
                        >
                          <span className="font-black text-sm w-5 tabular-nums text-center" style={{ color: mc }}>{i + 1}</span>
                          <Avatar name={s.name} size="sm" />
                          <span className="flex-1 text-sm font-bold truncate" style={{ color: isMe ? "hsl(30 35% 88%)" : "hsl(30 18% 72%)" }}>
                            {s.name}{isMe && " ←"}
                          </span>
                          <PixelFlame className="h-3.5 w-3.5" color={i === 0 ? mc : "hsl(14 60% 45%)"} />
                          <span className="text-sm font-black tabular-nums" style={{ color: "hsl(33 78% 62%)" }}>{s.crypto ?? 0}</span>
                        </div>
                      );
                    })}
                    {myRank > 3 && (
                      <>
                        <div className="text-center text-xs" style={{ color: "hsl(14 30% 30%)" }}>···</div>
                        <div
                          className="pixel-panel flex items-center gap-2.5 px-3 py-2"
                          style={{ background: `${rankColor}18`, borderColor: `${rankColor}` }}
                        >
                          <span className="font-black text-sm w-5 tabular-nums text-center" style={{ color: rankColor }}>{myRank}</span>
                          <Avatar name={me?.name ?? "?"} size="sm" />
                          <span className="flex-1 text-sm font-bold truncate" style={{ color: "hsl(30 35% 88%)" }}>{me?.name} ←</span>
                          <PixelFlame className="h-3.5 w-3.5" color={rankColor} />
                          <span className="text-sm font-black tabular-nums" style={{ color: "hsl(33 78% 62%)" }}>{bricks}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <button
                  onClick={() => navigate("/join")}
                  className="pixel-button mt-2 px-6 py-3"
                  style={{
                    background: "hsl(14 72% 52% / 0.15)",
                    borderColor: "hsl(14 72% 52%)",
                    color: "hsl(14 70% 72%)",
                  }}
                >
                  {ar ? "خروج" : "EXIT"}
                </button>
              </div>
            );
          })()}

          {/* QUESTION */}
          {(phase === "question" || phase === "answered") && currentQ && (
            /* pe-[72px] clears the fixed shop button on the right; ps-[52px]
               keeps the tower strip on the left visible behind nothing */
            <div className="flex-1 flex flex-col gap-2.5 max-w-2xl mx-auto w-full min-h-0 pe-[72px] ps-[52px] lg:pe-0 lg:ps-0">

              {/* Question card */}
              <div className="pixel-panel shrink-0 px-4 py-4 relative"
                style={{
                  background: `hsl(0 0% ${6 + glowStrength * 2}%)`,
                  borderColor: `hsl(14 ${55 + glowStrength * 30}% ${22 + glowStrength * 20}%)`,
                  transition: "border-color 0.4s, background 0.4s",
                }}>
                {currentQ.image_url && (
                  <img
                    src={currentQ.image_url}
                    alt=""
                    className="mx-auto max-h-[24vh] w-auto object-contain mb-3 border-2 border-white/20"
                  />
                )}
                <p className="text-base md:text-lg font-bold leading-snug text-center"
                  style={{ color: "hsl(30 18% 88%)" }}>
                  {currentQ.text}
                </p>

                {/* Timer bar — only when the teacher turned the timer on */}
                {timerEnabled && (
                  <>
                    <div className="pixel-progress mt-3 h-2" style={{ background: "hsl(0 0% 10%)", borderColor: timerColor }}>
                      <div className="pixel-progress-fill"
                        style={{
                          width: `${timerFrac * 100}%`,
                          background: timerColor,
                          transition: "width 0.2s linear, background 0.5s",
                        }} />
                    </div>
                    <div className="mt-1.5 text-right text-[10px] font-pixel font-black tabular-nums"
                      style={{ color: timerColor, transition: "color 0.5s" }}>
                      {timeLeft}s
                    </div>
                  </>
                )}
              </div>

              {/* Answer buttons — obsidian stone platforms */}
              <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
                {currentQ.options.map((opt, i) => {
                  const isCorrect = i === currentQ.correct_index;
                  const isPicked  = picked === i;
                  const show      = picked !== null;

                  let bg          = "hsl(0 0% 7%)";
                  let borderColor = `hsl(14 35% ${18 + glowStrength * 8}% / ${0.5 + glowStrength * 0.3})`;
                  let color       = "hsl(30 14% 80%)";

                  if (show && isCorrect)       { bg = "hsl(142 55% 9%)";  borderColor = "hsl(142 60% 38%)"; color = "hsl(142 80% 72%)"; }
                  else if (show && isPicked)    { bg = "hsl(0 55% 10%)";   borderColor = "hsl(0 65% 48%)";   color = "hsl(0 80% 70%)"; }
                  else if (show && !isCorrect)  { bg = "hsl(0 0% 5%)";     borderColor = "hsl(0 0% 12%)";    color = "hsl(30 8% 35%)"; }

                  return (
                    <button key={i} disabled={picked !== null} onClick={() => submit(i)}
                      className="pixel-button relative flex items-center justify-center px-3 py-3 text-sm font-bold text-center transition-all duration-200"
                      style={{
                        minHeight: "72px",
                        background: bg,
                        borderColor: borderColor,
                        color,
                        transition: "background 0.25s, border-color 0.25s, color 0.25s, transform 0.08s",
                      }}>
                      <span className="absolute top-2 left-2.5 text-[9px] font-black opacity-35 tracking-widest">
                        {["A","B","C","D"][i]}
                      </span>
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

export default LavaFloorGame;
