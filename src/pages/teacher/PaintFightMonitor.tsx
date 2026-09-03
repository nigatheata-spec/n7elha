import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Square, Maximize, Trophy, Timer } from "lucide-react";
import {
  CELL, PLAYER_RADIUS, PEER_TIMEOUT_MS,
  applyStrokeIncremental, coverageFromCounts,
  type CellOwner, type CoverageRow, type Stroke,
} from "@/lib/paintFight";
import {
  resizeCanvas, drawArenaBackground, drawPlayerRoller, drawNameTag, hueFill,
  createPaintLayer, paintCells, blitPaint, rollerIconSize,
} from "@/lib/paintFightRender";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";

// ── Paint Fight, teacher/projector view ─────────────────────────────────────
// Same single-source-of-truth design as the student view: the arena picture is
// drawn straight from cell ownership rebuilt by replaying paint_fight_strokes,
// and the leaderboard is the tally of that exact same map — so what's on the
// projector and what the results page reports can't disagree.
//
// The monitor is now a pure observer. It used to also be the power-up spawner,
// which meant the projector being closed/reopened changed the game; there are
// no power-ups any more and nothing here writes game state except the teacher
// pressing END (or the match clock running out).

type Peer = { id: string; name: string; x: number; y: number; angle: number; hue: number; t: number };

const BRUSH_WIDTH = PLAYER_RADIUS * 2;

interface Props { session: any; sessionId: string; }

const PaintFightMonitor = ({ session, sessionId }: Props) => {
  const nav = useNavigate();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const { i18n } = useTranslation();
  const ar = (session?.settings?.lang ?? i18n.language) === "ar";
  const cols: number = session?.settings?.arenaCols ?? 40;
  const rows: number = session?.settings?.arenaRows ?? 60;
  const totalCells = cols * rows;

  const [students, setStudents] = useState<any[]>([]);
  const [coverage, setCoverage] = useState<CoverageRow[]>([]);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layerRef  = useRef<HTMLCanvasElement | null>(null);
  const ownerRef  = useRef<Map<number, CellOwner>>(new Map());
  const countsRef = useRef<Map<string, { hue: number; count: number }>>(new Map());
  const peersRef  = useRef<Record<string, Peer>>({});
  const colsRef   = useRef(cols);
  const rowsRef   = useRef(rows);
  const endedRef  = useRef(false);

  colsRef.current = cols;
  rowsRef.current = rows;

  // ── Data + realtime, in one effect so subscribe/backfill stay ordered ────
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    layerRef.current = createPaintLayer(cols, rows);
    ownerRef.current = new Map();
    countsRef.current = new Map();

    // Rows landing between subscribe and backfill are buffered rather than
    // dropped; replaying one twice is harmless (claiming a cell is idempotent),
    // losing one is permanent.
    const buffer: Stroke[] = [];
    let historyApplied = false;

    const applyStroke = (row: Stroke) => {
      const layer = layerRef.current;
      if (!layer) return;
      applyStrokeIncremental(ownerRef.current, countsRef.current, row.student_id, row.hue, row.cell_indices, colsRef.current * rowsRef.current);
      paintCells(layer, row.cell_indices, row.hue, colsRef.current);
    };

    const refreshStudents = async () => {
      const { data } = await supabase.from("game_students").select("*").eq("session_id", sessionId);
      if (!cancelled) setStudents(data ?? []);
    };

    const ch = supabase.channel(`pf-${sessionId}`, { config: { broadcast: { self: false } } })
      .on("postgres_changes", { event: "*", schema: "public", table: "game_students", filter: `session_id=eq.${sessionId}` }, refreshStudents)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "paint_fight_strokes", filter: `session_id=eq.${sessionId}` },
        (p: any) => { const row = p.new as Stroke; if (historyApplied) applyStroke(row); else buffer.push(row); })
      .on("broadcast", { event: "pos" }, ({ payload }: any) => {
        if (!payload?.id) return;
        peersRef.current[payload.id] = { ...payload, t: Date.now() };
      })
      .subscribe();

    (async () => {
      await refreshStudents();
      const { data } = await supabase.from("paint_fight_strokes")
        .select("student_id,hue,cell_indices").eq("session_id", sessionId).order("created_at", { ascending: true });
      if (cancelled) return;
      for (const row of (data ?? []) as Stroke[]) applyStroke(row);
      for (const row of buffer) applyStroke(row);
      buffer.length = 0;
      historyApplied = true;
    })();

    // The leaderboard is derived on a slow interval instead of on every stroke
    // INSERT. At 20 painters that's ~80 inserts/second; re-deriving and
    // re-rendering the sidebar on each one is what made the panel flicker.
    const iv = setInterval(() => {
      if (!cancelled) setCoverage(coverageFromCounts(countsRef.current, colsRef.current * rowsRef.current));
    }, 600);

    return () => { cancelled = true; clearInterval(iv); supabase.removeChannel(ch); };
  }, [sessionId, cols, rows]);

  // ── Render the whole arena, fit to the box ──────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const { cssW, cssH } = resizeCanvas(canvas, ctx);
      if (cssW <= 0 || cssH <= 0) return;
      const worldW = colsRef.current * CELL, worldH = rowsRef.current * CELL;
      const scale = Math.min(cssW / worldW, cssH / worldH);
      const offX = (cssW - worldW * scale) / 2, offY = (cssH - worldH * scale) / 2;

      drawArenaBackground(ctx, cssW, cssH);
      if (layerRef.current) blitPaint(ctx, layerRef.current, offX, offY, scale);

      const cutoff = Date.now() - PEER_TIMEOUT_MS;
      for (const id of Object.keys(peersRef.current)) {
        const p = peersRef.current[id];
        if (p.t < cutoff) { delete peersRef.current[id]; continue; }
        const x = offX + p.x * scale, y = offY + p.y * scale;
        drawPlayerRoller(ctx, x, y, p.angle ?? 0, p.hue ?? 0, rollerIconSize(BRUSH_WIDTH, scale));
        drawNameTag(ctx, x, y + 14 * scale, p.name ?? "", Math.max(0.9, scale));
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Match clock ─────────────────────────────────────────────────────────
  // settings.minutes is optional; with no value the match simply runs until the
  // teacher presses END. (Nothing here reads settings.timePerQ — Paint Fight
  // has no per-question countdown at all.)
  const endGame = async (redirect = true) => {
    if (endedRef.current) return;
    endedRef.current = true;
    await supabase.from("game_sessions").update({ status: "finished", ended_at: new Date().toISOString() }).eq("id", sessionId);
    if (redirect) nav(`/app/games/${sessionId}/results`, { state: { justEnded: true } });
  };

  useEffect(() => {
    const minutes = Number(session?.settings?.minutes);
    if (!session?.started_at || !Number.isFinite(minutes) || minutes <= 0) { setSecondsLeft(null); return; }
    const deadline = new Date(session.started_at).getTime() + minutes * 60_000;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0 && session.status === "running") endGame(true);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [session?.started_at, session?.settings?.minutes, session?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (session?.status === "finished") nav(`/app/games/${sessionId}/results`, { replace: true, state: { justEnded: true } });
  }, [session?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmEnd = async () => {
    if (!(await confirm(ar ? "إنهاء اللعبة الآن؟" : "End the game now?"))) return;
    endGame(true);
  };

  const goFullscreen = () => {
    const el = document.documentElement as any;
    (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  };

  const nameFor = (id: string) => students.find(s => s.id === id)?.name ?? "—";
  const clock = secondsLeft == null
    ? null
    : `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;
  const paintedPct = totalCells > 0 ? (ownerRef.current.size / totalCells) * 100 : 0;

  return (
    <div className="fixed inset-0 overflow-hidden font-mono" style={{ background: "#3F5A63", color: "#fff" }}>
      {ConfirmDialog}
      <div className="h-full flex flex-col p-4 gap-3">
        <div className="flex items-center justify-between text-xs gap-3 shrink-0">
          <div className="text-white/60">
            {ar ? "الرمز" : "CODE"} <span className="text-base font-black tracking-widest" style={{ color: "#8FC44A" }}>{session?.code}</span>
            <span className="mx-3 opacity-30">|</span>
            <span className="font-bold">{students.length} {ar ? "طالب" : students.length === 1 ? "PAINTER" : "PAINTERS"}</span>
            <span className="mx-3 opacity-30">|</span>
            {ar ? "الشبكة" : "GRID"} <span className="font-bold">{cols}×{rows}</span>
          </div>
          <div className="flex items-center gap-2">
            {clock && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-[#3F5A63] border-2 border-[hsl(var(--nb-border))] shadow-[3px_3px_0_0_hsl(var(--nb-border))]">
                <Timer className="h-3.5 w-3.5" />
                <span className="text-sm font-black tabular-nums">{clock}</span>
              </div>
            )}
            <Button size="sm" variant="ghost" onClick={goFullscreen} className="text-white hover:text-white hover:bg-white/10">
              <Maximize className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={confirmEnd}
              className="bg-red-600 hover:bg-red-700 text-white font-bold border-2 border-[hsl(var(--nb-border))] shadow-[3px_3px_0_0_hsl(var(--nb-border))]">
              <Square className="h-4 w-4 me-1" />{ar ? "إنهاء" : "END"}
            </Button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-[1fr_320px] gap-4 min-h-0">
          <div className="overflow-hidden min-h-0 bg-white/5 border-2 border-[hsl(var(--nb-border))]">
            <canvas ref={canvasRef} className="h-full w-full block" />
          </div>

          <div className="flex flex-col gap-2 min-h-0">
            <div className="flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5 text-xs font-black tracking-widest uppercase" style={{ color: "#8FC44A" }}>
                <Trophy className="h-4 w-4" />{ar ? "الترتيب" : "Territory"}
              </div>
              <span className="text-[11px] font-bold tabular-nums text-white/50">
                {paintedPct.toFixed(0)}% {ar ? "مطلي" : "painted"}
              </span>
            </div>
            <div className="space-y-1.5 overflow-y-auto">
              {coverage.length === 0 && (
                <div className="text-center py-10 text-sm animate-pulse text-white/40">
                  {ar ? "بانتظار أول ضربة طلاء..." : "> WAITING FOR THE FIRST STROKE..."}
                </div>
              )}
              {coverage.map((row, i) => (
                <div key={row.studentId}
                  className="flex items-center gap-2.5 px-3 py-2 bg-white/[0.07] border-2"
                  style={{ borderColor: i === 0 ? "#8FC44A" : "rgba(255,255,255,0.14)" }}>
                  <span className="font-black text-sm w-5 tabular-nums text-center text-white/40">{i + 1}</span>
                  <div className="h-8 w-8 shrink-0 border-2 border-[hsl(var(--nb-border))]" style={{ background: hueFill(row.hue) }} />
                  <span className="flex-1 text-sm font-bold truncate">{nameFor(row.studentId)}</span>
                  {i === 0 && <Trophy className="h-3.5 w-3.5 shrink-0" style={{ color: "#8FC44A" }} />}
                  <div className="text-sm font-black tabular-nums" style={{ color: hueFill(row.hue) }}>{row.pct.toFixed(1)}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaintFightMonitor;
