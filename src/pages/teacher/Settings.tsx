import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { triggerLangTransition } from "@/lib/langTransitionBus";
import { LogOut, Eye, EyeOff } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Avatar } from "@/components/Avatar";
import { QuietAccents } from "@/components/teacher/DashboardAccents";

const LANGS = [
  { code: "ar", label: "العربية" },
  { code: "en", label: "English" },
] as const;

const MIN_PASSWORD = 6;
const PANEL = "rounded-2xl bg-white border-2 border-[hsl(var(--nb-border))] shadow-[4px_4px_0_0_hsl(var(--nb-border))]";

const field = "w-full rounded-xl border-2 border-[hsl(var(--nb-border))] bg-white px-3.5 py-2.5 text-[15px] text-[#3F5A63] placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-[#3F5A63]/20";
const primaryBtn = "shrink-0 rounded-xl border-2 border-[hsl(var(--nb-border))] bg-[#3F5A63] px-4 py-2.5 text-sm font-bold text-white shadow-[3px_3px_0_0_hsl(var(--nb-border))] transition-all hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_hsl(var(--nb-border))] disabled:opacity-40 disabled:pointer-events-none";
const quietBtn = "shrink-0 rounded-xl border-2 border-[hsl(var(--nb-border))] bg-white px-4 py-2 text-sm font-semibold text-[#3F5A63] shadow-[3px_3px_0_0_hsl(var(--nb-border))] transition-all hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_hsl(var(--nb-border))]";

/* One setting: label (and a hint) on one side, the control on the other. */
const Row = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="py-5 grid gap-3 sm:grid-cols-[200px_1fr] sm:items-start">
    <div className="pt-1">
      <div className="text-[15px] font-semibold text-[#3F5A63]">{label}</div>
      {hint && <div className="mt-0.5 text-[13px] text-black/45">{hint}</div>}
    </div>
    <div className="min-w-0">{children}</div>
  </div>
);

export const SettingsPage = () => {
  const { user, signOut } = useAuth();
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const ar = i18n.language === "ar";

  const savedName = user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "";

  const [name, setName] = useState(savedName);
  const [nameSaving, setNameSaving] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const nameChanged = name.trim() !== "" && name.trim() !== savedName;
  const pwShort = pw.length > 0 && pw.length < MIN_PASSWORD;
  const pwMismatch = pw2.length > 0 && pw !== pw2;
  const pwReady = pw.length >= MIN_PASSWORD && pw === pw2;

  const saveName = async () => {
    if (!nameChanged) return;
    setNameSaving(true);
    const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } });
    setNameSaving(false);
    if (error) toast.error(error.message);
    else toast.success(ar ? "تم حفظ الاسم" : "Name saved");
  };

  const closePw = () => { setPwOpen(false); setPw(""); setPw2(""); setShowPw(false); };

  const changePassword = async () => {
    if (!pwReady) return;
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(ar ? "تم تغيير كلمة المرور" : "Password changed"); closePw(); }
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
    <div className="relative isolate min-h-[calc(100dvh-2rem)] md:min-h-[calc(100dvh-4rem)]">
      <QuietAccents />
    <div className="max-w-3xl mx-auto space-y-5">
      <div className={PANEL + " px-5 py-4"}>
        <h1 className="font-display text-2xl font-bold text-primary">{t("settings")}</h1>
      </div>

      <div className={PANEL + " px-5 md:px-7 pt-6 pb-2"}>
      {/* Who is signed in */}
      <div className="flex items-center gap-4">
        <Avatar name={savedName || "?"} size={64} />
        <div className="min-w-0">
          <div className="text-xl font-bold text-[#3F5A63] truncate">{savedName}</div>
          <div className="text-sm text-black/45 truncate" dir="ltr">{user?.email}</div>
        </div>
      </div>

      <div className="mt-6 divide-y divide-black/[0.08] border-t border-black/[0.08]">
        <Row label={ar ? "الاسم" : "Name"} hint={ar ? "يظهر في لوحة التحكم" : "Shown on your dashboard"}>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && saveName()}
              className={field}
              maxLength={60}
            />
            {nameChanged && (
              <button onClick={saveName} disabled={nameSaving} className={primaryBtn}>
                {nameSaving ? "..." : ar ? "حفظ" : "Save"}
              </button>
            )}
          </div>
        </Row>

        <Row label={ar ? "كلمة المرور" : "Password"} hint={pwOpen ? (ar ? `${MIN_PASSWORD} أحرف على الأقل` : `At least ${MIN_PASSWORD} characters`) : undefined}>
          {!pwOpen ? (
            <button onClick={() => setPwOpen(true)} className={quietBtn}>
              {ar ? "تغيير كلمة المرور" : "Change password"}
            </button>
          ) : (
            <div className="space-y-2.5">
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={pw}
                  onChange={e => setPw(e.target.value)}
                  placeholder={ar ? "كلمة المرور الجديدة" : "New password"}
                  autoComplete="new-password"
                  autoFocus
                  className={`${field} pe-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute inset-y-0 end-0 px-3 text-black/40 hover:text-[#3F5A63]"
                  aria-label={showPw ? (ar ? "إخفاء" : "Hide") : (ar ? "إظهار" : "Show")}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <input
                type={showPw ? "text" : "password"}
                value={pw2}
                onChange={e => setPw2(e.target.value)}
                onKeyDown={e => e.key === "Enter" && changePassword()}
                placeholder={ar ? "أعد كتابتها" : "Type it again"}
                autoComplete="new-password"
                className={field}
              />
              {(pwShort || pwMismatch) && (
                <p className="text-[13px] text-red-600">
                  {pwShort
                    ? (ar ? `قصيرة، ${MIN_PASSWORD} أحرف على الأقل` : `Too short, at least ${MIN_PASSWORD} characters`)
                    : (ar ? "الكلمتان غير متطابقتين" : "The two don't match")}
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={changePassword} disabled={!pwReady || pwSaving} className={primaryBtn}>
                  {pwSaving ? "..." : ar ? "تغيير" : "Change"}
                </button>
                <button onClick={closePw} className="px-3 text-sm font-semibold text-black/50 hover:text-[#3F5A63]">
                  {ar ? "إلغاء" : "Cancel"}
                </button>
              </div>
            </div>
          )}
        </Row>

        <Row label={ar ? "اللغة" : "Language"}>
          <div className="inline-grid grid-cols-2 gap-1 rounded-xl border-2 border-[hsl(var(--nb-border))] bg-white p-1">
            {LANGS.map(l => {
              const active = i18n.language === l.code;
              return (
                <button
                  key={l.code}
                  onClick={() => switchLang(l.code)}
                  className={`min-w-[6.5rem] rounded-lg px-4 py-2 text-sm font-bold transition-colors ${active ? "bg-[#3F5A63] text-white" : "text-[#3F5A63] hover:bg-black/[0.05]"}`}
                >
                  {l.label}
                </button>
              );
            })}
          </div>
        </Row>
      </div>
      </div>

      <button
        onClick={handleSignOut}
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 -mx-3 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
      >
        <LogOut className="h-4 w-4" />
        {t("logout")}
      </button>
    </div>
    </div>
  );
};
