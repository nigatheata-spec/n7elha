import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { LangToggle } from "@/components/LangToggle";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

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
  const { t } = useTranslation();

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
        toast.success(t("welcome_back"));
        if (data.session) window.location.assign("/app");
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
    <div className="min-h-[100dvh] grid lg:grid-cols-2">
      {/* ── Left brand panel (desktop only) ── */}
      <div className="hidden lg:flex flex-col bg-[#3F5A63] p-12 relative overflow-hidden">
        {/* subtle cross grid */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" aria-hidden>
          {[[80,80],[240,80],[400,80],[80,240],[400,240],[80,400],[240,400],[400,400]].map(([x,y],i)=>(
            <g key={i} stroke="#fff" strokeWidth="1">
              <line x1={x-18} y1={y} x2={x+18} y2={y}/>
              <line x1={x} y1={y-18} x2={x} y2={y+18}/>
            </g>
          ))}
        </svg>

        <Link to="/" className="relative z-10 flex items-center gap-2 shrink-0">
          <span className="h-3 w-3 rounded-full bg-white/80 inline-block" />
          <span className="text-[17px] font-medium tracking-tight text-white">n7elha</span>
        </Link>

        <div className="relative z-10 flex-1 flex flex-col justify-center">
          <blockquote className="space-y-5">
            <p className="text-[#FFE8DC] text-[21px] leading-relaxed font-medium">
              {t("hero_title")}
            </p>
            <footer className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-[#FF8254]/40 flex items-center justify-center shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <span className="text-white/55 text-sm">{t("tagline")}</span>
            </footer>
          </blockquote>
        </div>

        <p className="relative z-10 text-white/30 text-[12px] tracking-wider">n7elha © 2026</p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-col bg-background">
        <header className="flex items-center justify-between px-6 lg:px-10 pt-6 lg:pt-8">
          <Link to="/" className="lg:hidden"><Logo /></Link>
          <div className="lg:ms-auto"><LangToggle /></div>
        </header>

        <main className="flex-1 flex items-center justify-center px-6 pb-10">
          <div className="w-full max-w-[400px] animate-fade-up">
            <div className="mb-8">
              <h1 className="text-[28px] font-bold tracking-tight text-foreground">
                {mode === "signup" ? t("signup") : t("welcome_back")}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {mode === "signup" ? t("hero_sub") : t("tagline")}
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label>{t("display_name")}</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>{t("email")}</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>{t("password")}</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-[#3F5A63] hover:bg-[#3F5A63]/90 text-white font-semibold rounded-xl active:-translate-y-px transition-all"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                    {mode === "signup" ? t("signup") : t("login")}
                  </span>
                ) : mode === "signup" ? t("signup") : t("login")}
              </Button>
            </form>

            <p className="mt-6 text-sm text-center text-muted-foreground">
              {mode === "signup" ? t("have_account") : t("no_account")}{" "}
              <button
                type="button"
                className="text-[#FF8254] font-medium hover:underline underline-offset-4"
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

export default Auth;
