import { useCallback, useRef, useState, type ComponentType } from "react";

// ── In-game feedback primitives ─────────────────────────────────────────────
// A toast flattens every event to the same rectangle — a summit milestone and
// a routine +30 reward read identically. These fire where the event actually
// happened and carry weight proportional to what happened:
//
//   useFloatingRewards — a number rises and fades from the HUD stat it just
//     changed (mount <Layer/> inside a `position: relative` wrapper around
//     that stat). For routine, frequent rewards — correct answers, currency.
//
//   usePowerupBurst — a colored badge slams into the center of the screen
//     and holds before fading. For rare, discrete pickups — powerups,
//     one-off bonuses. Only one shows at a time; a new fire replaces it
//     rather than queuing, since these are infrequent enough that overlap
//     would mean something is spawning powerups too fast anyway.
//
// Both are local to whichever component calls the hook — no global store,
// because these belong to one game screen at a time, unlike the system
// notification layer (components/ui/notify.tsx) which is app-wide.

type RewardItem = { id: number; label: string; color: string };

export const useFloatingRewards = () => {
  const [items, setItems] = useState<RewardItem[]>([]);
  const nextId = useRef(1);

  const fire = useCallback((label: string, color: string) => {
    const id = nextId.current++;
    setItems((list) => [...list, { id, label, color }]);
    setTimeout(() => setItems((list) => list.filter((i) => i.id !== id)), 900);
  }, []);

  const Layer = () => (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      {items.map((it) => (
        <span
          key={it.id}
          className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap font-black text-base animate-float-reward"
          style={{ color: it.color, textShadow: "0 1px 3px rgba(0,0,0,0.25)" }}
        >
          {it.label}
        </span>
      ))}
    </div>
  );

  return { fire, Layer };
};

type BurstItem = { id: number; Icon: ComponentType<{ className?: string; strokeWidth?: number }>; label: string; color: string };

export const usePowerupBurst = () => {
  const [item, setItem] = useState<BurstItem | null>(null);
  const nextId = useRef(1);

  const fire = useCallback((Icon: BurstItem["Icon"], label: string, color: string) => {
    const id = nextId.current++;
    setItem({ id, Icon, label, color });
    setTimeout(() => setItem((cur) => (cur?.id === id ? null : cur)), 1150);
  }, []);

  const Layer = () =>
    item ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none px-6">
        <div
          key={item.id}
          className="animate-powerup-slam flex items-center gap-2.5 px-6 py-3.5 rounded-2xl border-2 border-white/25 shadow-2xl"
          style={{ background: item.color }}
        >
          <item.Icon className="h-6 w-6 text-white shrink-0" strokeWidth={2.5} />
          <span className="text-lg font-black text-white tracking-wide whitespace-nowrap">{item.label}</span>
        </div>
      </div>
    ) : null;

  return { fire, Layer };
};
