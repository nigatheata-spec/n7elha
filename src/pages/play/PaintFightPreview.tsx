// ── Paint Fight — dev-only preview ──────────────────────────────────────────
// The whole mode with no lobby, no Supabase and no student identity: one
// keyboard-steered player, a few bots, and a stand-in quiz, so the capture rule,
// the trail, the cut-off rule, the tank loop and the look can all be watched end
// to end while they are being worked on. Arrow keys / WASD steer; the bots loop
// on their own; the questions are placeholders, the meter they feed is real.
//
// It drives the real rules and the real renderer — captureFill, cellsAlongSegment,
// claimCells, drawTerritories — so what you see here is what a match does. Only
// the loop scaffolding around them is local, since the real one is wired to
// realtime and a roster.
//
// Route is registered only when import.meta.env.DEV, so it never ships.

import { useEffect, useRef, useState } from "react";
import { X, Droplet } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CELL, TANK, PLAYER_SPEED, TURN_RATE, TRAIL_RADIUS, PIXELS_PER_WORLD_UNIT,
  emptyTerritory, claimCells, wipePlayer, cellsOf, coverageOf, captureFill,
  cellOfXY, spawnBlock, hueForJoinIndex, computeArenaSize, Trail,
  type Territory, type CoverageRow,
} from "@/lib/paintFight";
import {
  resizeCanvas, drawArena, drawTerritories, drawTrail, drawPlayer, drawName,
  computeCamera, drawMinimap, TerritoryPaths, hueFill, hueDeep, PF,
} from "@/lib/paintFightRender";

type Actor = {
  id: string; name: string; hue: number; bot: boolean;
  x: number; y: number; angle: number; tank: number; moving: boolean;
  trail: Trail;
  turnAt: number;
};

const PLAYER_SIZE = 17;

const ANSWER_HUES = [352, 145, 268, 40];
const BLOBS = [
  { left: "-14%", top: "6%",  size: "58vw", radius: "34%", rotate: -8,  hue: 145 },
  { left: "62%",  top: "-6%", size: "52vw", radius: "38%", rotate: 12,  hue: 352 },
  { left: "70%",  top: "58%", size: "64vw", radius: "40%", rotate: -14, hue: 268 },
  { left: "-20%", top: "70%", size: "60vw", radius: "36%", rotate: 6,   hue: 40  },
];

/** Stand-ins for a real quiz — the meter they feed is the real one. */
const SAMPLE_QUESTIONS = [
  { text: "What is 7 x 8?", options: ["54", "56", "48", "64"], correct: 1 },
  { text: "Which planet is closest to the Sun?", options: ["Venus", "Mars", "Mercury", "Earth"], correct: 2 },
  { text: "How many sides does a hexagon have?", options: ["5", "6", "7", "8"], correct: 1 },
];

const PaintFightPreview = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keys = useRef(new Set<string>());
  const [rowsOut, setRowsOut] = useState<CoverageRow[]>([]);
  const [note, setNote] = useState("");
  const [tank, setTank] = useState(TANK.start);
  const [showQuiz, setShowQuiz] = useState(false);
  const [qIndex, setQIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  const params = new URLSearchParams(window.location.search);
  const botCount = Math.max(0, Math.min(6, Number(params.get("bots") ?? 3)));
  const { cols, rows } = computeArenaSize(botCount + 1);

  const boardRef = useRef<Territory>(emptyTerritory());
  const pathsRef = useRef(new TerritoryPaths(cols));
  const actorsRef = useRef<Actor[]>([]);

  useEffect(() => {
    const board = emptyTerritory();
    boardRef.current = board;
    pathsRef.current = new TerritoryPaths(cols);

    const make = (i: number, bot: boolean): Actor => {
      const cx = Math.round((cols * (i + 1)) / (botCount + 2));
      const cy = Math.round(rows * (0.3 + 0.4 * ((i % 3) / 2)));
      const hue = hueForJoinIndex(i);
      const id = bot ? `bot${i}` : "me";
      claimCells(board, id, hue, spawnBlock(cx, cy, cols, rows), cols * rows);
      return {
        id, hue, bot, name: bot ? `Bot ${i}` : "You",
        x: (cx + 0.5) * CELL, y: (cy + 0.5) * CELL, angle: -Math.PI / 2,
        tank: TANK.start, moving: bot, trail: new Trail(), turnAt: 0,
      };
    };
    actorsRef.current = [make(0, false), ...Array.from({ length: botCount }, (_, i) => make(i + 1, true))];

    const down = (e: KeyboardEvent) => keys.current.add(e.key.toLowerCase());
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [cols, rows, botCount]);

  // Out of tank is a dead stop, so the quiz comes up without being asked —
  // the same rule the real game uses.
  useEffect(() => { if (tank <= 0 && !showQuiz) setShowQuiz(true); }, [tank, showQuiz]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0, last = performance.now(), acc = 0, hudAcc = 0;
    const STEP = 1 / 60;
    const total = cols * rows;

    const kill = (a: Actor, why: string) => {
      pathsRef.current.invalidate(wipePlayer(boardRef.current, a.id));
      a.trail.clear();
      const cx = 4 + Math.floor(Math.random() * (cols - 8));
      const cy = 4 + Math.floor(Math.random() * (rows - 8));
      pathsRef.current.invalidate(
        claimCells(boardRef.current, a.id, a.hue, spawnBlock(cx, cy, cols, rows), total));
      a.x = (cx + 0.5) * CELL; a.y = (cy + 0.5) * CELL;
      a.tank = TANK.start;
      a.moving = a.bot;
      if (!a.bot) setNote(why);
    };

    const step = (dt: number) => {
      const actors = actorsRef.current;
      for (const a of actors) {
        // Bots top themselves up; the player answers for it, same as a match.
        if (a.bot && a.tank <= 0) a.tank = TANK.start;
        if (a.tank <= 0) continue;                    // out of tank: dead stop
        let want: number | null = null;
        if (a.bot) {
          // Wander with occasional turns; the point is to see loops close, not
          // to build a good opponent.
          if (performance.now() > a.turnAt) {
            a.turnAt = performance.now() + 500 + Math.random() * 900;
            a.bot && (want = a.angle + (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 2));
          }
        } else {
          let dx = 0, dy = 0;
          const k = keys.current;
          if (k.has("arrowleft") || k.has("a")) dx -= 1;
          if (k.has("arrowright") || k.has("d")) dx += 1;
          if (k.has("arrowup") || k.has("w")) dy -= 1;
          if (k.has("arrowdown") || k.has("s")) dy += 1;
          if (dx || dy) { want = Math.atan2(dy, dx); a.moving = true; }
        }
        if (!a.moving) continue;
        if (want != null) {
          let d = want - a.angle;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          const max = TURN_RATE * dt;
          a.angle += Math.max(-max, Math.min(max, d));
        }

        const x0 = a.x, y0 = a.y;
        const nx = x0 + Math.cos(a.angle) * PLAYER_SPEED * dt;
        const ny = y0 + Math.sin(a.angle) * PLAYER_SPEED * dt;
        const worldW = cols * CELL, worldH = rows * CELL;
        const hitWall = nx <= 0 || ny <= 0 || nx >= worldW || ny >= worldH;
        a.x = Math.max(0.5, Math.min(worldW - 0.5, nx));
        a.y = Math.max(0.5, Math.min(worldH - 0.5, ny));
        a.tank = Math.max(0, a.tank - TANK.drainPerSec * dt);

        const cell = cellOfXY(a.x, a.y, cols, rows).index;
        const onOwn = boardRef.current.owner.get(cell)?.studentId === a.id;
        if (hitWall && !onOwn) {
          if (a.bot) a.angle += Math.PI / 2 + Math.random(); else { kill(a, "You hit the edge"); }
          if (a.bot) continue;
          continue;
        }
        if (onOwn) {
          if (a.trail.size > 0) {
            const gained = captureFill(cellsOf(boardRef.current, a.id), a.trail.cells.keys(), cols, rows);
            pathsRef.current.invalidate(claimCells(boardRef.current, a.id, a.hue, gained, total));
            a.trail.clear();
            if (!a.bot) setNote(`Captured ${gained.length} cells`);
          }
          continue;
        }

        if (a.trail.extend(x0, y0, a.x, a.y, cols, rows)) {
          kill(a, "You crossed your own trail");
          continue;
        }

        for (const other of actors) {
          if (other === a) continue;
          if (!a.trail.covers(other.x, other.y, cols, rows)) continue;
          kill(a, `${other.name} cut your trail`);
          break;
        }
      }
    };

    const draw = () => {
      const { cssW, cssH } = resizeCanvas(canvas, ctx);
      if (cssW <= 0 || cssH <= 0) return;
      const worldW = cols * CELL, worldH = rows * CELL;
      const scale = PIXELS_PER_WORLD_UNIT;
      const me = actorsRef.current[0];
      if (!me) return;
      const cam = computeCamera(me.x, me.y, cssW, cssH, scale, worldW, worldH);
      const offX = -(cam.x - cam.halfW) * scale, offY = -(cam.y - cam.halfH) * scale;

      drawArena(ctx, cssW, cssH, offX, offY, scale, worldW, worldH);
      drawTerritories(ctx, boardRef.current, pathsRef.current, offX, offY, scale);
      for (const a of actorsRef.current) {
        drawTrail(ctx, [...a.trail.points, { x: a.x, y: a.y }], a.hue, offX, offY, scale, TRAIL_RADIUS * 2);
        const x = offX + a.x * scale, y = offY + a.y * scale;
        drawPlayer(ctx, x, y, a.angle, a.hue, PLAYER_SIZE * scale);
        drawName(ctx, x, y - PLAYER_SIZE * scale * 0.85, a.name, a.hue, 13);
      }
      const r = 46;
      drawMinimap(ctx, boardRef.current, pathsRef.current, cam, worldW, worldH,
        actorsRef.current.map(a => ({ x: a.x, y: a.y, hue: a.hue })), cssW - r - 16, cssH - r - 140, r);
    };

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      let dt = (t - last) / 1000;
      last = t;
      if (dt > 0.25) dt = 0.25;
      acc += dt; hudAcc += dt;
      let n = 0;
      while (acc >= STEP && n < 8) { step(STEP); acc -= STEP; n++; }
      if (acc > STEP) acc = 0;
      draw();
      if (hudAcc >= 0.25) {
        hudAcc = 0;
        setRowsOut(coverageOf(boardRef.current, total).slice(0, 6));
        setTank(actorsRef.current[0]?.tank ?? 0);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [cols, rows]);

  const me = rowsOut.find(r => r.studentId === "me");
  const myHue = hueForJoinIndex(0);
  const empty = tank <= 0, low = tank > 0 && tank <= TANK.low;
  const q = SAMPLE_QUESTIONS[qIndex % SAMPLE_QUESTIONS.length];

  const answer = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === q.correct) {
      const a = actorsRef.current[0];
      if (a) { a.tank = Math.min(TANK.start, a.tank + TANK.rewardPerCorrect); setTank(a.tank); }
    }
    setTimeout(() => { setPicked(null); setQIndex(n => n + 1); }, 850);
  };

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: "#D8EDE6" }}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div dir="ltr" className="absolute inset-x-0 top-0 p-3 flex items-start justify-between gap-3 pointer-events-none">
        <div className="flex flex-col items-start gap-1.5">
          <div className="px-3 py-1 rounded-full text-white text-[15px] font-extrabold tabular-nums"
            style={{ background: hueFill(hueForJoinIndex(0)) }}>
            {(me?.pct ?? 0).toFixed(2)}%
          </div>
          <div className="px-2 py-1 rounded-full bg-white/70 text-[11px] font-bold" style={{ color: "#123A33" }}>
            {note || "WASD / arrows to steer"}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {rowsOut.map((row, i) => (
            <div key={row.studentId} className="px-2.5 py-0.5 rounded-full text-white text-[12px] font-extrabold tabular-nums"
              style={{ background: hueFill(row.hue) }}>
              {i + 1}- {row.pct.toFixed(2)}% {row.studentId}
            </div>
          ))}
        </div>
      </div>

      <div className="absolute inset-x-0 flex justify-center px-6 pointer-events-none" style={{ bottom: "4.6rem" }}>
        <div className="w-full max-w-[260px] h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(18,58,51,0.14)" }}>
          <div className="h-full rounded-full transition-[width] duration-100"
            style={{ width: `${Math.max(0, Math.min(100, (tank / TANK.start) * 100))}%`,
                     background: empty ? "#dc2626" : low ? "#e0812a" : hueFill(myHue) }} />
        </div>
      </div>

      {(empty || low) && !showQuiz && (
        <div className="absolute inset-x-0 top-[52%] flex justify-center pointer-events-none">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-extrabold text-white animate-pulse"
            style={{ background: empty ? "#dc2626" : "#e0812a" }}>
            <Droplet className="h-4 w-4" />{empty ? "OUT OF COLOUR" : "LOW COLOUR"}
          </div>
        </div>
      )}

      {!showQuiz && (
        <button onClick={() => setShowQuiz(true)}
          className={cn("absolute left-1/2 -translate-x-1/2 bottom-4 px-6 py-3 rounded-full text-sm font-extrabold text-white shadow-lg", empty && "animate-pulse")}
          style={{ background: empty ? "#dc2626" : PF.ink }}>
          Fill the tank
        </button>
      )}

      {showQuiz && (
        <div dir="ltr" className="absolute inset-0 z-40 flex flex-col overflow-hidden" style={{ background: PF.floor }}>
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

          <div className="relative flex items-center justify-between gap-3 px-4 py-3 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white shadow-sm"
                style={{ background: empty ? "#dc2626" : hueFill(myHue) }}>
                <Droplet className="h-3.5 w-3.5 shrink-0" />
                <span className="text-sm font-black tabular-nums">{Math.round(tank)}</span>
              </div>
              <span className="text-xs font-bold truncate" style={{ color: PF.inkSoft }}>
                +{TANK.rewardPerCorrect} per correct
              </span>
            </div>
            <button onClick={() => setShowQuiz(false)} disabled={empty}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black text-white shadow-sm disabled:opacity-30"
              style={{ background: PF.ink }}>
              <X className="h-3.5 w-3.5" />BACK
            </button>
          </div>

          <div className="relative px-4 pb-1 shrink-0">
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(18,58,51,0.12)" }}>
              <div className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${Math.max(0, Math.min(100, (tank / TANK.start) * 100))}%`,
                         background: empty ? "#dc2626" : low ? "#e0812a" : hueFill(myHue) }} />
            </div>
          </div>

          <div className="relative flex-1 flex flex-col justify-center gap-4 p-4 min-h-0">
            <div className="px-5 py-6 rounded-[28px] bg-white shrink-0" style={{ boxShadow: "0 10px 30px rgba(18,58,51,0.10)" }}>
              <p className="text-[17px] font-extrabold leading-snug text-center" style={{ color: PF.ink }}>{q.text}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 shrink-0">
              {q.options.map((opt, i) => {
                const show = picked !== null;
                const hue = ANSWER_HUES[i % ANSWER_HUES.length];
                let bg = hueFill(hue), col = "#ffffff", ring = hueDeep(hue);
                if (show && i === q.correct)   { bg = "#22a35a"; ring = "#15803d"; }
                else if (show && picked === i) { bg = "#d64545"; ring = "#a02c2c"; }
                else if (show)                 { bg = "rgba(18,58,51,0.07)"; ring = "transparent"; col = "rgba(18,58,51,0.35)"; }
                return (
                  <button key={i} disabled={show} onClick={() => answer(i)}
                    className="min-h-[84px] px-3 py-4 rounded-[26px] text-[15px] font-extrabold text-center flex items-center justify-center transition-all duration-200 active:scale-95"
                    style={{ background: bg, color: col, boxShadow: show ? "none" : `0 5px 0 0 ${ring}` }}>
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaintFightPreview;
