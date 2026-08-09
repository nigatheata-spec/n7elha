// Themed game-mode icons. Lucide-style: stroke-based, currentColor, single SVG.
import { cn } from "@/lib/utils";

type IconProps = {
  className?: string;
  size?: number;
  strokeWidth?: number;
  style?: React.CSSProperties;
};

const baseProps = (size = 24, strokeWidth = 2) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

// ── Bitcoin ───────────────────────────────────────────────────────
// Crypto Rush — using the Lucide-style ₿ glyph
export const BitcoinIcon = ({ className, size, strokeWidth, style }: IconProps) => (
  <svg className={cn(className)} style={style} {...baseProps(size, strokeWidth)}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.5 7v10" />
    <path d="M9.5 7h4a2.5 2.5 0 0 1 0 5h-4" />
    <path d="M9.5 12h4.5a2.5 2.5 0 0 1 0 5h-4.5" />
    <path d="M11 5v2M11 17v2M13 5v2M13 17v2" />
  </svg>
);

// ── Stopwatch ─────────────────────────────────────────────────────
// Time Wizard — circle face with crown stem, side button, and hand
export const StopwatchIcon = ({ className, size, strokeWidth, style }: IconProps) => (
  <svg className={cn(className)} style={style} {...baseProps(size, strokeWidth)}>
    {/* crown stem */}
    <path d="M10 2h4" />
    <path d="M12 2v3" />
    {/* side button (top-right) */}
    <path d="M18 4l1.5 1.5" />
    {/* face */}
    <circle cx="12" cy="14" r="8" />
    {/* tick marks */}
    <path d="M12 8v1" />
    <path d="M12 19v1" />
    <path d="M6 14h1" />
    <path d="M17 14h1" />
    {/* hand pointing up-right */}
    <path d="M12 14l3.5 -2.5" />
  </svg>
);

// ── Volcano ───────────────────────────────────────────────────────
// Lava Floor — cone with crater, lava dripping over sides, eruption sparks
export const LavaBucketIcon = ({ className, size, strokeWidth, style }: IconProps) => (
  <svg className={cn(className)} style={style} {...baseProps(size, strokeWidth)}>
    {/* eruption sparks above the crater */}
    <path d="M12 4v-2" />
    <path d="M9 4l-1.2 -1.6" />
    <path d="M15 4l1.2 -1.6" />
    {/* volcano cone with open crater on top */}
    <path d="M3 21L9 9" />
    <path d="M15 9l6 12" />
    {/* ground line */}
    <path d="M2 21h20" />
    {/* lava bubbling at crater rim (wavy bowl) */}
    <path d="M9 9c1 .8 2 .8 3 0s2 -.8 3 0" />
    {/* lava overflowing the left rim, dripping down */}
    <path d="M9.5 10c-.5 1.4 -1.5 1.8 -2.5 3" />
    <circle cx="6.8" cy="13.5" r="0.4" fill="currentColor" stroke="none" />
    {/* lava overflowing the right rim, dripping down */}
    <path d="M14.5 10c.5 1.4 1.5 1.8 2.5 3" />
    <circle cx="17.2" cy="13.5" r="0.4" fill="currentColor" stroke="none" />
  </svg>
);

// ── Dynamite ──────────────────────────────────────────────────────
// Pass It — three TNT sticks bundled together with a lit fuse
export const DynamiteIcon = ({ className, size, strokeWidth, style }: IconProps) => (
  <svg className={cn(className)} style={style} {...baseProps(size, strokeWidth)}>
    {/* three sticks side by side, rounded ends */}
    <rect x="4" y="9" width="4" height="13" rx="0.8" />
    <rect x="10" y="9" width="4" height="13" rx="0.8" />
    <rect x="16" y="9" width="4" height="13" rx="0.8" />
    {/* binding band across all three */}
    <path d="M3 14h18" />
    {/* fuse rising from middle stick, curling */}
    <path d="M12 9c0 -2 2 -2.5 2 -4.5s-2 -2 -2 -2" />
    {/* spark at fuse tip */}
    <path d="M11.5 1.5l1 1" />
    <path d="M12.5 1.5l-1 1" />
  </svg>
);

// ── Paint Roller ──────────────────────────────────────────────────
// Paint Fight — exact reference artwork: black handle ring + connecting bar,
// black roller frame with a diagonal-striped core. Fixed fill colors by
// design (not currentColor-themed like the other icons here).
export const PaintRollerIcon = ({ className, size, style }: IconProps) => (
  <svg className={cn(className)} style={{ width: size, height: size, ...style }} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="pf-diagonal-stripes" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="24" height="24" fill="#D85D44" />
        <rect x="0" y="0" width="12" height="24" fill="#9C3A29" />
      </pattern>
    </defs>
    <rect x="80" y="97" width="58" height="16" fill="#000000" />
    <rect x="8" y="90" width="88" height="30" rx="10" ry="10" fill="#000000" />
    <rect x="23" y="100" width="58" height="10" rx="5" ry="5" fill="#FFFFFF" />
    <rect x="132" y="26" width="64" height="178" rx="6" ry="6" fill="#000000" />
    <rect x="150" y="44" width="28" height="142" rx="2" ry="2" fill="url(#pf-diagonal-stripes)" />
  </svg>
);

// ── Map mode key → icon (for shared lookup) ───────────────────────
export const MODE_ICON = {
  crypto_rush: BitcoinIcon,
  dodgeball: StopwatchIcon,
  hotpotato: DynamiteIcon,
  lavafloor: LavaBucketIcon,
  paintfight: PaintRollerIcon,
} as const;
