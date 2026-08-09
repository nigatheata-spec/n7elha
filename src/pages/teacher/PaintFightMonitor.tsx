import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Square, Maximize, Trophy } from "lucide-react";
import { CELL, PLAYER_RADIUS, POWERUP_KINDS, computeCoverage, xyOfCell, type CellOwner, type Stroke } from "@/lib/paintFight";
import {
  resizeCanvas, drawArenaBackground, drawPlayerRoller,
  drawNameTag, drawPowerup, hueFill, createPaintLayer, strokeTo, blitPaintLayer,
  rollerIconSize,
} from "@/lib/paintFightRender";

type Peer = { id: string; name: string; x: number; y: number; angle: number; hue: number; t: number };
type Powerup = { id: string; kind: "speed" | "roller" | "splash"; cell_index: number };

const MAX_UNCLAIMED_POWERUPS = 3;
const SPAWN_MIN_MS = 7000, SPAWN_MAX_MS = 10000;
const BRUSH_WIDTH = PLAYER_RADIUS * 2;

interface Props { session: any; sessionId: string; }

const PaintFightMonitor = ({ session, sessionId }: Props) => {
  const nav = useNavigate();
  const { i18n } = useTranslation();
  const ar = (session?.settings?.lang ?? i18n.language) === "ar";
  const cols = session?.settings?.arenaCols ?? 20;
  const rows = session?.settings?.arenaRows ?? 30;
  const totalCells = cols * rows;

  const [students, setStudents] = useState<any[]>([]);
  const [powerups, setPowerups] = useState<Powerup[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const peersRef  = useRef<Record<string, Peer>>({});
  const ownerRef  = useRef<Map<number, CellOwner>>(new Map());
  const paintLayerRef = useRef<HTMLCanvasElement | null>(null);
  const lastPointRef  = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Same stroke-not-stamp approach as the student view — see paintFightRender.ts.
  const paintStroke = (id: string, hue: number, x: number, y: number) => {
    const layer = paintLayerRef.current;
    if (!layer) return;
    const last = lastPointRef.current.get(id);
    strokeTo(layer, last?.x ?? x, last?.y ?? y, x, y, hue, BRUSH_WIDTH);
    lastPointRef.current.set(id, { x, y });
  };

  // ── Data + live feeds ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    paintLayerRef.current = createPaintLayer(cols, rows);
    const refreshStudents = async () => {
      const { data } = await supabase.from("game_students").select("*").eq("session_id", sessionId);
      setStudents(data ?? []);
    };
    refreshStudents();

    (async () => {
      const { data } = await supabase.from("paint_fight_strokes")
        .select("student_id,hue,cell_indices").eq("session_id", sessionId).order("created_at", { ascending: true });
      const loaded = (data ?? []) as Stroke[];
      setStrokes(loaded);
      for (const s of loaded) {
        for (const idx of s.cell_indices) {
          ownerRef.current.set(idx, { studentId: s.student_id, hue: s.hue });
          const { x, y } = xyOfCell(idx, cols);
          paintStroke(s.student_id, s.hue, x, y);
        }
      }
      const { data: pu } = await supabase.from("paint_fight_powerups").select("*").eq("session_id", sessionId).is("claimed_by", null);
      setPowerups((pu ?? []) as Powerup[]);
    })();

    const ch = supabase.channel(`pf-${sessionId}`, { config: { broadcast: { self: false } } })
      .on("postgres_changes", { event: "*", schema: "public", table: "game_sessions", filter: `id=eq.${sessionId}` }, () => {})
      .on("postgres_changes", { event: "*", schema: "public", table: "game_students", filter: `session_id=eq.${sessionId}` }, refreshStudents)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "paint_fight_strokes", filter: `session_id=eq.${sessionId}` },
        (p: any) => {
          const row = p.new as Stroke;
          for (const idx of row.cell_indices) {
            ownerRef.current.set(idx, { studentId: row.student_id, hue: row.hue });
            const { x, y } = xyOfCell(idx, cols);
            paintStroke(row.student_id, row.hue, x, y);
          }
          setStrokes(prev => [...prev, row]);
        })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "paint_fight_powerups", filter: `session_id=eq.${sessionId}` },
        (p: any) => setPowerups(prev => prev.some(x => x.id === p.new.id) ? prev : [...prev, p.new]))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "paint_fight_powerups", filter: `session_id=eq.${sessionId}` },
        (p: any) => setPowerups(prev => prev.filter(x => x.id !== p.new.id)))
      .on("broadcast", { event: "pos" }, ({ payload }: any) => {
        if (!payload?.id) return;
        peersRef.current[payload.id] = { ...payload, t: Date.now() };
        paintStroke(payload.id, payload.hue ?? 0, payload.x, payload.y);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, cols, rows]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sole power-up spawner ──────────────────────────────────────────────────
  useEffect(() => {
    if (session?.status !== "running") return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const { count } = await supabase.from("paint_fight_powerups").select("id", { count: "exact", head: true })
        .eq("session_id", sessionId).is("claimed_by", null);
      if ((count ?? 0) < MAX_UNCLAIMED_POWERUPS) {
        const kind = POWERUP_KINDS[Math.floor(Math.random() * POWERUP_KINDS.length)];
        const cx = Math.floor(Math.random() * cols), cy = Math.floor(Math.random() * rows);
        await supabase.from("paint_fight_powerups").insert({ session_id: sessionId, kind, cell_index: cy * cols + cx });
      }
      timer = setTimeout(tick, SPAWN_MIN_MS + Math.random() * (SPAWN_MAX_MS - SPAWN_MIN_MS));
    };
    timer = setTimeout(tick, 2000);
    return () => clearTimeout(timer);
  }, [session?.status, sessionId, cols, rows]);

  // ── Render the whole arena, scaled to fit, with every painter on it ───────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const draw = () => {
      const { cssW, cssH } = resizeCanvas(canvas, ctx);
      const worldW = cols * CELL, worldH = rows * CELL;
      const scale = Math.min(cssW / worldW, cssH / worldH);
      const offX = (cssW - worldW * scale) / 2, offY = (cssH - worldH * scale) / 2;
      const sx = (wx: number) => offX + wx * scale, sy = (wy: number) => offY + wy * scale;

      drawArenaBackground(ctx, cssW, cssH);
      if (paintLayerRef.current) blitPaintLayer(ctx, paintLayerRef.current, offX, offY, scale);

      const pulse = (Math.sin(Date.now() / 220) + 1) / 2;
      for (const pu of powerups) {
        const x = sx((pu.cell_index % cols) * CELL + CELL / 2), y = sy(Math.floor(pu.cell_index / cols) * CELL + CELL / 2);
        drawPowerup(ctx, x, y, pu.kind, 22 * scale, pulse);
      }

      const cutoff = Date.now() - 5000;
      for (const id of Object.keys(peersRef.current)) {
        const p = peersRef.current[id];
        if (p.t < cutoff) { delete peersRef.current[id]; continue; }
        const x = sx(p.x), y = sy(p.y);
        drawPlayerRoller(ctx, x, y, p.angle ?? 0, p.hue ?? 0, rollerIconSize(BRUSH_WIDTH, scale));
        drawNameTag(ctx, x, y + 14 * scale, p.name ?? "", Math.max(0.65, scale));
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [cols, rows, powerups]);

  const endNow = async () => {
    if (!session || !confirm(ar ? "إنهاء اللعبة الآن؟" : "End the game now?")) return;
    await supabase.from("game_sessions").update({ status: "finished", ended_at: new Date().toISOString() }).eq("id", sessionId);
    nav(`/app/games/${session.id}/results`);
  };

  useEffect(() => {
    if (session?.status === "finished") nav(`/app/games/${session.id}/results`, { replace: true });
  }, [session?.status]);

  const goFullscreen = () => {
    const el = document.documentElement as any;
    (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  };

  const coverage = computeCoverage(strokes, totalCells);
  const nameFor = (id: string) => students.find(s => s.id === id)?.name ?? "—";

  return (
    <div className="fixed inset-0 overflow-hidden font-mono text-white" style={{ background: "#0B1020" }}>
      <div className="h-full flex flex-col p-4 gap-3">
        <div className="flex items-center justify-between text-xs gap-3 shrink-0">
          <div style={{ color: "rgba(255,255,255,0.55)" }}>
            {ar ? "الرمز" : "CODE"} <span className="text-base font-black tracking-widest" style={{ color: "#f0a35c" }}>{session?.code}</span>
            <span className="mx-3 opacity-30">|</span>
            <span className="font-bold">{students.length} {ar ? "طالب" : students.length === 1 ? "PAINTER" : "PAINTERS"}</span>
            <span className="mx-3 opacity-30">|</span>
            {ar ? "الشبكة" : "GRID"} <span className="font-bold">{cols}×{rows}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={goFullscreen} className="text-amber-300 hover:text-amber-300 hover:bg-amber-400/10">
              <Maximize className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={endNow} className="bg-red-600 hover:bg-red-700 text-white font-bold">
              <Square className="h-4 w-4 me-1" />{ar ? "إنهاء" : "END"}
            </Button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-[1fr_320px] gap-4 min-h-0">
          <div className="rounded-xl overflow-hidden min-h-0" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
            <canvas ref={canvasRef} className="h-full w-full" />
          </div>

          <div className="flex flex-col gap-2 min-h-0">
            <div className="flex items-center gap-1.5 text-xs font-black tracking-widest uppercase shrink-0" style={{ color: "#f0a35c" }}>
              <Trophy className="h-4 w-4" />{ar ? "الترتيب حسب المساحة" : "Territory Leaderboard"}
            </div>
            <div className="space-y-1.5 overflow-y-auto">
              {coverage.length === 0 && (
                <div className="text-center py-10 text-sm animate-pulse" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {ar ? "> بانتظار أول ضربة طلاء..." : "> WAITING FOR THE FIRST STROKE..."}
                </div>
              )}
              {coverage.map((row, i) => (
                <div key={row.studentId} className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${i === 0 ? "rgba(250,204,21,0.4)" : "rgba(255,255,255,0.08)"}` }}>
                  <span className="font-black text-sm w-5 tabular-nums text-center" style={{ color: "rgba(255,255,255,0.4)" }}>{i + 1}</span>
                  <div className="h-8 w-8 rounded-full shrink-0" style={{ background: hueFill(row.hue) }} />
                  <span className="flex-1 text-sm font-bold truncate">{nameFor(row.studentId)}</span>
                  {i === 0 && <Trophy className="h-3.5 w-3.5 shrink-0" style={{ color: "#facc15" }} />}
                  <div className="text-sm font-black tabular-nums" style={{ color: hueFill(row.hue) }}>{row.pct.toFixed(0)}%</div>
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
