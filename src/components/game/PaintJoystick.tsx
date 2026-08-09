import { useRef, useState, type MutableRefObject } from "react";

export type JoystickVector = { dx: number; dy: number; magnitude: number };

interface Props {
  /** Mutated directly on every pointer move — kept out of React state so the
   *  60fps physics loop reading it never triggers a re-render. */
  vectorRef: MutableRefObject<JoystickVector>;
  maxRadius?: number;
  deadzone?: number;
  className?: string;
}

/**
 * Touch-anywhere virtual joystick: appears centered on the touch point,
 * follows the finger 1:1 within a clamped radius, and disappears entirely
 * on release (zeroing the output vector). No snapping — direct tracking.
 */
const PaintJoystick = ({ vectorRef, maxRadius = 60, deadzone = 8, className }: Props) => {
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const activeId = useRef<number | null>(null);

  const reset = () => {
    activeId.current = null;
    setOrigin(null);
    setKnob({ x: 0, y: 0 });
    vectorRef.current.dx = 0;
    vectorRef.current.dy = 0;
    vectorRef.current.magnitude = 0;
  };

  const update = (clientX: number, clientY: number, ox: number, oy: number) => {
    let dx = clientX - ox, dy = clientY - oy;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, maxRadius);
    if (dist > maxRadius) { dx = (dx / dist) * maxRadius; dy = (dy / dist) * maxRadius; }
    setKnob({ x: dx, y: dy });

    const mag = clamped < deadzone ? 0 : (clamped - deadzone) / (maxRadius - deadzone);
    if (mag <= 0) {
      vectorRef.current.dx = 0; vectorRef.current.dy = 0; vectorRef.current.magnitude = 0;
    } else {
      vectorRef.current.dx = dx / clamped;
      vectorRef.current.dy = dy / clamped;
      vectorRef.current.magnitude = mag;
    }
  };

  return (
    <div
      className={className}
      style={{ position: "absolute", inset: 0, touchAction: "none" }}
      onPointerDown={e => {
        if (activeId.current !== null) return;
        activeId.current = e.pointerId;
        (e.target as Element).setPointerCapture?.(e.pointerId);
        setOrigin({ x: e.clientX, y: e.clientY });
        setKnob({ x: 0, y: 0 });
      }}
      onPointerMove={e => {
        if (activeId.current !== e.pointerId || !origin) return;
        update(e.clientX, e.clientY, origin.x, origin.y);
      }}
      onPointerUp={e => { if (activeId.current === e.pointerId) reset(); }}
      onPointerCancel={e => { if (activeId.current === e.pointerId) reset(); }}
      onPointerLeave={e => { if (activeId.current === e.pointerId) reset(); }}
    >
      {origin && (
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            left: origin.x - maxRadius, top: origin.y - maxRadius,
            width: maxRadius * 2, height: maxRadius * 2,
            background: "rgba(255,255,255,0.18)",
            border: "2px solid rgba(255,255,255,0.35)",
          }}
        >
          <div
            className="absolute rounded-full"
            style={{
              left: maxRadius + knob.x - 22, top: maxRadius + knob.y - 22,
              width: 44, height: 44,
              background: "rgba(255,255,255,0.85)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
            }}
          />
        </div>
      )}
    </div>
  );
};

export default PaintJoystick;
