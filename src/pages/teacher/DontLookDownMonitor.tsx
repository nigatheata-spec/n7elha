import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Square, Maximize, ChevronUp, Trophy } from "lucide-react";
import { PixelShield } from "@/components/PixelIcons";
import { PLATFORMS, SUMMIT_Y, WORLD, colorFor } from "@/lib/dontLookDown";
import { drawSky, drawCloud, drawPlatform, drawCharacter, drawNameTag, drawTopFog, CLOUDS } from "@/lib/dontLookDownRender";

type Peer = { id: string; name: string; x: number; y: number; t: number };

interface Props { session: any; sessionId: string; }

const DontLookDownMonitor = ({ session, sessionId }: Props) => {
  const nav = useNavigate();
  const { i18n } = useTranslation();
  const ar = (session?.settings?.lang ?? i18n.language) === "ar";
  const [students, setStudents] = useState<any[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const peersRef  = useRef<Record<string, Peer>>({});

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
        peersRef.current[payload.id] = { ...payload, t: Date.now() };
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId]);

  // ── Render the whole tower, scaled to fit, with every climber on it ──────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
      if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
        canvas.width = cssW * dpr; canvas.height = cssH * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      // Fit the full world into the canvas
      const minX = Math.min(...PLATFORMS.map(p => p.x)) - 80;
      const maxX = Math.max(...PLATFORMS.map(p => p.x + p.w)) + 80;
      const worldW = maxX - minX, worldH = SUMMIT_Y + 320;
      const scale = Math.min(cssW / worldW, cssH / worldH);
      const offX = (cssW - worldW * scale) / 2;

      const sx = (wx: number) => offX + (wx - minX) * scale;
      const sy = (wy: number) => cssH - (wy + 160) * scale;

      drawSky(ctx, cssW, cssH, 0.35);

      // A few clouds for depth, scaled to the zoomed-out view
      for (const c of CLOUDS) {
        if (c.depth < 0.55) continue;
        const px = sx(c.x), py = sy(c.y);
        if (px < -160 || px > cssW + 160 || py < -120 || py > cssH + 120) continue;
        ctx.globalAlpha = 0.7;
        drawCloud(ctx, px, py, c.s * Math.max(0.35, scale * 1.6));
      }
      ctx.globalAlpha = 1;

      for (const pl of PLATFORMS) {
        drawPlatform(ctx, sx(pl.x), sy(pl.y), Math.max(3, pl.w * scale), {
          checkpoint: pl.checkpoint, scale: Math.max(0.28, scale), pillars: scale > 0.14,
        });
      }

      const cutoff = Date.now() - 5000;
      for (const id of Object.keys(peersRef.current)) {
        const p = peersRef.current[id];
        if (p.t < cutoff) { delete peersRef.current[id]; continue; }
        const w = Math.max(11, WORLD.playerW * scale), h = Math.max(15, WORLD.playerH * scale);
        drawCharacter(ctx, sx(p.x), sy(p.y), w, h, colorFor(id), 1);
        drawNameTag(ctx, sx(p.x) + w / 2, sy(p.y) + 2, p.name ?? "", 0.85);
      }

      drawTopFog(ctx, cssW, cssH, 0.35);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const endNow = async () => {
    if (!session || !confirm(ar ? "إنهاء اللعبة الآن؟" : "End the game now?")) return;
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
      <div className="h-full flex flex-col p-4 gap-3">
        <div className="flex items-center justify-between text-xs gap-3 shrink-0">
          <div style={{ color: "rgba(255,255,255,0.55)" }}>
            {ar ? "الرمز" : "CODE"} <span className="text-base font-black tracking-widest" style={{ color: "#7dd3fc" }}>{session?.code}</span>
            <span className="mx-3 opacity-30">|</span>
            <span className="font-bold">{students.length} {ar ? "متسلق" : students.length === 1 ? "CLIMBER" : "CLIMBERS"}</span>
            <span className="mx-3 opacity-30">|</span>
            {ar ? "القمة" : "SUMMIT"} <span className="font-bold">{SUMMIT_Y}m</span>
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
              {ranked.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${i === 0 ? "rgba(250,204,21,0.4)" : "rgba(255,255,255,0.08)"}` }}>
                  <span className="font-black text-sm w-5 tabular-nums text-center" style={{ color: "rgba(255,255,255,0.4)" }}>{i + 1}</span>
                  <div className="h-8 w-8 rounded flex items-center justify-center font-black text-sm shrink-0"
                    style={{ background: colorFor(s.id), color: "#0B1020" }}>
                    {(s.name ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm font-bold truncate">{s.name}</span>
                  {i === 0 && <Trophy className="h-3.5 w-3.5 shrink-0" style={{ color: "#facc15" }} />}
                  <div className="text-right shrink-0">
                    <div className="text-sm font-black tabular-nums" style={{ color: "#7dd3fc" }}>{s.height_reached ?? 0}m</div>
                    <div className="flex items-center gap-1 justify-end text-[10px] font-bold tabular-nums"
                      style={{ color: "hsl(45 76% 64%)" }}>
                      <PixelShield className="h-2.5 w-2.5" />${s.crypto ?? 0}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DontLookDownMonitor;
