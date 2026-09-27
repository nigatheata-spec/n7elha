import { useEffect, useMemo, useRef, useState } from "react";
import { X, KeyRound } from "lucide-react";
import { passwordChoices } from "@/lib/cryptoRush";

/**
 * Full-screen red "incorrect" card after a wrong answer or a timeout. It sits
 * under the CRT scanline layer (z-20) so the glass texture still shows. Taps
 * in the first moment are ignored so the tap that picked the answer can't
 * also skip this.
 */
export const WrongScreen = ({ ar, answer, timedOut, onNext }: { ar: boolean; answer: string; timedOut?: boolean; onNext: () => void }) => {
  const readyAt = useRef(Date.now() + 700);
  const done = useRef(false);
  const next = () => {
    if (done.current || Date.now() < readyAt.current) return;
    done.current = true;
    onNext();
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") next(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  return (
    <button
      type="button"
      onClick={next}
      dir={ar ? "rtl" : "ltr"}
      className="fixed inset-0 z-[15] flex flex-col items-center justify-center gap-8 px-6 text-center cursor-pointer"
      style={{ background: "radial-gradient(ellipse at center, hsl(0 70% 52%) 0%, hsl(0 72% 40%) 100%)", animation: "cr-flash 0.15s ease-out both" }}
    >
      <h2 className="font-pixel leading-[1.6] text-white" style={{ fontSize: "clamp(20px, 7vw, 36px)", textShadow: "3px 3px 0 hsl(0 70% 28%)" }}>
        {timedOut ? (ar ? "انتهى الوقت" : "TIME'S UP") : (ar ? "إجابة خاطئة" : "INCORRECT")}
      </h2>
      <div className="h-20 w-20 flex items-center justify-center border-[3px] border-white" style={{ animation: "cr-shake 0.45s ease-out 0.1s both" }}>
        <X className="h-10 w-10 text-white" strokeWidth={3} />
      </div>
      <div className="max-w-sm text-white">
        <div className="text-sm font-bold opacity-80">{ar ? "الإجابة الصحيحة" : "Correct answer"}</div>
        <div className="mt-1.5 text-xl font-bold leading-snug break-words">{answer}</div>
      </div>
      <div className="text-sm font-bold text-white underline underline-offset-4 animate-pulse">
        {ar ? "اضغط في أي مكان للمتابعة" : "Tap anywhere to go next"}
      </div>
    </button>
  );
};

/** The rare card: pick a new password so anyone mid-hack on you misses. */
export const NewPassword = ({ ar, current, onDone }: { ar: boolean; current?: string | null; onDone: (pwd: string) => void }) => {
  const choices = useMemo(() => passwordChoices(ar, 5, current ? [current] : []), [ar, current]);
  const [chosen, setChosen] = useState<string | null>(null);

  const pick = (p: string) => {
    if (chosen) return;
    setChosen(p);
    setTimeout(() => onDone(p), 1100);
  };

  return (
    <div dir={ar ? "rtl" : "ltr"} className="flex-1 flex flex-col max-w-md mx-auto w-full px-5 py-6 gap-5">
      <div>
        <KeyRound className="h-8 w-8 mb-3" style={{ color: "hsl(120 90% 62%)" }} />
        <div className="text-2xl font-black" style={{ color: "hsl(0 0% 96%)" }}>{ar ? "غيّر كلمة المرور" : "Change your password"}</div>
        <div className="mt-2 text-sm" style={{ color: "hsl(120 50% 50%)" }}>
          {ar ? "> من كان يحاول اختراقك الآن سيفشل" : "> anyone hacking you right now will miss"}
        </div>
        {current && (
          <div className="mt-1 text-sm" style={{ color: "hsl(120 50% 44%)" }}>
            {ar ? "> الحالية:" : "> current:"} <span className="line-through">{current}</span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2.5">
        {choices.map(p => (
          <button
            key={p}
            onClick={() => pick(p)}
            disabled={!!chosen}
            className="px-4 py-3 text-start text-base font-bold transition-all"
            style={{
              border: `2px solid ${chosen === p ? "hsl(0 0% 96%)" : "hsl(120 100% 55% / 0.55)"}`,
              color: chosen === p ? "hsl(0 0% 96%)" : "hsl(120 90% 62%)",
              background: chosen === p ? "hsl(120 100% 55% / 0.18)" : "transparent",
              opacity: chosen && chosen !== p ? 0.3 : 1,
            }}
          >
            {p}
          </button>
        ))}
      </div>
      {chosen && (
        <div className="text-sm" style={{ color: "hsl(0 0% 96%)" }}>
          {ar ? "> تم تحديث كلمة المرور" : "> password updated"}
        </div>
      )}
    </div>
  );
};
