/**
 * Ambient space layer — small rock debris drifting slowly across the screen.
 * Purely decorative: sits behind content, ignores pointer events, and holds to
 * the game's flat cartoon look (solid fills, black outlines, no glow).
 */

const DEBRIS = [
  { top: 9,  size: 18, dur: 78,  delay: -12,  spin: 300,  opacity: 0.45 },
  { top: 22, size: 11, dur: 112, delay: -55,  spin: -240, opacity: 0.32 },
  { top: 34, size: 22, dur: 96,  delay: -30,  spin: 200,  opacity: 0.4 },
  { top: 47, size: 9,  dur: 130, delay: -78,  spin: -400, opacity: 0.26 },
  { top: 58, size: 15, dur: 88,  delay: -47,  spin: 260,  opacity: 0.38 },
  { top: 66, size: 8,  dur: 145, delay: -95,  spin: 420,  opacity: 0.24 },
  { top: 76, size: 19, dur: 104, delay: -66,  spin: -280, opacity: 0.36 },
  { top: 88, size: 12, dur: 121, delay: -20,  spin: 340,  opacity: 0.3 },
  { top: 15, size: 8,  dur: 158, delay: -110, spin: -360, opacity: 0.22 },
  { top: 41, size: 13, dur: 92,  delay: -84,  spin: 380,  opacity: 0.34 },
];

const Rock = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <polygon
      points="30,3 46,10 56,26 52,44 36,56 18,54 5,41 3,22 14,8"
      fill="#333B4A"
      stroke="#0A0C10"
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <circle cx="38" cy="22" r="7"   fill="#414B5C" />
    <circle cx="38" cy="22" r="4.3" fill="#12151B" />
    <circle cx="21" cy="38" r="5"   fill="#414B5C" />
    <circle cx="21" cy="38" r="3"   fill="#12151B" />
    <circle cx="43" cy="41" r="2.6" fill="#12151B" />
    <circle cx="18" cy="18" r="2.2" fill="#12151B" />
    <circle cx="30" cy="49" r="2"   fill="#12151B" />
  </svg>
);

export const SpaceBackdrop = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden z-0" aria-hidden>
    {DEBRIS.map((d, i) => (
      <div
        key={i}
        className="space-debris absolute"
        style={{
          top: `${d.top}%`,
          left: 0,
          opacity: d.opacity,
          ["--spin" as string]: `${d.spin}deg`,
          animation: `debris-drift ${d.dur}s linear ${d.delay}s infinite`,
        }}
      >
        <Rock size={d.size} />
      </div>
    ))}

  </div>
);

export default SpaceBackdrop;
