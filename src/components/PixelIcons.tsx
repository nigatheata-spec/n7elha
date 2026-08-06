export function PixelShield({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} xmlns="http://www.w3.org/2000/svg">
      <g fill="currentColor" shapeRendering="crispEdges">
        {/* Shield outline — hard edges, 4-unit grid */}
        <rect x="6" y="3" width="12" height="2" />
        <rect x="5" y="5" width="2" height="8" />
        <rect x="17" y="5" width="2" height="8" />
        <rect x="6" y="13" width="12" height="2" />
        {/* Shield body — stacked blocks for depth */}
        <rect x="7" y="6" width="10" height="6" opacity="0.8" />
        {/* Center accent — stripe */}
        <rect x="10" y="8" width="4" height="2" />
      </g>
    </svg>
  );
}

export function PixelFlame({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} xmlns="http://www.w3.org/2000/svg">
      <g fill="currentColor" shapeRendering="crispEdges">
        {/* Flame — blocky blocks stacked upward */}
        <rect x="10" y="12" width="4" height="2" />
        <rect x="9" y="10" width="6" height="2" />
        <rect x="9" y="8" width="2" height="2" />
        <rect x="13" y="8" width="2" height="2" />
        <rect x="11" y="6" width="2" height="2" />
        {/* Glow blocks for depth */}
        <rect x="8" y="10" width="1" height="2" opacity="0.6" />
        <rect x="15" y="10" width="1" height="2" opacity="0.6" />
      </g>
    </svg>
  );
}

export function PixelTrophy({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} xmlns="http://www.w3.org/2000/svg">
      <g fill="currentColor" shapeRendering="crispEdges">
        {/* Trophy cup — pixel blocks */}
        <rect x="7" y="3" width="2" height="2" />
        <rect x="15" y="3" width="2" height="2" />
        <rect x="6" y="5" width="12" height="2" />
        <rect x="6" y="7" width="3" height="2" />
        <rect x="15" y="7" width="3" height="2" />
        <rect x="9" y="9" width="6" height="1" />
        <rect x="10" y="10" width="4" height="4" />
        {/* Handle left */}
        <rect x="5" y="11" width="2" height="2" />
        {/* Handle right */}
        <rect x="17" y="11" width="2" height="2" />
        {/* Base */}
        <rect x="8" y="14" width="8" height="2" />
        <rect x="7" y="16" width="10" height="1" />
      </g>
    </svg>
  );
}

export function PixelPlank({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} xmlns="http://www.w3.org/2000/svg">
      <g fill="currentColor" shapeRendering="crispEdges">
        {/* Single wooden plank, laid flat */}
        <rect x="3" y="10" width="18" height="4" />
        {/* Grain lines */}
        <rect x="5" y="11" width="4" height="1" opacity="0.5" />
        <rect x="11" y="12" width="6" height="1" opacity="0.5" />
        <rect x="4" y="10" width="16" height="1" opacity="0.3" />
      </g>
    </svg>
  );
}

export function PixelBrick({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} xmlns="http://www.w3.org/2000/svg">
      <g fill="currentColor" shapeRendering="crispEdges">
        {/* Offset brick courses */}
        <rect x="3" y="6" width="8" height="4" />
        <rect x="12" y="6" width="9" height="4" opacity="0.85" />
        <rect x="7" y="11" width="8" height="4" opacity="0.85" />
        <rect x="16" y="11" width="5" height="4" opacity="0.7" />
        <rect x="3" y="11" width="3" height="4" opacity="0.7" />
      </g>
    </svg>
  );
}

export function PixelStaircase({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} xmlns="http://www.w3.org/2000/svg">
      <g fill="currentColor" shapeRendering="crispEdges">
        {/* Ascending steps */}
        <rect x="3" y="16" width="6" height="4" />
        <rect x="9" y="12" width="6" height="8" opacity="0.85" />
        <rect x="15" y="8" width="6" height="12" opacity="0.7" />
      </g>
    </svg>
  );
}

export function PixelHouse({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} xmlns="http://www.w3.org/2000/svg">
      <g fill="currentColor" shapeRendering="crispEdges">
        {/* Roof — stepped pixel triangle */}
        <rect x="11" y="2" width="2" height="2" />
        <rect x="9" y="4" width="6" height="2" />
        <rect x="7" y="6" width="10" height="2" />
        <rect x="5" y="8" width="14" height="2" />
        {/* Walls */}
        <rect x="6" y="10" width="12" height="8" opacity="0.85" />
        {/* Door */}
        <rect x="11" y="14" width="2" height="4" opacity="0.5" />
        {/* Window */}
        <rect x="8" y="11" width="2" height="2" opacity="0.5" />
        <rect x="14" y="11" width="2" height="2" opacity="0.5" />
      </g>
    </svg>
  );
}

export function PixelSkull({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} xmlns="http://www.w3.org/2000/svg">
      <g fill="currentColor" shapeRendering="crispEdges">
        {/* Cranium — top rounded blocks */}
        <rect x="9" y="4" width="6" height="2" />
        <rect x="8" y="6" width="8" height="2" />
        {/* Left eye socket */}
        <rect x="10" y="8" width="2" height="2" />
        {/* Right eye socket */}
        <rect x="12" y="8" width="2" height="2" />
        {/* Nasal cavity */}
        <rect x="11" y="10" width="2" height="1" />
        {/* Jaw — lower blocks */}
        <rect x="8" y="11" width="8" height="2" />
        {/* Teeth marks */}
        <rect x="8" y="13" width="2" height="1" />
        <rect x="12" y="13" width="2" height="1" />
        <rect x="14" y="13" width="2" height="1" />
      </g>
    </svg>
  );
}
