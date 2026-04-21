import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";

export const LangToggle = () => {
  const { i18n } = useTranslation();
  const next = i18n.language === "ar" ? "en" : "ar";
  return (
    <Button variant="ghost" size="sm" onClick={() => i18n.changeLanguage(next)} className="gap-2">
      <Languages className="h-4 w-4" />
      <span className="font-medium">{next === "ar" ? "العربية" : "English"}</span>
    </Button>
  );
};
