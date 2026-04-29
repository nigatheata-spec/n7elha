import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";

export const LangToggle = ({ variant = "default" }: { variant?: "default" | "pill" }) => {
  const { i18n } = useTranslation();
  const next = i18n.language === "ar" ? "en" : "ar";
  const label = next === "ar" ? "العربية" : "English";

  if (variant === "pill") {
    return (
      <button
        onClick={() => i18n.changeLanguage(next)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-black/15 bg-white text-black text-[13px] tracking-wider font-medium hover:bg-black hover:text-white transition"
      >
        <Languages className="h-4 w-4" />
        {label}
      </button>
    );
  }

  return (
    <button
      onClick={() => i18n.changeLanguage(next)}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium hover:bg-accent/40 transition"
    >
      <Languages className="h-4 w-4" />
      {label}
    </button>
  );
};
