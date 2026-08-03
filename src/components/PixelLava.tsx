import { CSSProperties } from "react";

/**
 * Pixel-art lava surface.
 *
 * Everything is drawn on a 4-unit pixel grid with shapeRendering="crispEdges"
 * and 2px-wide steps, so the crest stays hard-edged and chunky at any scale
 * instead of smoothing into the vector waves this replaces. The tile repeats
 * via a duplicated <g>, and the crest scrolls by animating a double-width SVG.
 */

const PX = 4;                 // one "pixel"
const STEP = 2;                // step width in pixels — wider steps read as chunkier rock
const COLS = 16;                // steps per tile
const TILE = COLS * STEP * PX;  // tile width in svg units
const CREST_ROWS = 4;           // rows of stepped edge above the hot band

// Per-step crest height, in pixel rows down from the top. Hand-tuned rather
// than random so the silhouette reads as chunky lava rock, not noise.
const CREST = [1, 0, 1, 2, 1, 0, 1, 1, 2, 1, 0, 1, 2, 1, 1, 0];

const C = {
  tip:    "#FFD37A", // lit crest pixel
  bright: "#F9A62B", // hot surface band
  band:   "#EE7B2A", // base of the hot band, meets the body
  bubble: "#8C3A22", // dark arch mouth
};

/** Bubble arches sitting in the hot band, like the reference art. */
const BUBBLES = [
  { x: 4,  y: 7 },
  { x: 14, y: 8 },
  { x: 24, y: 7 },
];

const CrestTile = ({ idOffset }: { idOffset: number }) => (
  <g transform={`translate(${idOffset * TILE} 0)`}>
    {CREST.map((top, i) => {
      const x = i * STEP * PX;
      const w = STEP * PX;
      return (
        <g key={i}>
          <rect x={x} y={top * PX} width={w} height={PX} fill={C.tip} />
          <rect x={x} y={(top + 1) * PX} width={w} height={(CREST_ROWS - top) * PX} fill={C.bright} />
        </g>
      );
    })}
    {BUBBLES.map((b, i) => (
      <g key={`b${i}`}>
        <rect x={b.x * PX}       y={b.y * PX}       width={PX * 3} height={PX} fill={C.bubble} />
        <rect x={b.x * PX}       y={(b.y + 1) * PX} width={PX}     height={PX} fill={C.bubble} />
        <rect x={(b.x + 2) * PX} y={(b.y + 1) * PX} width={PX}     height={PX} fill={C.bubble} />
      </g>
    ))}
  </g>
);

/** The stepped, scrolling top edge of the lava. */
export const PixelLavaCrest = ({ className, style }: { className?: string; style?: CSSProperties }) => (
  <div className={`relative overflow-hidden ${className ?? ""}`} style={style}>
    <svg
      className="absolute inset-y-0 left-0 h-full"
      style={{ width: "200%", animation: "lava-wave-x 7s linear infinite" }}
      viewBox={`0 0 ${TILE * 2} 44`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      aria-hidden
    >
      {/* base fill under the crest so no background shows through the steps */}
      <rect x="0" y={CREST_ROWS * PX} width={TILE * 2} height={44} fill={C.band} />
      <CrestTile idOffset={0} />
      <CrestTile idOffset={1} />
    </svg>
  </div>
);

/** The molten body below the surface: hard-stop horizontal bands. */
export const PixelLavaBody = ({ className, style }: { className?: string; style?: CSSProperties }) => (
  <div className={`lava-pixel-body ${className ?? ""}`} style={style} aria-hidden />
);
