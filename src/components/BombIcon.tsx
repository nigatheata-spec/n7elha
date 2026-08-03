import { CSSProperties } from "react";

// Fuse runs from the top of the stick out to the tip. pathLength is normalised
// to 100 so `burn` maps straight onto dash length and burst position.
const FUSE = "M19 9 C 20 1, 34 0, 36 8 C 38 16.5, 24 18.5, 26 27.5 C 27.2 33.5, 31 35.5, 34 35";

// Sparkler burst: needles radiating from the hot point, uneven lengths so it
// reads as scattering sparks rather than a drawn star.
const RAY_LENGTHS = [9, 5, 7.5, 4.5, 10, 6, 8, 5.5, 9.5, 4.8, 7, 6.5, 8.5, 5.2, 9.2, 6.8, 7.8, 4.6];
const RAYS = RAY_LENGTHS.map((len, i) => {
  const a = (i / RAY_LENGTHS.length) * Math.PI * 2;
  const cos = Math.cos(a), sin = Math.sin(a);
  return {
    x1: +(cos * 1.6).toFixed(2), y1: +(sin * 1.6).toFixed(2),
    x2: +(cos * len).toFixed(2), y2: +(sin * len).toFixed(2),
    w: i % 3 === 0 ? 0.75 : 0.5,
    c: i % 2 === 0 ? "#FFE066" : "#FFF6D0",
  };
});

// Loose sparks that have flown clear of the burst.
const MOTES = [
  { x: 7.5,  y: -6.5, r: 0.55 },
  { x: -6.8, y: -5.2, r: 0.45 },
  { x: 5.2,  y: 7.4,  r: 0.5  },
  { x: -8.2, y: 3.6,  r: 0.4  },
];

/**
 * Dynamite — one definition shared by the Pass It student screen and teacher
 * monitor so the two can never drift apart.
 *
 * Flat cartoon stick with a real lit fuse: `burn` is the fraction of cord left
 * (1 = full, 0 = spent). The cord is trimmed to that length and the sparkler
 * burst rides the burn point, so the icon shows the actual countdown rather
 * than a decorative flash. `sparks` adds embers thrown clear of the burst.
 */
export const BombIcon = ({
  className,
  style,
  burn = 1,
  sparks = false,
}: {
  className?: string;
  style?: CSSProperties;
  burn?: number;
  sparks?: boolean;
}) => {
  const pct = Math.max(0, Math.min(1, burn)) * 100;
  // Masks need unique ids when several icons share a page.
  const uid = `fuse-${Math.round(pct * 100)}-${sparks ? "s" : "n"}`;

  const embers = [
    { dx: 6,    dy: -10, r: 0.75, delay: "0s"    },
    { dx: -5.5, dy: -8,  r: 0.6,  delay: "0.38s" },
    { dx: 8,    dy: -4,  r: 0.55, delay: "0.76s" },
    { dx: -3,   dy: -12, r: 0.7,  delay: "1.12s" },
  ];

  return (
    <svg className={className} style={style} viewBox="0 0 48 48" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {/* Stick */}
      <g transform="translate(15 27) rotate(20)">
        <rect x="-6.5" y="-19" width="13" height="38" rx="2.6" fill="#E9552B" />
        <rect x="-6.5" y="-19" width="4.4" height="38" rx="2.2" fill="#D2431C" />
      </g>

      {/* Only the unburnt run of cord is painted */}
      <mask id={`${uid}-cord`}>
        <path d={FUSE} pathLength={100} stroke="#fff" strokeWidth="4"
          strokeLinecap="round" fill="none" strokeDasharray={`${pct} 100`} />
      </mask>
      <g mask={`url(#${uid}-cord)`}>
        <path d={FUSE} stroke="#3B2A21" strokeWidth="3.2" strokeLinecap="round" fill="none" />
        {/* rope twist */}
        <path d={FUSE} stroke="#6B5040" strokeWidth="1.2" fill="none"
          strokeDasharray="1.3 1.7" opacity="0.7" />
      </g>

      {/* Sparkler burst at the burn point */}
      <g
        style={{
          offsetPath: `path("${FUSE}")`,
          offsetDistance: `${pct}%`,
          offsetRotate: "0deg",
        }}
      >
        <g className="bomb-burst">
          {RAYS.map((r, i) => (
            <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2}
              stroke={r.c} strokeWidth={r.w} strokeLinecap="round" />
          ))}
          {MOTES.map((m, i) => (
            <circle key={`m${i}`} cx={m.x} cy={m.y} r={m.r} fill="#FFE066" />
          ))}
        </g>

        {/* Hot core */}
        <circle r="3.1" fill="#FFC61A" opacity="0.55" />
        <circle r="1.9" fill="#FFF3C4" />

        {sparks && embers.map((e, i) => (
          <circle
            key={`e${i}`}
            r={e.r}
            fill={i % 2 === 0 ? "#FFE066" : "#FFB01A"}
            className="bomb-spark"
            style={{
              ["--dx" as string]: `${e.dx}px`,
              ["--dy" as string]: `${e.dy}px`,
              animationDelay: e.delay,
            }}
          />
        ))}
      </g>
    </svg>
  );
};

export default BombIcon;
