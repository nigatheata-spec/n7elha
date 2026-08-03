export function PixelVolcano({ size = 120, className = "" }: { size?: number; className?: string }) {
  const scale = size / 120;
  return (
    <svg viewBox="0 0 120 140" width={size} height={(size * 140) / 120} className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="volcano-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E8722B" />
          <stop offset="40%" stopColor="#DE6528" />
          <stop offset="70%" stopColor="#D25A28" />
          <stop offset="100%" stopColor="#8C3A22" />
        </linearGradient>
      </defs>

      {/* Volcano cone — stacked trapezoids for stepped appearance */}
      <g fill="url(#volcano-gradient)" shapeRendering="crispEdges">
        {/* Base */}
        <polygon points="20,120 100,120 90,90 30,90" />
        {/* Mid section */}
        <polygon points="30,90 90,90 80,60 40,60" />
        {/* Upper cone */}
        <polygon points="40,60 80,60 70,30 50,30" />
        {/* Peak */}
        <polygon points="50,30 70,30 60,10" />
      </g>

      {/* Lava flow — jagged blocks down the side */}
      <g fill="#FFD37A" shapeRendering="crispEdges" opacity="0.9">
        <rect x="55" y="15" width="10" height="8" />
        <rect x="53" y="23" width="14" height="8" />
        <rect x="50" y="31" width="20" height="8" />
        <rect x="48" y="39" width="24" height="10" />
      </g>

      {/* Erupting sparks — starburst pattern */}
      <g stroke="currentColor" strokeWidth="2" fill="none" shapeRendering="crispEdges">
        <line x1="60" y1="8" x2="60" y2="-4" />
        <line x1="68" y1="12" x2="78" y2="2" />
        <line x1="68" y1="12" x2="76" y2="20" />
        <line x1="52" y1="12" x2="42" y2="2" />
        <line x1="52" y1="12" x2="44" y2="20" />
      </g>
    </svg>
  );
}
