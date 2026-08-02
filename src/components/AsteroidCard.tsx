import { CSSProperties, ReactNode } from "react";

// Craters with a raised rim (two-tone donut).
const RINGS = [
  { cx: 165, cy: 26, r: 14 },
  { cx: 179, cy: 63, r: 11 },
  { cx: 131, cy: 76, r: 10 },
  { cx: 71,  cy: 70, r: 8 },
  { cx: 186, cy: 89, r: 7 },
  { cx: 112, cy: 31, r: 7.5 },
  { cx: 44,  cy: 88, r: 6.5 },
  { cx: 148, cy: 8,  r: 6 },
];
// Flat pockmarks.
const DOTS = [
  { cx: 146, cy: 55, r: 4 },
  { cx: 101, cy: 86, r: 3.5 },
  { cx: 46,  cy: 50, r: 3 },
  { cx: 161, cy: 80, r: 3 },
  { cx: 190, cy: 44, r: 3.5 },
  { cx: 96,  cy: 93, r: 3 },
  { cx: 124, cy: 57, r: 2.5 },
  { cx: 78,  cy: 40, r: 2.5 },
  { cx: 196, cy: 16, r: 3 },
  { cx: 60,  cy: 22, r: 2 },
  { cx: 172, cy: 44, r: 2.5 },
  { cx: 118, cy: 93, r: 2.5 },
  { cx: 33,  cy: 66, r: 2 },
  { cx: 152, cy: 94, r: 2 },
];

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
};

type Tone = { rock: string; ring: string; hole: string };

const tone = (dim: boolean, active: boolean): Tone =>
  dim
    ? { rock: "#20242B", ring: "#2A2F38", hole: "#0A0C0F" }
    : active
      ? { rock: "#3C4658", ring: "#4C5669", hole: "#12151B" }
      : { rock: "#333B4A", ring: "#414B5C", hole: "#12151B" };

const Craters = ({ uid, t, jx, jy }: { uid: string; t: Tone; jx: number; jy: number }) => (
  <g clipPath={`url(#${uid}-clip)`}>
    <g transform={`translate(${jx},${jy})`}>
      {RINGS.map((c, i) => (
        <g key={`r${i}`}>
          <circle cx={c.cx} cy={c.cy} r={c.r} fill={t.ring} />
          <circle cx={c.cx} cy={c.cy} r={c.r * 0.62} fill={t.hole} />
        </g>
      ))}
      {DOTS.map((c, i) => (
        <circle key={`d${i}`} cx={c.cx} cy={c.cy} r={c.r} fill={t.hole} />
      ))}
    </g>
  </g>
);

/**
 * Cartoon asteroid surface — rounded rectangle, thick black outline, craters of
 * many sizes. Crater positions jitter per `seed` so no two rocks look alike.
 *
 * Default: the SVG sets the height from its 2:1 aspect, content overlays it.
 * `fill`: the rock adapts to whatever the content's box is. The outline is drawn
 * in CSS so it stays crisp at any size, and craters are cropped rather than
 * stretched so they never turn into ellipses.
 */
export const AsteroidCard = ({
  seed,
  dim = false,
  active = false,
  fill = false,
  className,
  style,
  children,
}: {
  seed: string;
  dim?: boolean;
  active?: boolean;
  fill?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) => {
  const h = hash(seed);
  const uid = `ast-${h % 99999}`;
  const jx = (h * 13) % 9 - 4;
  const jy = (h * 29) % 9 - 4;
  const t = tone(dim, active);

  if (fill) {
    return (
      <div
        className={`relative overflow-hidden rounded-2xl ${className ?? ""}`}
        style={{ background: t.rock, border: "4px solid #0A0C10", ...style }}
      >
        <svg
          className="absolute inset-0 h-full w-full pointer-events-none"
          viewBox="0 0 200 100"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <defs>
            <clipPath id={`${uid}-clip`}>
              <rect x="0" y="0" width="200" height="100" />
            </clipPath>
          </defs>
          <Craters uid={uid} t={t} jx={jx} jy={jy} />
        </svg>
        <div className="relative z-10 h-full">{children}</div>
      </div>
    );
  }

  return (
    <div className={`relative ${className ?? ""}`} style={style}>
      <svg className="block w-full h-auto" viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <defs>
          <clipPath id={`${uid}-clip`}>
            <rect x="3" y="3" width="194" height="94" rx="14" />
          </clipPath>
        </defs>

        <rect
          x="3" y="3" width="194" height="94" rx="14"
          fill={t.rock}
          stroke="#0A0C10"
          strokeWidth="4"
          strokeLinejoin="round"
        />

        <Craters uid={uid} t={t} jx={jx} jy={jy} />
      </svg>

      <div className="absolute inset-0 z-10">{children}</div>
    </div>
  );
};

export default AsteroidCard;
