import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import logoMark from "@/assets/logo-mark.png";

export const Logo = ({ className, withText = true }: { className?: string; withText?: boolean }) => {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <img src={logoMark} alt="nefelha" className="h-9 w-9 object-contain" />
      {withText && <span className="text-xl font-bold tracking-tight text-foreground">{isAr ? "نفلها" : "nefelha"}</span>}
    </div>
  );
};
