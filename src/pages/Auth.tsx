import { useEffect, useState } from "react";
import { LIME, SAND, TEAL } from "@/components/teacher/DashboardAccents";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import logoMark from "@/assets/logo-mark.png";
import { LangToggle } from "@/components/LangToggle";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/ui/sonner";
import { z } from "zod";
import { Loader2, ArrowUpRight } from "lucide-react";
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
    <div
      className="relative min-h-[100dvh] overflow-hidden flex flex-col"
      style={{ background: "hsl(var(--cream-panel))", fontFamily: "'Outfit', 'Almarai', system-ui, sans-serif" }}
    >
      <Seo
        path="/auth"
        titleAr="تسجيل الدخول"
        titleEn="Log In"
        descriptionAr="سجّل الدخول إلى حسابك في نفلها."
        descriptionEn="Log in to your nefelha account."
        index={false}
      />

      {/* The home page's shapes, so signing in feels like the same place:
          lime and sand from one top corner, teal from the opposite bottom,
          and a thin oval with a drop. Drawn left-to-right, mirrored in Arabic. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-16 -end-20 w-[240px] sm:w-[420px] lg:w-[520px] rtl:-scale-x-100">
          <svg viewBox="0 0 400 400" className="accent-drift w-full" style={{ animationDuration: "24s" }}>
            <path fill={SAND} d="M400 0H70C20 40 48 118 100 172C154 228 132 300 204 356C254 396 338 404 400 392Z" />
            <path fill={LIME} d="M400 0H154C102 34 130 104 174 150C222 200 202 262 266 310C308 342 360 340 400 330Z" />
          </svg>
        </div>
        <div className="absolute -bottom-10 -start-10 w-[260px] sm:w-[440px] lg:w-[560px] ltr:-scale-x-100">
          <svg viewBox="0 0 400 300" className="accent-drift w-full" style={{ animationDuration: "28s", animationDelay: "-9s" }}>
            <path fill={SAND} d="M400 300V84C350 66 300 92 274 140C238 208 170 214 112 250C78 272 56 290 46 300Z" />
            <path fill={TEAL} d="M400 300V140C364 126 328 144 308 180C282 230 224 234 180 262C154 278 138 292 132 300Z" />
          </svg>
        </div>
        <div className="absolute top-[22%] start-[8%] w-[200px] h-[150px] hidden lg:block">
          <svg viewBox="0 0 240 140" className="accent-drift absolute inset-x-0 top-0 w-full" style={{ animationDuration: "22s", animationDelay: "-6s" }}>
            <ellipse cx="120" cy="70" rx="112" ry="52" transform="rotate(-18 120 70)" fill="none" stroke="#12262B" strokeWidth="1.5" opacity="0.4" />
          </svg>
          <svg viewBox="0 0 120 120" className="accent-drift absolute top-[52%] end-[10%] w-[48px]" style={{ animationDuration: "18s", animationDelay: "-3s" }}>
            <path fill={TEAL} d="M64 6C94 8 116 34 112 66C108 98 82 116 52 112C22 108 4 84 8 56C12 26 34 4 64 6Z" />
          </svg>
        </div>
      </div>

      <header className="relative z-10 flex items-center justify-between px-5 sm:px-10 pt-5 sm:pt-7">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoMark} alt="nefelha" className="h-9 w-9 object-contain" />
          <span className="text-[18px] font-semibold tracking-tight text-[#2B3F45]">{isAr ? "نفلها" : "nefelha"}</span>
        </Link>
        <LangToggle />
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[440px]">
          <h1
            className="text-center leading-[1.15] text-[40px] sm:text-[52px]"
            style={{ fontFamily: "'ArslanWessam', 'Almarai', sans-serif", color: "#3F5A63" }}
          >
            {mode === "signup"
              ? (isAr ? <>ابدأ مع <span style={{ color: "#8FC44A" }}>نفلها</span></> : <>Start with <span style={{ color: "#8FC44A" }}>nefelha</span></>)
              : (isAr ? <>أهلاً <span style={{ color: "#8FC44A" }}>من جديد</span></> : <>Welcome <span style={{ color: "#8FC44A" }}>back</span></>)}
          </h1>
          <p className="mt-3 text-center text-[15px] text-black/55">
            {mode === "signup"
              ? (isAr ? "حساب مجاني، وأول لعبة على السبورة خلال دقيقة." : "A free account, and your first game on the board in a minute.")
              : (isAr ? "اختباراتك وألعابك بانتظارك." : "Your quizzes and games are waiting.")}
          </p>

          <div className="mt-8 rounded-[28px] bg-white border-2 border-[hsl(var(--nb-border))] shadow-[6px_6px_0_0_hsl(var(--nb-border))] p-6 sm:p-8">
            {/* login / signup */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-full border-2 border-[hsl(var(--nb-border))] mb-6">
              {(["login", "signup"] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className={`py-2 rounded-full text-[14px] font-bold transition-colors ${mode === m ? "bg-[#2B3F45] text-white" : "text-[#2B3F45] hover:bg-black/[0.05]"}`}
                >
                  {m === "login" ? t("login") : t("signup")}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-4">
              {mode === "signup" && (
                <Field label={t("display_name")}>
                  <AuthInput value={name} onChange={e => setName(e.target.value)} maxLength={100} required autoComplete="name" />
                </Field>
              )}
              <Field label={t("email")}>
                <AuthInput type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" autoComplete="email" dir="ltr" />
              </Field>
              <Field label={t("password")}>
                <AuthInput
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  minLength={6} required placeholder="••••••••" dir="ltr"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
              </Field>

              <button
                type="submit"
                disabled={loading}
                className="group mt-2 w-full inline-flex items-center justify-between gap-3 rounded-full border-2 border-[hsl(var(--nb-border))] bg-[#8FC44A] text-[#2B3F45] ps-6 pe-2 py-2 text-[16px] font-bold shadow-[4px_4px_0_0_hsl(var(--nb-border))] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_hsl(var(--nb-border))] transition-all disabled:opacity-60"
              >
                {mode === "signup" ? t("signup") : t("login")}
                <span className="h-10 w-10 rounded-full bg-white flex items-center justify-center transition group-hover:rotate-12">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />}
                </span>
              </button>
            </form>
          </div>

          {/* Students sometimes land here looking for the game */}
          <p className="mt-6 text-center text-[14px] text-black/55">
            {isAr ? "طالب؟" : "A student?"}{" "}
            <Link to="/join" className="font-bold text-[#2B3F45] underline underline-offset-4 decoration-[#8FC44A] decoration-2">
              {isAr ? "ادخل اللعبة برمزها" : "Join a game with its code"}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};

/* ── Field wrapper ─────────────────────────────────────────────────────── */
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block space-y-1.5">
    <span className="block text-[13px] font-bold text-[#2B3F45]">{label}</span>
    {children}
  </label>
);

/* ── Input ─────────────────────────────────────────────────────────────── */
const AuthInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className="w-full h-12 rounded-2xl px-4 text-[15px] text-[#12262B] bg-[hsl(var(--cream-panel))] border-2 border-[hsl(var(--nb-border))] outline-none placeholder:text-black/30 focus:bg-white focus:ring-4 focus:ring-[#8FC44A]/30 transition"
  />
);

export default Auth;
