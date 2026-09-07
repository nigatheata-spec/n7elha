import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Square, Maximize, Trophy, Timer, Skull } from "lucide-react";
import {
  CELL, PEER_TIMEOUT_MS, emptyTerritory, applyStroke, coverageOf,
  type CoverageRow, type Stroke, type Territory,
} from "@/lib/paintFight";
import {
  resizeCanvas, drawArena, drawTerritories, drawTrail, drawPlayer, drawName,
  TerritoryPaths, hueFill, PF,
} from "@/lib/paintFightRender";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";

// ── Paint Fight, teacher/projector view ─────────────────────────────────────
// Same single source of truth as the student view: the arena picture is drawn
// straight from territory rebuilt by replaying paint_fight_strokes, and the
// standings are the tally of that exact same board — so what's on the
// projector and what the results page reports can't disagree.
//
// The monitor is a pure OBSERVER. It never judges a capture or a death (each
// client does that for itself and appends the result), and nothing here writes
// game state except the teacher pressing END or the match clock running out.
// That matters: the projector being closed and reopened must not change the
// game.

type Peer = {
  id: string; name: string; x: number; y: number; angle: number; hue: number;
  alive: boolean; trail: { x: number; y: number }[]; t: number;
};

interface Props { session: any; sessionId: string; }

const PaintFightMonitor = ({ session, sessionId }: Props) => {
  const nav = useNavigate();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const { i18n } = useTranslation();
  const ar = (session?.settings?.lang ?? i18n.language) === "ar";
  const cols: number = session?.settings?.arenaCols ?? 60;
  const rows: number = session?.settings?.arenaRows ?? 81;
  const totalCells = cols * rows;

  const [students, setStudents] = useState<any[]>([]);
  const [coverage, setCoverage] = useState<CoverageRow[]>([]);
  const [claimedPct, setClaimedPct] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boardRef  = useRef<Territory>(emptyTerritory());
  const pathsRef  = useRef<TerritoryPaths>(new TerritoryPaths(cols));
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
    boardRef.current = emptyTerritory();
    pathsRef.current = new TerritoryPaths(cols);

    // Rows landing between subscribe and backfill are buffered rather than
    // dropped: replaying a claim twice is harmless, losing one is permanent,
    // and a wipe applied out of order would erase live territory.
    const buffer: Stroke[] = [];
    let historyApplied = false;

    const apply = (row: Stroke) => {
      pathsRef.current.invalidate(applyStroke(boardRef.current, row, colsRef.current * rowsRef.current));
    };

    const refreshStudents = async () => {
      const { data } = await supabase.from("game_students").select("*").eq("session_id", sessionId);
      if (!cancelled) setStudents(data ?? []);
    };

    const ch = supabase.channel(`pf-${sessionId}`, { config: { broadcast: { self: false } } })
      .on("postgres_changes", { event: "*", schema: "public", table: "game_students", filter: `session_id=eq.${sessionId}` }, refreshStudents)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "paint_fight_strokes", filter: `session_id=eq.${sessionId}` },
        (p: any) => { const row = p.new as Stroke; if (historyApplied) apply(row); else buffer.push(row); })
      .on("broadcast", { event: "pos" }, ({ payload }: any) => {
        if (!payload?.id) return;
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
      .subscribe();

    (async () => {
      await refreshStudents();
      const { data } = await supabase.from("paint_fight_strokes")
        .select("student_id,hue,cell_indices,op").eq("session_id", sessionId).order("created_at", { ascending: true });
      if (cancelled) return;
      for (const row of (data ?? []) as Stroke[]) apply(row);
      for (const row of buffer) apply(row);
      buffer.length = 0;
      historyApplied = true;
    })();

    // The standings are derived on a slow interval instead of per stroke
    // INSERT. Twenty players capturing is a burst of inserts; re-deriving and
    // re-rendering the panel on each one is what made it flicker.
    const iv = setInterval(() => {
      if (cancelled) return;
      const total = colsRef.current * rowsRef.current;
      setCoverage(coverageOf(boardRef.current, total));
      setClaimedPct(total > 0 ? (boardRef.current.owner.size / total) * 100 : 0);
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

      drawArena(ctx, cssW, cssH, offX, offY, scale, worldW, worldH);
      drawTerritories(ctx, boardRef.current, pathsRef.current, offX, offY, scale);

      const cutoff = Date.now() - PEER_TIMEOUT_MS;
      for (const id of Object.keys(peersRef.current)) {
        const p = peersRef.current[id];
        if (p.t < cutoff) { delete peersRef.current[id]; continue; }
        if (!p.alive) continue;
        drawTrail(ctx, p.trail, p.hue, offX, offY, scale, 9);
        const x = offX + p.x * scale, y = offY + p.y * scale;
        drawPlayer(ctx, x, y, p.angle, p.hue, Math.max(12, 17 * scale));
        drawName(ctx, x, y - Math.max(12, 17 * scale) * 0.9, p.name, p.hue, Math.max(11, 13 * scale));
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Match clock ─────────────────────────────────────────────────────────
  // settings.minutes is optional; with no value the match runs until the
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

  const studentFor = (id: string) => students.find(s => s.id === id);
  const clock = secondsLeft == null
    ? null
    : `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: "#0F2E28", color: "#fff" }}>
      {ConfirmDialog}
      <div className="h-full flex flex-col p-4 gap-3">
        <div className="flex items-center justify-between text-xs gap-3 shrink-0">
          <div className="text-white/55">
            {ar ? "الرمز" : "CODE"} <span className="text-base font-black tracking-widest" style={{ color: "#8FC44A" }}>{session?.code}</span>
            <span className="mx-3 opacity-30">|</span>
            <span className="font-bold">{students.length} {ar ? "لاعب" : students.length === 1 ? "PLAYER" : "PLAYERS"}</span>
            <span className="mx-3 opacity-30">|</span>
            <span className="font-bold tabular-nums">{claimedPct.toFixed(0)}%</span> {ar ? "من الأرض محتلّة" : "of the ground claimed"}
          </div>
          <div className="flex items-center gap-2">
            {clock && (
              <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white text-[#0F2E28]">
                <Timer className="h-3.5 w-3.5" />
                <span className="text-sm font-black tabular-nums">{clock}</span>
              </div>
            )}
            <Button size="sm" variant="ghost" onClick={goFullscreen} className="text-white hover:text-white hover:bg-white/10 rounded-full">
              <Maximize className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={confirmEnd} className="rounded-full bg-red-600 hover:bg-red-700 text-white font-bold">
              <Square className="h-4 w-4 me-1" />{ar ? "إنهاء" : "END"}
            </Button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-[1fr_320px] gap-4 min-h-0">
          <div className="overflow-hidden min-h-0 rounded-3xl" style={{ background: PF.void }}>
            <canvas ref={canvasRef} className="h-full w-full block" />
          </div>

          {/* Standings, as the reference's colored pills rather than a table —
              at projector distance the color is what the class reads, not the
              row. Forced LTR so rank and percentage stay in that order in
              Arabic; the name is the only part that should flip. */}
          <div className="flex flex-col gap-2 min-h-0">
            <div className="flex items-center gap-1.5 text-xs font-black tracking-widest uppercase shrink-0" style={{ color: "#8FC44A" }}>
              <Trophy className="h-4 w-4" />{ar ? "الترتيب" : "Standings"}
            </div>
            <div dir="ltr" className="space-y-1.5 overflow-y-auto pe-1">
              {coverage.length === 0 && (
                <div className="text-center py-10 text-sm animate-pulse text-white/40">
                  {ar ? "بانتظار أول أرض..." : "Waiting for the first claim..."}
                </div>
              )}
              {coverage.map((row, i) => {
                const s = studentFor(row.studentId);
                return (
                  <div key={row.studentId}
                    className="flex items-center gap-2 px-3 py-2 rounded-full text-[#0F2E28]"
                    style={{ background: hueFill(row.hue) }}>
                    <span className="font-black text-sm w-5 tabular-nums text-center opacity-70">{i + 1}</span>
                    <span className="text-sm font-black tabular-nums">{row.pct.toFixed(2)}%</span>
                    <span className="flex-1 text-sm font-extrabold truncate">{s?.name ?? "—"}</span>
                    {(s?.fight_kills ?? 0) > 0 && (
                      <span className="flex items-center gap-0.5 text-[11px] font-black opacity-70">
                        <Skull className="h-3 w-3" />{s.fight_kills}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaintFightMonitor;
