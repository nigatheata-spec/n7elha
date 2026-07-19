import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { triggerLangTransition } from "@/lib/langTransitionBus";

export const LangToggle = ({ variant = "default" }: { variant?: "default" | "pill" }) => {
  const { i18n } = useTranslation();
  const next = i18n.language === "ar" ? "en" : "ar";
  const label = next === "ar" ? "العربية" : "English";

  const handleChange = () => {
    triggerLangTransition();
    i18n.changeLanguage(next);
  };

  if (variant === "pill") {
    return (
      <button
        onClick={handleChange}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 border-[hsl(var(--nb-border))] bg-white text-[#3F5A63] text-[13px] tracking-wider font-medium shadow-[3px_3px_0_0_hsl(var(--nb-border))] hover:bg-[#3F5A63] hover:text-white hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_hsl(var(--nb-border))] transition-all"
      >
        <Languages className="h-4 w-4" />
        {label}
      </button>
    );
  }

  return (
    <button
      onClick={handleChange}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium hover:bg-accent/40 transition"
    >
      <Languages className="h-4 w-4" />
      {label}
    </button>
  );
};
