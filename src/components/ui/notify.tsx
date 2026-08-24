import { useEffect, useState } from "react";
import { AlertTriangle, Check, Info, X } from "lucide-react";

// ── nefelha notifications ────────────────────────────────────────────────────
// Purpose-built rather than a restyled toast library, because every library
// default fought the thing that actually matters here: these messages are
// SHORT ("تم الحفظ", "Copied", "Invalid code"). A fixed-width card wrapped
// around three words is mostly empty space, which is what made the old one
// look unfinished. So this hugs its content and stays a pill.
//
// Top-center, not a corner: a corner notification is peripheral by design and
// a student mid-game will miss it. Centered under the top edge is the first
// place your eye goes when something changes.
//
// SYSTEM messages only — "saved", "lobby closed", "invalid code". In-game
// feedback (rewards, powerups, penalties, milestones) needs to fire where the
// event happens and carry its own weight; routing a summit milestone and a
// routine +30 through one identical pill is what flattens a game.

type NotifyType = "success" | "error" | "warning" | "info";
type Item = { id: number; type: NotifyType; message: string; leaving?: boolean };

const DURATION = 3400;
const EXIT_MS = 200;
const MAX_VISIBLE = 3;

let items: Item[] = [];
let nextId = 1;
const listeners = new Set<(v: Item[]) => void>();
const emit = () => listeners.forEach((l) => l([...items]));

const dismiss = (id: number) => {
  const it = items.find((i) => i.id === id);
  if (!it || it.leaving) return;
  it.leaving = true;
  emit();
  setTimeout(() => {
    items = items.filter((i) => i.id !== id);
    emit();
  }, EXIT_MS);
};

const push = (type: NotifyType, message: string) => {
  const id = nextId++;
  items = [...items, { id, type, message }];
  // Oldest beyond the cap leave early rather than piling up off-screen.
  const live = items.filter((i) => !i.leaving);
  if (live.length > MAX_VISIBLE) live.slice(0, live.length - MAX_VISIBLE).forEach((i) => dismiss(i.id));
  emit();
  setTimeout(() => dismiss(id), DURATION);
  return id;
};

/** Drop-in for the previous sonner API — every call site passes a single string. */
export const toast = Object.assign(
  (message: string) => push("info", message),
  {
    success: (message: string) => push("success", message),
    error: (message: string) => push("error", message),
    warning: (message: string) => push("warning", message),
    info: (message: string) => push("info", message),
    dismiss,
  }
);

const STYLES: Record<NotifyType, { bg: string; glyph: string; dark?: boolean }> = {
  success: { bg: "#3a9e6e", glyph: "#2f7d57" },
  error: { bg: "#c0392b", glyph: "#9c2d22" },
  // Amber needs dark text — white on #e0b400 lands near 2:1 contrast and is unreadable.
  warning: { bg: "#e0b400", glyph: "#a97a00", dark: true },
  info: { bg: "#3F5A63", glyph: "#2c4149" },
};

const ICONS: Record<NotifyType, typeof Check> = {
  success: Check,
  error: X,
  warning: AlertTriangle,
  info: Info,
};

const Notification = ({ item }: { item: Item }) => {
  const s = STYLES[item.type];
  const Icon = ICONS[item.type];
  const fg = s.dark ? "hsl(var(--nb-border))" : "#fff";

  return (
    <div
      role="status"
      onClick={() => dismiss(item.id)}
      className={`pointer-events-auto cursor-pointer inline-flex items-center gap-2.5 max-w-[calc(100vw-2rem)]
        rounded-full ps-2 pe-4 py-2 border-2 border-[hsl(var(--nb-border))]
        shadow-[3px_3px_0_0_hsl(var(--nb-border))]
        ${item.leaving ? "animate-notify-out" : "animate-notify-in"}`}
      style={{ background: s.bg }}
    >
      <span className="h-7 w-7 rounded-full bg-white flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4" style={{ color: s.glyph }} strokeWidth={3.5} />
      </span>
      <span className="font-bold text-[13.5px] leading-tight truncate" style={{ color: fg }}>
        {item.message}
      </span>
    </div>
  );
};

export const Toaster = () => {
  const [list, setList] = useState<Item[]>([]);

  useEffect(() => {
    listeners.add(setList);
    return () => { listeners.delete(setList); };
  }, []);

  return (
    <div className="fixed top-4 inset-x-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none safe-top">
      {list.map((item) => <Notification key={item.id} item={item} />)}
    </div>
  );
};
