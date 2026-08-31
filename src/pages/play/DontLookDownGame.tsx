import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/ui/sonner";
import { Zap, ChevronUp, ArrowUp, ArrowLeft, ArrowRight, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { WORLD, ENERGY, colorFor } from "@/lib/dontLookDown";
import {
  getGenerator, initialSpawn, platformWorldPos, laserActiveAt, distToLaser, seedFromString,
} from "@/lib/dontLookDownLevel";
import {
  drawSky, drawTopFog, drawPlatform, drawGround, drawSpikes, drawLaser, drawCloud, ambientFor,
  drawCharacter, drawNameTag, PLATFORM_DRAW_ABOVE, PLATFORM_DRAW_BELOW,
} from "@/lib/dontLookDownRender";

type Q = { id: string; text: string; options: string[]; correct_index: number; image_url?: string };
type Phase = "waiting" | "playing" | "done";
type Peer = { id: string; name: string; x: number; y: number; face: number; t: number };

const PILL = "flex items-center gap-2 px-3 py-1.5 rounded-full shadow-md pointer-events-none";
const PILL_STYLE: React.CSSProperties = { background: "rgba(255,255,255,0.93)", backdropFilter: "blur(4px)" };
const BOUNCE_VELOCITY = 1350;
const HAZARD_COOLDOWN_MS = 900;
const CRUMBLE_GRACE_MS = 480;
const CRUMBLE_FADE_MS = 380;
const LAND_PULSE_MS = 160;
// Landing on the ground floor far from the start platform would strand you —
// the level only trends rightward, so there's nothing to climb back up
// right there. Snap back to base instead of leaving you stuck.
const FAR_FROM_ORIGIN = 4000;
const BASE_SPAWN = initialSpawn(WORLD.playerW);

interface Props { sessionId: string; studentId: string; }

const DontLookDownGame = ({ sessionId, studentId }: Props) => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();

  const [session, setSession]     = useState<any>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [me, setMe]               = useState<any>(null);
  const [phase, setPhase]         = useState<Phase>("waiting");
  const [showQuiz, setShowQuiz]   = useState(false);
  const [currentQ, setCurrentQ]   = useState<Q | null>(null);
  const [picked, setPicked]       = useState<number | null>(null);
  const [qSeed, setQSeed]         = useState(0);

  // HUD mirrors of the physics state — updated on a throttle, not every frame.
  const [hud, setHud] = useState({ energy: ENERGY.start, height: 0 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keysRef   = useRef<Set<string>>(new Set());
  const peersRef  = useRef<Record<string, Peer>>({});
  const chanRef   = useRef<any>(null);
  const pickedRef = useRef<number | null>(null);
  const localWriteAtRef = useRef(0);
  const meRef     = useRef<any>(null);
  const genRef    = useRef(getGenerator(sessionId));
  const crumbleRef = useRef<Map<string, number>>(new Map());
  const bounceRef  = useRef<Map<string, number>>(new Map());
  const lastHazardAtRef = useRef(0);
  const landedAtRef = useRef(0);
  const blinkSeedRef = useRef(seedFromString(studentId));
  // Debug noclip fly mode — scout the generated level with no gravity/energy/
  // collision. Gated behind ?fly=1 so it never shows up for real students.
  const flyEnabled = new URLSearchParams(window.location.search).get("fly") === "1";
  const flyRef = useRef(false);
  const [flying, setFlying] = useState(false);

  // All mutable per-frame physics state. Deliberately outside React.
  const pRef = useRef({
    x: 0, y: 4, vx: 0, vy: 0,
    grounded: false, usedDoubleJump: false, face: 1,
    energy: ENERGY.start,
    maxHeight: 0,
    camX: 0, camY: 0, camInit: false,
  });

  const settings = session?.settings ?? {};
  const ar = (settings.lang ?? i18n.language) === "ar";

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
        const sp = initialSpawn(WORLD.playerW);
        pRef.current.x = sp.x; pRef.current.y = sp.y;
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
      if (["arrowleft", "arrowright", "arrowup", "arrowdown", " ", "a", "d", "w", "s"].includes(k)) e.preventDefault();
      if (flyEnabled && k === "f" && !e.repeat) {
        flyRef.current = !flyRef.current;
        setFlying(flyRef.current);
      }
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

  const holdKey = (key: string, on: boolean) => {
    if (on) keysRef.current.add(key); else keysRef.current.delete(key);
  };

  // ── Hazards knock you off, they don't teleport you — you just fall, same as missing a jump ──
  const knockback = useCallback((message: string) => {
    const p = pRef.current;
    p.vy = Math.min(p.vy, -500);
    p.vx *= 0.3;
    p.grounded = false;
    toast.error(message);
  }, []);

  // ── Physics + render loop ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const gen = genRef.current;

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let hudAcc = 0;
    let netAcc = 0;
    let dbAcc = 0;
    const STEP = 1 / 120;

    const physics = (dt: number) => {
      const p = pRef.current;
      const nowMs = Date.now();
      const tSec = nowMs / 1000;

      const keys = keysRef.current;
      const left  = keys.has("arrowleft") || keys.has("a");
      const right = keys.has("arrowright") || keys.has("d");
      const jump  = keys.has("arrowup") || keys.has(" ") || keys.has("w");

      if (flyRef.current) {
        const up = jump;
        const down = keys.has("arrowdown") || keys.has("s");
        const FLY_SPEED = 900;
        p.vx = (right ? FLY_SPEED : 0) - (left ? FLY_SPEED : 0);
        p.vy = (up ? FLY_SPEED : 0) - (down ? FLY_SPEED : 0);
        if (left) p.face = -1; else if (right) p.face = 1;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.grounded = false;
        gen.ensureGeneratedTo(p.y);
        if (p.y > p.maxHeight) p.maxHeight = p.y;
        return;
      }

      if (p.energy <= 0) {
        p.energy = 0;
        p.vx = 0; p.vy = 0;
        return;
      }

      if (left && !right) {
        p.vx -= WORLD.moveAccel * dt; p.face = -1;
        p.energy -= ENERGY.moveDrainPerSec * dt;
      } else if (right && !left) {
        p.vx += WORLD.moveAccel * dt; p.face = 1;
        p.energy -= ENERGY.moveDrainPerSec * dt;
      } else {
        const d = WORLD.moveDecel * dt;
        p.vx = p.vx > 0 ? Math.max(0, p.vx - d) : Math.min(0, p.vx + d);
      }
      p.vx = Math.max(-WORLD.maxRunSpeed, Math.min(WORLD.maxRunSpeed, p.vx));

      if (jump && !(p as any).jumpLatch) {
        (p as any).jumpLatch = true;
        const cost = ENERGY.jumpCost;
        if (p.grounded && p.energy >= cost) {
          p.vy = WORLD.jumpVelocity; p.grounded = false; p.usedDoubleJump = false; p.energy -= cost;
        } else if (!p.grounded && !p.usedDoubleJump && p.energy >= cost) {
          p.vy = WORLD.doubleJumpVelocity; p.usedDoubleJump = true; p.energy -= cost;
        }
      } else if (!jump) {
        (p as any).jumpLatch = false;
      }

      p.vy += WORLD.gravity * dt;
      if (p.vy < WORLD.maxFallSpeed) p.vy = WORLD.maxFallSpeed;

      const prevY = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.energy < 0) p.energy = 0;

      gen.ensureGeneratedTo(p.y);

      // One-way platform collision: only land when descending through the top.
      const wasGrounded = p.grounded;
      p.grounded = false;
      if (p.vy <= 0) {
        for (const pl of gen.platforms) {
          if (crumbleRef.current.has(pl.id) && nowMs - crumbleRef.current.get(pl.id)! > CRUMBLE_GRACE_MS + CRUMBLE_FADE_MS) continue;
          const pos = platformWorldPos(pl, tSec);
          const overlapX = p.x + WORLD.playerW > pos.x && p.x < pos.x + pl.w;
          if (!overlapX) continue;
          if (prevY >= pos.y && p.y <= pos.y) {
            p.y = pos.y; p.grounded = true; p.usedDoubleJump = false;
            if (pl.bounce) {
              p.vy = BOUNCE_VELOCITY; p.grounded = false;
              bounceRef.current.set(pl.id, nowMs);
            } else {
              p.vy = 0;
            }
            if (pl.crumble && !crumbleRef.current.has(pl.id)) crumbleRef.current.set(pl.id, nowMs);
            break;
          }
        }
        // The ground floor — an unconditional catch below every platform, so a
        // missed jump just means falling further, never a teleport. The one
        // exception: touching down far from the start platform would strand
        // you with nothing nearby to climb, so that specific landing slides
        // your x back to the origin — you still land ON the ground, same as
        // any other fall, just not stranded thousands of units out.
        if (!p.grounded && p.y <= WORLD.groundY) {
          p.y = WORLD.groundY;
          if (Math.abs(p.x - BASE_SPAWN.x) > FAR_FROM_ORIGIN) {
            p.x = BASE_SPAWN.x;
            toast.success(ar ? "عدت إلى القاعدة!" : "Back to base!");
          }
          p.vy = 0; p.grounded = true; p.usedDoubleJump = false;
        }
      }
      if (p.grounded && !wasGrounded) landedAtRef.current = nowMs;

      // Hazards knock you back into a fall — they don't respawn you either.
      if (nowMs - lastHazardAtRef.current > HAZARD_COOLDOWN_MS) {
        const cxp = p.x + WORLD.playerW / 2, cyp = p.y + WORLD.playerH / 2;
        for (const hz of gen.hazards) {
          const hzY = hz.kind === "spikes" ? hz.y : Math.min(hz.y1, hz.y2);
          if (hzY < p.y - 400 || hzY > p.y + 900) continue;
          let hit = false;
          if (hz.kind === "spikes") {
            hit = cxp > hz.x - hz.w * 0.1 && cxp < hz.x + hz.w * 1.1 && p.y < hz.y + 20 && p.y > hz.y - 30;
          } else if (laserActiveAt(hz, tSec)) {
            hit = distToLaser(hz, cxp, cyp) < 16;
          }
          if (hit) {
            lastHazardAtRef.current = nowMs;
            knockback(hz.kind === "spikes" ? (ar ? "أصابتك الأشواك!" : "Ouch — spikes!") : (ar ? "أصابك الليزر!" : "Zapped by the laser!"));
            break;
          }
        }
      }

      if (p.y > p.maxHeight) p.maxHeight = p.y;
    };

    const draw = () => {
      const p = pRef.current;
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
      if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
        canvas.width = cssW * dpr; canvas.height = cssH * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const targetCamX = p.x + WORLD.playerW / 2 - cssW / 2;
      const targetCamY = p.y - cssH * 0.38;
      if (!p.camInit) { p.camX = targetCamX; p.camY = targetCamY; p.camInit = true; }
      p.camX += (targetCamX - p.camX) * 0.12;
      p.camY += (targetCamY - p.camY) * 0.12;

      const sx = (wx: number) => wx - p.camX;
      const sy = (wy: number) => cssH - (wy - p.camY);
      const tSec = Date.now() / 1000;

      const gen = genRef.current;
      drawSky(ctx, cssW, cssH, p.y);

      // Ambient clouds for every band currently in view
      const viewTop = p.camY - 100, viewBottom = p.camY + cssH + 100;
      for (const band of gen.bands) {
        if (band.endY < viewTop || band.startY > viewBottom) continue;
        for (const part of ambientFor(band)) {
          if (part.y < viewTop || part.y > viewBottom) continue;
          const px = part.x - p.camX * part.depth;
          const py = cssH - (part.y - p.camY * part.depth);
          if (px < -220 || px > cssW + 220 || py < -160 || py > cssH + 160) continue;
          ctx.globalAlpha = 0.5 + part.depth * 0.5;
          drawCloud(ctx, px, py, part.s);
        }
      }
      ctx.globalAlpha = 1;

      // Ground floor — drawn before platforms so it sits behind them
      const groundScreenY = sy(WORLD.groundY);
      if (groundScreenY < cssH + 100) drawGround(ctx, groundScreenY, cssW, cssH);

      // Platforms
      for (const pl of gen.platforms) {
        const pos = platformWorldPos(pl, tSec);
        const x = sx(pos.x), y = sy(pos.y);
        if (x + pl.w < -60 || x > cssW + 60) continue;
        if (y + PLATFORM_DRAW_BELOW < -40) continue;
        if (y - PLATFORM_DRAW_ABOVE > cssH + 40) continue;
        const crumbleAt = crumbleRef.current.get(pl.id);
        const crumbleT = crumbleAt ? Math.max(0, Math.min(1, (Date.now() - crumbleAt - CRUMBLE_GRACE_MS) / CRUMBLE_FADE_MS)) : 0;
        const bounceAt = bounceRef.current.get(pl.id);
        const bounceT = bounceAt ? Math.max(0, 1 - (Date.now() - bounceAt) / 260) : 0;
        drawPlatform(ctx, x, y, pl.w, { crumbleT, bounceT, t: tSec });
      }

      // Hazards
      for (const hz of gen.hazards) {
        if (hz.kind === "spikes") {
          const x = sx(hz.x), y = sy(hz.y);
          if (x < -60 || x > cssW + 60 || y < -60 || y > cssH + 60) continue;
          drawSpikes(ctx, x, y, hz.w);
        } else {
          const x1 = sx(hz.x1), y1 = sy(hz.y1), x2 = sx(hz.x2), y2 = sy(hz.y2);
          if (Math.max(x1, x2) < -60 || Math.min(x1, x2) > cssW + 60) continue;
          drawLaser(ctx, x1, y1, x2, y2, laserActiveAt(hz, tSec), tSec);
        }
      }

      // Other climbers
      const cutoff = Date.now() - 5000;
      for (const id of Object.keys(peersRef.current)) {
        const peer = peersRef.current[id];
        if (peer.t < cutoff) { delete peersRef.current[id]; continue; }
        const x = sx(peer.x), y = sy(peer.y);
        if (x < -80 || x > cssW + 80 || y < -80 || y > cssH + 80) continue;
        drawCharacter(ctx, x, y, WORLD.playerW, WORLD.playerH, colorFor(id), peer.face ?? 1,
          { t: tSec, alpha: 0.7, grounded: true, blinkSeed: seedFromString(id) });
        drawNameTag(ctx, x + WORLD.playerW / 2, y + 3, peer.name ?? "");
      }

      // Self
      const px = sx(p.x), py = sy(p.y);
      const frozen = p.energy <= 0;
      const landPulse = Math.max(0, 1 - (Date.now() - landedAtRef.current) / LAND_PULSE_MS);
      drawCharacter(ctx, px, py, WORLD.playerW, WORLD.playerH, colorFor(studentId), p.face, {
        t: tSec, grounded: p.grounded, vx: p.vx, vy: p.vy, landPulse, frozen, blinkSeed: blinkSeedRef.current,
      });
      drawNameTag(ctx, px + WORLD.playerW / 2, py + 3, meRef.current?.name ?? "");

      drawTopFog(ctx, cssW, cssH, p.y);
    };

    const frame = (t: number) => {
      let dt = (t - last) / 1000;
      last = t;
      if (dt > 0.25) dt = 0.25;
      acc += dt; hudAcc += dt; netAcc += dt; dbAcc += dt;

      while (acc >= STEP) { physics(STEP); acc -= STEP; }
      draw();

      if (hudAcc >= 0.08) {
        hudAcc = 0;
        const p = pRef.current;
        setHud({ energy: p.energy, height: p.y });
      }
      if (netAcc >= 0.066) {
        netAcc = 0;
        const p = pRef.current;
        chanRef.current?.send({
          type: "broadcast", event: "pos",
          payload: { id: studentId, name: meRef.current?.name ?? "", x: Math.round(p.x), y: Math.round(p.y), face: p.face },
        });
      }
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
  }, [phase, studentId, ar, knockback]);

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

    if (correct) {
      const gain = ENERGY.rewardPerCorrect;
      pRef.current.energy += gain;
      toast.success(`+${gain} ${ar ? "طاقة" : "energy"}`);
    } else {
      toast.error(ar ? "إجابة خاطئة" : "Wrong answer");
    }

    const updates: any = { total_answers: (me.total_answers ?? 0) + 1 };
    if (correct) updates.correct_answers = (me.correct_answers ?? 0) + 1;
    localWriteAtRef.current = Date.now();
    setMe((prev: any) => ({ ...prev, ...updates }));
    supabase.rpc("dld_apply_answer", { p_student_id: me.id, p_correct: correct }).then(undefined, () => {});
    supabase.from("question_responses").insert({
      session_id: sessionId, student_id: me.id, question_id: currentQ.id,
      question_index: 0, answer_index: idx, is_correct: correct,
    }).then(undefined, () => {});

    setTimeout(() => setQSeed(s => s + 1), 900);
  };

  const energyPct = Math.max(6, Math.min(100, (hud.energy / 200) * 100));
  const frozen = hud.energy <= 0;

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
            {flying && (
              <div className={PILL} style={{ ...PILL_STYLE, background: "rgba(79,70,229,0.94)" }}>
                <span className="text-xs font-extrabold tracking-widest text-white">
                  {ar ? "وضع الطيران" : "FLY MODE"} — F {ar ? "للإيقاف" : "to exit"}
                </span>
              </div>
            )}
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

      {/* ── Answer Questions ── */}
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

        <button
          onPointerDown={e => { e.preventDefault(); holdKey(" ", true); }}
          onPointerUp={() => holdKey(" ", false)}
          onPointerLeave={() => holdKey(" ", false)}
          onPointerCancel={() => holdKey(" ", false)}
          className="h-20 w-20 rounded-2xl flex flex-col items-center justify-center shadow-lg active:scale-95 transition-transform"
          style={{ background: "#4f46e5", color: "white" }}>
          <ArrowUp className="h-8 w-8" strokeWidth={2.8} />
          <span className="text-[8px] font-extrabold tracking-wider">×2</span>
        </button>
      </div>

      {/* ── Quiz overlay ── */}
      {showQuiz && (
        <div className="absolute inset-0 z-40 flex flex-col" style={{ background: "rgba(8,12,24,0.96)" }}>
          <div className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" style={{ color: "#38bdf8" }} />
              <span className="text-sm font-black tabular-nums" style={{ color: "#7dd3fc" }}>
                {Math.round(hud.energy)}
              </span>
              <span className="text-xs opacity-50" style={{ color: "white" }}>
                +{ENERGY.rewardPerCorrect} {ar ? "لكل إجابة" : "per correct"}
              </span>
            </div>
            <button onClick={() => setShowQuiz(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black"
              style={{ background: "rgba(255,255,255,0.1)", color: "white" }}>
              {ar ? "تسلّق" : "CLIMB"}
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
    </div>
  );
};

export default DontLookDownGame;
