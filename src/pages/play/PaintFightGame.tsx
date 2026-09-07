import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Trophy, X, Skull, Droplet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import PaintJoystick, { type JoystickVector } from "@/components/game/PaintJoystick";
import { useFloatingRewards } from "@/components/game/GameFeedback";
import { playCorrect, playWrong } from "@/lib/sound";
import {
  CELL, TANK, PLAYER_SPEED, TURN_RATE, TRAIL_RADIUS, RESPAWN_MS, SPAWN_HALF,
  PIXELS_PER_WORLD_UNIT, FLUSH_INTERVAL_MS, BROADCAST_INTERVAL_MS, PEER_TIMEOUT_MS,
  emptyTerritory, applyStroke, claimCells, wipePlayer, cellsOf, coverageOf,
  captureFill, cellOfXY, spawnBlock, Trail,
  type Stroke, type Territory, type CoverageRow,
} from "@/lib/paintFight";
import {
  resizeCanvas, drawArena, drawTerritories, drawTrail, drawPlayer, drawName,
  computeCamera, drawMinimap, TerritoryPaths, hueFill, hueDeep, PF,
} from "@/lib/paintFightRender";
import { readSettings } from "@/lib/sessionSettings";

// ── Paint Fight, student view ───────────────────────────────────────────────
// Drive out of your territory, come back, and everything your loop encloses is
// yours. Touch anyone's trail — including your own — and you lose all of it.
// See src/lib/paintFight.ts for who is allowed to decide what; the short answer
// is that this client decides its own capture and its own death and nothing
// else, which is what keeps twenty phones agreeing without a server.
//
// Everything that runs at 60fps lives in refs, driven by ONE requestAnimationFrame
// loop whose effect has only stable deps, so the loop is started once per match
// and cancelled exactly once.
//
// NOTE ON TIMERS: this mode reads nothing from settings.timePerQ. Questions are
// opened by the player, on demand, and never expire — running dry halfway around
// a loop, stranded outside your own ground, is the pressure, not a countdown.

type Q = { id: string; text: string; options: string[]; correct_index: number; image_url?: string };
type Phase = "waiting" | "playing" | "done";
type Peer = {
  id: string; name: string; x: number; y: number; angle: number; hue: number;
  alive: boolean; trail: { x: number; y: number }[]; t: number;
};

interface Props { sessionId: string; studentId: string; }

const PLAYER_SIZE = 17;      // world px
const TRAIL_W = TRAIL_RADIUS * 2;

/** One colour per answer slot — the four a class recognises from the arena. */
const ANSWER_HUES = [352, 145, 268, 40];

/** Background territory on the question screen. Fixed rather than random so the
 *  screen doesn't reshuffle itself between questions. */
const BLOBS = [
  { left: "-14%", top: "6%",  size: "58vw", radius: "34%", rotate: -8,  hue: 145 },
  { left: "62%",  top: "-6%", size: "52vw", radius: "38%", rotate: 12,  hue: 352 },
  { left: "70%",  top: "58%", size: "64vw", radius: "40%", rotate: -14, hue: 268 },
  { left: "-20%", top: "70%", size: "60vw", radius: "36%", rotate: 6,   hue: 40  },
];

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
  const [hud, setHud] = useState({ tank: TANK.start, pct: 0, best: 0, kills: 0, alive: true });
  const [board, setBoard]       = useState<CoverageRow[]>([]);
  const [toast, setToast]       = useState<{ text: string; bad: boolean } | null>(null);

  const reward = useFloatingRewards();

  // ── Loop-owned state. None of this belongs in React state: it changes every
  //    frame, and re-rendering on it would both wreck the framerate and make the
  //    loop read stale closure values.
  const canvasRef  = useRef<HTMLCanvasElement | null>(null);
  const boardRef   = useRef<Territory>(emptyTerritory());
  const pathsRef   = useRef<TerritoryPaths>(new TerritoryPaths(1));
  const pendingRef = useRef<Set<number>>(new Set());
  const peersRef   = useRef<Record<string, Peer>>({});
  const vectorRef  = useRef<JoystickVector>({ dx: 0, dy: 0, magnitude: 0 });
  const trailRef      = useRef<Trail>(new Trail());
  const trailResetRef = useRef(true);
  // `moving` is false until the stick is first touched. Movement is otherwise
  // constant (that is the mode), which would mean a student who opens the app
  // and doesn't touch anything drives straight into the wall and dies before
  // they have read the screen.
  const pRef = useRef({ x: 0, y: 0, angle: 0, tank: TANK.start, alive: true, moving: false, respawnAt: 0, best: 0, kills: 0 });
  const chanRef    = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const colsRef    = useRef(0);
  const rowsRef    = useRef(0);
  const hueRef     = useRef(0);
  const nameRef    = useRef("");
  const flushingRef = useRef(false);
  const pickedRef  = useRef<number | null>(null);
  const questionsRef = useRef<Q[]>([]);
  const lastQIdRef = useRef<string | null>(null);
  const localWriteAtRef = useRef(0);

  const settings = session?.settings ?? {};
  const ar = (settings.lang ?? i18n.language) === "ar";
  const myHue: number = me?.fight_hue ?? 0;
  const myColor = hueFill(myHue);
  const myInk = hueDeep(myHue);

  const say = (text: string, bad: boolean) => {
    setToast({ text, bad });
    setTimeout(() => setToast(t => (t?.text === text ? null : t)), 1900);
  };

  // ── One effect owns all data + realtime, so subscription and history load
  //    are ordered against each other exactly once. ──────────────────────────
  useEffect(() => {
    let cancelled = false;
    // Rows that arrive between subscribing and finishing the history read are
    // buffered, not applied. History is fetched AFTER subscribing (so nothing
    // can slip through the gap) and may therefore already contain some buffered
    // rows — replaying a claim twice is harmless, whereas missing one is
    // permanent, and a wipe replayed after the claims it preceded would wrongly
    // erase live territory, which is exactly why order is preserved here.
    const buffer: Stroke[] = [];
    let historyApplied = false;

    const apply = (row: Stroke) => {
      const cols = colsRef.current, rows = rowsRef.current;
      if (cols <= 0) return;
      pathsRef.current.invalidate(applyStroke(boardRef.current, row, cols * rows));
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
          // Our own rows echo back (postgres_changes delivers an INSERT to every
          // subscriber including the sender). We applied those locally the
          // instant we captured, so a live echo is pure waste — but an echo
          // replayed from HISTORY is how a reconnecting player gets their own
          // territory back, so those must still go through.
          if (historyApplied) { if (row.student_id !== studentId) apply(row); }
          else buffer.push(row);
        })
      .on("broadcast", { event: "pos" }, ({ payload }: any) => {
        // Cosmetic only — where to draw somebody and the ribbon behind them.
        // Their territory arrives through the log like everyone else's and
        // their death is their own client's call, so a dropped broadcast can
        // never cost anybody a cell or a life.
        if (!payload?.id || payload.id === studentId) return;
        const prev = peersRef.current[payload.id];
        const trail = payload.reset || !prev ? [] : prev.trail;
        for (const [x, y] of (payload.pts ?? [])) trail.push({ x, y });
        if (trail.length > 400) trail.splice(0, trail.length - 400);
        peersRef.current[payload.id] = {
          id: payload.id, name: payload.name ?? "", x: payload.x, y: payload.y,
          angle: payload.angle ?? 0, hue: payload.hue ?? 0, alive: payload.alive !== false,
          trail, t: Date.now(),
        };
      })
      .on("broadcast", { event: "kill" }, ({ payload }: any) => {
        // The victim tells us we cut them off; we are the only client that
        // writes our own kill counter. A dropped broadcast loses a tally mark
        // and nothing else — territory and deaths are never decided here.
        if (payload?.by !== studentId) return;
        pRef.current.kills++;
        say(ar ? "أقصيت لاعبًا!" : "You cut someone off!", false);
        localWriteAtRef.current = Date.now();
        supabase.from("game_students").update({ fight_kills: pRef.current.kills }).eq("id", studentId).then(undefined, () => {});
      })
      .subscribe();
    chanRef.current = ch;

    (async () => {
      const { data: s } = await supabase.from("game_sessions").select("*, quizzes(id,title)").eq("id", sessionId).maybeSingle();
      if (cancelled) return;
      setSession(s);

      const cfg = readSettings(s?.settings);
      const cols = cfg.arenaCols ?? 60;
      const rows = cfg.arenaRows ?? 81;
      colsRef.current = cols;
      rowsRef.current = rows;
      pathsRef.current = new TerritoryPaths(cols);

      if (s?.quiz_id) {
        const { data: qs } = await supabase.from("questions").select("*").eq("quiz_id", s.quiz_id).order("position");
        if (cancelled) return;
        questionsRef.current = (qs ?? []).map((q: any) => ({ ...q, options: Array.isArray(q.options) ? q.options : [] })) as Q[];
      }

      const { data: m } = await supabase.from("game_students").select("*").eq("id", studentId).maybeSingle();
      if (cancelled) return;
      if (m) {
        setMe(m);
        hueRef.current = m.fight_hue ?? 0;
        nameRef.current = m.name ?? "";
        pRef.current.kills = m.fight_kills ?? 0;
      }

      const { data: strokes } = await supabase.from("paint_fight_strokes")
        .select("student_id,hue,cell_indices,op").eq("session_id", sessionId).order("created_at", { ascending: true });
      if (cancelled) return;
      for (const row of (strokes ?? []) as Stroke[]) apply(row);
      for (const row of buffer) apply(row);
      buffer.length = 0;
      historyApplied = true;

      // A reconnecting player keeps whatever the log says is theirs; a fresh one
      // gets a home block. Either way we stand on our own ground, never inside
      // somebody else's.
      const mine = cellsOf(boardRef.current, studentId);
      if (mine.size > 0) {
        let sx = 0, sy = 0;
        for (const idx of mine) { sx += idx % cols; sy += Math.floor(idx / cols); }
        pRef.current.x = (sx / mine.size + 0.5) * CELL;
        pRef.current.y = (sy / mine.size + 0.5) * CELL;
      } else {
        spawnHome();
      }
      pRef.current.tank = TANK.start;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
      chanRef.current = null;
    };
  }, [sessionId, studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Drop a fresh home block somewhere clear and publish it. */
  const spawnHome = () => {
    const cols = colsRef.current, rows = rowsRef.current;
    const margin = SPAWN_HALF + 2;
    let cx = 0, cy = 0;
    // A handful of tries is plenty: prefer bare floor, but never loop forever
    // on a nearly-full arena — landing on someone's turf just means the block
    // takes it, which is a legal capture anyway.
    for (let attempt = 0; attempt < 24; attempt++) {
      cx = margin + Math.floor(Math.random() * (cols - margin * 2));
      cy = margin + Math.floor(Math.random() * (rows - margin * 2));
      if (!boardRef.current.owner.has(cy * cols + cx)) break;
    }
    const block = spawnBlock(cx, cy, cols, rows);
    pathsRef.current.invalidate(claimCells(boardRef.current, studentId, hueRef.current, block, cols * rows));
    for (const idx of block) pendingRef.current.add(idx);
    pRef.current.x = (cx + 0.5) * CELL;
    pRef.current.y = (cy + 0.5) * CELL;
    pRef.current.angle = -Math.PI / 2;
    pRef.current.alive = true;
    pRef.current.moving = false;
    clearTrail();
  };
  const spawnHomeRef = useRef(spawnHome);
  spawnHomeRef.current = spawnHome;

  const clearTrail = () => {
    trailRef.current.clear();
    trailResetRef.current = true;
  };

  // ── Session status → phase ──────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    if (session.status === "lobby") setPhase("waiting");
    else if (session.status === "running") setPhase("playing");
    else if (session.status === "finished") setPhase("done");
  }, [session?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { hueRef.current = myHue; }, [myHue]);
  useEffect(() => { nameRef.current = me?.name ?? ""; }, [me?.name]);

  // ── Flush newly-owned cells to the append-only log ──────────────────────
  // One insert in flight at a time. Overlapping inserts could land in the
  // opposite order to the order they happened in, and for a last-write-wins
  // replay that means a cell we captured could end up back with whoever we took
  // it from — or worse, a wipe landing after the claims that followed it.
  const flush = (op: "claim" | "wipe" = "claim") => {
    if (op === "claim" && (flushingRef.current || pendingRef.current.size === 0)) return;
    const batch = op === "claim" ? Array.from(pendingRef.current) : [];
    pendingRef.current.clear();
    flushingRef.current = true;
    const requeue = () => {
      flushingRef.current = false;
      // Never drop cells on a failed write: the log is the score, so a lost
      // batch is lost territory. Put them back and try again next tick.
      for (const idx of batch) pendingRef.current.add(idx);
    };
    supabase.from("paint_fight_strokes")
      .insert({ session_id: sessionId, student_id: studentId, hue: hueRef.current, cell_indices: batch, op })
      .then(({ error }) => { if (error && op === "claim") requeue(); else flushingRef.current = false; }, requeue);
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;

  // Make sure the last capture of the match is on record.
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

    const cols = () => colsRef.current;
    const rows = () => rowsRef.current;

    /** Everything we own is gone; publish it so it clears on every screen. */
    const die = (reasonAr: string, reasonEn: string) => {
      const p = pRef.current;
      if (!p.alive) return;
      p.alive = false;
      p.respawnAt = Date.now() + RESPAWN_MS;
      pendingRef.current.clear();       // unsent claims died with us
      pathsRef.current.invalidate(wipePlayer(boardRef.current, studentId));
      clearTrail();
      flushRef.current("wipe");
      say(ar ? reasonAr : reasonEn, true);
    };

    const capture = () => {
      const p = pRef.current;
      const mine = cellsOf(boardRef.current, studentId);
      const gained = captureFill(mine, trailRef.current.cells.keys(), cols(), rows());
      clearTrail();
      if (gained.length === 0) return;
      pathsRef.current.invalidate(claimCells(boardRef.current, studentId, hueRef.current, gained, cols() * rows()));
      for (const idx of gained) pendingRef.current.add(idx);
      p.best = Math.max(p.best, (cellsOf(boardRef.current, studentId).size / (cols() * rows())) * 100);
    };

    const physics = (dt: number) => {
      const p = pRef.current;
      if (!p.alive) {
        if (Date.now() >= p.respawnAt) { spawnHomeRef.current(); p.tank = Math.max(p.tank, TANK.rewardPerCorrect); }
        return;
      }
      if (p.tank <= 0) return;                       // tank empty: dead stop, still killable

      // The stick steers; speed is constant. Turning is rate-limited so a
      // flick of the thumb can't fold you back onto your own trail.
      const vec = vectorRef.current;
      if (vec.magnitude > 0) p.moving = true;
      if (!p.moving) return;
      if (vec.magnitude > 0) {
        const want = Math.atan2(vec.dy, vec.dx);
        let d = want - p.angle;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const max = TURN_RATE * dt;
        p.angle += Math.max(-max, Math.min(max, d));
      }

      const x0 = p.x, y0 = p.y;
      const nx = x0 + Math.cos(p.angle) * PLAYER_SPEED * dt;
      const ny = y0 + Math.sin(p.angle) * PLAYER_SPEED * dt;
      const worldW = cols() * CELL, worldH = rows() * CELL;
      const hitWall = nx <= 0 || ny <= 0 || nx >= worldW || ny >= worldH;
      p.x = Math.max(0.5, Math.min(worldW - 0.5, nx));
      p.y = Math.max(0.5, Math.min(worldH - 0.5, ny));
      p.tank = Math.max(0, p.tank - TANK.drainPerSec * dt);

      const cell = cellOfXY(p.x, p.y, cols(), rows()).index;
      const onOwn = boardRef.current.owner.get(cell)?.studentId === studentId;

      // The wall is a wall. Inside your own ground it just stops you; outside,
      // there is nowhere to close your loop from, so it is a death.
      if (hitWall && !onOwn) { die("اصطدمت بالحافة", "You hit the edge"); return; }

      if (onOwn) {
        if (trailRef.current.size > 0) capture();   // loop closed
        return;
      }

      // Outside: lay trail. Crossing your own is fatal, past the grace length
      // that keeps the ground under your own feet from counting.
      if (trailRef.current.extend(x0, y0, p.x, p.y, cols(), rows())) {
        die("قطعت أثرك بنفسك", "You crossed your own trail");
        return;
      }

      // Anyone standing on our trail cuts us off. We judge this against OUR
      // trail, which we hold exactly — the peer position it is tested against
      // is a broadcast, so at worst a cut is a frame late, never wrong about
      // whose trail it was.
      const cutoff = Date.now() - PEER_TIMEOUT_MS;
      for (const id of Object.keys(peersRef.current)) {
        const peer = peersRef.current[id];
        if (peer.t < cutoff || !peer.alive) continue;
        if (!trailRef.current.covers(peer.x, peer.y, cols(), rows())) continue;
        chanRef.current?.send({ type: "broadcast", event: "kill", payload: { by: id, victim: studentId } });
        die("قطع أحدهم أثرك", "Someone cut your trail");
        return;
      }
    };

    const draw = () => {
      const { cssW, cssH } = resizeCanvas(canvas, ctx);
      if (cssW <= 0 || cssH <= 0) return;
      const worldW = cols() * CELL, worldH = rows() * CELL;
      const scale = PIXELS_PER_WORLD_UNIT;
      const p = pRef.current;
      const cam = computeCamera(p.x, p.y, cssW, cssH, scale, worldW, worldH);
      const offX = -(cam.x - cam.halfW) * scale, offY = -(cam.y - cam.halfH) * scale;
      const sx = (wx: number) => offX + wx * scale, sy = (wy: number) => offY + wy * scale;

      drawArena(ctx, cssW, cssH, offX, offY, scale, worldW, worldH);
      drawTerritories(ctx, boardRef.current, pathsRef.current, offX, offY, scale);

      const cutoff = Date.now() - PEER_TIMEOUT_MS;
      const dots = p.alive ? [{ x: p.x, y: p.y, hue: hueRef.current }] : [];
      for (const id of Object.keys(peersRef.current)) {
        const peer = peersRef.current[id];
        if (peer.t < cutoff) { delete peersRef.current[id]; continue; }
        if (!peer.alive) continue;
        drawTrail(ctx, peer.trail, peer.hue, offX, offY, scale, TRAIL_W);
        drawPlayer(ctx, sx(peer.x), sy(peer.y), peer.angle, peer.hue, PLAYER_SIZE * scale);
        drawName(ctx, sx(peer.x), sy(peer.y) - PLAYER_SIZE * scale * 0.85, peer.name, peer.hue, 13);
        dots.push({ x: peer.x, y: peer.y, hue: peer.hue });
      }

      if (p.alive) {
        drawTrail(ctx, [...trailRef.current.points, { x: p.x, y: p.y }], hueRef.current, offX, offY, scale, TRAIL_W);
        drawPlayer(ctx, sx(p.x), sy(p.y), p.angle, hueRef.current, PLAYER_SIZE * scale, { frozen: p.tank <= 0 });
        drawName(ctx, sx(p.x), sy(p.y) - PLAYER_SIZE * scale * 0.85, nameRef.current, hueRef.current, 13);
      }

      const r = 46;
      drawMinimap(ctx, boardRef.current, pathsRef.current, cam, worldW, worldH, dots,
        cssW - r - 16, cssH - r - 140, r);
    };

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      let dt = (t - last) / 1000;
      last = t;
      // A backgrounded tab returns with a huge dt; cap it so the player doesn't
      // teleport across the arena, drawing a trail through everyone on the way.
      if (dt > 0.25) dt = 0.25;
      acc += dt; hudAcc += dt; netAcc += dt; flushAcc += dt;

      let steps = 0;
      while (acc >= STEP && steps < 8) { physics(STEP); acc -= STEP; steps++; }
      if (acc > STEP) acc = 0; // never let the accumulator spiral

      draw();

      if (hudAcc >= 0.2) {
        hudAcc = 0;
        const total = cols() * rows();
        const rowsOut = coverageOf(boardRef.current, total);
        const p = pRef.current;
        const mine = rowsOut.find(r => r.studentId === studentId);
        p.best = Math.max(p.best, mine?.pct ?? 0);
        setHud({ tank: p.tank, pct: mine?.pct ?? 0, best: p.best, kills: p.kills, alive: p.alive });
        setBoard(rowsOut.slice(0, 5));
      }
      if (netAcc >= BROADCAST_INTERVAL_MS / 1000) {
        netAcc = 0;
        const p = pRef.current;
        // Only the trail points added since the last send go on the wire; a
        // full polyline every 70ms from twenty phones is a classroom wifi
        // problem, and peers rebuild the ribbon by appending.
        chanRef.current?.send({
          type: "broadcast", event: "pos",
          payload: {
            id: studentId, name: nameRef.current, hue: hueRef.current, alive: p.alive,
            x: Math.round(p.x), y: Math.round(p.y), angle: Number(p.angle.toFixed(2)),
            reset: trailResetRef.current,
            pts: trailRef.current.pending.map(q => [q.x, q.y]),
          },
        });
        trailRef.current.pending = [];
        trailResetRef.current = false;
      }
      if (flushAcc >= FLUSH_INTERVAL_MS / 1000) { flushAcc = 0; flushRef.current(); }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase, ready, studentId, ar]);

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

  // An empty tank is a dead stop and you are still killable standing there, so
  // put the quiz up without being asked.
  useEffect(() => {
    if (phase === "playing" && hud.tank <= 0 && !showQuiz) openQuiz();
  }, [hud.tank, phase, showQuiz]); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = (idx: number) => {
    if (!currentQ || !me || pickedRef.current !== null) return;
    pickedRef.current = idx;                 // sync guard: a double-tap must not double-count
    setPicked(idx);
    const correct = idx === currentQ.correct_index;

    if (correct) {
      pRef.current.tank = Math.min(TANK.start, pRef.current.tank + TANK.rewardPerCorrect);
      setHud(h => ({ ...h, tank: pRef.current.tank }));
      playCorrect();
      reward.fire(`+${TANK.rewardPerCorrect}`, myColor);
    } else {
      playWrong();  // the button turning red is feedback enough
    }

    // Fire-and-forget writes: the game must never stall waiting on Supabase.
    const updates: { total_answers: number; correct_answers?: number } = {
      total_answers: (me.total_answers ?? 0) + 1,
    };
    if (correct) updates.correct_answers = (me.correct_answers ?? 0) + 1;
    localWriteAtRef.current = Date.now();
    setMe((prev: Record<string, unknown>) => ({ ...prev, ...updates }));
    supabase.from("game_students").update(updates).eq("id", me.id).then(undefined, () => {});
    supabase.from("question_responses").insert({
      session_id: sessionId, student_id: me.id, question_id: currentQ.id,
      question_index: 0, answer_index: idx, is_correct: correct,
    }).then(undefined, () => {});

    setTimeout(() => nextQuestion(), 850);
  };

  const tankPct = Math.max(0, Math.min(100, (hud.tank / TANK.start) * 100));
  const empty = hud.tank <= 0;
  const low = hud.tank > 0 && hud.tank <= TANK.low;

  // ── Waiting ─────────────────────────────────────────────────────────────
  if (phase === "waiting") {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center"
        style={{ background: "#E7F6F0", color: "#123A33" }}>
        <div className="h-16 w-16 rounded-[22%] rotate-12" style={{ background: myColor, border: `4px solid ${myInk}` }} />
        <div>
          <div className="text-[10px] tracking-[0.35em] uppercase mb-1 opacity-50">
            {ar ? "معركة الأرض" : "PAINT FIGHT"}
          </div>
          <div className="text-2xl font-extrabold">{me?.name ?? "—"}</div>
        </div>
        <p className="text-sm max-w-xs leading-relaxed font-semibold opacity-75">
          {ar
            ? "اخرج من أرضك، ارسم دائرة، وعُد إليها — كل ما أحطت به يصبح لك. لا تلمس أثرك ولا يلمسه أحد، وإلا خسرت كل شيء. الحركة تستهلك اللون، والإجابة الصحيحة تملأ الخزان."
            : "Leave your ground, loop around, come back — everything you enclose becomes yours. Let anyone touch your trail and you lose the lot. Moving spends colour; a correct answer refills the tank."}
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
        style={{ background: "#E7F6F0", color: "#123A33" }}>
        <Trophy className="h-16 w-16" style={{ color: "#8FC44A" }} />
        <div className="text-2xl font-extrabold">{ar ? "انتهت المعركة" : "Fight Over"}</div>
        <div className="flex gap-2.5">
          {[
            { label: ar ? "أرضك" : "TERRITORY", value: `${hud.pct.toFixed(1)}%`, color: myInk },
            { label: ar ? "إقصاءات" : "CUTS", value: String(hud.kills), color: "#b91c1c" },
            { label: ar ? "صحيح" : "CORRECT", value: String(me?.correct_answers ?? 0), color: "#15803d" },
          ].map(s => (
            <div key={s.label} className="px-4 py-3 rounded-2xl bg-white/80">
              <div className="text-[9px] tracking-widest font-bold opacity-50">{s.label}</div>
              <div className="text-2xl font-extrabold tabular-nums" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
        <button onClick={() => navigate("/join")}
          className="mt-3 px-8 py-3 rounded-full font-extrabold text-sm text-white active:scale-95 transition-transform"
          style={{ background: "#123A33" }}>
          {ar ? "خروج" : "EXIT"}
        </button>
      </div>
    );
  }

  // ── Playing ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{ background: "#D8EDE6", touchAction: "none" }}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {!showQuiz && <PaintJoystick vectorRef={vectorRef} />}

      {/* ── HUD. Laid out like the reference: your own numbers top-left, the
          standings top-right, both as soft pills over the arena. Forced LTR —
          the site renders RTL in Arabic, which would otherwise mirror the two
          corners and swap the percentage onto the wrong side of every pill. */}
      <div dir="ltr" className="absolute inset-x-0 top-0 p-3 pointer-events-none flex items-start justify-between gap-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <div className="flex flex-col items-start gap-1.5">
          <div className="px-3 py-1 rounded-full text-white text-[15px] font-extrabold tabular-nums shadow-sm"
            style={{ background: empty ? "#8A9A95" : myColor }}>
            {hud.pct.toFixed(2)}%
          </div>
          <div className="ps-1 text-[11px] font-bold tracking-wide" style={{ color: "rgba(18,58,51,0.55)" }}>
            {ar ? "الأفضل" : "BEST"} {hud.best.toFixed(2)}%
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/70">
            <Skull className="h-3.5 w-3.5" style={{ color: "#123A33" }} />
            <span className="text-[12px] font-extrabold tabular-nums" style={{ color: "#123A33" }}>x{hud.kills}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          {board.map((row, i) => (
            <div key={row.studentId}
              className="px-2.5 py-0.5 rounded-full text-white text-[12px] font-extrabold tabular-nums shadow-sm max-w-[52vw] truncate"
              style={{ background: hueFill(row.hue), opacity: row.studentId === studentId ? 1 : 0.88 }}>
              {i + 1}- {row.pct.toFixed(2)}% {row.studentId === studentId ? (ar ? "أنت" : "you") : ""}
            </div>
          ))}
        </div>
      </div>

      {/* The colour tank — the only thing the quiz feeds, so it gets the bottom
          of the screen where a thumb already is. */}
      <div className="absolute inset-x-0 flex justify-center px-6 pointer-events-none"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 4.6rem)" }}>
        <div className="w-full max-w-[260px] h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(18,58,51,0.14)" }}>
          <div className="h-full rounded-full transition-[width] duration-100"
            style={{ width: `${tankPct}%`, background: empty ? "#dc2626" : low ? "#e0812a" : myColor }} />
        </div>
      </div>

      {toast && (
        <div className="absolute inset-x-0 top-[38%] flex justify-center px-8 pointer-events-none">
          <div className="px-5 py-2.5 rounded-full text-sm font-extrabold text-white text-center shadow-lg"
            style={{ background: toast.bad ? "#B4342F" : "#123A33" }}>
            {toast.text}
          </div>
        </div>
      )}

      {(empty || low) && !showQuiz && (
        <div className="absolute inset-x-0 top-[52%] flex justify-center px-8 pointer-events-none">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-extrabold text-white animate-pulse"
            style={{ background: empty ? "#dc2626" : "#e0812a" }}>
            <Droplet className="h-4 w-4" />
            {empty ? (ar ? "نفد اللون" : "OUT OF COLOUR") : (ar ? "اللون على وشك النفاد" : "LOW COLOUR")}
          </div>
        </div>
      )}

      {!showQuiz && (
        <button onClick={openQuiz}
          className={cn(
            "absolute left-1/2 -translate-x-1/2 z-10 px-6 py-3 rounded-full text-sm font-extrabold text-white shadow-lg active:scale-95 transition-transform",
            empty && "animate-pulse",
          )}
          style={{ background: empty ? "#dc2626" : "#123A33", bottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
          {ar ? "أجب لتملأ الخزان" : "Fill the tank"}
        </button>
      )}

      {/* ── The question screen ──────────────────────────────────────────
          Same visual language as the arena, because it IS the arena's other
          half: the mint ground, flat rounded blobs of claimed colour behind
          the card, and four answers as four players' colours. A dark panel
          here read as a different game bolted onto this one. */}
      {showQuiz && (
        <div dir={ar ? "rtl" : "ltr"} className="absolute inset-0 z-40 flex flex-col overflow-hidden"
          style={{ background: PF.floor }}>
          {/* Decorative territory. Purely background: it is the shape language
              of a captured blob, at the size a blob would be if the card were
              standing on the arena. */}
          <div aria-hidden className="absolute inset-0 pointer-events-none">
            {BLOBS.map((b, i) => (
              <div key={i} className="absolute"
                style={{
                  left: b.left, top: b.top, width: b.size, height: b.size,
                  background: hueFill(b.hue, 0.16), borderRadius: b.radius,
                  transform: `rotate(${b.rotate}deg)`,
                }} />
            ))}
          </div>

          <div className="relative flex items-center justify-between gap-3 px-4 py-3 shrink-0"
            style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
            <div className="relative flex items-center gap-2 min-w-0">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white shadow-sm"
                style={{ background: empty ? "#dc2626" : myColor }}>
                <Droplet className="h-3.5 w-3.5 shrink-0" />
                <span className="text-sm font-black tabular-nums">{Math.round(hud.tank)}</span>
              </div>
              <span className="text-xs font-bold truncate" style={{ color: PF.inkSoft }}>
                +{TANK.rewardPerCorrect} {ar ? "لكل إجابة صحيحة" : "per correct"}
              </span>
              <reward.Layer />
            </div>
            <button onClick={() => setShowQuiz(false)} disabled={empty}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black text-white shadow-sm disabled:opacity-30 active:scale-95 transition-transform"
              style={{ background: PF.ink }}>
              <X className="h-3.5 w-3.5" />{ar ? "عودة" : "BACK"}
            </button>
          </div>

          <div className="relative px-4 pb-1 shrink-0">
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(18,58,51,0.12)" }}>
              <div className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${tankPct}%`, background: empty ? "#dc2626" : low ? "#e0812a" : myColor }} />
            </div>
          </div>

          {currentQ ? (
            <div className="relative flex-1 flex flex-col justify-center gap-4 p-4 min-h-0 overflow-y-auto">
              <div className="px-5 py-6 rounded-[28px] bg-white shrink-0"
                style={{ boxShadow: "0 10px 30px rgba(18,58,51,0.10)" }}>
                {currentQ.image_url && (
                  <img src={currentQ.image_url} alt="" className="mx-auto max-h-[22vh] w-auto object-contain mb-4 rounded-2xl" />
                )}
                <p className="text-[17px] font-extrabold leading-snug text-center" style={{ color: PF.ink }}>
                  {currentQ.text}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 shrink-0">
                {currentQ.options.map((opt, i) => {
                  const isCorrect = i === currentQ.correct_index;
                  const isPicked = picked === i;
                  const show = picked !== null;
                  // Each answer is a different player's colour, so the screen
                  // reads as the same world as the arena rather than a form.
                  const hue = ANSWER_HUES[i % ANSWER_HUES.length];
                  let bg = hueFill(hue), col = "#ffffff", ring = hueDeep(hue), scale = "";
                  if (show && isCorrect)          { bg = "#22a35a"; ring = "#15803d"; scale = "scale-[1.03]"; }
                  else if (show && isPicked)      { bg = "#d64545"; ring = "#a02c2c"; }
                  else if (show)                  { bg = "rgba(18,58,51,0.07)"; ring = "transparent"; col = "rgba(18,58,51,0.35)"; }
                  return (
                    <button key={i} disabled={show} onClick={() => answer(i)}
                      className={cn(
                        "min-h-[84px] px-3 py-4 rounded-[26px] text-[15px] font-extrabold text-center flex items-center justify-center transition-all duration-200 active:scale-95",
                        scale,
                        show && isCorrect && "animate-answer-correct",
                        show && isPicked && !isCorrect && "animate-answer-wrong",
                      )}
                      style={{ background: bg, color: col, boxShadow: show ? "none" : `0 5px 0 0 ${ring}` }}>
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="relative flex-1 flex items-center justify-center text-sm font-bold px-6 text-center"
              style={{ color: PF.inkSoft }}>
              {ar ? "لا توجد أسئلة في هذا الاختبار." : "This quiz has no questions."}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PaintFightGame;
