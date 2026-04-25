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

export const OutputCards = ({ onPick, picked }: { onPick: (r: OutputResult) => void; picked: OutputResult | null }) => {
  const deck = useMemo(() => buildDeck(), []);
  const [flipped, setFlipped] = useState<number | null>(null);

  const click = (i: number) => {
    if (flipped !== null) return;
    setFlipped(i);
    setTimeout(() => onPick(deck[i]), 700);
  };

  return (
    <div className="text-center py-6">
      <div className="font-mono text-sm text-success mb-2">✓ ACCESS_GRANTED</div>
      <h3 className="font-mono text-xl text-primary text-glow-cyan mb-6">{"> SELECT_OUTPUT"}</h3>
      <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
        {deck.map((r, i) => {
          const isFlipped = flipped === i;
          return (
            <button key={i} onClick={() => click(i)} disabled={flipped !== null}
              className={cn("aspect-[3/4] rounded-2xl border-2 relative transition-all duration-700 transform-gpu",
                isFlipped ? "border-primary bg-primary/10" : "border-primary/40 bg-card/60 hover:border-primary hover:scale-105",
                flipped !== null && !isFlipped && "opacity-30")}
              style={{ transformStyle: "preserve-3d", transform: isFlipped ? "rotateY(180deg)" : undefined }}>
              {!isFlipped ? (
                <div className="absolute inset-0 flex items-center justify-center font-mono text-6xl text-primary text-glow-cyan">?</div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3" style={{transform:"rotateY(180deg)"}}>
                  {r.kind === "flat" && (<><Coins className="h-10 w-10" style={{color:"hsl(51 100% 50%)"}} /><div className="font-mono font-bold text-2xl" style={{color:"hsl(51 100% 50%)"}}>+{fmt(r.value)}</div></>)}
                  {r.kind === "mult" && (<><Zap className="h-10 w-10 text-primary" /><div className="font-mono font-black text-2xl text-primary">{r.value}×</div></>)}
                  {r.kind === "hack" && (<><Skull className="h-10 w-10 text-destructive" /><div className="font-mono font-bold text-destructive">HACK</div></>)}
                  {r.kind === "dud" && (<><X className="h-10 w-10 text-muted-foreground" /><div className="font-mono text-muted-foreground">NOTHING</div></>)}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
