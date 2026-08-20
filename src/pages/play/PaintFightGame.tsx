import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/ui/sonner";
import { Trophy, X, Droplet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { PaintRollerIcon } from "@/components/game/icons";
import PaintJoystick, { type JoystickVector } from "@/components/game/PaintJoystick";
import {
  CELL, PAINT, PLAYER_SPEED, PLAYER_RADIUS, POWERUP_DEFS,
  cellsInRadius, xyOfCell, type CellOwner,
} from "@/lib/paintFight";
import {
  resizeCanvas, drawArenaBackground, drawPlayerRoller,
  drawNameTag, drawPowerup, hueFill, createPaintLayer, strokeTo, stampCell, fillSplash,
  rollerIconSize, computeCamera, blitPaintLayerCamera, drawMinimap, drawSplashFx, type SplashFx,
} from "@/lib/paintFightRender";

type Q = { id: string; text: string; options: string[]; correct_index: number; image_url?: string };
type Phase = "waiting" | "playing" | "done";
type Peer = { id: string; name: string; x: number; y: number; angle: number; hue: number; brushWidth?: number; t: number };
type Powerup = { id: string; kind: "speed" | "roller" | "splash"; cell_index: number };

const PICKUP_RADIUS = 22;
const FLUSH_INTERVAL = 0.18;
const BROADCAST_INTERVAL = 0.07;
const BRUSH_WIDTH = PLAYER_RADIUS * 2;
// Fixed zoom for the local camera — screen size determines how much of the
// arena is visible, not the other way around, same as paper.io.
const PIXELS_PER_WORLD_UNIT = 3.2;
const MINIMAP_W = 92, MINIMAP_H = 138, MINIMAP_MARGIN = 12;

interface Props { sessionId: string; studentId: string; }

const PaintFightGame = ({ sessionId, studentId }: Props) => {
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
  const [powerups, setPowerups]   = useState<Powerup[]>([]);
  const [hud, setHud] = useState({ paint: PAINT.start, speedUntil: 0, rollerUntil: 0, myPct: 0 });
  const [now, setNow] = useState(Date.now());

  const canvasRef  = useRef<HTMLCanvasElement | null>(null);
  const peersRef   = useRef<Record<string, Peer>>({});
  const ownerRef   = useRef<Map<number, CellOwner>>(new Map());
  const pendingRef = useRef<Set<number>>(new Set());
  const paintLayerRef = useRef<HTMLCanvasElement | null>(null);
  const lastPointRef  = useRef<Map<string, { x: number; y: number }>>(new Map());
  const chanRef    = useRef<any>(null);
  const pickedRef  = useRef<number | null>(null);
  const claimingRef = useRef<Set<string>>(new Set());
  const localWriteAtRef = useRef(0);
  const meRef      = useRef<any>(null);
  const vectorRef  = useRef<JoystickVector>({ dx: 0, dy: 0, magnitude: 0 });
  const splashFxRef = useRef<SplashFx[]>([]);

  const pRef = useRef({ x: 0, y: 0, angle: 0, paint: PAINT.start, speedUntil: 0, rollerUntil: 0 });

  const settings = session?.settings ?? {};
  const ar = (settings.lang ?? i18n.language) === "ar";
  const cols = settings.arenaCols ?? 20;
  const rows = settings.arenaRows ?? 30;
  const myHue: number = me?.fight_hue ?? 0;

  useEffect(() => { meRef.current = me; }, [me]);

  // Stroke a round-cap segment from this student's last known point to the
  // new one directly onto the persistent paint bitmap — real paint, not a
  // shape re-stamped every frame. Used ONLY for live position streams (self
  // movement each physics tick, peer position broadcasts) where consecutive
  // points are genuinely adjacent in time and space, so connecting them
  // draws the actual path. Never use this for the cell-index log — see
  // stampOwnedCell below.
  const paintStroke = (id: string, hue: number, x: number, y: number, width = BRUSH_WIDTH) => {
    const layer = paintLayerRef.current;
    if (!layer) return;
    const last = lastPointRef.current.get(id);
    strokeTo(layer, last?.x ?? x, last?.y ?? y, x, y, hue, width);
    lastPointRef.current.set(id, { x, y });
  };

  // Reconstruct ownership from the append-only cell-index log (initial
  // history load + realtime INSERT echoes — including echoes of our own
  // flushes, since postgres_changes delivers INSERTs to every subscriber,
  // sender included). A single flush can carry a whole disc of cells claimed
  // in one tick, in grid-scan order, not path order — connecting those
  // centers with strokeTo lines (like live movement does) draws chaotic
  // lines criss-crossing the disc every ~180ms, which is what looked like
  // "the brush keeps expanding into a circle." Independent, fixed-size dots
  // have no order to get wrong, and touch nothing in lastPointRef so they
  // never disturb the live-movement stroke chains.
  const stampOwnedCell = (hue: number, x: number, y: number) => {
    const layer = paintLayerRef.current;
    if (!layer) return;
    stampCell(layer, x, y, hue, CELL);
  };

  // ── Initial load ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from("game_sessions").select("*, quizzes(id,title)").eq("id", sessionId).maybeSingle();
      setSession(s);
      if (s?.quiz_id) {
        const { data: qs } = await supabase.from("questions").select("*").eq("quiz_id", s.quiz_id).order("position");
        setQuestions((qs ?? []).map((q: any) => ({ ...q, options: Array.isArray(q.options) ? q.options : [] })));
      }
      const c = s?.settings?.arenaCols ?? 20, r = s?.settings?.arenaRows ?? 30;
      paintLayerRef.current = createPaintLayer(c, r);
      const { data: m } = await supabase.from("game_students").select("*").eq("id", studentId).maybeSingle();
      if (m) {
        setMe(m);
        pRef.current.x = (c * CELL) / 2 + (Math.random() - 0.5) * c * CELL * 0.3;
        pRef.current.y = (r * CELL) / 2 + (Math.random() - 0.5) * r * CELL * 0.3;
        pRef.current.paint = PAINT.start;
      }
      const { data: strokes } = await supabase.from("paint_fight_strokes")
        .select("student_id,hue,cell_indices").eq("session_id", sessionId).order("created_at", { ascending: true });
      for (const row of (strokes ?? []) as any[]) {
        for (const idx of row.cell_indices) {
          ownerRef.current.set(idx, { studentId: row.student_id, hue: row.hue });
          const { x, y } = xyOfCell(idx, c);
          stampOwnedCell(row.hue, x, y);
        }
      }
      const { data: pu } = await supabase.from("paint_fight_powerups").select("*").eq("session_id", sessionId).is("claimed_by", null);
      setPowerups((pu ?? []) as Powerup[]);
    })();
  }, [sessionId, studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Realtime ────────────────────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel(`pf-${sessionId}`, { config: { broadcast: { self: false } } })
      .on("postgres_changes", { event: "*", schema: "public", table: "game_sessions", filter: `id=eq.${sessionId}` },
        (p: any) => setSession((prev: any) => ({ ...prev, ...p.new })))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_students", filter: `id=eq.${studentId}` },
        (p: any) => {
          if (Date.now() - localWriteAtRef.current < 2000) return;
          setMe((prev: any) => ({ ...prev, ...p.new }));
        })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "paint_fight_strokes", filter: `session_id=eq.${sessionId}` },
        (p: any) => {
          // Postgres delivers this INSERT to every subscriber, including the
          // client that just wrote it — our own flushes echo straight back.
          // A player we're already live-tracking (ourselves, always; a peer,
          // if their position broadcasts are actively arriving) already has
          // a fully-painted smooth trail from strokeTo — re-stamping their
          // just-claimed cells on top paints a fixed-size dot directly over
          // an already-correct line every ~180ms. Since that dot's radius is
          // slightly larger than the live brush's, it reads as a bead
          // bulging out of the line at each newly-claimed cell — "the line
          // turning into circles." Only stamp for reconstruction when there
          // genuinely isn't a live view of this player yet (initial catch-up
          // load, or a peer whose broadcasts haven't reached us).
          const sid = p.new.student_id;
          const peer = peersRef.current[sid];
          const isLiveTracked = sid === studentId || (peer && Date.now() - peer.t < 3000);
          for (const idx of p.new.cell_indices) {
            ownerRef.current.set(idx, { studentId: sid, hue: p.new.hue });
            if (!isLiveTracked) {
              const { x, y } = xyOfCell(idx, cols);
              stampOwnedCell(p.new.hue, x, y);
            }
          }
        })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "paint_fight_powerups", filter: `session_id=eq.${sessionId}` },
        (p: any) => setPowerups(prev => prev.some(x => x.id === p.new.id) ? prev : [...prev, p.new]))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "paint_fight_powerups", filter: `session_id=eq.${sessionId}` },
        (p: any) => setPowerups(prev => prev.filter(x => x.id !== p.new.id)))
      .on("broadcast", { event: "pos" }, ({ payload }: any) => {
        if (!payload?.id || payload.id === studentId) return;
        peersRef.current[payload.id] = { ...payload, t: Date.now() };
        paintStroke(payload.id, payload.hue ?? 0, payload.x, payload.y, payload.brushWidth ?? BRUSH_WIDTH);
      })
      .subscribe();
    chanRef.current = ch;
    return () => { supabase.removeChannel(ch); chanRef.current = null; };
  }, [sessionId, studentId, cols]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Status → phase ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    if (session.status === "lobby") setPhase("waiting");
    else if (session.status === "running") setPhase("playing");
    else if (session.status === "finished") setPhase("done");
  }, [session?.status]);

  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(iv); }, []);

  // ── Auto-open quiz when out of paint ────────────────────────────────────
  useEffect(() => {
    if (hud.paint <= 0 && !showQuiz) setShowQuiz(true);
  }, [hud.paint]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!showQuiz || questions.length === 0) return;
    setCurrentQ(questions[Math.floor(Math.random() * questions.length)]);
    setPicked(null);
    pickedRef.current = null;
  }, [showQuiz, qSeed, questions.length]);

  // ── Physics + render loop ───────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0, last = performance.now(), acc = 0, hudAcc = 0, netAcc = 0, flushAcc = 0;
    const STEP = 1 / 60;

    const physics = (dt: number) => {
      const p = pRef.current;
      const frozen = p.paint <= 0;
      if (!frozen) {
        const vec = vectorRef.current;
        const speedMult = Date.now() < p.speedUntil ? POWERUP_DEFS.speed.speedMult : 1;
        if (vec.magnitude > 0) {
          const speed = PLAYER_SPEED * speedMult * vec.magnitude;
          p.x = Math.max(0, Math.min(cols * CELL, p.x + vec.dx * speed * dt));
          p.y = Math.max(0, Math.min(rows * CELL, p.y + vec.dy * speed * dt));
          p.angle = Math.atan2(vec.dy, vec.dx);
          p.paint = Math.max(0, p.paint - PAINT.drainPerSec * dt);

          const rollerActive = Date.now() < p.rollerUntil;
          const radius = PLAYER_RADIUS * (rollerActive ? POWERUP_DEFS.roller.radiusMult : 1);
          for (const idx of cellsInRadius(p.x, p.y, radius, cols, rows)) {
            if (ownerRef.current.get(idx)?.studentId !== studentId) {
              ownerRef.current.set(idx, { studentId, hue: myHue });
              pendingRef.current.add(idx);
            }
          }
          paintStroke(studentId, myHue, p.x, p.y, rollerActive ? BRUSH_WIDTH * POWERUP_DEFS.roller.radiusMult : BRUSH_WIDTH);
        }
      }

      // Power-up pickups
      for (const pu of powerups) {
        if (claimingRef.current.has(pu.id)) continue;
        const cx = (pu.cell_index % cols) * CELL + CELL / 2;
        const cy = Math.floor(pu.cell_index / cols) * CELL + CELL / 2;
        if (Math.hypot(cx - p.x, cy - p.y) <= PICKUP_RADIUS) {
          claimingRef.current.add(pu.id);
          supabase.from("paint_fight_powerups").update({ claimed_by: studentId, claimed_at: new Date().toISOString() })
            .eq("id", pu.id).is("claimed_by", null).select().maybeSingle()
            .then(({ data }: any) => {
              if (!data) return; // someone else claimed it first
              if (pu.kind === "speed") { p.speedUntil = Date.now() + POWERUP_DEFS.speed.durationMs; toast.success(ar ? "دفعة سرعة!" : "Speed boost!"); }
              else if (pu.kind === "roller") { p.rollerUntil = Date.now() + POWERUP_DEFS.roller.durationMs; toast.success(ar ? "رولر عملاق!" : "Giant roller!"); }
              else {
                toast.success(ar ? "رشة طلاء!" : "Paint splash!");
                for (const idx of cellsInRadius(cx, cy, POWERUP_DEFS.splash.radius, cols, rows)) {
                  ownerRef.current.set(idx, { studentId, hue: myHue });
                  pendingRef.current.add(idx);
                }
                if (paintLayerRef.current) fillSplash(paintLayerRef.current, cx, cy, POWERUP_DEFS.splash.radius, myHue);
                splashFxRef.current.push({ x: cx, y: cy, radius: POWERUP_DEFS.splash.radius, startedAt: Date.now() });
              }
            }, () => {});
        }
      }
    };

    const draw = () => {
      const { cssW, cssH } = resizeCanvas(canvas, ctx);
      const worldW = cols * CELL, worldH = rows * CELL;
      const scale = PIXELS_PER_WORLD_UNIT;
      const p = pRef.current;
      // Fixed-zoom camera centered on the local player — a local view like
      // paper.io, not the whole arena squeezed to fit the screen.
      const cam = computeCamera(p.x, p.y, cssW, cssH, scale, worldW, worldH);
      const offX = -(cam.x - cam.halfW) * scale, offY = -(cam.y - cam.halfH) * scale;
      const sx = (wx: number) => offX + wx * scale, sy = (wy: number) => offY + wy * scale;

      drawArenaBackground(ctx, cssW, cssH);
      if (paintLayerRef.current) blitPaintLayerCamera(ctx, paintLayerRef.current, cam, cssW, cssH, scale);

      splashFxRef.current = splashFxRef.current.filter(fx => drawSplashFx(ctx, fx, scale, offX, offY));

      const pulse = (Math.sin(Date.now() / 220) + 1) / 2;
      for (const pu of powerups) {
        const x = sx((pu.cell_index % cols) * CELL + CELL / 2), y = sy(Math.floor(pu.cell_index / cols) * CELL + CELL / 2);
        drawPowerup(ctx, x, y, pu.kind, 26 * scale, pulse);
      }

      const cutoff = Date.now() - 5000;
      for (const id of Object.keys(peersRef.current)) {
        const peer = peersRef.current[id];
        if (peer.t < cutoff) { delete peersRef.current[id]; continue; }
        const x = sx(peer.x), y = sy(peer.y);
        drawPlayerRoller(ctx, x, y, peer.angle ?? 0, peer.hue ?? 0, rollerIconSize(peer.brushWidth ?? BRUSH_WIDTH, scale));
        drawNameTag(ctx, x, y + 16 * scale, peer.name ?? "", Math.max(0.7, scale));
      }

      const px = sx(p.x), py = sy(p.y);
      const myRollerActive = Date.now() < p.rollerUntil;
      const myBrushWidth = myRollerActive ? BRUSH_WIDTH * POWERUP_DEFS.roller.radiusMult : BRUSH_WIDTH;
      drawPlayerRoller(ctx, px, py, p.angle, myHue, rollerIconSize(myBrushWidth, scale), { frozen: p.paint <= 0 });
      drawNameTag(ctx, px, py + 16 * scale, meRef.current?.name ?? "", Math.max(0.7, scale));

      // Corner overview so a zoomed-in local camera doesn't leave you lost.
      if (paintLayerRef.current) {
        const minimapPlayers = [{ x: p.x, y: p.y, hue: myHue }];
        for (const id of Object.keys(peersRef.current)) {
          const peer = peersRef.current[id];
          if (peer.t >= cutoff) minimapPlayers.push({ x: peer.x, y: peer.y, hue: peer.hue ?? 0 });
        }
        drawMinimap(ctx, paintLayerRef.current, cam, worldW, worldH, minimapPlayers, {
          x: cssW - MINIMAP_W - MINIMAP_MARGIN,
          y: cssH - MINIMAP_H - MINIMAP_MARGIN,
          w: MINIMAP_W, h: MINIMAP_H,
        });
      }
    };

    const frame = (t: number) => {
      let dt = (t - last) / 1000;
      last = t;
      if (dt > 0.25) dt = 0.25;
      acc += dt; hudAcc += dt; netAcc += dt; flushAcc += dt;

      while (acc >= STEP) { physics(STEP); acc -= STEP; }
      draw();

      if (hudAcc >= 0.1) {
        hudAcc = 0;
        const p = pRef.current;
        let mine = 0;
        for (const cell of ownerRef.current.values()) if (cell.studentId === studentId) mine++;
        const total = cols * rows;
        setHud({ paint: p.paint, speedUntil: p.speedUntil, rollerUntil: p.rollerUntil, myPct: total > 0 ? (mine / total) * 100 : 0 });
      }
      if (netAcc >= BROADCAST_INTERVAL) {
        netAcc = 0;
        const p = pRef.current;
        const broadcastBrushWidth = Date.now() < p.rollerUntil ? BRUSH_WIDTH * POWERUP_DEFS.roller.radiusMult : BRUSH_WIDTH;
        chanRef.current?.send({
          type: "broadcast", event: "pos",
          payload: {
            id: studentId, name: meRef.current?.name ?? "", x: Math.round(p.x), y: Math.round(p.y),
            angle: p.angle, hue: myHue, brushWidth: broadcastBrushWidth,
          },
        });
      }
      if (flushAcc >= FLUSH_INTERVAL) {
        flushAcc = 0;
        if (pendingRef.current.size > 0) {
          const cell_indices = Array.from(pendingRef.current);
          pendingRef.current.clear();
          supabase.from("paint_fight_strokes").insert({ session_id: sessionId, student_id: studentId, hue: myHue, cell_indices }).then(undefined, () => {});
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase, studentId, sessionId, cols, rows, myHue, powerups, ar]); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = (idx: number) => {
    if (!currentQ || !me || pickedRef.current !== null) return;
    pickedRef.current = idx;
    setPicked(idx);
    const correct = idx === currentQ.correct_index;

    if (correct) {
      pRef.current.paint = Math.min(PAINT.start, pRef.current.paint + PAINT.rewardPerCorrect);
      toast.success(`+${PAINT.rewardPerCorrect} ${ar ? "طلاء" : "paint"}`);
    } else {
      toast.error(ar ? "إجابة خاطئة" : "Wrong answer");
    }

    const updates: any = { total_answers: (me.total_answers ?? 0) + 1 };
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

  const paintPct = Math.max(0, Math.min(100, (hud.paint / PAINT.start) * 100));
  const frozen = hud.paint <= 0;
  const speedLeft = Math.max(0, Math.ceil((hud.speedUntil - now) / 1000));
  const rollerLeft = Math.max(0, Math.ceil((hud.rollerUntil - now) / 1000));
  const myColor = hueFill(myHue);

  // ── Waiting ─────────────────────────────────────────────────────────────
  if (phase === "waiting") {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center" style={{ background: "#EBDFC7", color: "#2b2013" }}>
        <PaintRollerIcon className="h-14 w-14" style={{ color: myColor }} />
        <div className="px-5 py-4 rounded-2xl shadow-lg bg-white">
          <div className="text-[10px] tracking-[0.4em] uppercase mb-2 text-black/40">
            {ar ? "معركة الطلاء" : "PAINT FIGHT"}
          </div>
          <div className="text-xl font-extrabold">{me?.name ?? "—"}</div>
        </div>
        <p className="text-sm max-w-xs leading-relaxed font-semibold text-black/70">
          {ar
            ? "أجب على الأسئلة لكسب الطلاء، واستخدمه للتحرك ورسم أرضك. اطلِ أكبر مساحة ممكنة."
            : "Answer questions to earn paint, and spend it moving and claiming ground. Paint as much of the arena as you can."}
        </p>
        <div className="text-xs font-bold animate-pulse text-black/60">
          {ar ? "بانتظار المعلّم..." : "Waiting for the teacher..."}
        </div>
      </div>
    );
  }

  // ── Done ────────────────────────────────────────────────────────────────
  if (phase === "done") {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center" style={{ background: "#EBDFC7", color: "#2b2013" }}>
        <Trophy className="h-16 w-16" style={{ color: "#f59e0b" }} />
        <div className="text-2xl font-extrabold">{ar ? "انتهت المعركة" : "Fight Over"}</div>
        <div className="flex gap-3">
          <div className="px-4 py-3 rounded-2xl shadow-md bg-white">
            <div className="text-[9px] tracking-widest font-bold text-black/40">{ar ? "منطقتك" : "TERRITORY"}</div>
            <div className="text-2xl font-extrabold tabular-nums" style={{ color: myColor }}>{hud.myPct.toFixed(0)}%</div>
          </div>
          <div className="px-4 py-3 rounded-2xl shadow-md bg-white">
            <div className="text-[9px] tracking-widest font-bold text-black/40">{ar ? "صحيح" : "CORRECT"}</div>
            <div className="text-2xl font-extrabold tabular-nums" style={{ color: "#15803d" }}>{me?.correct_answers ?? 0}</div>
          </div>
        </div>
        <button onClick={() => navigate("/play")}
          className="mt-3 px-7 py-3 rounded-xl font-extrabold text-sm text-white shadow-lg active:scale-95 transition-transform"
          style={{ background: "#4f46e5" }}>
          {ar ? "خروج" : "EXIT"}
        </button>
      </div>
    );
  }

  // ── Playing ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{ background: "#EBDFC7", touchAction: "none" }}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {!showQuiz && <PaintJoystick vectorRef={vectorRef} />}

      {/* HUD */}
      <div className="absolute inset-x-0 top-0 p-3 pointer-events-none" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2 items-start">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full shadow-md" style={{ background: "rgba(255,255,255,0.93)", minWidth: 152 }}>
              <Droplet className="h-3.5 w-3.5 shrink-0" style={{ color: frozen ? "#dc2626" : myColor }} />
              <div className="flex-1 h-2 overflow-hidden rounded-full" style={{ background: "rgba(15,23,42,0.12)" }}>
                <div className="h-full rounded-full transition-[width] duration-100"
                  style={{ width: `${paintPct}%`, background: frozen ? "#dc2626" : myColor }} />
              </div>
              <span className="text-[11px] font-extrabold tabular-nums shrink-0" style={{ color: frozen ? "#dc2626" : "#0f172a" }}>
                {Math.round(hud.paint)}
              </span>
            </div>
            {speedLeft > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full shadow-md text-xs font-extrabold text-white" style={{ background: "rgba(234,179,8,0.94)" }}>
                {ar ? `سرعة ${speedLeft}` : `SPEED ${speedLeft}s`}
              </div>
            )}
            {rollerLeft > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full shadow-md text-xs font-extrabold text-white" style={{ background: "rgba(99,102,241,0.94)" }}>
                {ar ? `رولر ${rollerLeft}` : `ROLLER ${rollerLeft}s`}
              </div>
            )}
          </div>
          <div className="px-3 py-1.5 rounded-full shadow-md" style={{ background: "rgba(255,255,255,0.93)" }}>
            <span className="text-sm font-extrabold tabular-nums" style={{ color: myColor }}>{hud.myPct.toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {frozen && !showQuiz && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center pointer-events-none px-6">
          <div className="px-5 py-3 rounded-2xl text-sm font-extrabold text-center animate-pulse shadow-lg" style={{ background: "rgba(220,38,38,0.95)", color: "white" }}>
            {ar ? "لا يوجد طلاء — أجب سؤالاً!" : "OUT OF PAINT — ANSWER A QUESTION!"}
          </div>
        </div>
      )}

      {!showQuiz && (
        <button onClick={() => { setQSeed(s => s + 1); setShowQuiz(true); }}
          className={cn("absolute left-4 z-10 px-4 py-2.5 rounded-xl text-sm font-extrabold text-white shadow-lg active:scale-95 transition-transform",
            frozen && "animate-pulse")}
          style={{ background: frozen ? "#dc2626" : "#4f46e5", bottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
          {ar ? "أجب على الأسئلة" : "Answer Questions"}
        </button>
      )}

      {showQuiz && (
        <div className="absolute inset-0 z-40 flex flex-col" style={{ background: "rgba(8,12,24,0.96)" }}>
          <div className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-2">
              <Droplet className="h-4 w-4" style={{ color: myColor }} />
              <span className="text-sm font-black tabular-nums" style={{ color: myColor }}>
                {Math.round(hud.paint)}/{PAINT.start}
              </span>
              <span className="text-xs opacity-50" style={{ color: "white" }}>
                +{PAINT.rewardPerCorrect} {ar ? "لكل إجابة" : "per correct"}
              </span>
            </div>
            <button onClick={() => setShowQuiz(false)}
              disabled={frozen}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black disabled:opacity-30"
              style={{ background: "rgba(255,255,255,0.1)", color: "white" }}>
              <X className="h-3.5 w-3.5" />{ar ? "طلاء" : "PAINT"}
            </button>
          </div>

          {currentQ && (
            <div className="flex-1 flex flex-col gap-3 p-4 min-h-0 overflow-y-auto">
              <div className="rounded-xl px-4 py-5 shrink-0" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                {currentQ.image_url && (
                  <img src={currentQ.image_url} alt="" className="mx-auto max-h-[22vh] w-auto object-contain mb-3 rounded" />
                )}
                <p className="text-base font-bold leading-snug text-center" style={{ color: "hsl(210 30% 92%)" }}>{currentQ.text}</p>
              </div>
              <div className="grid grid-cols-2 gap-2.5 flex-1 min-h-0">
                {currentQ.options.map((opt, i) => {
                  const isCorrect = i === currentQ.correct_index;
                  const isPicked = picked === i;
                  const show = picked !== null;
                  let bg = "rgba(255,255,255,0.06)", bd = "rgba(255,255,255,0.14)", col = "hsl(210 30% 88%)";
                  if (show && isCorrect)     { bg = "rgba(34,197,94,0.16)"; bd = "#22c55e"; col = "#86efac"; }
                  else if (show && isPicked) { bg = "rgba(239,68,68,0.16)"; bd = "#ef4444"; col = "#fca5a5"; }
                  else if (show)             { bg = "rgba(255,255,255,0.03)"; bd = "rgba(255,255,255,0.06)"; col = "rgba(255,255,255,0.3)"; }
                  return (
                    <button key={i} disabled={show} onClick={() => answer(i)}
                      className="rounded-xl px-3 py-3 text-sm font-bold text-center flex items-center justify-center transition-colors"
                      style={{ background: bg, border: `1.5px solid ${bd}`, color: col }}>
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

export default PaintFightGame;
