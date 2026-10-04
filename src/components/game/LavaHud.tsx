import { Flame } from "lucide-react";
import { ERUPT_EVERY } from "@/lib/lavaFloor";

export type FeedItem = { id: number; text: string; kind: "dunk" | "out" };

/** The Lava Floor projector: the canvas plus its HUD. Used by the monitor and the dev preview. */
export const LavaHud = ({ ar, code, left, nextErupt, lava, standing, total, banner, feed, onErupt, canvasRef, children }: {
  ar: boolean; code: string; left: number; nextErupt: number; lava: number; standing: number; total: number;
  banner: boolean; feed: FeedItem[]; onErupt: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement>; children?: React.ReactNode;
}) => {
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const pill = "rounded-full bg-[#140A14]/80 backdrop-blur-sm border border-white/10";
  return (
    <div className="fixed inset-0 overflow-hidden bg-[#160C22] text-[#F5EBD2] select-none"
      style={{ fontFamily: "'Outfit', 'Almarai', system-ui, sans-serif" }} dir={ar ? "rtl" : "ltr"}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      <div className="absolute top-4 inset-x-4 flex items-start justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-2 items-start">
          <div className={`${pill} px-4 py-2 flex items-center gap-3`}>
            <span className="text-xs opacity-60">{ar ? "رمز الغرفة" : "Room code"}</span>
            <span className="text-xl font-black tracking-[0.2em]" dir="ltr">{code}</span>
          </div>
          <div className={`${pill} px-4 py-1.5 text-sm flex items-center gap-4`}>
            <span><span className="opacity-60">{ar ? "الحمم" : "Lava"}</span> <b className="text-[#FFB347]" dir="ltr">{Math.max(0, lava).toFixed(1)}{ar ? "م" : "m"}</b></span>
            <span><span className="opacity-60">{ar ? "فوق الحمم" : "Above lava"}</span> <b dir="ltr">{standing}/{total}</b></span>
          </div>
        </div>

        <div className={`${pill} px-6 py-2 text-4xl font-black tabular-nums`} dir="ltr">{mm}:{ss}</div>

        {/* the teacher's own players / pause / end bar sits in the far corner,
            so this group keeps clear of it */}
        <div className="flex items-center gap-2 me-14">
          <div className={`${pill} px-4 py-2 flex items-center gap-2.5`}>
            <EruptRing frac={nextErupt / ERUPT_EVERY} />
            <div className="leading-tight">
              <div className="text-[11px] opacity-60">{ar ? "الثوران القادم" : "Next eruption"}</div>
              <div className="font-black tabular-nums" dir="ltr">0:{String(nextErupt).padStart(2, "0")}</div>
            </div>
          </div>
          <button onClick={onErupt}
            className="rounded-full bg-[#FF5A3C] hover:bg-[#ff6e52] text-white font-bold px-4 py-2.5 flex items-center gap-1.5 border-2 border-[#140A14] shadow-[3px_3px_0_0_#140A14]">
            <Flame className="h-4 w-4" />{ar ? "ثوران الآن" : "Erupt now"}
          </button>
        </div>
      </div>

      <div className="absolute top-36 start-4 flex flex-col gap-1.5 items-start">
        {feed.map(f => (
          <div key={f.id} className={`${pill} px-3 py-1 text-sm font-bold animate-in fade-in slide-in-from-top-1`}
            style={{ color: f.kind === "dunk" ? "#FF8A6B" : "#B9E07A" }}>
            {f.text}
          </div>
        ))}
      </div>

      {banner && (
        <div className="absolute inset-x-0 top-[28%] flex justify-center pointer-events-none">
          <div className="text-[clamp(48px,9vw,120px)] font-black text-[#FFD04A] animate-in zoom-in-50 fade-in duration-300"
            style={{ textShadow: "0 6px 0 #B72A1E, 0 0 40px rgba(255,120,40,0.8)" }}>
            {ar ? "ثوران!" : "ERUPTION!"}
          </div>
        </div>
      )}
      {children}
    </div>
  );
};

const EruptRing = ({ frac }: { frac: number }) => {
  const r = 14, c = 2 * Math.PI * r;
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90">
      <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
      <circle cx="18" cy="18" r={r} fill="none" stroke="#FF5A3C" strokeWidth="4" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, frac)))} />
    </svg>
  );
};
