// ── Don't Look Down — dev-only art preview ──────────────────────────────────
// Renders the climb with the real pixel renderer and a free-flying camera, with
// no lobby, no Supabase and no student identity. This exists so the level art
// can be looked at end to end while it is being worked on — arrow keys / WASD
// fly, and the theme readout tells you which band you are in.
//
// Route is registered only when import.meta.env.DEV, so it never ships.

import { useEffect, useRef, useState } from "react";
import { WORLD, SUMMIT_Y, colorFor } from "@/lib/dontLookDown";
import {
  setupPixelCanvas, drawSky, drawStars, drawCloud, drawBlock,
  drawCharacter, drawNameTag, drawTopFog, drawGround, CLOUDS,
} from "@/lib/dontLookDownRender";
import { SKINNED, PX, themeBlendAt, themeIndexAt, THEMES, GROUND_Y } from "@/lib/dldLevel";

const DldPreview = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keys = useRef(new Set<string>());
  // ?y=1500 drops the camera straight to that height, for checking one theme.
  const startY = Number(new URLSearchParams(window.location.search).get("y") ?? 240);
  const y0 = Number.isFinite(startY) ? startY : 240;
  // The ladder drifts a long way sideways as it climbs, so start over whichever
  // platform is nearest that height rather than at x=0 looking at empty sky.
  const nearest = SKINNED.reduce((a, b) => (Math.abs(b.y - y0) < Math.abs(a.y - y0) ? b : a), SKINNED[0]);
  const cam = useRef({ x: nearest.x + nearest.w / 2, y: y0, vx: 0, face: 1 as 1 | -1 });
  const [hud, setHud] = useState({ y: 0, theme: 0 });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["arrowleft", "arrowright", "arrowup", "arrowdown", "a", "d", "w", "s", " "].includes(k)) e.preventDefault();
      keys.current.add(k);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    let last = performance.now();
    let hudAcc = 0;

    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;

      const k = keys.current;
      const SPEED = 900;
      const dx = (k.has("arrowright") || k.has("d") ? 1 : 0) - (k.has("arrowleft") || k.has("a") ? 1 : 0);
      const dy = (k.has("arrowup") || k.has("w") ? 1 : 0) - (k.has("arrowdown") || k.has("s") ? 1 : 0);
      cam.current.x += dx * SPEED * dt;
      cam.current.y += dy * SPEED * dt;
      cam.current.vx = dx * 300;
      if (dx) cam.current.face = dx > 0 ? 1 : -1;

      const { ctx, bw, bh } = setupPixelCanvas(canvas);
      if (!ctx) { raf = requestAnimationFrame(frame); return; }

      const viewW = bw / PX, viewH = bh / PX;
      const camX = cam.current.x + WORLD.playerW / 2 - viewW / 2;
      const camY = cam.current.y - viewH * 0.38;
      const camBX = Math.round(camX * PX);
      const camBY = Math.round(camY * PX);
      const sx = (wx: number) => Math.round(wx * PX) - camBX;
      const sy = (wy: number) => bh - (Math.round(wy * PX) - camBY);

      const blend = themeBlendAt(cam.current.y);
      drawSky(ctx, bw, bh, blend);

      const ti = themeIndexAt(cam.current.y);
      drawStars(ctx, bw, bh, camX * PX, camY * PX, ti >= 3 ? 1 : ti === 2 ? 0.35 + blend.t * 0.65 : 0);

      const cloudAlpha = ti >= 3 ? 0 : 1;
      for (const c of CLOUDS) {
        const px = Math.round(c.x * PX - camBX * c.depth);
        const py = Math.round(bh - (c.y * PX - camBY * c.depth));
        if (cloudAlpha === 0) break;
        if (px < -60 || px > bw + 60 || py < -40 || py > bh + 40) continue;
        ctx.globalAlpha = (0.55 + c.depth * 0.45) * cloudAlpha;
        drawCloud(ctx, px, py, c.s);
      }
      ctx.globalAlpha = 1;

      // Ground sits just under the starting block's base so the first platform
      // reads as standing on it rather than sunk into it.
      const groundTop = sy(GROUND_Y);
      if (groundTop < bh) drawGround(ctx, groundTop, bw, bh);

      for (const pl of SKINNED) {
        const x = sx(pl.x), y = sy(pl.y);
        const wpx = Math.round(pl.w * PX), hpx = Math.round(pl.h * PX);
        if (x + wpx < -8 || x > bw + 8) continue;
        if (y > bh + 8 || y + hpx < -8) continue;
        drawBlock(ctx, x, y, pl.block);
      }

      const px = sx(cam.current.x), py = sy(cam.current.y);
      drawCharacter(ctx, px, py, WORLD.playerW * PX, WORLD.playerH * PX, colorFor("preview"), cam.current.face, {
        t: t / 1000, vx: cam.current.vx, grounded: true,
      });
      drawNameTag(ctx, px + (WORLD.playerW * PX) / 2, py - 22, "You");

      drawTopFog(ctx, bw, bh, blend);

      hudAcc += dt;
      if (hudAcc > 0.15) {
        hudAcc = 0;
        setHud({ y: Math.round(cam.current.y), theme: ti });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="fixed inset-0 bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ imageRendering: "pixelated" }} />
      <div className="absolute top-3 left-3 font-mono text-xs text-white bg-black/60 px-3 py-2 rounded">
        <div>WASD / arrows to fly</div>
        <div>y = {hud.y} / {SUMMIT_Y}</div>
        <div>theme = {THEMES[hud.theme].nameEn} ({hud.theme + 1}/{THEMES.length})</div>
      </div>
    </div>
  );
};

export default DldPreview;
