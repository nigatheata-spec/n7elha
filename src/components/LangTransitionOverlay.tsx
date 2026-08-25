import { useEffect, useRef, useState } from "react";
import { onLangTransition } from "@/lib/langTransitionBus";
import logoMark from "@/assets/logo-mark.png";

export const LangTransitionOverlay = () => {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const clearAll = () => { timers.current.forEach(clearTimeout); timers.current = []; };

    const unsub = onLangTransition(() => {
      clearAll();
      setFading(false);
      setVisible(true);

      timers.current = [
        setTimeout(() => setFading(true), 1100),
        setTimeout(() => { setVisible(false); setFading(false); }, 1500),
      ];
    });

    return () => { unsub(); clearAll(); };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center pointer-events-none select-none"
      style={{
        background: "hsl(43, 58%, 94%)",
        opacity: fading ? 0 : 1,
        transition: "opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <img
        src={logoMark}
        alt="nefelha"
        className="h-16 w-16 object-contain"
        style={{ animation: "lang-logo-in 0.45s cubic-bezier(0.16, 1, 0.3, 1) both" }}
      />
      <span
        className="mt-3 text-[19px] font-semibold tracking-tight"
        style={{
          color: "#3F5A63",
          fontFamily: "'Outfit', 'Almarai', system-ui",
          animation: "lang-logo-in 0.45s 60ms cubic-bezier(0.16, 1, 0.3, 1) both",
        }}
      >
        nefelha
      </span>
      <div
        className="mt-5 flex gap-2"
        style={{ animation: "lang-logo-in 0.45s 120ms cubic-bezier(0.16, 1, 0.3, 1) both" }}
      >
        {[0, 150, 300].map((delay, i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full"
            style={{ background: "#8FC44A", animation: `dot-pulse 1.1s ease-in-out ${delay}ms infinite` }}
          />
        ))}
      </div>
    </div>
  );
};
