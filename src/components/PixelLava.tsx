import { CSSProperties } from "react";
import lavaCrest1 from "@/assets/lava/lava-crest-1.png";
import lavaCrest2 from "@/assets/lava/lava-crest-2.png";
import lavaCrest3 from "@/assets/lava/lava-crest-3.png";
import lavaBodyMatched from "@/assets/lava/lava-body-matched.png";

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

/**
 * The molten body — same 5-color palette as the crest frames (sampled
 * directly from them), rendered as blocky pixel-art blobs instead of the
 * crest's crust-edge banding, so it reads as the same lava, further down.
 * Rises vertically via a seamless tile.
 */
export const PixelLavaBody = ({ className, style }: { className?: string; style?: CSSProperties }) => (
  <div
    className={`absolute inset-0 lava-body-rise ${className ?? ""}`}
    style={{
      backgroundImage: `url(${lavaBodyMatched})`,
      backgroundRepeat: "repeat",
      backgroundSize: "160px 160px",
      imageRendering: "pixelated",
      ...style,
    }}
    aria-hidden
  />
);
