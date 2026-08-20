import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { triggerLangTransition } from "@/lib/langTransitionBus";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut, Check } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

// ── Letter avatar ─────────────────────────────────────────────────────────────
const AV_COLORS = ["#2563eb","#16a34a","#b45309","#dc2626","#7c3aed","#0891b2","#c2410c","#0f766e"];
const av = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return { bg: AV_COLORS[Math.abs(h) % AV_COLORS.length], letter: (name.charAt(0) || "?").toUpperCase() };
};

const LANGS = [
  { code: "ar", label: "العربية", sub: "Arabic" },
  { code: "en", label: "English", sub: "الإنجليزية" },
] as const;

export const SettingsPage = () => {
  const { user, signOut } = useAuth();
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const ar = i18n.language === "ar";

  const displayName = user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "";
  const { bg, letter } = av(displayName || "?");

  const [name, setName]         = useState(displayName);
  const [nameSaving, setNameSaving] = useState(false);
  const [pwNew, setPwNew]       = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  const saveName = async () => {
    if (!name.trim()) return;
    setNameSaving(true);
    const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } });
    setNameSaving(false);
    if (error) toast.error(error.message);
    else toast.success(ar ? "تم الحفظ" : "Saved");
  };

  const changePassword = async () => {
    if (!pwNew) return;
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwNew });
    setPwSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(ar ? "تم تغيير كلمة المرور" : "Password updated"); setPwNew(""); }
  };

  const switchLang = (code: "ar" | "en") => {
    if (i18n.language === code) return;
    triggerLangTransition();
    i18n.changeLanguage(code);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-3xl font-bold">{t("settings")}</h1>
      </div>

      {/* ── Account ── */}
      <Card className="p-6 space-y-6">
        <h2 className="font-semibold text-lg">{ar ? "الحساب" : "Account"}</h2>

        {/* Avatar + email identity */}
        <div className="flex items-center gap-4">
          <div style={{ background: bg }}
            className="h-14 w-14 rounded-full flex items-center justify-center font-black text-white text-xl select-none shrink-0">
            {letter}
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate">{displayName}</div>
            <div className="text-sm text-muted-foreground truncate">{user?.email}</div>
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Display name */}
        <div className="space-y-2">
          <Label htmlFor="display-name">{ar ? "الاسم المعروض" : "Display name"}</Label>
          <div className="flex gap-2">
            <Input
              id="display-name"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && saveName()}
              className="flex-1"
            />
            <Button
              onClick={saveName}
              disabled={nameSaving || !name.trim()}
              className="bg-accent text-white hover:bg-accent/90 shrink-0">
              {nameSaving ? "..." : ar ? "حفظ" : "Save"}
            </Button>
          </div>
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Label htmlFor="new-password">{ar ? "كلمة مرور جديدة" : "New password"}</Label>
          <div className="flex gap-2">
            <Input
              id="new-password"
              type="password"
              value={pwNew}
              onChange={e => setPwNew(e.target.value)}
              onKeyDown={e => e.key === "Enter" && changePassword()}
              placeholder={ar ? "اتركه فارغاً للإلغاء" : "Leave blank to cancel"}
              className="flex-1"
            />
            <Button
              onClick={changePassword}
              disabled={!pwNew || pwSaving}
              variant="outline"
              className="shrink-0">
              {pwSaving ? "..." : ar ? "تغيير" : "Update"}
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Language ── */}
      <Card className="p-6 space-y-4">
        <h2 className="font-semibold text-lg">{ar ? "اللغة" : "Language"}</h2>
        <div className="grid grid-cols-2 gap-3">
          {LANGS.map(lang => {
            const active = i18n.language === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => switchLang(lang.code)}
                className={cn(
                  "relative rounded-xl border-2 p-4 text-center transition-all",
                  active
                    ? "border-accent bg-accent/8 text-accent"
                    : "border-border hover:border-accent/40 text-foreground"
                )}>
                {active && (
                  <span className="absolute top-2.5 end-2.5 h-5 w-5 rounded-full bg-accent flex items-center justify-center">
                    <Check className="h-3 w-3 text-white" />
                  </span>
                )}
                <div className={cn("text-xl font-bold", active ? "text-accent" : "")}>{lang.label}</div>
                <div className="text-xs text-muted-foreground mt-1">{lang.sub}</div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* ── Sign out ── */}
      <Card className="p-6">
        <h2 className="font-semibold text-lg mb-4">{ar ? "الجلسة" : "Session"}</h2>
        <Button variant="destructive" onClick={handleSignOut}>
          <LogOut className="h-4 w-4 me-2" />
          {t("logout")}
        </Button>
      </Card>
    </div>
  );
};
