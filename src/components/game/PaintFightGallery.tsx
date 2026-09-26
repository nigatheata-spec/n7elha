import { useEffect, useRef, type ReactNode } from "react";
import type { Territory } from "@/lib/paintFight";
import { drawPainting, type TerritoryPaths } from "@/lib/paintFightRender";

// ── Paint Fight — the finished painting ─────────────────────────────────────
// When the match ends, the arena is hung on the wall: the round sheet exactly
// as it finished, in a round wooden frame with a paper mat, under a title. The
// projector shows it big with the podium beside it; every phone shows the same
// picture above the student's own numbers. It is the same board the scores
// were tallied from, so the picture and the percentages can't disagree.

interface Props {
  board: Territory;
  paths: TerritoryPaths;
  cols: number;
  rows: number;
  /** Frame diameter in CSS px. */
  size: number;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

const PaintFightGallery = ({ board, paths, cols, rows, size, title, subtitle, children }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frame = Math.max(10, Math.round(size * 0.05));
  const mat = Math.max(8, Math.round(size * 0.04));
  const inner = size - (frame + mat) * 2;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || inner <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(inner * dpr);
    canvas.height = Math.round(inner * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const paint = () => drawPainting(ctx, inner, inner, board, paths, cols, rows);
    paint();
    // The board is live and mutated in place: the last captures of the match
    // are still landing for a moment after it ends, so paint again once they
    // have.
    const t = setTimeout(paint, 1500);
    return () => clearTimeout(t);
  }, [board, paths, cols, rows, inner]);

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div>
        <div className="text-2xl md:text-4xl font-extrabold tracking-tight">{title}</div>
        {subtitle && <div className="mt-1 text-sm md:text-base font-bold opacity-60">{subtitle}</div>}
      </div>
      <div
        className="rounded-full animate-scale-in shrink-0"
        style={{
          width: size, height: size, padding: frame,
          // Wood: a warm ring with a lighter bevel inside and a drop shadow on the wall.
          background: "radial-gradient(circle at 35% 30%, #A8723F, #6E4521 70%)",
          boxShadow: "0 18px 40px rgba(0,0,0,0.35), inset 0 0 0 3px rgba(255,220,170,0.25)",
        }}
      >
        <div className="rounded-full h-full w-full" style={{ padding: mat, background: "#FBF7EE", boxShadow: "inset 0 3px 10px rgba(60,35,10,0.35)" }}>
          <canvas ref={canvasRef} className="rounded-full block" style={{ width: inner, height: inner }} />
        </div>
      </div>
      {children}
    </div>
  );
};

export default PaintFightGallery;
