import { CSSProperties } from "react";
import lavaCrest1 from "@/assets/lava/lava-crest-1.png";
import lavaCrest2 from "@/assets/lava/lava-crest-2.png";
import lavaCrest3 from "@/assets/lava/lava-crest-3.png";
import lavaBodyUrl from "@/assets/lava/lava-body.png";

/**
 * Pixel-art lava surface, built from real frames extracted from the
 * reference animation (not procedural rects, not AI-approximated art) —
 * cropped, color-quantized to remove JPEG noise, and quantized colors snap
 * back to flat blocks so image-rendering:pixelated stays crisp on scale.
 *
 * The crest cycles through the 3 actual animation frames via hard opacity
 * swaps (no fade — real pixel-art flipbook motion), each tiling horizontally
 * on its own. The body is a single tile cropped so its top row matches its
 * bottom row exactly, so it repeats vertically with no seam.
 */

const CREST_FRAMES = [lavaCrest1, lavaCrest2, lavaCrest3];
const FRAME_CLASS = ["lava-crest-frame-a", "lava-crest-frame-b", "lava-crest-frame-c"];

export const PixelLavaCrest = ({ className, style }: { className?: string; style?: CSSProperties }) => (
  <div className={`relative ${className ?? ""}`} style={style} aria-hidden>
    {CREST_FRAMES.map((url, i) => (
      <div
        key={i}
        className={`absolute inset-0 lava-crest-frame ${FRAME_CLASS[i]}`}
        style={{
          backgroundImage: `url(${url})`,
          backgroundRepeat: "repeat-x",
          backgroundSize: "auto 100%",
          backgroundPosition: "bottom left",
          imageRendering: "pixelated",
        }}
      />
    ))}
  </div>
);

/** The molten body below the surface — tiles seamlessly, drifts slowly upward. */
export const PixelLavaBody = ({ className, style }: { className?: string; style?: CSSProperties }) => (
  <div
    className={`lava-pixel-body-img ${className ?? ""}`}
    style={{
      backgroundImage: `url(${lavaBodyUrl})`,
      backgroundRepeat: "repeat",
      backgroundSize: "150px 20px",
      imageRendering: "pixelated",
      ...style,
    }}
    aria-hidden
  />
);
