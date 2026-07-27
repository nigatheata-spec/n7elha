import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Coins, Zap, Skull, X } from "lucide-react";

export type OutputResult =
  | { kind: "flat"; value: number }
  | { kind: "mult"; value: number }
  | { kind: "hack" }
  | { kind: "dud" };

// Equal-probability pool. Eight outcomes, all equal odds.
const POOL: OutputResult[] = [
  { kind: "flat", value: 10 },
  { kind: "flat", value: 20 },
  { kind: "flat", value: 30 },
  { kind: "flat", value: 50 },
  { kind: "mult", value: 2 },
  { kind: "mult", value: 3 },
  { kind: "hack" },
  { kind: "dud" },
];

const pick = (): OutputResult => POOL[Math.floor(Math.random() * POOL.length)];

const buildDeck = (): OutputResult[] => {
  // 3 cards drawn independently from equal pool
  return [pick(), pick(), pick()];
};

const fmt = (n: number) => n.toLocaleString();

const TEAL = "#3F5A63";
const GOLD = "#C8783A";
const GREEN = "#3a9e6e";
const RED = "#dc2626";

export const OutputCards = ({ onPick, picked, ar }: { onPick: (r: OutputResult) => void; picked: OutputResult | null; ar?: boolean }) => {
  const deck = useMemo(() => buildDeck(), []);
  const [flipped, setFlipped] = useState<number | null>(null);

  const click = (i: number) => {
    if (flipped !== null) return;
    setFlipped(i);
    setTimeout(() => onPick(deck[i]), 700);
  };

  return (
    <div className="text-center py-8">
      <div className="text-sm font-semibold mb-2" style={{ color: GREEN }}>
        {ar ? "أجبت بشكل صحيح!" : "Correct!"}
      </div>
      <h3
        className="text-xl sm:text-2xl font-bold mb-8"
        style={{ color: TEAL, fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}
      >
        {ar ? "اختر بطاقة" : "Pick a card"}
      </h3>
      <div className="grid grid-cols-3 gap-3 sm:gap-4 max-w-xl mx-auto">
        {deck.map((r, i) => {
          const isFlipped = flipped === i;
          return (
            <button
              key={i}
              onClick={() => click(i)}
              disabled={flipped !== null}
              className={cn(
                "aspect-[3/4] rounded-2xl border-2 relative transition-all duration-500 transform-gpu bg-white",
                flipped !== null && !isFlipped && "opacity-30"
              )}
              style={{
                borderColor: "hsl(199 23% 18%)",
                boxShadow: isFlipped ? "none" : "3px 3px 0 0 hsl(199 23% 18%)",
                transformStyle: "preserve-3d",
                transform: isFlipped ? "rotateY(180deg)" : undefined,
              }}
            >
              {!isFlipped ? (
                <div className="absolute inset-0 flex items-center justify-center text-5xl font-bold" style={{ color: TEAL }}>?</div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3" style={{ transform: "rotateY(180deg)" }}>
                  {r.kind === "flat" && (<><Coins className="h-9 w-9" style={{ color: GOLD }} /><div className="font-bold text-xl" style={{ color: GOLD }}>+{fmt(r.value)}</div></>)}
                  {r.kind === "mult" && (<><Zap className="h-9 w-9" style={{ color: GREEN }} /><div className="font-black text-xl" style={{ color: GREEN }}>{r.value}×</div></>)}
                  {r.kind === "hack" && (<><Skull className="h-9 w-9" style={{ color: RED }} /><div className="font-bold text-sm" style={{ color: RED }}>{ar ? "اختراق" : "Hack"}</div></>)}
                  {r.kind === "dud" && (<><X className="h-9 w-9 text-black/30" /><div className="text-sm text-black/40">{ar ? "لا شيء" : "Nothing"}</div></>)}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
