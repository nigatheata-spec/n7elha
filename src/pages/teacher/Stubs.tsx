import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
const Stub = ({ tk }: { tk: string }) => {
  const { t } = useTranslation();
  return <div className="space-y-6 max-w-5xl"><h1 className="font-display text-3xl font-bold">{t(tk)}</h1><Card className="p-12 text-center text-muted-foreground">قريباً</Card></div>;
};
export const Analytics = () => <Stub tk="analytics" />;
export { SettingsPage } from "./Settings";
