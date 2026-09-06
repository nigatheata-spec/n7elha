import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/ui/sonner";
import { Store, X, ChevronUp, Zap, Battery, Feather, ArrowUp, ArrowLeft, ArrowRight, Trophy, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { PixelShield } from "@/components/PixelIcons";
import { Avatar } from "@/components/Avatar";
import {
  WORLD, ENERGY, toMetres, streakMultiplier,
  INCOME_TIERS, STREAK_INSURANCE_TIERS, MULTIPLIER_INSURANCE_TIERS,
  ENERGY_TANK_TIERS, BATTERY_TIERS,
  DOUBLE_JUMP_COST, FEATHER_FALL_COST, FEATHER_FALL_MS, FEATHER_FALL_GRAVITY_SCALE,
  buildClimb, groundSpawn,
} from "@/lib/dontLookDown";
import {
  setupPixelCanvas, setupOverlayCanvas, drawSky, drawStars, drawCloud, drawBlock,
  drawCharacter, drawNameTag, drawScenery, drawTopFog, drawGround, drawPlatform, drawHint, forEachCloud,
} from "@/lib/dontLookDownRender";
import { PX, themeBlendAt, themeIndexAt, starAlphaAt, THEMES, STARRY_FROM } from "@/lib/dldLevel";
import { artH } from "@/lib/dldArt";
import { readSettings } from "@/lib/sessionSettings";

type Q = { id: string; text: string; options: string[]; correct_index: number; image_url?: string };
type Phase = "waiting" | "playing" | "done";
type ShopTab = "economy" | "parkour";
type Peer = { id: string; name: string; x: number; y: number; face: number; t: number; avatarColor?: number | null; avatarFace?: number | null };

// Floating white HUD chip, matching the reference's rounded pills over the sky.
/* HUD chips are slabs, not soft pills: hard 2px outline and an offset shadow,
   so they sit in the pixel world instead of floating over it. */
const PILL = "flex items-center gap-2 px-2.5 py-1 pointer-events-none";
const PILL_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.94)",
  border: "2px solid #12151f",
  boxShadow: "0 3px 0 0 rgba(18,21,31,0.5)",
};

/* Every control is the same slab: hard outline, lit top edge, offset shadow. */
const CTRL: React.CSSProperties = {
  border: `2px solid ${"#12151f"}`,
  borderTopWidth: 4,
  borderTopColor: "rgba(255,255,255,0.75)",
  boxShadow: "0 5px 0 0 #12151f",
};
/** Clamped against the short axis, so landscape shrinks rather than crowds. */
const CTRL_D = "clamp(3.6rem, 17.5vmin, 4.75rem)";
const JUMP_D = "clamp(4.4rem, 21vmin, 5.75rem)";

/* The jump button is the primary action, so it takes the gold the in-world
   signs use. Nothing in this world is purple. */
const GOLD = "#ffc94d";
const INK = "#12151f";

interface Props { sessionId: string; studentId: string; }

/* The quiz screen borrows the top band's sky ramp and a sparse star field, so
   answering reads as a pause inside the climb rather than a different screen. */
/* Fixed rather than random per render, so the burst does not reshuffle itself
   on every frame the celebration is on screen. */
const CONFETTI = Array.from({ length: 34 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  color: ["#ffd876", "#7fe0a2", "#7dd3fc", "#f87171", "#ffffff"][i % 5],
  dur: `${1.7 + ((i * 13) % 16) / 10}s`,
  delay: `${((i * 7) % 20) / 10}s`,
}));

const DLD_SKY = "linear-gradient(180deg,#05060f 0%,#0a0c1d 34%,#11142f 68%,#191d44 100%)";
const DLD_STARS = [
  ["12%", "14%"], ["31%", "7%"], ["58%", "18%"], ["77%", "9%"], ["91%", "24%"],
  ["7%", "38%"], ["44%", "31%"], ["68%", "44%"], ["23%", "56%"], ["86%", "52%"],
  ["37%", "71%"], ["61%", "82%"], ["15%", "88%"], ["94%", "77%"],
].map(([x, y]) => `radial-gradient(1px 1px at ${x} ${y}, rgba(255,255,255,0.75) 50%, transparent 50%)`).join(",");

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
  const [showSummit, setShowSummit] = useState(false);

  // HUD mirrors of the physics state — updated on a throttle, not every frame,
  // so the 60fps loop never triggers a React render.
  const [hud, setHud] = useState({ energy: ENERGY.start, grounded: false, featherUntil: 0, height: 0 });
  const [now, setNow] = useState(Date.now());

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
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
  // Built from the session's length: a five minute round gets a climb you can
  // finish, a twenty minute one gets four times as much of it.
  const climb = useMemo(() => buildClimb(settings.minutes ?? 5), [settings.minutes]);
  const climbRef = useRef(climb);
  climbRef.current = climb;
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
        // Built straight from the session that just loaded rather than from the
        // ref, which is still holding the placeholder climb until React rerenders.
        const sp = groundSpawn(buildClimb(readSettings(s?.settings).minutes ?? 5));
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
      navigate("/join");
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

  // There is deliberately no void and no checkpoint respawn: if you fall you
  // land back on the grass and climb again. Losing the height IS the cost.

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
        const plats = climbRef.current.platforms;
        for (let i = 0; i < plats.length; i++) {
          const pl = plats[i];
          const overlapX = p.x + WORLD.playerW > pl.x && p.x < pl.x + pl.w;
          if (!overlapX) continue;
          if (prevY >= pl.y && p.y <= pl.y) {
            p.y = pl.y; p.vy = 0; p.grounded = true; p.usedDoubleJump = false;
            if (pl.y >= climbRef.current.summitY && !summitRef.current) {
              summitRef.current = true;
              setShowSummit(true);
            }
            break;
          }
        }
      }

      // The grass is solid, unlike the one-way blocks — you never pass through
      // it, you just walk on it and start climbing again.
      if (p.y <= climbRef.current.groundY) {
        p.y = climbRef.current.groundY;
        if (p.vy < 0) p.vy = 0;
        p.grounded = true;
        p.usedDoubleJump = false;
      }

      if (p.y > p.maxHeight) p.maxHeight = p.y;
    };

    const draw = () => {
      const p = pRef.current;
      // The whole scene is painted into a small pixel buffer; CSS scales it up
      // with nearest-neighbour so every layer shares one pixel grid.
      const { ctx: bctx, bw, bh, zoom } = setupPixelCanvas(canvas);
      if (!bctx) return;
      // Faces, names and hint signs go on the sharp layer; everything else
      // stays on the pixel grid.
      const octx = overlayRef.current
        ? setupOverlayCanvas(overlayRef.current, bw, bh, zoom).ctx
        : null;
      const sharp = octx ?? bctx;

      // Camera in world units, player centred horizontally and sitting low so
      // there is more sky than floor on screen.
      const viewW = bw / PX, viewH = bh / PX;
      const targetCamX = p.x + WORLD.playerW / 2 - viewW / 2;
      const targetCamY = p.y - viewH * 0.38;
      if (!p.camInit) { p.camX = targetCamX; p.camY = targetCamY; p.camInit = true; }
      p.camX += (targetCamX - p.camX) * 0.12;
      p.camY += (targetCamY - p.camY) * 0.12;

      // Snap to whole buffer pixels — a fractional camera makes a pixel scene
      // shimmer as it scrolls.
      const camBX = Math.round(p.camX * PX);
      const camBY = Math.round(p.camY * PX);
      const sx = (wx: number) => Math.round(wx * PX) - camBX;
      const sy = (wy: number) => bh - (Math.round(wy * PX) - camBY);

      const blend = themeBlendAt(climbRef.current, p.y);
      drawSky(bctx, bw, bh, blend);

      // Stars fade in as the city dusk gives way to orbit.
      const ti = themeIndexAt(climbRef.current, p.y);
      const starAlpha = starAlphaAt(climbRef.current, p.y);
      drawStars(bctx, bw, bh, p.camX * PX, p.camY * PX, starAlpha);

      // Parallax clouds — thinner out in orbit.
      const cloudAlpha = ti > STARRY_FROM ? 0 : 1;
      if (cloudAlpha > 0) {
        forEachCloud(camBX, camBY, bw, bh, (px, py, c) => {
          bctx.globalAlpha = (0.55 + c.depth * 0.45) * cloudAlpha;
          drawCloud(bctx, px, py, c.s);
        });
        bctx.globalAlpha = 1;
      }

      // Solid ground under the starting platform, then the void below it.
      // Ground sits just under the starting block's base so the first platform
      // reads as standing on it rather than sunk into it.
      const groundTop = sy(climbRef.current.groundY);
      if (groundTop < bh) drawGround(bctx, groundTop, bw, bh);

      // Blocks
      // Scenery behind the platforms: buildings, and the black hole over the top.
      for (const p of climbRef.current.scenery) {
        if (!p.back) continue;
        const px = sx(p.x), py = sy(p.y);
        if (px < -420 || px > bw + 420 || py < -420 || py > bh + 420) continue;
        drawScenery(bctx, px, py, p.id, 0.85);
      }

      for (const pl of climbRef.current.platforms) {
        const x = sx(pl.x), y = sy(pl.y);
        const wpx = Math.round(pl.w * PX), hpx = Math.round(pl.h * PX);
        if (x + wpx < -8 || x > bw + 8) continue;
        if (y > bh + 8 || y + hpx < -8) continue;
        drawPlatform(bctx, x, y, pl.sprites);
      }

      // Signs along the starting ground — what the controls are, and which way
      // is up — so the first thing a player meets is not a blind jump.
      // Scenery in front: street furniture lining the trail.
      for (const p of climbRef.current.scenery) {
        if (p.back) continue;
        const px = sx(p.x), py = sy(p.y);
        if (px < -120 || px > bw + 120 || py < -120 || py > bh + 120) continue;
        drawScenery(bctx, px, py, p.id);
      }

      for (const hint of climbRef.current.hints) {
        const x = sx(hint.x), y = sy(hint.y);
        if (x < -80 || x > bw + 80 || y < -20 || y > bh + 20) continue;
        drawHint(sharp, x, y, ar ? hint.ar : hint.en);
      }

      // Other climbers
      const cutoff = Date.now() - 5000;
      const tSec = Date.now() / 1000;
      for (const id of Object.keys(peersRef.current)) {
        const peer = peersRef.current[id];
        if (peer.t < cutoff) { delete peersRef.current[id]; continue; }
        const x = sx(peer.x), y = sy(peer.y);
        if (x < -30 || x > bw + 30 || y < -30 || y > bh + 30) continue;
        drawCharacter(sharp, x, y, WORLD.playerW * PX, WORLD.playerH * PX, peer.name ?? "?", (peer.face ?? 1) as 1 | -1, {
          t: tSec, alpha: 0.75, grounded: true, colorIndex: peer.avatarColor, faceIndex: peer.avatarFace,
        });
        drawNameTag(sharp, x + (WORLD.playerW * PX) / 2, y - 22, peer.name ?? "");
      }

      // Self
      const pxs = sx(p.x), pys = sy(p.y);
      const frozen = p.energy <= 0;
      if (Date.now() < p.featherUntil) {
        // glide aura, as a chunky ring rather than a soft ellipse
        bctx.fillStyle = "rgba(255,255,255,0.5)";
        bctx.fillRect(pxs - 3, pys - 26, WORLD.playerW * PX + 6, 1);
        bctx.fillRect(pxs - 4, pys - 14, 1, 12);
        bctx.fillRect(pxs + WORLD.playerW * PX + 3, pys - 14, 1, 12);
      }
      drawCharacter(sharp, pxs, pys, WORLD.playerW * PX, WORLD.playerH * PX, meRef.current?.name ?? "?", p.face as 1 | -1, {
        t: tSec, vx: p.vx, grounded: p.grounded, frozen,
        colorIndex: meRef.current?.avatar_color, faceIndex: meRef.current?.avatar_face,
      });
      drawNameTag(sharp, pxs + (WORLD.playerW * PX) / 2, pys - 22, meRef.current?.name ?? "");

      // Last, so it hazes the blocks rather than sitting behind them.
      drawTopFog(bctx, bw, bh, blend);
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
          payload: {
            id: studentId, name: meRef.current?.name ?? "", x: Math.round(p.x), y: Math.round(p.y), face: p.face,
            avatarColor: meRef.current?.avatar_color, avatarFace: meRef.current?.avatar_face,
          },
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
  }, [phase, studentId, ar]);

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

    let newStreak: number, newCash: number, cashDelta = 0;
    if (correct) {
      newStreak = (me.streak ?? 0) + 1;
      const m = streakMultiplier(newStreak);
      cashDelta = incomeTier.payout * m;
      newCash = (me.crypto ?? 0) + cashDelta;
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
    // Atomic (dld_apply_answer migration): the physics loop keeps running under
    // the overlays, so this can't clobber a concurrent write.
    supabase.rpc("dld_apply_answer", {
      p_student_id: me.id, p_correct: correct,
      p_drop_by: streakIns.dropBy, p_cash_delta: cashDelta, p_loss_pct: multIns.lossPct,
    }).then(undefined, () => {});
    supabase.from("question_responses").insert({
      session_id: sessionId, student_id: me.id, question_id: currentQ.id,
      question_index: 0, answer_index: idx, is_correct: correct,
    }).then(undefined, () => {});

    setTimeout(() => setQSeed(s => s + 1), 900);
  };

  // ── Purchases ─────────────────────────────────────────────────────────────
  // Atomic + affordability-checked server-side (dld_spend migration): the
  // local `cash < cost` guard below can pass on a stale balance (a void fall
  // or a wrong answer can land between render and tap), so the DB re-checks
  // at write time and returns no rows if it's no longer affordable.
  const buy = (patch: any, cost: number, label: string) => {
    if (!me || cash < cost || buyingRef.current) return;
    buyingRef.current = true;
    const next = { ...patch, crypto: Math.max(0, cash - cost) };
    localWriteAtRef.current = Date.now();
    setMe((prev: any) => ({ ...prev, ...next }));
    toast.success(label);
    supabase.rpc("dld_spend", {
      p_student_id: me.id, p_cost: cost,
      p_income_tier: patch.income_tier ?? null,
      p_streak_drain_tier: patch.streak_drain_tier ?? null,
      p_cash_insurance_tier: patch.cash_insurance_tier ?? null,
      p_energy_tier: patch.energy_tier ?? null,
      p_battery_tier: patch.battery_tier ?? null,
      p_double_jump: patch.double_jump ?? null,
    }).then(({ data, error }: any) => {
      if (!error && (!data || data.length === 0)) toast.error(ar ? "لم تعد تملك ما يكفي" : "No longer affordable");
    }, () => {});
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
    supabase.rpc("dld_spend", { p_student_id: me.id, p_cost: FEATHER_FALL_COST }).then(({ data, error }: any) => {
      if (!error && (!data || data.length === 0)) toast.error(ar ? "لم تعد تملك ما يكفي" : "No longer affordable");
    }, () => {});
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
  // Warned before committing to a jump, rather than after falling off one.
  const lowEnergy = !frozen && hud.energy <= ENERGY.low;
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
            { label: ar ? "الارتفاع" : "HEIGHT", value: `${toMetres(Math.max(pRef.current.maxHeight, me?.height_reached ?? 0))}m`, color: "#0284c7" },
            { label: ar ? "النقود" : "CASH", value: `$${cash}`, color: "#b45309" },
            { label: ar ? "صحيح" : "CORRECT", value: `${me?.correct_answers ?? 0}`, color: "#15803d" },
          ].map(s => (
            <div key={s.label} className="px-4 py-3 rounded-2xl shadow-md" style={{ background: "rgba(255,255,255,0.93)" }}>
              <div className="text-[9px] tracking-widest font-bold" style={{ color: "#64748b" }}>{s.label}</div>
              <div className="text-2xl font-extrabold tabular-nums" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
        <button onClick={() => navigate("/join")}
          className="mt-3 px-7 py-3 text-sm font-black active:translate-y-[3px] transition-transform"
          style={{ ...CTRL, background: GOLD, color: "#3b2606", borderTopColor: "#ffe9a8" }}>
          {ar ? "خروج" : "EXIT"}
        </button>
      </div>
    );
  }

  // ── Playing ───────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{ background: "#8bd9f7", touchAction: "none" }}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ imageRendering: "pixelated" }} />
      <canvas ref={overlayRef} className="absolute inset-0 h-full w-full pointer-events-none" />

      {/* ── HUD: floating white pills over the sky ── */}
      <div className="absolute inset-x-0 top-0 p-3 pointer-events-none" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2 items-start">
            <div className={PILL} style={PILL_STYLE}>
              <span className="text-base font-black tabular-nums" style={{ color: "#1e293b" }}>
                {toMetres(hud.height)}m
              </span>
            </div>
            <div className={cn(PILL, lowEnergy && "animate-pulse")} style={{ ...PILL_STYLE, minWidth: 152 }}>
              <Zap className="h-3.5 w-3.5 shrink-0" style={{ color: frozen ? "#dc2626" : lowEnergy ? "#b45309" : "#0284c7" }} />
              <div className="flex-1 h-2 overflow-hidden" style={{ background: "rgba(15,23,42,0.14)" }}>
                <div className="h-full transition-[width] duration-100"
                  style={{ width: `${energyPct}%`, background: frozen ? "#dc2626" : lowEnergy ? "#f59e0b" : "#0ea5e9" }} />
              </div>
              <span className="text-[11px] font-extrabold tabular-nums shrink-0"
                style={{ color: frozen ? "#dc2626" : lowEnergy ? "#b45309" : "#0f172a" }}>{Math.round(hud.energy)}</span>
            </div>
            {featherLeft > 0 && (
              <div className={PILL} style={{ ...PILL_STYLE, background: "#0ea5e9" }}>
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

      {lowEnergy && (
        <div className="absolute inset-x-0 z-10 flex justify-center pointer-events-none px-6"
          style={{ top: "calc(max(0.75rem, env(safe-area-inset-top)) + 5.5rem)" }}>
          <div className="flex items-center gap-2 px-4 py-2 text-xs font-black animate-pulse"
            style={{ background: "#f59e0b", color: "#3b2606", border: "2px solid #12151f", borderTopWidth: 4, borderTopColor: "#ffe9a8", boxShadow: "0 4px 0 0 #12151f" }}>
            <Zap className="h-3.5 w-3.5" />
            {ar ? "طاقة منخفضة" : "LOW ENERGY"}
          </div>
        </div>
      )}

      {showSummit && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden select-none"
          style={{ background: "rgba(5,6,15,0.86)" }}
          onClick={() => setShowSummit(false)}>
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[160vmax] w-[160vmax] -translate-x-1/2 -translate-y-1/2 animate-dld-summit-rays"
            style={{ background: "conic-gradient(from 0deg, rgba(255,216,118,0.16) 0 6deg, transparent 6deg 30deg)" }} />

          {CONFETTI.map((c, i) => (
            <span key={i} aria-hidden
              className="pointer-events-none absolute top-0 h-2.5 w-2.5 animate-dld-confetti"
              style={{ left: c.left, background: c.color, animationDuration: c.dur, animationDelay: c.delay }} />
          ))}

          <div className="relative flex flex-col items-center animate-dld-summit-pop">
            <Avatar name={meRef.current?.name ?? "?"} size="xl"
              colorIndex={meRef.current?.avatar_color} faceIndex={meRef.current?.avatar_face} />
            <Trophy className="h-8 w-8 mt-4" style={{ color: "#ffd876" }} />
            <div className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-center" style={{ color: "#ffd876" }}>
              {ar ? "وصلت القمة!" : "SUMMIT REACHED!"}
            </div>
            <div className="mt-3 px-5 py-2 text-lg font-black tabular-nums"
              style={{ background: "#2f3646", color: "#dce4f0", border: "2px solid #12151f", borderTopWidth: 4, borderTopColor: "#7fe0a2", boxShadow: "0 5px 0 0 #12151f" }}>
              {toMetres(hud.height)}m
            </div>
            <p className="mt-6 text-xs font-bold" style={{ color: "rgba(220,228,240,0.6)" }}>
              {ar ? "المس للمتابعة" : "TAP TO KEEP CLIMBING"}
            </p>
          </div>
        </div>
      )}

      {/* ── Controls ────────────────────────────────────────────────────────
          dir="ltr" is load-bearing: the site runs RTL, which was mirroring the
          control bar so move and jump swapped sides between screens. Movement
          is always left, jump is always right. Sizes are in vmin so landscape,
          where height is the scarce axis, shrinks them instead of cramping. */}
      <div dir="ltr" className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 p-4"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <div className="flex items-end gap-4">
          {([["arrowleft", ArrowLeft], ["arrowright", ArrowRight]] as const).map(([key, Icon]) => (
            <button key={key}
              onPointerDown={e => { e.preventDefault(); holdKey(key, true); }}
              onPointerUp={() => holdKey(key, false)}
              onPointerLeave={() => holdKey(key, false)}
              onPointerCancel={() => holdKey(key, false)}
              className="flex items-center justify-center active:translate-y-[3px] transition-transform"
              style={{ ...CTRL, width: CTRL_D, height: CTRL_D, background: "#f4f8fb", color: "#1e293b" }}>
              <Icon style={{ width: "45%", height: "45%" }} strokeWidth={2.6} />
            </button>
          ))}
        </div>

        <div className="flex items-end gap-4">
          <button onClick={() => setShowShop(true)}
            className="flex flex-col items-center justify-center gap-0.5 active:translate-y-[3px] transition-transform"
            style={{ ...CTRL, width: CTRL_D, height: CTRL_D, background: "#f4f8fb", color: "#1e293b" }}>
            <Store style={{ width: "34%", height: "34%" }} strokeWidth={2.4} />
            <span className="text-[9px] font-black">{ar ? "متجر" : "SHOP"}</span>
          </button>
          <button
            onPointerDown={e => { e.preventDefault(); holdKey(" ", true); }}
            onPointerUp={() => holdKey(" ", false)}
            onPointerLeave={() => holdKey(" ", false)}
            onPointerCancel={() => holdKey(" ", false)}
            className="flex flex-col items-center justify-center active:translate-y-[3px] transition-transform"
            style={{ ...CTRL, width: JUMP_D, height: JUMP_D, background: GOLD, color: "#3b2606", borderTopColor: "#ffe9a8" }}>
            <ArrowUp style={{ width: "44%", height: "44%" }} strokeWidth={2.8} />
            {hasDoubleJump && <span className="text-[9px] font-black tracking-wider">x2</span>}
          </button>
        </div>
      </div>

      {/* Sits directly above the movement pad, on the same side, so the two
          things a thumb reaches for are never on opposite edges. */}
      <button dir="ltr" onClick={() => { setQSeed(s => s + 1); setShowQuiz(true); }}
        className={cn("absolute left-4 z-10 px-4 py-2.5 text-sm font-black active:translate-y-[3px] transition-transform",
          frozen && "animate-pulse")}
        style={{
          ...CTRL,
          background: frozen ? "#dc2626" : "#12203a",
          color: frozen ? "#ffffff" : "#ffd876",
          borderTopColor: frozen ? "#fca5a5" : "#3d4560",
          bottom: `calc(env(safe-area-inset-bottom) + 1rem + ${CTRL_D} + 0.75rem)`,
        }}>
        {ar ? "أجب على الأسئلة" : "Answer Questions"}
      </button>

      {/* ── Quiz overlay ── */}
      {/* ── Questions ──────────────────────────────────────────────────────
          Dressed as part of the climb rather than as a generic quiz sheet: the
          night sky the player is climbing through, the question on a slab like
          the hint signs in the world, and each answer built as a platform with
          a lit top edge that settles under you when you press it. */}
      {showQuiz && (
        <div className="absolute inset-0 z-40 flex flex-col" style={{ background: DLD_SKY }}>
          <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: DLD_STARS }} />

          <div className="relative flex items-center justify-between px-4 py-3 shrink-0"
            style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", borderBottom: "2px solid rgba(125,211,252,0.16)" }}>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" style={{ color: "#38bdf8" }} />
              <span className="text-sm font-black tabular-nums" style={{ color: "#7dd3fc" }}>
                {Math.round(hud.energy)}/{maxEnergy}
              </span>
              <span className="text-xs font-bold" style={{ color: "#ffd876" }}>
                +{ENERGY.rewardPerCorrect * mult} {ar ? "لكل إجابة" : "per correct"}
              </span>
            </div>
            <button onClick={() => setShowQuiz(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black active:translate-y-[2px] transition-transform"
              style={{ background: "#2f3646", color: "#dce4f0", border: "2px solid #12151f", borderTopColor: "#98a3b5", boxShadow: "0 3px 0 0 #12151f" }}>
              <X className="h-3.5 w-3.5" />{ar ? "تسلّق" : "CLIMB"}
            </button>
          </div>

          {currentQ && (
            <div className="relative flex-1 flex flex-col gap-4 p-4 min-h-0 overflow-y-auto">
              {/* The question, on a sign like the ones staked into the level */}
              <div className="shrink-0 px-4 py-4"
                style={{ background: "rgba(12,16,26,0.85)", border: "2px solid #12151f", borderTopColor: "#3d4560", boxShadow: "0 4px 0 0 #12151f" }}>
                {currentQ.image_url && (
                  <img src={currentQ.image_url} alt="" className="mx-auto max-h-[22vh] w-auto object-contain mb-3" />
                )}
                <p className="text-base font-bold leading-snug text-center" style={{ color: "#ffd876" }}>
                  {currentQ.text}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
                {currentQ.options.map((opt, i) => {
                  const isCorrect = i === currentQ.correct_index;
                  const isPicked = picked === i;
                  const show = picked !== null;
                  // A platform: dark stone body, a lit top edge, a hard shadow
                  // underneath so it reads as something with thickness.
                  let body = "#2f3646", top = "#98a3b5", col = "#dce4f0", dim = false;
                  if (show && isCorrect)     { body = "#1f4635"; top = "#7fe0a2"; col = "#b8f5d0"; }
                  else if (show && isPicked) { body = "#4a2230"; top = "#f87171"; col = "#fecaca"; }
                  else if (show)             { body = "#20242f"; top = "#3d4560"; col = "#5d6780"; dim = true; }
                  return (
                    <button key={i} disabled={picked !== null} onClick={() => answer(i)}
                      className={cn(
                        "relative flex items-center justify-center px-3 py-4 text-sm font-bold transition-all",
                        !show && "active:translate-y-[3px]",
                      )}
                      style={{
                        minHeight: 82,
                        background: body,
                        color: col,
                        border: "2px solid #12151f",
                        borderTopWidth: 4,
                        borderTopColor: top,
                        boxShadow: show ? "0 2px 0 0 #12151f" : "0 5px 0 0 #12151f",
                        opacity: dim ? 0.55 : 1,
                      }}>
                      <span className="absolute top-1.5 start-2 h-2 w-2" style={{ background: top }} aria-hidden />
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
