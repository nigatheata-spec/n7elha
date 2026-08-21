import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Trophy, X, Droplet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { PaintRollerIcon } from "@/components/game/icons";
import PaintJoystick, { type JoystickVector } from "@/components/game/PaintJoystick";
import { useFloatingRewards } from "@/components/game/GameFeedback";
import { playCorrect, playWrong } from "@/lib/sound";
import {
  CELL, PAINT, PLAYER_SPEED, PLAYER_RADIUS, PIXELS_PER_WORLD_UNIT,
  FLUSH_INTERVAL_MS, BROADCAST_INTERVAL_MS, PEER_TIMEOUT_MS,
  cellsInRadius, applyStrokeIncremental, type CellOwner, type Stroke,
} from "@/lib/paintFight";
import {
  resizeCanvas, drawArenaBackground, drawPlayerRoller, drawNameTag, hueFill,
  createPaintLayer, paintCells, blitPaint, rollerIconSize, computeCamera, drawMinimap,
} from "@/lib/paintFightRender";

// ── Paint Fight, student view ───────────────────────────────────────────────
// Deliberately small: move, paint, answer to refill. No power-ups, no timers,
// no second rendering path. Everything that runs at 60fps lives in refs and is
// driven by ONE requestAnimationFrame loop whose effect has only stable deps,
// so the loop is started once per match and cancelled exactly once. (The old
// version listed `powerups` in the loop's dep array, so every power-up spawn
// tore down and restarted the loop mid-frame — a big part of the stutter.)
//
// NOTE ON TIMERS: this mode intentionally reads nothing from settings.timePerQ.
// Questions are opened by the player, on demand, and never expire — running out
// of paint is the pressure, not a countdown.

type Q = { id: string; text: string; options: string[]; correct_index: number; image_url?: string };
type Phase = "waiting" | "playing" | "done";
type Peer = { id: string; name: string; x: number; y: number; angle: number; hue: number; t: number };

const BRUSH_WIDTH = PLAYER_RADIUS * 2;
const MINIMAP_W = 84, MINIMAP_H = 126, MINIMAP_MARGIN = 12;

interface Props { sessionId: string; studentId: string; }

const PaintFightGame = ({ sessionId, studentId }: Props) => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();

  const [session, setSession]   = useState<any>(null);
  const [me, setMe]             = useState<any>(null);
  const [phase, setPhase]       = useState<Phase>("waiting");
  const [ready, setReady]       = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [currentQ, setCurrentQ] = useState<Q | null>(null);
  const [picked, setPicked]     = useState<number | null>(null);
  const [hud, setHud]           = useState({ paint: PAINT.start, pct: 0 });

  const reward = useFloatingRewards();

  // ── Loop-owned state. None of this belongs in React state: it changes every
  //    frame and re-rendering on it would both tank the framerate and make the
  //    loop read stale closure values.
  const canvasRef  = useRef<HTMLCanvasElement | null>(null);
  const layerRef   = useRef<HTMLCanvasElement | null>(null);
  const ownerRef   = useRef<Map<number, CellOwner>>(new Map());
  const countsRef  = useRef<Map<string, { hue: number; count: number }>>(new Map());
  const pendingRef = useRef<Set<number>>(new Set());
  const peersRef   = useRef<Record<string, Peer>>({});
  const vectorRef  = useRef<JoystickVector>({ dx: 0, dy: 0, magnitude: 0 });
  const pRef       = useRef({ x: 0, y: 0, angle: 0, paint: PAINT.start });
  const chanRef    = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const colsRef    = useRef(0);
  const rowsRef    = useRef(0);
  const hueRef     = useRef(0);
  const nameRef    = useRef("");
  const meIdRef    = useRef<string | null>(null);
  const flushingRef = useRef(false);
  const pickedRef  = useRef<number | null>(null);
  const questionsRef = useRef<Q[]>([]);
  const lastQIdRef = useRef<string | null>(null);
  const localWriteAtRef = useRef(0);

  const settings = session?.settings ?? {};
  const ar = (settings.lang ?? i18n.language) === "ar";
  const myHue: number = me?.fight_hue ?? 0;
  const myColor = hueFill(myHue);

  // ── One effect owns all data + realtime, so subscription and history load
  //    are ordered against each other exactly once. ──────────────────────────
  useEffect(() => {
    let cancelled = false;
    // Rows that arrive between subscribing and finishing the history read are
    // buffered, not applied. History is fetched AFTER subscribing (so nothing
    // can slip through the gap) and may therefore already contain some buffered
    // rows — replaying a row twice is harmless because claiming a cell is
    // idempotent, whereas missing one is permanent.
    const buffer: Stroke[] = [];
    let historyApplied = false;

    const applyStroke = (row: Stroke, fromHistory: boolean) => {
      const cols = colsRef.current, rows = rowsRef.current;
      const layer = layerRef.current;
      if (!layer || cols <= 0) return;
      // Our own rows echo back to us (postgres_changes delivers an INSERT to
      // every subscriber including the sender). We already applied those cells
      // locally the instant we painted them, so re-applying live echoes is pure
      // waste — but echoes replayed from HISTORY are how a reconnecting player
      // gets their own territory back, so those must still be applied.
      if (!fromHistory && row.student_id === studentId) return;
      applyStrokeIncremental(ownerRef.current, countsRef.current, row.student_id, row.hue, row.cell_indices, cols * rows);
      paintCells(layer, row.cell_indices, row.hue, cols);
    };

    const ch = supabase.channel(`pf-${sessionId}`, { config: { broadcast: { self: false } } })
      .on("postgres_changes", { event: "*", schema: "public", table: "game_sessions", filter: `id=eq.${sessionId}` },
        (p: any) => setSession((prev: any) => ({ ...prev, ...p.new })))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_students", filter: `id=eq.${studentId}` },
        (p: any) => {
          // Ignore the echo of our own answer write for a moment, otherwise a
          // slow round-trip can roll our counters backwards on screen.
          if (Date.now() - localWriteAtRef.current < 2000) return;
          setMe((prev: any) => ({ ...prev, ...p.new }));
        })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "paint_fight_strokes", filter: `session_id=eq.${sessionId}` },
        (p: any) => {
          const row = p.new as Stroke;
          if (historyApplied) applyStroke(row, false); else buffer.push(row);
        })
      .on("broadcast", { event: "pos" }, ({ payload }: any) => {
        // Cosmetic only — where to draw someone's roller. Their paint arrives
        // through the log like everyone else's, so a dropped broadcast can
        // never cost anybody territory.
        if (!payload?.id || payload.id === studentId) return;
        peersRef.current[payload.id] = { ...payload, t: Date.now() };
      })
      .subscribe();
    chanRef.current = ch;

    (async () => {
      const { data: s } = await supabase.from("game_sessions").select("*, quizzes(id,title)").eq("id", sessionId).maybeSingle();
      if (cancelled) return;
      setSession(s);

      const cols = s?.settings?.arenaCols ?? 40;
      const rows = s?.settings?.arenaRows ?? 60;
      colsRef.current = cols;
      rowsRef.current = rows;
      layerRef.current = createPaintLayer(cols, rows);

      if (s?.quiz_id) {
        const { data: qs } = await supabase.from("questions").select("*").eq("quiz_id", s.quiz_id).order("position");
        if (cancelled) return;
        const list = (qs ?? []).map((q: any) => ({ ...q, options: Array.isArray(q.options) ? q.options : [] })) as Q[];
        questionsRef.current = list;
      }

      const { data: m } = await supabase.from("game_students").select("*").eq("id", studentId).maybeSingle();
      if (cancelled) return;
      if (m) {
        setMe(m);
        meIdRef.current = m.id;
        hueRef.current = m.fight_hue ?? 0;
        nameRef.current = m.name ?? "";
      }

      // Spawn somewhere inside the middle half of the arena.
      pRef.current.x = cols * CELL * (0.25 + Math.random() * 0.5);
      pRef.current.y = rows * CELL * (0.25 + Math.random() * 0.5);
      pRef.current.paint = PAINT.start;

      const { data: strokes } = await supabase.from("paint_fight_strokes")
        .select("student_id,hue,cell_indices").eq("session_id", sessionId).order("created_at", { ascending: true });
      if (cancelled) return;
      for (const row of (strokes ?? []) as Stroke[]) applyStroke(row, true);
      for (const row of buffer) applyStroke(row, true);
      buffer.length = 0;
      historyApplied = true;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
      chanRef.current = null;
    };
  }, [sessionId, studentId]);

  // ── Session status → phase ──────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    if (session.status === "lobby") setPhase("waiting");
    else if (session.status === "running") setPhase("playing");
    else if (session.status === "finished") setPhase("done");
  }, [session?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { hueRef.current = myHue; }, [myHue]);
  useEffect(() => { nameRef.current = me?.name ?? ""; }, [me?.name]);

  // ── Flush newly-claimed cells to the append-only log ────────────────────
  // One insert in flight at a time. Overlapping inserts could land in the
  // opposite order to the order the cells were painted in, which for a
  // last-write-wins replay means a cell we repainted could end up owned by
  // whoever we painted over. Serialising costs nothing at a 250ms cadence.
  const flush = () => {
    if (flushingRef.current || pendingRef.current.size === 0) return;
    const batch = Array.from(pendingRef.current);
    pendingRef.current.clear();
    flushingRef.current = true;
    const requeue = () => {
      flushingRef.current = false;
      // Never drop cells on a failed write: the log is the score, so a lost
      // batch is lost territory. Put them back and try again next tick.
      for (const idx of batch) pendingRef.current.add(idx);
    };
    supabase.from("paint_fight_strokes")
      .insert({ session_id: sessionId, student_id: studentId, hue: hueRef.current, cell_indices: batch })
      .then(({ error }) => { if (error) requeue(); else flushingRef.current = false; }, requeue);
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;

  // Make sure the last few strokes of the match are on record.
  useEffect(() => { if (phase === "done") flushRef.current(); }, [phase]);
  useEffect(() => () => { flushRef.current(); }, []);

  // ── The single game loop ────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing" || !ready) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let acc = 0, hudAcc = 0, netAcc = 0, flushAcc = 0;
    const STEP = 1 / 60;

    const physics = (dt: number) => {
      const p = pRef.current;
      const cols = colsRef.current, rows = rowsRef.current;
      if (p.paint <= 0) return;                    // out of paint: frozen
      const vec = vectorRef.current;
      if (vec.magnitude <= 0) return;              // standing still costs nothing

      const speed = PLAYER_SPEED * vec.magnitude;
      p.x = Math.max(0, Math.min(cols * CELL, p.x + vec.dx * speed * dt));
      p.y = Math.max(0, Math.min(rows * CELL, p.y + vec.dy * speed * dt));
      p.angle = Math.atan2(vec.dy, vec.dx);
      p.paint = Math.max(0, p.paint - PAINT.drainPerSec * dt);

      const claimed: number[] = [];
      for (const idx of cellsInRadius(p.x, p.y, PLAYER_RADIUS, cols, rows)) {
        if (ownerRef.current.get(idx)?.studentId === studentId) continue;
        claimed.push(idx);
        pendingRef.current.add(idx);
      }
      if (claimed.length) {
        // Local prediction: claim and paint immediately so the brush feels
        // instant, then let the flush make it durable. Because the picture is
        // drawn from ownership, prediction and confirmation are the same
        // operation — there is nothing to reconcile when the echo returns.
        applyStrokeIncremental(ownerRef.current, countsRef.current, studentId, hueRef.current, claimed, cols * rows);
        if (layerRef.current) paintCells(layerRef.current, claimed, hueRef.current, cols);
      }
    };

    const draw = () => {
      const { cssW, cssH } = resizeCanvas(canvas, ctx);
      if (cssW <= 0 || cssH <= 0) return;
      const cols = colsRef.current, rows = rowsRef.current;
      const worldW = cols * CELL, worldH = rows * CELL;
      const scale = PIXELS_PER_WORLD_UNIT;
      const p = pRef.current;
      const cam = computeCamera(p.x, p.y, cssW, cssH, scale, worldW, worldH);
      const offX = -(cam.x - cam.halfW) * scale, offY = -(cam.y - cam.halfH) * scale;
      const sx = (wx: number) => offX + wx * scale, sy = (wy: number) => offY + wy * scale;

      drawArenaBackground(ctx, cssW, cssH);
      const layer = layerRef.current;
      if (layer) blitPaint(ctx, layer, offX, offY, scale);

      const cutoff = Date.now() - PEER_TIMEOUT_MS;
      const minimapPlayers = [{ x: p.x, y: p.y, hue: hueRef.current }];
      for (const id of Object.keys(peersRef.current)) {
        const peer = peersRef.current[id];
        if (peer.t < cutoff) { delete peersRef.current[id]; continue; }
        const x = sx(peer.x), y = sy(peer.y);
        drawPlayerRoller(ctx, x, y, peer.angle ?? 0, peer.hue ?? 0, rollerIconSize(BRUSH_WIDTH, scale));
        drawNameTag(ctx, x, y + 16 * scale, peer.name ?? "", Math.max(0.8, scale));
        minimapPlayers.push({ x: peer.x, y: peer.y, hue: peer.hue ?? 0 });
      }

      const px = sx(p.x), py = sy(p.y);
      drawPlayerRoller(ctx, px, py, p.angle, hueRef.current, rollerIconSize(BRUSH_WIDTH, scale), { frozen: p.paint <= 0 });
      drawNameTag(ctx, px, py + 16 * scale, nameRef.current, Math.max(0.8, scale));

      if (layer) {
        drawMinimap(ctx, layer, cam, worldW, worldH, minimapPlayers, {
          x: cssW - MINIMAP_W - MINIMAP_MARGIN,
          y: cssH - MINIMAP_H - MINIMAP_MARGIN,
          w: MINIMAP_W, h: MINIMAP_H,
        });
      }
    };

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      let dt = (t - last) / 1000;
      last = t;
      // A backgrounded tab returns with a huge dt; cap it so the player doesn't
      // teleport across the arena painting a stripe on the way.
      if (dt > 0.25) dt = 0.25;
      acc += dt; hudAcc += dt; netAcc += dt; flushAcc += dt;

      let steps = 0;
      while (acc >= STEP && steps < 8) { physics(STEP); acc -= STEP; steps++; }
      if (acc > STEP) acc = 0; // never let the accumulator spiral

      draw();

      if (hudAcc >= 0.12) {
        hudAcc = 0;
        const total = colsRef.current * rowsRef.current;
        const mine = countsRef.current.get(studentId)?.count ?? 0;
        setHud({ paint: pRef.current.paint, pct: total > 0 ? (mine / total) * 100 : 0 });
      }
      if (netAcc >= BROADCAST_INTERVAL_MS / 1000) {
        netAcc = 0;
        const p = pRef.current;
        chanRef.current?.send({
          type: "broadcast", event: "pos",
          payload: {
            id: studentId, name: nameRef.current,
            x: Math.round(p.x), y: Math.round(p.y), angle: p.angle, hue: hueRef.current,
          },
        });
      }
      if (flushAcc >= FLUSH_INTERVAL_MS / 1000) { flushAcc = 0; flushRef.current(); }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase, ready, studentId]);

  // ── Questions ───────────────────────────────────────────────────────────
  const nextQuestion = () => {
    const list = questionsRef.current;
    if (list.length === 0) { setCurrentQ(null); return; }
    let q = list[Math.floor(Math.random() * list.length)];
    if (list.length > 1 && q.id === lastQIdRef.current) {
      q = list[(list.indexOf(q) + 1) % list.length]; // never the same one twice running
    }
    lastQIdRef.current = q.id;
    setCurrentQ(q);
    setPicked(null);
    pickedRef.current = null;
  };

  const openQuiz = () => { nextQuestion(); setShowQuiz(true); };

  // Out of paint is a dead stop, so put the quiz up automatically.
  useEffect(() => {
    if (phase === "playing" && hud.paint <= 0 && !showQuiz) openQuiz();
  }, [hud.paint, phase, showQuiz]); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = (idx: number) => {
    if (!currentQ || !me || pickedRef.current !== null) return;
    pickedRef.current = idx;                 // sync guard: a double-tap must not double-count
    setPicked(idx);
    const correct = idx === currentQ.correct_index;

    if (correct) {
      pRef.current.paint = Math.min(PAINT.start, pRef.current.paint + PAINT.rewardPerCorrect);
      setHud(h => ({ ...h, paint: pRef.current.paint }));
      playCorrect();
      reward.fire(`+${PAINT.rewardPerCorrect}`, myColor);
    } else {
      playWrong();  // the button turning red is feedback enough
    }

    // Fire-and-forget writes: the game must never stall waiting on Supabase.
    const updates: any = { total_answers: (me.total_answers ?? 0) + 1 };
    if (correct) updates.correct_answers = (me.correct_answers ?? 0) + 1;
    localWriteAtRef.current = Date.now();
    setMe((prev: any) => ({ ...prev, ...updates }));
    supabase.from("game_students").update(updates).eq("id", me.id).then(undefined, () => {});
    supabase.from("question_responses").insert({
      session_id: sessionId, student_id: me.id, question_id: currentQ.id,
      question_index: 0, answer_index: idx, is_correct: correct,
    }).then(undefined, () => {});

    setTimeout(() => nextQuestion(), 850);
  };

  const paintPct = Math.max(0, Math.min(100, (hud.paint / PAINT.start) * 100));
  const frozen = hud.paint <= 0;

  // ── Waiting ─────────────────────────────────────────────────────────────
  if (phase === "waiting") {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center"
        style={{ background: "#EBDFC7", color: "#3F5A63" }}>
        <PaintRollerIcon className="h-14 w-14" style={{ color: myColor }} />
        <div className="px-6 py-4 bg-white border-2 border-[hsl(var(--nb-border))] shadow-[4px_4px_0_0_hsl(var(--nb-border))]">
          <div className="text-[10px] tracking-[0.35em] uppercase mb-1.5 opacity-50">
            {ar ? "معركة الطلاء" : "PAINT FIGHT"}
          </div>
          <div className="text-xl font-extrabold">{me?.name ?? "—"}</div>
        </div>
        <p className="text-sm max-w-xs leading-relaxed font-semibold opacity-80">
          {ar
            ? "حرّك الرولر لتطلي الأرض بلونك. الحركة تستهلك الطلاء، والإجابة الصحيحة تعيد تعبئته. من يطلي أكبر مساحة يفوز."
            : "Move your roller to paint the ground in your color. Moving spends paint, correct answers refill it. Whoever paints the most wins."}
        </p>
        <div className="text-xs font-bold animate-pulse opacity-70">
          {ar ? "بانتظار المعلّم..." : "Waiting for the teacher..."}
        </div>
      </div>
    );
  }

  // ── Done ────────────────────────────────────────────────────────────────
  if (phase === "done") {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center"
        style={{ background: "#EBDFC7", color: "#3F5A63" }}>
        <Trophy className="h-16 w-16" style={{ color: "#FF8254" }} />
        <div className="text-2xl font-extrabold">{ar ? "انتهت المعركة" : "Fight Over"}</div>
        <div className="flex gap-3">
          <div className="px-5 py-3 bg-white border-2 border-[hsl(var(--nb-border))] shadow-[4px_4px_0_0_hsl(var(--nb-border))]">
            <div className="text-[9px] tracking-widest font-bold opacity-50">{ar ? "منطقتك" : "TERRITORY"}</div>
            <div className="text-2xl font-extrabold tabular-nums" style={{ color: myColor }}>{hud.pct.toFixed(0)}%</div>
          </div>
          <div className="px-5 py-3 bg-white border-2 border-[hsl(var(--nb-border))] shadow-[4px_4px_0_0_hsl(var(--nb-border))]">
            <div className="text-[9px] tracking-widest font-bold opacity-50">{ar ? "صحيح" : "CORRECT"}</div>
            <div className="text-2xl font-extrabold tabular-nums" style={{ color: "#15803d" }}>{me?.correct_answers ?? 0}</div>
          </div>
        </div>
        <button onClick={() => navigate("/play")}
          className="mt-3 px-7 py-3 font-extrabold text-sm text-white border-2 border-[hsl(var(--nb-border))] shadow-[4px_4px_0_0_hsl(var(--nb-border))] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_0_hsl(var(--nb-border))] transition-transform"
          style={{ background: "#FF8254" }}>
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
      <div className="absolute inset-x-0 top-0 p-3 pointer-events-none"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border-2 border-[hsl(var(--nb-border))] shadow-[3px_3px_0_0_hsl(var(--nb-border))]"
            style={{ minWidth: 156 }}>
            <Droplet className="h-3.5 w-3.5 shrink-0" style={{ color: frozen ? "#dc2626" : myColor }} />
            <div className="flex-1 h-2.5 overflow-hidden border border-[hsl(var(--nb-border))]" style={{ background: "rgba(63,90,99,0.12)" }}>
              <div className="h-full transition-[width] duration-100"
                style={{ width: `${paintPct}%`, background: frozen ? "#dc2626" : myColor }} />
            </div>
            <span className="text-[11px] font-extrabold tabular-nums shrink-0"
              style={{ color: frozen ? "#dc2626" : "#3F5A63" }}>{Math.round(hud.paint)}</span>
          </div>
          <div className="px-3 py-1.5 bg-white border-2 border-[hsl(var(--nb-border))] shadow-[3px_3px_0_0_hsl(var(--nb-border))]">
            <span className="text-sm font-extrabold tabular-nums" style={{ color: myColor }}>{hud.pct.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {frozen && !showQuiz && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center pointer-events-none px-6">
          <div className="px-5 py-3 text-sm font-extrabold text-center text-white animate-pulse border-2 border-[hsl(var(--nb-border))] shadow-[4px_4px_0_0_hsl(var(--nb-border))]"
            style={{ background: "#dc2626" }}>
            {ar ? "نفد الطلاء — أجب على سؤال!" : "OUT OF PAINT — ANSWER A QUESTION!"}
          </div>
        </div>
      )}

      {!showQuiz && (
        <button onClick={openQuiz}
          className={cn(
            "absolute left-4 z-10 px-4 py-2.5 text-sm font-extrabold text-white border-2 border-[hsl(var(--nb-border))] shadow-[4px_4px_0_0_hsl(var(--nb-border))] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_0_hsl(var(--nb-border))] transition-transform",
            frozen && "animate-pulse",
          )}
          style={{ background: frozen ? "#dc2626" : "#FF8254", bottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
          {ar ? "أجب على الأسئلة" : "Answer Questions"}
        </button>
      )}

      {showQuiz && (
        <div className="absolute inset-0 z-40 flex flex-col" style={{ background: "#3F5A63" }}>
          <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b-2 border-[hsl(var(--nb-border))]"
            style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
            <div className="relative flex items-center gap-2">
              <Droplet className="h-4 w-4" style={{ color: myColor }} />
              <span className="text-sm font-black tabular-nums" style={{ color: myColor }}>
                {Math.round(hud.paint)}/{PAINT.start}
              </span>
              <span className="text-xs text-white/50">
                +{PAINT.rewardPerCorrect} {ar ? "لكل إجابة صحيحة" : "per correct"}
              </span>
              <reward.Layer />
            </div>
            <button onClick={() => setShowQuiz(false)} disabled={frozen}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black text-white border-2 border-white/30 disabled:opacity-30">
              <X className="h-3.5 w-3.5" />{ar ? "عودة للطلاء" : "PAINT"}
            </button>
          </div>

          {currentQ ? (
            <div className="flex-1 flex flex-col gap-3 p-4 min-h-0 overflow-y-auto">
              <div className="px-4 py-5 shrink-0 border-2 border-white/20" style={{ background: "rgba(255,255,255,0.06)" }}>
                {currentQ.image_url && (
                  <img src={currentQ.image_url} alt="" className="mx-auto max-h-[22vh] w-auto object-contain mb-3" />
                )}
                <p className="text-base font-bold leading-snug text-center text-white">{currentQ.text}</p>
              </div>
              <div className="grid grid-cols-2 gap-2.5 flex-1 min-h-0">
                {currentQ.options.map((opt, i) => {
                  const isCorrect = i === currentQ.correct_index;
                  const isPicked = picked === i;
                  const show = picked !== null;
                  let bg = "rgba(255,255,255,0.08)", bd = "rgba(255,255,255,0.35)", col = "#ffffff";
                  if (show && isCorrect)     { bg = "rgba(34,197,94,0.2)";  bd = "#22c55e"; col = "#86efac"; }
                  else if (show && isPicked) { bg = "rgba(239,68,68,0.2)";  bd = "#ef4444"; col = "#fca5a5"; }
                  else if (show)             { bg = "rgba(255,255,255,0.04)"; bd = "rgba(255,255,255,0.1)"; col = "rgba(255,255,255,0.35)"; }
                  return (
                    <button key={i} disabled={show} onClick={() => answer(i)}
                      className={cn(
                        "px-3 py-3 text-sm font-bold text-center flex items-center justify-center transition-colors border-2",
                        show && isCorrect && "animate-answer-correct",
                        show && isPicked && !isCorrect && "animate-answer-wrong",
                      )}
                      style={{ background: bg, borderColor: bd, color: col }}>
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm font-bold text-white/60 px-6 text-center">
              {ar ? "لا توجد أسئلة في هذا الاختبار." : "This quiz has no questions."}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PaintFightGame;
