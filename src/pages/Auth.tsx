import { useEffect, useState } from "react";
import { LIME, SAND, TEAL } from "@/components/teacher/DashboardAccents";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import logoLight from "@/assets/logo-light.png";
import { LangToggle } from "@/components/LangToggle";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/ui/sonner";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Seo } from "@/components/Seo";

const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
});

const signupSchema = loginSchema.extend({
  display_name: z.string().trim().min(1).max(100),
});

const Auth = () => {
  const [params, setParams] = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">((params.get("mode") as any) || "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  useEffect(() => {
    setMode(params.get("mode") === "signup" ? "signup" : "login");
  }, [params]);

  const switchMode = (next: "login" | "signup") => {
    setMode(next);
    setParams(next === "signup" ? { mode: "signup" } : {}, { replace: true });
    setLoading(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const parsed = (mode === "signup" ? signupSchema : loginSchema).safeParse({
        email,
        password,
        ...(mode === "signup" ? { display_name: name } : {}),
      });
      if (!parsed.success) {
        toast.error(parsed.error.errors[0].message);
        return;
      }
      if (mode === "signup") {
        const { error, data } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) {
          if (error.message.toLowerCase().includes("already")) {
            switchMode("login");
            toast.info("الحساب موجود مسبقًا — سجّل دخولك الآن");
            return;
          }
          throw error;
        }
        if (data.session) window.location.assign("/app"); // redirect is instant — a toast would be gone before it's read
        else toast.info("Check your email to confirm");
      } else {
        const { error, data } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.session) window.location.assign("/app");
      }
    } catch (e: any) {
      toast.error(e.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] grid lg:grid-cols-2" style={{ fontFamily: "'Outfit', 'Tajawal', system-ui, sans-serif" }}>
      <Seo
        path="/auth"
        titleAr="تسجيل الدخول"
        titleEn="Log In"
        descriptionAr="سجّل الدخول إلى حسابك في نفلها."
        descriptionEn="Log in to your nefelha account."
        index={false}
      />

      {/* ── Left brand panel ── */}
      <div className="hidden lg:flex flex-col bg-[#3F5A63] p-12 relative overflow-hidden">
        {/* The brand's flowing shapes (the business-card look) in place of a
            pattern: lime from the top corner, sand and teal from the bottom. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {/* drawn for left-to-right; mirrored in Arabic so it stays opposite the logo */}
          <div className="absolute -top-16 -end-20 w-[380px] rtl:-scale-x-100">
          <svg viewBox="0 0 400 400" className="accent-drift w-full" style={{ animationDuration: "24s" }}>
            <path fill={SAND} opacity="0.9" d="M400 0H70C20 40 48 118 100 172C154 228 132 300 204 356C254 396 338 404 400 392Z" />
            <path fill={LIME} d="M400 0H154C102 34 130 104 174 150C222 200 202 262 266 310C308 342 360 340 400 330Z" />
          </svg>
          </div>
          <div className="absolute -bottom-6 -start-10 w-[460px] rtl:-scale-x-100">
          <svg viewBox="0 0 420 300" className="accent-drift w-full" style={{ animationDuration: "28s", animationDelay: "-9s" }}>
            <path fill={SAND} d="M0 300V96C46 70 112 92 150 150C190 210 262 200 320 236C362 262 392 284 404 300Z" />
            <path fill={TEAL} d="M0 300V150C40 132 92 150 120 194C150 240 214 236 268 262C298 276 318 290 326 300Z" />
          </svg>
          </div>
          <svg viewBox="0 0 240 140" className="accent-drift absolute top-[15%] start-[10%] w-[150px]" style={{ animationDuration: "20s", animationDelay: "-5s" }}>
            <ellipse cx="120" cy="70" rx="112" ry="52" transform="rotate(-14 120 70)" fill="none" stroke="#FFE8DC" strokeWidth="1.5" opacity="0.4" />
          </svg>
        </div>

        <Link to="/" className="relative z-10 flex items-center gap-2 shrink-0">
          <img src={logoLight} alt="nefelha" className="h-9 w-9 object-contain" />
          <span className="text-[17px] font-medium tracking-tight text-white">{isAr ? "نفلها" : "nefelha"}</span>
        </Link>

        <div className="relative z-10 flex-1 flex flex-col justify-center">
          <blockquote className="space-y-5">
            <p className="text-[#FFE8DC] text-[22px] leading-relaxed font-medium">
              {t("hero_title")}
            </p>
            <footer className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-[#8FC44A]/40 flex items-center justify-center shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <span className="text-white/55 text-sm">{t("tagline")}</span>
            </footer>
          </blockquote>
        </div>

        <p className="relative z-10 text-white/70 text-[12px] tracking-wider">{isAr ? "نفلها © ٢٠٢٦" : "nefelha © 2026"}</p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-col" style={{ background: "#FAFAF8" }}>
        <header className="flex items-center justify-between px-6 lg:px-10 pt-6 lg:pt-8">
          <Link to="/" className="lg:hidden"><Logo /></Link>
          <div className="lg:ms-auto"><LangToggle /></div>
        </header>

        <main className="flex-1 flex items-center justify-center px-6 pb-10">
          <div className="w-full max-w-[400px]">

            {/* Heading */}
            <div className="mb-8">
              <h1 className="text-[28px] font-bold tracking-tight" style={{ color: "#1a2b30" }}>
                {mode === "signup" ? t("signup") : t("welcome_back")}
              </h1>
              <p className="mt-1.5 text-[14px]" style={{ color: "#6b8089" }}>
                {mode === "signup" ? t("hero_sub") : t("tagline")}
              </p>
            </div>

            {/* Mode toggle pills */}
            <div className="flex gap-1 p-1 rounded-xl mb-7" style={{ background: "#ede8df" }}>
              {(["login", "signup"] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className="flex-1 py-2 text-[13px] font-semibold rounded-lg transition-all"
                  style={mode === m
                    ? { background: "#fff", color: "#3F5A63", boxShadow: "0 1px 4px rgba(0,0,0,0.10)" }
                    : { background: "transparent", color: "#7a8e93" }
                  }
                >
                  {m === "login" ? t("login") : t("signup")}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-4">
              {mode === "signup" && (
                <Field label={t("display_name")}>
                  <AuthInput
                    value={name}
                    onChange={e => setName(e.target.value)}
                    maxLength={100}
                    required
                    placeholder={t("display_name")}
                  />
                </Field>
              )}
              <Field label={t("email")}>
                <AuthInput
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                />
              </Field>
              <Field label={t("password")}>
                <AuthInput
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  minLength={6}
                  required
                  placeholder="••••••••"
                />
              </Field>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl font-semibold text-white text-[15px] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                style={{ background: "#3F5A63" }}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "signup" ? t("signup") : t("login")}
              </button>
            </form>

            <p className="mt-6 text-[13px] text-center" style={{ color: "#7a8e93" }}>
              {mode === "signup" ? t("have_account") : t("no_account")}{" "}
              <button
                type="button"
                className="font-semibold hover:underline underline-offset-4 transition"
                style={{ color: "#8FC44A" }}
                onClick={() => switchMode(mode === "signup" ? "login" : "signup")}
              >
                {mode === "signup" ? t("login") : t("signup")}
              </button>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
};

/* ── Field wrapper ─────────────────────────────────────────────────────── */
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="block text-[13px] font-semibold" style={{ color: "#2c3e44" }}>{label}</label>
    {children}
  </div>
);

/* ── Input ─────────────────────────────────────────────────────────────── */
const AuthInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className="w-full h-11 rounded-xl px-4 text-[14px] outline-none transition-all"
    style={{
      background: "#fff",
      border: "1.5px solid #d4cec6",
      color: "#1a2b30",
    }}
    onFocus={e => { e.currentTarget.style.borderColor = "#3F5A63"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(63,90,99,0.12)"; }}
    onBlur={e => { e.currentTarget.style.borderColor = "#d4cec6"; e.currentTarget.style.boxShadow = "none"; }}
  />
);

export default Auth;
