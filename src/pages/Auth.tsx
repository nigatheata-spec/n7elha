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
    <div className="min-h-screen bg-background flex flex-col">
      <header className="container flex h-16 items-center justify-between">
        <Link to="/"><Logo /></Link>
        <LangToggle />
      </header>
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-2xl p-8 shadow-soft animate-fade-in">
            <h1 className="font-display text-3xl font-bold mb-1">
              {mode === "signup" ? t("signup") : t("welcome_back")}
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              {mode === "signup" ? t("hero_sub") : t("tagline")}
            </p>
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
              <Button type="submit" disabled={loading} className="w-full bg-gradient-cyan shadow-glow h-11">
                {loading ? "..." : mode === "signup" ? t("signup") : t("login")}
              </Button>
            </form>
            <p className="mt-6 text-sm text-center text-muted-foreground">
              {mode === "signup" ? t("have_account") : t("no_account")}{" "}
              <button type="button" className="text-primary font-medium hover:underline" onClick={() => switchMode(mode === "signup" ? "login" : "signup")}>
                {mode === "signup" ? t("login") : t("signup")}
              </button>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Auth;
