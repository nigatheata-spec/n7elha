import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/ui/sonner";
import { Store, X, ChevronUp, Zap, Battery, Feather, ArrowUp, ArrowLeft, ArrowRight, Trophy, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { PixelShield, PixelFlame } from "@/components/PixelIcons";
import {
  WORLD, ENERGY, VOID_CASH_PENALTY_PCT, streakMultiplier,
  INCOME_TIERS, STREAK_INSURANCE_TIERS, MULTIPLIER_INSURANCE_TIERS,
  ENERGY_TANK_TIERS, BATTERY_TIERS,
  DOUBLE_JUMP_COST, FEATHER_FALL_COST, FEATHER_FALL_MS, FEATHER_FALL_GRAVITY_SCALE,
  PLATFORMS, SUMMIT_Y, spawnFor, colorFor,
} from "@/lib/dontLookDown";
import { drawSky, drawCloud, drawPlatform, drawCharacter, drawNameTag, drawTopFog, PLATFORM_DRAW_ABOVE, PLATFORM_DRAW_BELOW, CLOUDS } from "@/lib/dontLookDownRender";

type Q = { id: string; text: string; options: string[]; correct_index: number; image_url?: string };
type Phase = "waiting" | "playing" | "done";
type ShopTab = "economy" | "parkour";
type Peer = { id: string; name: string; x: number; y: number; face: number; t: number };

// Floating white HUD chip, matching the reference's rounded pills over the sky.
const PILL = "flex items-center gap-2 px-3 py-1.5 rounded-full shadow-md pointer-events-none";
const PILL_STYLE: React.CSSProperties = { background: "rgba(255,255,255,0.93)", backdropFilter: "blur(4px)" };

interface Props { sessionId: string; studentId: string; }

const DontLookDownGame = ({ sessionId, studentId }: Props) => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();

  const [session, setSession]     = useState<any>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [me, setMe]               = useState<any>(null);
  const [phase, setPhase]         = useState<Phase>("waiting");
  const [showQuiz, setShowQuiz]   = useState(false);
  const [showShop, setShowShop]   = useState(false);
  const [shopTab, setShopTab]     = useState<ShopTab>("parkour");
  const [currentQ, setCurrentQ]   = useState<Q | null>(null);
  const [picked, setPicked]       = useState<number | null>(null);
  const [qSeed, setQSeed]         = useState(0);
  const [summited, setSummited]   = useState(false);

  // HUD mirrors of the physics state — updated on a throttle, not every frame,
  // so the 60fps loop never triggers a React render.
  const [hud, setHud] = useState({ energy: ENERGY.start, grounded: false, featherUntil: 0, height: 0 });
  const [now, setNow] = useState(Date.now());

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keysRef   = useRef<Set<string>>(new Set());
  const peersRef  = useRef<Record<string, Peer>>({});
  const chanRef   = useRef<any>(null);
  const pickedRef = useRef<number | null>(null);
  const buyingRef = useRef(false);
  const localWriteAtRef = useRef(0);
  const meRef     = useRef<any>(null);
  const summitRef = useRef(false);

  // All mutable per-frame physics state. Deliberately outside React.
  const pRef = useRef({
    x: 0, y: 4, vx: 0, vy: 0,
    grounded: false, usedDoubleJump: false, face: 1,
    energy: ENERGY.start, featherUntil: 0,
    checkpointIndex: 0, maxHeight: 0,
    camX: 0, camY: 0, camInit: false,
  });

  const settings = session?.settings ?? {};
  const ar   = (settings.lang ?? i18n.language) === "ar";
  const cash = me?.crypto ?? 0;

  const incomeTier   = INCOME_TIERS.find(t => t.level === (me?.income_tier ?? 1)) ?? INCOME_TIERS[0];
  const streakIns    = STREAK_INSURANCE_TIERS.find(t => t.level === (me?.streak_drain_tier ?? 1)) ?? STREAK_INSURANCE_TIERS[0];
  const multIns      = MULTIPLIER_INSURANCE_TIERS.find(t => t.level === (me?.cash_insurance_tier ?? 1)) ?? MULTIPLIER_INSURANCE_TIERS[0];
  const energyTank   = ENERGY_TANK_TIERS.find(t => t.level === (me?.energy_tier ?? 1)) ?? ENERGY_TANK_TIERS[0];
  const battery      = BATTERY_TIERS.find(t => t.level === (me?.battery_tier ?? 1)) ?? BATTERY_TIERS[0];
  const hasDoubleJump = !!me?.double_jump;
  const maxEnergy    = energyTank.maxEnergy;
  const streak       = me?.streak ?? 0;
  const mult         = streakMultiplier(streak);

  useEffect(() => { meRef.current = me; }, [me]);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from("game_sessions").select("*, quizzes(id,title)").eq("id", sessionId).maybeSingle();
      setSession(s);
      if (s?.quiz_id) {
        const { data: qs } = await supabase.from("questions").select("*").eq("quiz_id", s.quiz_id).order("position");
        setQuestions((qs ?? []).map((q: any) => ({ ...q, options: Array.isArray(q.options) ? q.options : [] })));
      }
      const { data: m } = await supabase.from("game_students").select("*").eq("id", studentId).maybeSingle();
      if (m) {
        setMe(m);
        const cp = (m as any).checkpoint_index ?? 0;
        const sp = spawnFor(cp);
        pRef.current.x = sp.x; pRef.current.y = sp.y;
        pRef.current.checkpointIndex = cp;
        pRef.current.maxHeight = (m as any).height_reached ?? 0;
        pRef.current.energy = ENERGY.start;
      }
    })();
  }, [sessionId, studentId]);

  // ── Realtime: session status + own row, plus the position broadcast ───────
  useEffect(() => {
    const ch = supabase.channel(`dld-${sessionId}`, { config: { broadcast: { self: false } } })
      .on("postgres_changes", { event: "*", schema: "public", table: "game_sessions", filter: `id=eq.${sessionId}` },
        (p: any) => setSession((prev: any) => ({ ...prev, ...p.new })))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_students", filter: `id=eq.${studentId}` },
        (p: any) => {
          // Ignore the echo of our own optimistic write for a moment.
          if (Date.now() - localWriteAtRef.current < 2000) return;
          setMe((prev: any) => ({ ...prev, ...p.new }));
        })
      .on("broadcast", { event: "pos" }, ({ payload }: any) => {
        if (!payload?.id || payload.id === studentId) return;
        peersRef.current[payload.id] = { ...payload, t: Date.now() };
      })
      .subscribe();
    chanRef.current = ch;
    return () => { supabase.removeChannel(ch); chanRef.current = null; };
  }, [sessionId, studentId]);

  // ── Status → phase ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    if (session.status === "lobby") setPhase("waiting");
    else if (session.status === "finished") setPhase("done");
    else if (session.status === "running") setPhase(prev => (prev === "waiting" ? "playing" : prev));
    else if (session.status === "cancelled") {
      toast.error(ar ? "أغلق المعلّم الردهة" : "The teacher closed the lobby");
      navigate("/play");
    }
  }, [session?.status]);

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["arrowleft", "arrowright", "arrowup", " ", "a", "d", "w"].includes(k)) e.preventDefault();
      keysRef.current.add(k);
    };
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    const blur = () => keysRef.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  // ── Touch controls write into the same key set the physics loop reads ────
  const holdKey = (key: string, on: boolean) => {
    if (on) keysRef.current.add(key); else keysRef.current.delete(key);
  };

  // ── Void fall: respawn at checkpoint, take the cash penalty ──────────────
  const handleVoidFall = useCallback(() => {
    const p = pRef.current;
    const sp = spawnFor(p.checkpointIndex);
    p.x = sp.x; p.y = sp.y; p.vx = 0; p.vy = 0; p.grounded = true; p.usedDoubleJump = false;

    const m = meRef.current;
    if (!m) return;
    // The 10% void penalty is softened by the same insurance track that covers
    // wrong answers, scaled off its level-1 loss so the tiers stay meaningful.
    const insTier = MULTIPLIER_INSURANCE_TIERS.find(t => t.level === (m.cash_insurance_tier ?? 1)) ?? MULTIPLIER_INSURANCE_TIERS[0];
    const pct = VOID_CASH_PENALTY_PCT * (insTier.lossPct / MULTIPLIER_INSURANCE_TIERS[0].lossPct);
    const lost = Math.floor((m.crypto ?? 0) * (pct / 100));
    const remaining = Math.max(0, (m.crypto ?? 0) - lost);
    localWriteAtRef.current = Date.now();
    setMe((prev: any) => ({ ...prev, crypto: remaining }));
    toast.error(lost > 0
      ? (ar ? `سقطت! -$${lost}` : `You fell! -$${lost}`)
      : (ar ? "سقطت!" : "You fell!"));
    supabase.from("game_students").update({ crypto: remaining }).eq("id", m.id).then(undefined, () => {});
  }, [ar]);

  // ── Physics + render loop ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let hudAcc = 0;
    let netAcc = 0;
    let dbAcc = 0;
    const STEP = 1 / 120; // fixed physics step

    const physics = (dt: number) => {
      const p = pRef.current;
      const m = meRef.current;
      const tank = ENERGY_TANK_TIERS.find(t => t.level === (m?.energy_tier ?? 1)) ?? ENERGY_TANK_TIERS[0];
      const batt = BATTERY_TIERS.find(t => t.level === (m?.battery_tier ?? 1)) ?? BATTERY_TIERS[0];
      const canDouble = !!m?.double_jump;
      const cap = tank.maxEnergy;
      const nowMs = Date.now();

      const keys = keysRef.current;
      const left  = keys.has("arrowleft") || keys.has("a");
      const right = keys.has("arrowright") || keys.has("d");
      const jump  = keys.has("arrowup") || keys.has(" ") || keys.has("w");

      // Out of energy → total freeze until a correct answer refuels them.
      if (p.energy <= 0) {
        p.energy = 0;
        p.vx = 0; p.vy = 0;
        return;
      }

      // Horizontal
      if (left && !right) {
        p.vx -= WORLD.moveAccel * dt; p.face = -1;
        p.energy -= ENERGY.moveDrainPerSec * batt.drainMult * dt;
      } else if (right && !left) {
        p.vx += WORLD.moveAccel * dt; p.face = 1;
        p.energy -= ENERGY.moveDrainPerSec * batt.drainMult * dt;
      } else {
        const d = WORLD.moveDecel * dt;
        p.vx = p.vx > 0 ? Math.max(0, p.vx - d) : Math.min(0, p.vx + d);
      }
      p.vx = Math.max(-WORLD.maxRunSpeed, Math.min(WORLD.maxRunSpeed, p.vx));

      // Jump — edge-triggered via the jumpLatch flag
      if (jump && !(p as any).jumpLatch) {
        (p as any).jumpLatch = true;
        const cost = ENERGY.jumpCost * batt.drainMult;
        if (p.grounded && p.energy >= cost) {
          p.vy = WORLD.jumpVelocity; p.grounded = false; p.usedDoubleJump = false; p.energy -= cost;
        } else if (!p.grounded && canDouble && !p.usedDoubleJump && p.energy >= cost) {
          p.vy = WORLD.doubleJumpVelocity; p.usedDoubleJump = true; p.energy -= cost;
        }
      } else if (!jump) {
        (p as any).jumpLatch = false;
      }

      // Gravity (halved while Feather Fall is active)
      const gScale = nowMs < p.featherUntil ? FEATHER_FALL_GRAVITY_SCALE : 1;
      p.vy += WORLD.gravity * gScale * dt;
      if (p.vy < WORLD.maxFallSpeed) p.vy = WORLD.maxFallSpeed;

      const prevY = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.energy < 0) p.energy = 0;
      if (p.energy > cap) p.energy = cap;

      // One-way platform collision: only land when descending through the top.
      p.grounded = false;
      if (p.vy <= 0) {
        for (let i = 0; i < PLATFORMS.length; i++) {
          const pl = PLATFORMS[i];
          const overlapX = p.x + WORLD.playerW > pl.x && p.x < pl.x + pl.w;
          if (!overlapX) continue;
          if (prevY >= pl.y && p.y <= pl.y) {
            p.y = pl.y; p.vy = 0; p.grounded = true; p.usedDoubleJump = false;
            if (pl.checkpoint && p.checkpointIndex !== i) {
              p.checkpointIndex = i;
              toast.success(ar ? "نقطة حفظ!" : "Checkpoint!");
              const mm = meRef.current;
              if (mm) supabase.from("game_students").update({ checkpoint_index: i }).eq("id", mm.id).then(undefined, () => {});
            }
            if (pl.y >= SUMMIT_Y && !summitRef.current) {
              summitRef.current = true;
              setSummited(true);
              toast.success(ar ? "وصلت القمة!" : "You reached the summit!");
            }
            break;
          }
        }
      }

      if (p.y > p.maxHeight) p.maxHeight = p.y;
      if (p.y < WORLD.voidY) handleVoidFall();
    };

    const draw = () => {
      const p = pRef.current;
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
      if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
        canvas.width = cssW * dpr; canvas.height = cssH * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Camera: player centred horizontally, sitting low so more sky is visible.
      const targetCamX = p.x + WORLD.playerW / 2 - cssW / 2;
      const targetCamY = p.y - cssH * 0.38;
      if (!p.camInit) { p.camX = targetCamX; p.camY = targetCamY; p.camInit = true; }
      p.camX += (targetCamX - p.camX) * 0.12;
      p.camY += (targetCamY - p.camY) * 0.12;

      const sx = (wx: number) => wx - p.camX;
      const sy = (wy: number) => cssH - (wy - p.camY); // flip world-Y to screen-Y

      // Sky
      const alt = Math.max(0, Math.min(1, p.y / SUMMIT_Y));
      drawSky(ctx, cssW, cssH, alt);

      // Parallax clouds — nearer ones track the camera more strongly
      for (const c of CLOUDS) {
        const px = c.x - p.camX * c.depth;
        const py = cssH - (c.y - p.camY * c.depth);
        if (px < -220 || px > cssW + 220 || py < -160 || py > cssH + 160) continue;
        ctx.globalAlpha = 0.55 + c.depth * 0.45;
        drawCloud(ctx, px, py, c.s);
      }
      ctx.globalAlpha = 1;

      // Void haze at the bottom of the world
      const voidTop = sy(WORLD.voidY);
      if (voidTop < cssH) {
        const vg = ctx.createLinearGradient(0, voidTop - 110, 0, cssH);
        vg.addColorStop(0, "rgba(190,60,60,0)");
        vg.addColorStop(1, "rgba(170,40,40,0.42)");
        ctx.fillStyle = vg;
        ctx.fillRect(0, Math.max(0, voidTop - 110), cssW, cssH);
      }

      // Platforms
      for (const pl of PLATFORMS) {
        const x = sx(pl.x), y = sy(pl.y);
        // Cull against the platform's PAINTED extent, not its slab position:
        // the pillars hang well below `y`, so testing `y` alone popped
        // platforms out while their legs were still visible on screen.
        if (x + pl.w < -60 || x > cssW + 60) continue;
        if (y + PLATFORM_DRAW_BELOW < -40) continue;
        if (y - PLATFORM_DRAW_ABOVE > cssH + 40) continue;
        drawPlatform(ctx, x, y, pl.w, { checkpoint: pl.checkpoint });
      }

      // Other climbers
      const cutoff = Date.now() - 5000;
      for (const id of Object.keys(peersRef.current)) {
        const peer = peersRef.current[id];
        if (peer.t < cutoff) { delete peersRef.current[id]; continue; }
        const x = sx(peer.x), y = sy(peer.y);
        if (x < -80 || x > cssW + 80 || y < -80 || y > cssH + 80) continue;
        drawCharacter(ctx, x, y, WORLD.playerW, WORLD.playerH, colorFor(id), peer.face ?? 1, { alpha: 0.7 });
        drawNameTag(ctx, x + WORLD.playerW / 2, y + 3, peer.name ?? "");
      }

      // Self
      const px = sx(p.x), py = sy(p.y);
      const frozen = p.energy <= 0;
      if (Date.now() < p.featherUntil) {
        // glide aura
        ctx.fillStyle = "rgba(255,255,255,0.42)";
        ctx.beginPath();
        ctx.ellipse(px + WORLD.playerW / 2, py - WORLD.playerH * 0.55, WORLD.playerW * 1.05, WORLD.playerH * 0.78, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      drawCharacter(ctx, px, py, WORLD.playerW, WORLD.playerH, colorFor(studentId), p.face, { frozen });
      drawNameTag(ctx, px + WORLD.playerW / 2, py + 3, meRef.current?.name ?? "");

      // Last, so it hazes the platforms rather than sitting behind them.
      drawTopFog(ctx, cssW, cssH, alt);
    };

    const frame = (t: number) => {
      let dt = (t - last) / 1000;
      last = t;
      if (dt > 0.25) dt = 0.25; // tab was backgrounded — don't teleport
      acc += dt; hudAcc += dt; netAcc += dt; dbAcc += dt;

      while (acc >= STEP) { physics(STEP); acc -= STEP; }
      draw();

      // HUD at ~12Hz instead of 60 — keeps React out of the hot path
      if (hudAcc >= 0.08) {
        hudAcc = 0;
        const p = pRef.current;
        setHud({ energy: p.energy, grounded: p.grounded, featherUntil: p.featherUntil, height: p.y });
        setNow(Date.now());
      }
      // Broadcast position at ~15Hz
      if (netAcc >= 0.066) {
        netAcc = 0;
        const p = pRef.current;
        chanRef.current?.send({
          type: "broadcast", event: "pos",
          payload: { id: studentId, name: meRef.current?.name ?? "", x: Math.round(p.x), y: Math.round(p.y), face: p.face },
        });
      }
      // Persist best height every 3s so the teacher leaderboard ranks the climb
      if (dbAcc >= 3) {
        dbAcc = 0;
        const p = pRef.current;
        const m = meRef.current;
        if (m && Math.round(p.maxHeight) > (m.height_reached ?? 0)) {
          const h = Math.round(p.maxHeight);
          localWriteAtRef.current = Date.now();
          setMe((prev: any) => ({ ...prev, height_reached: h }));
          supabase.from("game_students").update({ height_reached: h }).eq("id", m.id).then(undefined, () => {});
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase, studentId, ar, handleVoidFall]);

  // ── Trivia ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!showQuiz || questions.length === 0) return;
    setCurrentQ(questions[Math.floor(Math.random() * questions.length)]);
    setPicked(null);
    pickedRef.current = null;
  }, [showQuiz, qSeed, questions.length]);

  const answer = (idx: number) => {
    if (!currentQ || !me || pickedRef.current !== null) return;
    pickedRef.current = idx;
    setPicked(idx);
    const correct = idx === currentQ.correct_index;

    let newStreak: number, newCash: number;
    if (correct) {
      newStreak = (me.streak ?? 0) + 1;
      const m = streakMultiplier(newStreak);
      newCash = (me.crypto ?? 0) + incomeTier.payout * m;
      const gain = ENERGY.rewardPerCorrect * m;
      const p = pRef.current;
      p.energy = Math.min(maxEnergy, p.energy + gain);
      toast.success(`+${gain} ${ar ? "طاقة" : "energy"}  ·  +$${incomeTier.payout * m}`);
    } else {
      const cur = me.streak ?? 0;
      newStreak = streakIns.dropBy === null ? 0 : Math.max(0, cur - streakIns.dropBy);
      newCash = Math.floor((me.crypto ?? 0) * (1 - multIns.lossPct / 100));
      const lost = (me.crypto ?? 0) - newCash;
      toast.error(lost > 0 ? (ar ? `خطأ! -$${lost}` : `Wrong! -$${lost}`) : (ar ? "إجابة خاطئة" : "Wrong answer"));
    }

    const updates: any = { total_answers: (me.total_answers ?? 0) + 1, streak: newStreak, crypto: newCash };
    if (correct) updates.correct_answers = (me.correct_answers ?? 0) + 1;
    localWriteAtRef.current = Date.now();
    setMe((prev: any) => ({ ...prev, ...updates }));
    supabase.from("game_students").update(updates).eq("id", me.id).then(undefined, () => {});
    supabase.from("question_responses").insert({
      session_id: sessionId, student_id: me.id, question_id: currentQ.id,
      question_index: 0, answer_index: idx, is_correct: correct,
    }).then(undefined, () => {});

    setTimeout(() => setQSeed(s => s + 1), 900);
  };

  // ── Purchases ─────────────────────────────────────────────────────────────
  const buy = (patch: any, cost: number, label: string) => {
    if (!me || cash < cost || buyingRef.current) return;
    buyingRef.current = true;
    const next = { ...patch, crypto: Math.max(0, cash - cost) };
    localWriteAtRef.current = Date.now();
    setMe((prev: any) => ({ ...prev, ...next }));
    toast.success(label);
    supabase.from("game_students").update(next).eq("id", me.id).then(undefined, () => {});
    setTimeout(() => { buyingRef.current = false; }, 400);
  };

  const activateFeatherFall = () => {
    if (!me || cash < FEATHER_FALL_COST || buyingRef.current) return;
    buyingRef.current = true;
    pRef.current.featherUntil = Date.now() + FEATHER_FALL_MS;
    const remaining = Math.max(0, cash - FEATHER_FALL_COST);
    localWriteAtRef.current = Date.now();
    setMe((prev: any) => ({ ...prev, crypto: remaining }));
    toast.success(ar ? "سقوط الريشة مفعّل!" : "Feather Fall active!");
    supabase.from("game_students").update({ crypto: remaining }).eq("id", me.id).then(undefined, () => {});
    setShowShop(false);
    setTimeout(() => { buyingRef.current = false; }, 400);
  };

  const nextIncome = INCOME_TIERS.find(t => t.level === incomeTier.level + 1);
  const nextStreakIns = STREAK_INSURANCE_TIERS.find(t => t.level === streakIns.level + 1);
  const nextMultIns = MULTIPLIER_INSURANCE_TIERS.find(t => t.level === multIns.level + 1);
  const nextTank = ENERGY_TANK_TIERS.find(t => t.level === energyTank.level + 1);
  const nextBattery = BATTERY_TIERS.find(t => t.level === battery.level + 1);

  const energyPct = Math.max(0, Math.min(100, (hud.energy / maxEnergy) * 100));
  const frozen = hud.energy <= 0;
  const featherLeft = Math.max(0, Math.ceil((hud.featherUntil - now) / 1000));

  // ── Waiting ───────────────────────────────────────────────────────────────
  if (phase === "waiting") {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center"
        style={{ background: "linear-gradient(180deg,#5fc5ef 0%,#8bd9f7 55%,#b6e8fb 100%)", color: "#0f172a" }}>
        <ChevronUp className="h-14 w-14" style={{ color: "#0f172a" }} />
        <div className="px-5 py-4 rounded-2xl shadow-lg" style={{ background: "rgba(255,255,255,0.93)" }}>
          <div className="text-[10px] tracking-[0.4em] uppercase mb-2" style={{ color: "#64748b" }}>
            {ar ? "لا تنظر للأسفل" : "DON'T LOOK DOWN"}
          </div>
          <div className="text-xl font-extrabold">{me?.name ?? "—"}</div>
        </div>
        <p className="text-sm max-w-xs leading-relaxed font-semibold" style={{ color: "#0f3d5c" }}>
          {ar
            ? "أجب على الأسئلة لكسب الطاقة، واستخدم الطاقة للجري والقفز. تسلّق لأعلى نقطة ممكنة."
            : "Answer questions to earn energy. Spend energy running and jumping. Climb as high as you can."}
        </p>
        <div className="text-xs font-bold animate-pulse" style={{ color: "#0f3d5c" }}>
          {ar ? "بانتظار المعلّم..." : "Waiting for the teacher..."}
        </div>
      </div>
    );
  }

  // ── Finished ──────────────────────────────────────────────────────────────
  if (phase === "done") {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center"
        style={{ background: "linear-gradient(180deg,#5fc5ef 0%,#8bd9f7 55%,#b6e8fb 100%)", color: "#0f172a" }}>
        <Trophy className="h-16 w-16" style={{ color: "#f59e0b" }} />
        <div className="text-2xl font-extrabold">{ar ? "انتهى التسلّق" : "Climb Over"}</div>
        <div className="flex gap-3">
          {[
            { label: ar ? "الارتفاع" : "HEIGHT", value: `${Math.round(Math.max(pRef.current.maxHeight, me?.height_reached ?? 0))}m`, color: "#0284c7" },
            { label: ar ? "النقود" : "CASH", value: `$${cash}`, color: "#b45309" },
            { label: ar ? "صحيح" : "CORRECT", value: `${me?.correct_answers ?? 0}`, color: "#15803d" },
          ].map(s => (
            <div key={s.label} className="px-4 py-3 rounded-2xl shadow-md" style={{ background: "rgba(255,255,255,0.93)" }}>
              <div className="text-[9px] tracking-widest font-bold" style={{ color: "#64748b" }}>{s.label}</div>
              <div className="text-2xl font-extrabold tabular-nums" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
        <button onClick={() => navigate("/play")}
          className="mt-3 px-7 py-3 rounded-xl font-extrabold text-sm text-white shadow-lg active:scale-95 transition-transform"
          style={{ background: "#4f46e5" }}>
          {ar ? "خروج" : "EXIT"}
        </button>
      </div>
    );
  }

  // ── Playing ───────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{ background: "#8bd9f7", touchAction: "none" }}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* ── HUD: floating white pills over the sky ── */}
      <div className="absolute inset-x-0 top-0 p-3 pointer-events-none" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2 items-start">
            <div className={PILL} style={PILL_STYLE}>
              <span className="text-sm font-extrabold tabular-nums" style={{ color: "#1e293b" }}>
                {ar ? "الارتفاع" : "Height"}: {Math.max(0, Math.round(hud.height))}m
              </span>
            </div>
            <div className={PILL} style={{ ...PILL_STYLE, minWidth: 152 }}>
              <Zap className="h-3.5 w-3.5 shrink-0" style={{ color: frozen ? "#dc2626" : "#0284c7" }} />
              <div className="flex-1 h-2 overflow-hidden rounded-full" style={{ background: "rgba(15,23,42,0.12)" }}>
                <div className="h-full rounded-full transition-[width] duration-100"
                  style={{ width: `${energyPct}%`, background: frozen ? "#dc2626" : energyPct < 25 ? "#f59e0b" : "#0ea5e9" }} />
              </div>
              <span className="text-[11px] font-extrabold tabular-nums shrink-0"
                style={{ color: frozen ? "#dc2626" : "#0f172a" }}>{Math.round(hud.energy)}</span>
            </div>
            {featherLeft > 0 && (
              <div className={PILL} style={{ ...PILL_STYLE, background: "rgba(14,165,233,0.94)" }}>
                <Feather className="h-3.5 w-3.5" style={{ color: "white" }} />
                <span className="text-xs font-extrabold tabular-nums text-white">{featherLeft}s</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 items-end">
            <div className={PILL} style={PILL_STYLE}>
              <PixelShield className="h-3.5 w-3.5" />
              <span className="text-sm font-extrabold tabular-nums" style={{ color: "#1e293b" }}>${cash}</span>
            </div>
            <div className={PILL} style={PILL_STYLE}>
              <PixelFlame className="h-3.5 w-3.5" />
              <span className="text-sm font-extrabold tabular-nums" style={{ color: streak >= 2 ? "#b45309" : "#475569" }}>
                {streak} ×{mult}
              </span>
            </div>
          </div>
        </div>
      </div>

      {frozen && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center pointer-events-none px-6">
          <div className="px-5 py-3 rounded-2xl text-sm font-extrabold text-center animate-pulse shadow-lg"
            style={{ background: "rgba(220,38,38,0.95)", color: "white" }}>
            {ar ? "لا توجد طاقة — أجب سؤالاً!" : "OUT OF ENERGY — ANSWER A QUESTION!"}
          </div>
        </div>
      )}

      {summited && !frozen && (
        <div className="absolute inset-x-0 top-28 flex justify-center pointer-events-none">
          <div className="px-5 py-2.5 rounded-2xl text-sm font-extrabold shadow-lg"
            style={{ background: "rgba(245,158,11,0.96)", color: "#3b2606" }}>
            {ar ? "وصلت القمة!" : "SUMMIT REACHED!"}
          </div>
        </div>
      )}

      {/* ── Answer Questions (matches the reference's bottom-left CTA) ── */}
      <button onClick={() => { setQSeed(s => s + 1); setShowQuiz(true); }}
        className={cn("absolute left-4 z-10 px-4 py-2.5 rounded-xl text-sm font-extrabold text-white shadow-lg active:scale-95 transition-transform",
          frozen && "animate-pulse")}
        style={{ background: frozen ? "#dc2626" : "#4f46e5", bottom: "calc(env(safe-area-inset-bottom) + 6.5rem)" }}>
        {ar ? "أجب على الأسئلة" : "Answer Questions"}
      </button>

      {/* ── Touch controls ── */}
      <div className="absolute inset-x-0 bottom-0 p-4 flex items-end justify-between gap-3"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <div className="flex gap-2.5">
          {([["arrowleft", ArrowLeft], ["arrowright", ArrowRight]] as const).map(([key, Icon]) => (
            <button key={key}
              onPointerDown={e => { e.preventDefault(); holdKey(key, true); }}
              onPointerUp={() => holdKey(key, false)}
              onPointerLeave={() => holdKey(key, false)}
              onPointerCancel={() => holdKey(key, false)}
              className="h-16 w-16 rounded-2xl flex items-center justify-center shadow-md active:scale-95 transition-transform"
              style={{ background: "rgba(255,255,255,0.92)", color: "#1e293b" }}>
              <Icon className="h-7 w-7" strokeWidth={2.6} />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          <button onClick={() => setShowShop(true)}
            className="h-14 w-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 shadow-md active:scale-95 transition-transform"
            style={{ background: "rgba(255,255,255,0.92)", color: "#1e293b" }}>
            <Store className="h-5 w-5" strokeWidth={2.4} />
            <span className="text-[8px] font-extrabold">{ar ? "متجر" : "SHOP"}</span>
          </button>
          <button
            onPointerDown={e => { e.preventDefault(); holdKey(" ", true); }}
            onPointerUp={() => holdKey(" ", false)}
            onPointerLeave={() => holdKey(" ", false)}
            onPointerCancel={() => holdKey(" ", false)}
            className="h-20 w-20 rounded-2xl flex flex-col items-center justify-center shadow-lg active:scale-95 transition-transform"
            style={{ background: "#4f46e5", color: "white" }}>
            <ArrowUp className="h-8 w-8" strokeWidth={2.8} />
            {hasDoubleJump && <span className="text-[8px] font-extrabold tracking-wider">×2</span>}
          </button>
        </div>
      </div>

      {/* ── Quiz overlay ── */}
      {showQuiz && (
        <div className="absolute inset-0 z-40 flex flex-col" style={{ background: "rgba(8,12,24,0.96)" }}>
          <div className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" style={{ color: "#38bdf8" }} />
              <span className="text-sm font-black tabular-nums" style={{ color: "#7dd3fc" }}>
                {Math.round(hud.energy)}/{maxEnergy}
              </span>
              <span className="text-xs opacity-50" style={{ color: "white" }}>
                +{ENERGY.rewardPerCorrect * mult} {ar ? "لكل إجابة" : "per correct"}
              </span>
            </div>
            <button onClick={() => setShowQuiz(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black"
              style={{ background: "rgba(255,255,255,0.1)", color: "white" }}>
              <X className="h-3.5 w-3.5" />{ar ? "تسلّق" : "CLIMB"}
            </button>
          </div>

          {currentQ && (
            <div className="flex-1 flex flex-col gap-3 p-4 min-h-0 overflow-y-auto">
              <div className="rounded-xl px-4 py-5 shrink-0"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                {currentQ.image_url && (
                  <img src={currentQ.image_url} alt="" className="mx-auto max-h-[22vh] w-auto object-contain mb-3 rounded" />
                )}
                <p className="text-base font-bold leading-snug text-center" style={{ color: "hsl(210 30% 92%)" }}>
                  {currentQ.text}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2.5 flex-1 min-h-0">
                {currentQ.options.map((opt, i) => {
                  const isCorrect = i === currentQ.correct_index;
                  const isPicked = picked === i;
                  const show = picked !== null;
                  let bg = "rgba(255,255,255,0.06)", bd = "rgba(255,255,255,0.14)", col = "hsl(210 30% 88%)";
                  if (show && isCorrect)       { bg = "rgba(34,197,94,0.16)"; bd = "#22c55e"; col = "#86efac"; }
                  else if (show && isPicked)   { bg = "rgba(239,68,68,0.16)"; bd = "#ef4444"; col = "#fca5a5"; }
                  else if (show)               { bg = "rgba(255,255,255,0.03)"; bd = "rgba(255,255,255,0.06)"; col = "rgba(255,255,255,0.3)"; }
                  return (
                    <button key={i} disabled={picked !== null} onClick={() => answer(i)}
                      className="relative rounded-xl px-3 py-4 text-sm font-bold transition-all"
                      style={{ minHeight: 76, background: bg, border: `2px solid ${bd}`, color: col }}>
                      <span className="absolute top-2 left-2.5 text-[9px] font-black opacity-40">{["A","B","C","D"][i]}</span>
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Shop ── */}
      {showShop && (
        <div className="absolute inset-0 z-40 flex items-end sm:items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setShowShop(false)}>
          <div onClick={e => e.stopPropagation()}
            className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-4 max-h-[86vh] overflow-y-auto"
            style={{ background: "#101728", border: "1px solid rgba(255,255,255,0.12)",
                     paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-black tracking-widest" style={{ color: "hsl(210 30% 90%)" }}>
                {ar ? "المتجر" : "SHOP"}
              </span>
              <div className="flex items-center gap-1.5">
                <PixelShield className="h-4 w-4" />
                <span className="font-black tabular-nums text-sm" style={{ color: "hsl(45 76% 64%)" }}>${cash}</span>
              </div>
            </div>

            <div className="flex gap-2 mb-3">
              {(["parkour", "economy"] as ShopTab[]).map(tab => (
                <button key={tab} onClick={() => setShopTab(tab)}
                  className="flex-1 py-2 rounded-lg text-xs font-black transition-all"
                  style={{
                    background: shopTab === tab ? "rgba(56,189,248,0.16)" : "rgba(255,255,255,0.04)",
                    border: `2px solid ${shopTab === tab ? "#38bdf8" : "rgba(255,255,255,0.1)"}`,
                    color: shopTab === tab ? "#7dd3fc" : "rgba(255,255,255,0.45)",
                  }}>
                  {tab === "parkour" ? (ar ? "المهارات" : "PARKOUR") : (ar ? "الاقتصاد" : "ECONOMY")}
                </button>
              ))}
            </div>

            {shopTab === "economy" && (
              <div className="space-y-3">
                <ShopRow ar={ar} labelEn="MONEY PER QUESTION" labelAr="النقود لكل سؤال"
                  current={ar ? incomeTier.nameAr : incomeTier.nameEn}
                  next={nextIncome && { name: ar ? nextIncome.nameAr : nextIncome.nameEn, cost: nextIncome.cost,
                    detail: `$${incomeTier.payout} → $${nextIncome.payout}` }}
                  cash={cash} onBuy={() => nextIncome && buy({ income_tier: nextIncome.level }, nextIncome.cost, ar ? nextIncome.nameAr : nextIncome.nameEn)} />
                <ShopRow ar={ar} labelEn="STREAK INSURANCE" labelAr="تأمين السلسلة"
                  current={ar ? streakIns.nameAr : streakIns.nameEn}
                  next={nextStreakIns && { name: ar ? nextStreakIns.nameAr : nextStreakIns.nameEn, cost: nextStreakIns.cost,
                    detail: ar ? `تفقد ${nextStreakIns.dropBy} فقط` : `drop only ${nextStreakIns.dropBy} on a miss` }}
                  cash={cash} onBuy={() => nextStreakIns && buy({ streak_drain_tier: nextStreakIns.level }, nextStreakIns.cost, ar ? nextStreakIns.nameAr : nextStreakIns.nameEn)} />
                <ShopRow ar={ar} labelEn="MULTIPLIER INSURANCE" labelAr="تأمين المضاعف"
                  current={ar ? multIns.nameAr : multIns.nameEn}
                  next={nextMultIns && { name: ar ? nextMultIns.nameAr : nextMultIns.nameEn, cost: nextMultIns.cost,
                    detail: ar ? `تفقد ${nextMultIns.lossPct}% فقط` : `lose only ${nextMultIns.lossPct}%` }}
                  cash={cash} onBuy={() => nextMultIns && buy({ cash_insurance_tier: nextMultIns.level }, nextMultIns.cost, ar ? nextMultIns.nameAr : nextMultIns.nameEn)} />
              </div>
            )}

            {shopTab === "parkour" && (
              <div className="space-y-3">
                <ShopRow ar={ar} labelEn="ENERGY TANK" labelAr="خزان الطاقة" icon={<Zap className="h-4 w-4" />}
                  current={`${energyTank.maxEnergy}`}
                  next={nextTank && { name: ar ? nextTank.nameAr : nextTank.nameEn, cost: nextTank.cost,
                    detail: `${energyTank.maxEnergy} → ${nextTank.maxEnergy} ${ar ? "طاقة" : "energy"}` }}
                  cash={cash} onBuy={() => nextTank && buy({ energy_tier: nextTank.level }, nextTank.cost, ar ? nextTank.nameAr : nextTank.nameEn)} />

                <ShopRow ar={ar} labelEn="EFFICIENCY BATTERIES" labelAr="بطاريات الكفاءة" icon={<Battery className="h-4 w-4" />}
                  current={ar ? battery.nameAr : battery.nameEn}
                  next={nextBattery && { name: ar ? nextBattery.nameAr : nextBattery.nameEn, cost: nextBattery.cost,
                    detail: ar ? `استهلاك أقل بنسبة ${Math.round((1 - nextBattery.drainMult) * 100)}%` : `${Math.round((1 - nextBattery.drainMult) * 100)}% less energy used` }}
                  cash={cash} onBuy={() => nextBattery && buy({ battery_tier: nextBattery.level }, nextBattery.cost, ar ? nextBattery.nameAr : nextBattery.nameEn)} />

                <div>
                  <div className="flex items-center justify-between px-1 pb-1.5 text-[10px] tracking-widest uppercase"
                    style={{ color: "rgba(255,255,255,0.4)" }}>
                    <span>{ar ? "القفزة المزدوجة" : "DOUBLE JUMP"}</span>
                    {hasDoubleJump && <span style={{ color: "#4ade80" }}>{ar ? "مملوكة" : "OWNED"}</span>}
                  </div>
                  {hasDoubleJump ? (
                    <div className="text-center text-xs py-2" style={{ color: "#4ade80" }}>
                      {ar ? "اقفز مرة أخرى في الهواء" : "Jump again in mid-air"}
                    </div>
                  ) : (
                    <BuyButton ar={ar} cash={cash} cost={DOUBLE_JUMP_COST}
                      name={ar ? "القفزة المزدوجة" : "Double Jump"}
                      detail={ar ? "قفزة إضافية في الهواء" : "one extra jump while airborne"}
                      onBuy={() => buy({ double_jump: true }, DOUBLE_JUMP_COST, ar ? "القفزة المزدوجة!" : "Double Jump unlocked!")} />
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between px-1 pb-1.5 text-[10px] tracking-widest uppercase"
                    style={{ color: "rgba(255,255,255,0.4)" }}>
                    <span>{ar ? "سقوط الريشة" : "FEATHER FALL"}</span>
                    {featherLeft > 0 && <span style={{ color: "#7dd3fc" }}>{featherLeft}s</span>}
                  </div>
                  <BuyButton ar={ar} cash={cash} cost={FEATHER_FALL_COST}
                    name={ar ? "تفعيل" : "Activate"}
                    detail={ar ? `نصف الجاذبية لمدة ${FEATHER_FALL_MS / 1000} ثانية` : `half gravity for ${FEATHER_FALL_MS / 1000}s`}
                    onBuy={activateFeatherFall} />
                </div>
              </div>
            )}

            <button onClick={() => setShowShop(false)}
              className="w-full mt-3 py-2.5 rounded-lg text-xs font-bold"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}>
              {ar ? "إغلاق" : "CLOSE"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Shop building blocks ────────────────────────────────────────────────────
const BuyButton = ({ ar, cash, cost, name, detail, onBuy }: {
  ar: boolean; cash: number; cost: number; name: string; detail: string; onBuy: () => void;
}) => {
  const can = cash >= cost;
  return (
    <button disabled={!can} onClick={onBuy}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-start transition-all"
      style={{
        background: can ? "rgba(56,189,248,0.1)" : "rgba(255,255,255,0.03)",
        border: `2px solid ${can ? "#38bdf8" : "rgba(255,255,255,0.08)"}`,
        color: can ? "hsl(210 30% 90%)" : "rgba(255,255,255,0.3)",
      }}>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold truncate">{name}</div>
        <div className="text-[10px] opacity-70">{detail}</div>
      </div>
      <div className="flex items-center gap-1 shrink-0 font-black tabular-nums text-sm">
        <PixelShield className="h-3.5 w-3.5" />{cost}
      </div>
    </button>
  );
};

const ShopRow = ({ ar, labelEn, labelAr, current, next, cash, onBuy, icon }: {
  ar: boolean; labelEn: string; labelAr: string; current: string;
  next: { name: string; cost: number; detail: string } | undefined | null;
  cash: number; onBuy: () => void; icon?: React.ReactNode;
}) => (
  <div>
    <div className="flex items-center justify-between px-1 pb-1.5 text-[10px] tracking-widest uppercase"
      style={{ color: "rgba(255,255,255,0.4)" }}>
      <span className="flex items-center gap-1.5">{icon}{ar ? labelAr : labelEn}</span>
      <span style={{ color: "#7dd3fc" }}>{current}</span>
    </div>
    {next ? (
      <BuyButton ar={ar} cash={cash} cost={next.cost} name={next.name} detail={next.detail} onBuy={onBuy} />
    ) : (
      <div className="text-center text-xs py-2" style={{ color: "hsl(45 76% 60%)" }}>{ar ? "أقصى مستوى" : "MAX LEVEL"}</div>
    )}
  </div>
);

export default DontLookDownGame;
