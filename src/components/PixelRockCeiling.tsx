import { CSSProperties } from "react";
import rockCeilingUrl from "@/assets/lava/rock-ceiling.png";

/**
 * Cave-rock ceiling background, built from an AI-generated hard-edge pixel
 * texture that tiles seamlessly left-to-right. Static (no per-frame cost);
 * fades into the dark void just above where the lava crest sits.
 */
export const PixelRockCeiling = ({ className, style }: { className?: string; style?: CSSProperties }) => (
  <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className ?? ""}`} style={{ background: "#0A0610", ...style }} aria-hidden>
    <div
      className="absolute inset-x-0 top-0"
      style={{
        height: "62%",
        backgroundImage: `url(${rockCeilingUrl})`,
        backgroundRepeat: "repeat-x",
        backgroundSize: "auto 100%",
        backgroundPosition: "top left",
        imageRendering: "pixelated",
      }}
    />
    {/* fade the rock silhouette into the dark void above the lava's glow */}
    <div className="absolute inset-x-0" style={{ top: "44%", height: "24%", background: "linear-gradient(to bottom, transparent, #0A0610)" }} />
  </div>
);
