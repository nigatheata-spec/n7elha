import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { LangToggle } from "@/components/LangToggle";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { ArrowRight, Sparkles, Activity, Shield, Zap } from "lucide-react";

const Landing = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const features = [
    { icon: Sparkles, title: t("ai_generate"), desc: "PDF · Word · PowerPoint" },
    { icon: Activity, title: t("analytics"), desc: "Live monitoring · per-question stats" },
    { icon: Shield, title: "Hack & Defense", desc: "8 mini-tasks · breach lockout" },
    { icon: Zap, title: "Realtime", desc: "Instant leaderboard · zero lag" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur sticky top-0 z-30">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <LangToggle />
            {user ? (
              <Button asChild variant="default" size="sm" className="bg-gradient-cyan shadow-glow">
                <Link to="/app">{t("dashboard")}</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm"><Link to="/auth">{t("login")}</Link></Button>
                <Button asChild size="sm" className="bg-gradient-cyan shadow-glow">
                  <Link to="/auth?mode=signup">{t("signup")}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-[0.04] pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
          <div className="container relative py-24 md:py-32">
            <div className="max-w-3xl mx-auto text-center animate-fade-in">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 backdrop-blur px-4 py-1.5 text-sm text-muted-foreground mb-6">
                <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                {t("tagline")}
              </div>
              <h1 className="font-display text-5xl md:text-7xl font-black leading-tight tracking-tight">
                {t("hero_title")}
              </h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                {t("hero_sub")}
              </p>
              <div className="mt-10 flex items-center justify-center gap-3 flex-wrap">
                <Button asChild size="lg" className="bg-gradient-cyan shadow-glow text-base h-12 px-8">
                  <Link to={user ? "/app" : "/auth?mode=signup"}>
                    {t("get_started")} <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="text-base h-12 px-8 border-2">
                  <Link to="/play">انضم للعبة</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="container py-16 md:py-24">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-border bg-card p-6 shadow-soft hover:shadow-glow transition-shadow">
                <div className="h-11 w-11 rounded-xl bg-gradient-cyan flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <h3 className="font-bold text-lg mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50 py-8">
        <div className="container text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Hash Platform
        </div>
      </footer>
    </div>
  );
};

export default Landing;
