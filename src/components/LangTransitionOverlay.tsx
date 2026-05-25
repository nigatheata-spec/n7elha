import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import logoMark from "@/assets/logo-mark.png";

export const LangTransitionOverlay = () => {
  const { i18n } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const clearAll = () => timers.current.forEach(clearTimeout);

    const handler = () => {
      clearAll();
      setFading(false);
      setVisible(true);

      const t1 = setTimeout(() => setFading(true), 1100);
      const t2 = setTimeout(() => { setVisible(false); setFading(false); }, 1500);
      timers.current = [t1, t2];
    };

    i18n.on("languageChanged", handler);
    return () => { i18n.off("languageChanged", handler); clearAll(); };
  }, [i18n]);

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
        alt="n7elha"
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
        n7elha
      </span>
      <div
        className="mt-5 flex gap-2"
        style={{ animation: "lang-logo-in 0.45s 120ms cubic-bezier(0.16, 1, 0.3, 1) both" }}
      >
        {[0, 150, 300].map((delay, i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full"
            style={{
              background: "#FF8254",
              animation: `dot-pulse 1.1s ease-in-out ${delay}ms infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
};
