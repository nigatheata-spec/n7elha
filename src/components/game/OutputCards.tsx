import { useMemo, useState } from "react";
import { Coins, Zap, Skull, X, KeyRound } from "lucide-react";
import { buildDeck, type OutputResult } from "@/lib/cryptoRush";

export type { OutputResult } from "@/lib/cryptoRush";

// Same green panel as the projector's hack log (GameMonitor): lime glass,
// ink borders, hard ink shadow, faint scanlines.
const LIME = "#8FC44A";
const INK = "#0B1418";
const SCAN = "repeating-linear-gradient(0deg, rgba(11,20,24,0.08) 0 2px, transparent 2px 4px)";

const fmt = (n: number) => n.toLocaleString();

const Face = ({ r, ar }: { r: OutputResult; ar?: boolean }) => {
  const rare = r.kind === "password";
  const icon = "h-9 w-9 sm:h-11 sm:w-11";
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2 text-center" style={{ color: rare ? LIME : INK }}>
      {r.kind === "flat" && <><Coins className={icon} strokeWidth={2.4} /><div className="text-2xl sm:text-3xl font-black tabular-nums" dir="ltr">+{fmt(r.value)}</div></>}
      {r.kind === "mult" && <><Zap className={icon} strokeWidth={2.4} /><div className="text-3xl sm:text-4xl font-black" dir="ltr">{r.value}×</div></>}
      {r.kind === "hack" && <><Skull className={icon} strokeWidth={2.4} /><div className="text-lg sm:text-xl font-black">{ar ? "اختراق" : "HACK"}</div></>}
      {r.kind === "dud" && <><X className={`${icon} opacity-50`} strokeWidth={2.4} /><div className="text-base font-bold opacity-60">{ar ? "لا شيء" : "NOTHING"}</div></>}
      {rare && (
        <>
          <KeyRound className={icon} strokeWidth={2.4} />
          <div className="text-[13px] sm:text-sm font-black leading-tight">{ar ? "كلمة مرور جديدة" : "NEW PASSWORD"}</div>
          <div className="text-[10px] font-bold opacity-70">{ar ? "نادرة" : "RARE"}</div>
        </>
      )}
    </div>
  );
};

export const OutputCards = ({ onPick, ar }: { onPick: (r: OutputResult) => void; picked?: OutputResult | null; ar?: boolean }) => {
  const deck = useMemo(() => buildDeck(), []);
  const [flipped, setFlipped] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const click = (i: number) => {
    if (flipped !== null) return;
    setFlipped(i);
    setTimeout(() => setShowAll(true), 650);
    setTimeout(() => onPick(deck[i]), deck[i].kind === "password" ? 1600 : 1300);
  };

  return (
    <div dir={ar ? "rtl" : "ltr"} className="flex-1 flex flex-col items-center justify-center px-5 py-6">
      <div className="text-sm mb-1.5" style={{ color: "hsl(120 90% 62%)" }}>{ar ? "تم منح الوصول" : "ACCESS_GRANTED"}</div>
      <h3 className="font-pixel text-center leading-[1.7] mb-7" style={{ fontSize: "clamp(12px, 3.6vw, 16px)", color: "hsl(0 0% 96%)" }}>
        {ar ? "اختر بطاقة" : "PICK A CARD"}
      </h3>
      <div className="grid grid-cols-3 gap-3 sm:gap-5 w-full max-w-md" style={{ perspective: "900px" }}>
        {deck.map((r, i) => {
          const open = flipped === i || (showAll && flipped !== null);
          const mine = flipped === i;
          const other = flipped !== null && !mine;
          const rare = r.kind === "password";
          return (
            <button
              key={i}
              onClick={() => click(i)}
              disabled={flipped !== null}
              className="relative aspect-[3/4] transition-transform duration-200 enabled:hover:-translate-y-1 enabled:active:translate-y-0"
              style={{ opacity: other ? 0.45 : 1, transition: "opacity 300ms, transform 200ms" }}
            >
              <div
                className="absolute inset-0 transition-transform duration-[600ms]"
                style={{ transformStyle: "preserve-3d", transform: open ? "rotateY(180deg)" : "none", transitionTimingFunction: "cubic-bezier(0.2,0.8,0.2,1)" }}
              >
                {/* back */}
                <div
                  className="absolute inset-0 rounded-xl overflow-hidden flex flex-col items-center justify-center"
                  style={{ backfaceVisibility: "hidden", background: LIME, border: `3px solid ${INK}`, boxShadow: `4px 4px 0 0 ${INK}` }}
                >
                  <div className="absolute inset-0" style={{ backgroundImage: SCAN }} />
                  <div className="absolute inset-1.5 rounded-lg" style={{ border: `2px dashed ${INK}33` }} />
                  <span className="absolute top-2 start-2.5 text-[11px] font-black" style={{ color: INK }}>₿</span>
                  <span className="absolute bottom-2 end-2.5 text-[11px] font-black rotate-180" style={{ color: INK }}>₿</span>
                  <span className="relative font-pixel text-3xl sm:text-4xl" style={{ color: INK }}>?</span>
                </div>
                {/* face */}
                <div
                  className="absolute inset-0 rounded-xl overflow-hidden"
                  style={{
                    backfaceVisibility: "hidden", transform: "rotateY(180deg)",
                    background: rare ? INK : LIME, border: `3px solid ${rare ? LIME : INK}`,
                    boxShadow: mine ? `4px 4px 0 0 ${rare ? LIME : INK}, 0 0 0 3px ${LIME}66` : `4px 4px 0 0 ${INK}`,
                  }}
                >
                  <div className="absolute inset-0" style={{ backgroundImage: SCAN }} />
                  <Face r={r} ar={ar} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
