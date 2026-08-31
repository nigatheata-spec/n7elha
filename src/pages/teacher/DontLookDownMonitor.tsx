import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Square, Maximize, ChevronUp, Trophy, Crosshair } from "lucide-react";
import { WORLD, colorFor } from "@/lib/dontLookDown";
import { getGenerator, platformWorldPos, laserActiveAt, seedFromString } from "@/lib/dontLookDownLevel";
import {
  drawSky, drawTopFog, drawPlatform, drawGround, drawSpikes, drawLaser, drawCloud, ambientFor,
  drawCharacter, drawNameTag, PLATFORM_DRAW_ABOVE, PLATFORM_DRAW_BELOW,
} from "@/lib/dontLookDownRender";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";

type Peer = { id: string; name: string; x: number; y: number; face: number; t: number; vx: number };

interface Props { session: any; sessionId: string; }

const DontLookDownMonitor = ({ session, sessionId }: Props) => {
  const nav = useNavigate();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const { i18n } = useTranslation();
  const ar = (session?.settings?.lang ?? i18n.language) === "ar";
  const [students, setStudents] = useState<any[]>([]);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [followName, setFollowName] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const peersRef  = useRef<Record<string, Peer>>({});
  const genRef    = useRef(getGenerator(sessionId));
  const camRef    = useRef({ x: 0, y: 0, init: false });

  // ── Data + live position feed ─────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    const refresh = async () => {
      const { data } = await supabase.from("game_students").select("*")
        .eq("session_id", sessionId).order("height_reached", { ascending: false });
      setStudents(data ?? []);
    };
    refresh();

    const ch = supabase.channel(`dld-${sessionId}`, { config: { broadcast: { self: false } } })
      .on("postgres_changes", { event: "*", schema: "public", table: "game_sessions", filter: `id=eq.${sessionId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_students", filter: `session_id=eq.${sessionId}` }, refresh)
      .on("broadcast", { event: "pos" }, ({ payload }: any) => {
        if (!payload?.id) return;
        const prev = peersRef.current[payload.id];
        const now = Date.now();
        const dt = prev ? (now - prev.t) / 1000 : 0;
        const vx = prev && dt > 0.01 ? (payload.x - prev.x) / dt : 0;
        peersRef.current[payload.id] = { ...payload, t: now, vx };
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId]);

  // ── Spotlight camera: follow the pinned student, or whoever's leading ────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const gen = genRef.current;

    let raf = 0;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
      if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
        canvas.width = cssW * dpr; canvas.height = cssH * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      const ranked = [...students].sort((a, b) => (b.height_reached ?? 0) - (a.height_reached ?? 0));
      const leaderId = pinnedId ?? ranked[0]?.id ?? null;
      const peer = leaderId ? peersRef.current[leaderId] : undefined;
      const student = students.find(s => s.id === leaderId);
      setFollowName(student?.name ?? "");

      const focusY = peer?.y ?? student?.height_reached ?? 0;
      const focusX = peer?.x ?? 0;
      const cam = camRef.current;
      const targetX = focusX + WORLD.playerW / 2 - cssW / 2;
      const targetY = focusY - cssH * 0.42;
      if (!cam.init) { cam.x = targetX; cam.y = targetY; cam.init = true; }
      cam.x += (targetX - cam.x) * 0.10;
      cam.y += (targetY - cam.y) * 0.10;

      const sx = (wx: number) => wx - cam.x;
      const sy = (wy: number) => cssH - (wy - cam.y);
      const tSec = Date.now() / 1000;

      gen.ensureGeneratedTo(Math.max(0, focusY));
      drawSky(ctx, cssW, cssH, Math.max(0, focusY));

      const viewTop = cam.y - 100, viewBottom = cam.y + cssH + 100;
      for (const band of gen.bands) {
        if (band.endY < viewTop || band.startY > viewBottom) continue;
        for (const part of ambientFor(band)) {
          if (part.y < viewTop || part.y > viewBottom) continue;
          const px = part.x - cam.x * part.depth;
          const py = cssH - (part.y - cam.y * part.depth);
          if (px < -220 || px > cssW + 220 || py < -160 || py > cssH + 160) continue;
          ctx.globalAlpha = 0.5 + part.depth * 0.5;
          drawCloud(ctx, px, py, part.s);
        }
      }
      ctx.globalAlpha = 1;

      const groundScreenY = sy(WORLD.groundY);
      if (groundScreenY < cssH + 100) drawGround(ctx, groundScreenY, cssW, cssH);

      for (const pl of gen.platforms) {
        const pos = platformWorldPos(pl, tSec);
        const x = sx(pos.x), y = sy(pos.y);
        if (x + pl.w < -60 || x > cssW + 60) continue;
        if (y + PLATFORM_DRAW_BELOW < -40) continue;
        if (y - PLATFORM_DRAW_ABOVE > cssH + 40) continue;
        drawPlatform(ctx, x, y, pl.w, { t: tSec });
      }

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

      const cutoff = Date.now() - 5000;
      for (const id of Object.keys(peersRef.current)) {
        const p = peersRef.current[id];
        if (p.t < cutoff) { delete peersRef.current[id]; continue; }
        const x = sx(p.x), y = sy(p.y);
        if (x < -80 || x > cssW + 80 || y < -80 || y > cssH + 80) continue;
        const isLeader = id === leaderId;
        drawCharacter(ctx, x, y, WORLD.playerW, WORLD.playerH, colorFor(id), p.face ?? 1, {
          t: tSec, grounded: true, vx: p.vx, alpha: isLeader ? 1 : 0.6, blinkSeed: seedFromString(id),
        });
        drawNameTag(ctx, x + WORLD.playerW / 2, y + 3, p.name ?? "");
      }

      drawTopFog(ctx, cssW, cssH, Math.max(0, focusY));
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [students, pinnedId]);

  const endNow = async () => {
    if (!session || !(await confirm(ar ? "إنهاء اللعبة الآن؟" : "End the game now?"))) return;
    await supabase.from("game_sessions").update({
      status: "finished", ended_at: new Date().toISOString(),
    }).eq("id", sessionId);
    nav(`/app/games/${session.id}/results`);
  };

  useEffect(() => {
    if (session?.status === "finished") nav(`/app/games/${session.id}/results`, { replace: true });
  }, [session?.status]);

  const goFullscreen = () => {
    const el = document.documentElement as any;
    (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  };

  const ranked = [...students].sort((a, b) => (b.height_reached ?? 0) - (a.height_reached ?? 0));

  return (
    <div className="fixed inset-0 overflow-hidden font-mono text-white" style={{ background: "#0B1020" }}>
      {ConfirmDialog}
      <div className="h-full flex flex-col p-4 gap-3">
        <div className="flex items-center justify-between text-xs gap-3 shrink-0">
          <div style={{ color: "rgba(255,255,255,0.55)" }}>
            {ar ? "الرمز" : "CODE"} <span className="text-base font-black tracking-widest" style={{ color: "#7dd3fc" }}>{session?.code}</span>
            <span className="mx-3 opacity-30">|</span>
            <span className="font-bold">{students.length} {ar ? "متسلق" : students.length === 1 ? "CLIMBER" : "CLIMBERS"}</span>
            {followName && (
              <>
                <span className="mx-3 opacity-30">|</span>
                <span className="inline-flex items-center gap-1.5" style={{ color: "#facc15" }}>
                  <Crosshair className="h-3 w-3" />{ar ? "متابعة" : "Spectating"}: <span className="font-bold">{followName}</span>
                </span>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={goFullscreen} className="text-sky-300 hover:text-sky-300 hover:bg-sky-400/10">
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
            <div className="flex items-center gap-1.5 text-xs font-black tracking-widest uppercase shrink-0"
              style={{ color: "#7dd3fc" }}>
              <ChevronUp className="h-4 w-4" />{ar ? "أعلى تسلّق" : "Highest Climb"}
            </div>
            <div className="space-y-1.5 overflow-y-auto">
              {ranked.length === 0 && (
                <div className="text-center py-10 text-sm animate-pulse" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {ar ? "> بانتظار المتسلقين..." : "> WAITING FOR CLIMBERS..."}
                </div>
              )}
              {ranked.map((s, i) => {
                const pinned = pinnedId === s.id || (!pinnedId && i === 0);
                return (
                  <button key={s.id} onClick={() => setPinnedId(pinnedId === s.id ? null : s.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-start transition-colors"
                    style={{
                      background: pinned ? "rgba(250,204,21,0.10)" : "rgba(255,255,255,0.05)",
                      border: `1px solid ${pinned ? "rgba(250,204,21,0.4)" : "rgba(255,255,255,0.08)"}`,
                    }}>
                    <span className="font-black text-sm w-5 tabular-nums text-center" style={{ color: "rgba(255,255,255,0.4)" }}>{i + 1}</span>
                    <div className="h-8 w-8 rounded flex items-center justify-center font-black text-sm shrink-0"
                      style={{ background: colorFor(s.id), color: "#0B1020" }}>
                      {(s.name ?? "?").charAt(0).toUpperCase()}
                    </div>
                    <span className="flex-1 text-sm font-bold truncate">{s.name}</span>
                    {i === 0 && <Trophy className="h-3.5 w-3.5 shrink-0" style={{ color: "#facc15" }} />}
                    {pinned && <Crosshair className="h-3.5 w-3.5 shrink-0" style={{ color: "#facc15" }} />}
                    <div className="text-right shrink-0">
                      <div className="text-sm font-black tabular-nums" style={{ color: "#7dd3fc" }}>{s.height_reached ?? 0}m</div>
                      <div className="text-[10px] font-bold tabular-nums" style={{ color: "rgba(255,255,255,0.35)" }}>
                        {s.correct_answers ?? 0}/{s.total_answers ?? 0}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DontLookDownMonitor;
