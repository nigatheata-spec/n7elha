import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import {
  ArrowUpRight, LayoutDashboard, ListChecks, Radio, BarChart3, Settings,
  Sparkles, Plus,
} from "lucide-react";

/* Teacher-side control panel rebuilt as live markup rather than a screenshot: it
   stays sharp at any density, needs no asset pipeline, and reads from the same
   tokens as the real dashboard, so it cannot silently drift from what the app
   actually looks like. Every number/name here is illustrative demo content for
   the mockup, same treatment the student-side phone mockup used (join code,
   score, player count) — not a claim about real usage. */
const SIDEBAR_ICONS = [LayoutDashboard, ListChecks, Radio, BarChart3, Settings];
const MODE_COLORS = ["#3F5A63", "#8B4A3A", "#C8783A", "#8FC44A"];

export const ProductPreview = () => {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const isAr = i18n.language === "ar";

  const t = isAr
    ? {
        kicker: "من جهة المعلم",
        title: "كل صفك، في لوحة واحدة",
        sub: "اختباراتك، جلساتك المباشرة، وأداء طلابك — كلها في مكان واحد. لا تنقّل بين أدوات متفرقة، ولا نسخ ولصق بين شاشات.",
        cta: "ابدأ معنا",
        secondary: "شاهد المميزات",
        greeting: "صباح الخير، أستاذة سارة",
        newQuiz: "اختبار جديد",
        host: "استضف جلسة",
        stat1Label: "الإجابات الصحيحة",
        stat2Label: "طلاب شاركوا اليوم",
        stat3Label: "اختبارات هذا الأسبوع",
        recentLabel: "جلساتي الأخيرة",
        sessions: [
          { name: "كلاسيك — الوحدة الثالثة", meta: "قبل ٣ ساعات · ٢٨ طالبًا" },
          { name: "حرب الزومبي — مراجعة", meta: "أمس · ٣١ طالبًا" },
          { name: "أرضية الحمم — كيمياء", meta: "الإثنين · ٢٤ طالبًا" },
        ],
        aiLabel: "اقتراح ذكي",
        aiText: "طلابك يتعثرون في أسئلة الوحدة الثانية. ولّد جولة مراجعة سريعة؟",
      }
    : {
        kicker: "TEACHER SIDE",
        title: "Your whole class, one dashboard",
        sub: "Quizzes, live sessions, and student performance — all in one place. No jumping between tools, no copy-pasting between screens.",
        cta: "Get started",
        secondary: "See features",
        greeting: "Good morning, Ms. Sara",
        newQuiz: "New quiz",
        host: "Host session",
        stat1Label: "Correct answers",
        stat2Label: "Students joined today",
        stat3Label: "Quizzes this week",
        recentLabel: "Recent sessions",
        sessions: [
          { name: "Classic — Unit 3", meta: "3h ago · 28 students" },
          { name: "Humans vs Zombies — Review", meta: "Yesterday · 31 students" },
          { name: "Lava Floor — Chemistry", meta: "Monday · 24 students" },
        ],
        aiLabel: "AI suggestion",
        aiText: "Your class is struggling with Unit 2 questions. Generate a quick review round?",
      };

  return (
    <section className="relative overflow-hidden px-5 sm:px-8 md:px-14 py-16 sm:py-24 border-t border-black/5">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] gap-12 lg:gap-20 items-center">
        <div className="max-w-xl">
          <span className={`text-[12px] font-semibold text-[#8FC44A] ${isAr ? "tracking-normal" : "tracking-[0.25em]"}`}>{t.kicker}</span>
          <h2
            className="mt-3 text-[28px] sm:text-[40px] tracking-tight leading-[1.1]"
            style={{ color: "#3F5A63", fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}
          >
            {t.title}
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-black/65">{t.sub}</p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              to={user ? "/app" : "/auth?mode=signup"}
              className="group inline-flex items-center gap-3 rounded-full border-2 border-[hsl(var(--nb-border))] bg-[#3F5A63] text-white pl-6 pr-2 py-2 text-[15px] font-medium shadow-[4px_4px_0_0_hsl(var(--nb-border))] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_hsl(var(--nb-border))] transition-all"
            >
              {t.cta}
              <span className="h-9 w-9 rounded-full bg-white text-black flex items-center justify-center transition group-hover:rotate-12">
                <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
              </span>
            </Link>
            <Link
              to="/services"
              className="inline-flex items-center rounded-full border-2 border-[hsl(var(--nb-border))] bg-white text-[#3F5A63] px-6 py-2.5 text-[15px] font-medium shadow-[4px_4px_0_0_hsl(var(--nb-border))] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_hsl(var(--nb-border))] transition-all"
            >
              {t.secondary}
            </Link>
          </div>
        </div>

        {/* ---- browser window ---- */}
        <div className="relative mx-auto w-full max-w-[560px]">
          <div className="relative rounded-2xl border-4 border-[hsl(var(--nb-border))] bg-white shadow-[10px_10px_0_0_hsl(var(--nb-border))] overflow-hidden">
            {/* chrome */}
            <div className="flex items-center gap-2 border-b-2 border-[hsl(var(--nb-border))] bg-[#EBDFC7] px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#C8783A]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#8FC44A]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#3a9e6e]" />
              <span dir="ltr" className="ms-3 rounded-full bg-white/70 px-3 py-0.5 text-[10px] font-semibold text-black/40">
                nefelha.com/app
              </span>
            </div>

            <div className="flex" style={{ background: "hsl(var(--cream-panel))" }}>
              {/* mini sidebar */}
              <div className="flex w-11 sm:w-14 shrink-0 flex-col items-center gap-3 border-e-2 border-[hsl(var(--nb-border))] bg-white/60 py-4">
                {SIDEBAR_ICONS.map((Icon, i) => (
                  <span
                    key={i}
                    className={`flex h-7 w-7 items-center justify-center rounded-lg ${i === 0 ? "bg-[#3F5A63] text-white" : "text-[#3F5A63]/40"}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                ))}
              </div>

              {/* main */}
              <div className="min-w-0 flex-1 p-3.5 sm:p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-bold text-[#3F5A63]">{t.greeting}</p>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#8FC44A] opacity-70 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#8FC44A]" />
                  </span>
                </div>

                {/* quick actions */}
                <div className="mt-3 flex gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[hsl(var(--nb-border))] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#3F5A63] shadow-[2px_2px_0_0_hsl(var(--nb-border))]">
                    <Plus className="h-3 w-3" /> {t.newQuiz}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[hsl(var(--nb-border))] bg-[#8FC44A] px-2.5 py-1.5 text-[11px] font-semibold text-[#3F5A63] shadow-[2px_2px_0_0_hsl(var(--nb-border))]">
                    <Radio className="h-3 w-3" /> {t.host}
                  </span>
                </div>

                {/* stats */}
                <div className="mt-4 flex items-start">
                  <div className="flex-1 px-1">
                    <p className="text-[16px] font-black text-[#3a9e6e]">82%</p>
                    <p className="mt-0.5 text-[9px] font-medium text-black/45 leading-tight">{t.stat1Label}</p>
                  </div>
                  <div className="w-px self-stretch bg-black/10" />
                  <div className="flex-1 px-2.5">
                    <p className="text-[16px] font-black text-[#3F5A63]">126</p>
                    <p className="mt-0.5 text-[9px] font-medium text-black/45 leading-tight">{t.stat2Label}</p>
                  </div>
                  <div className="w-px self-stretch bg-black/10" />
                  <div className="flex-1 px-2.5">
                    <p className="text-[16px] font-black text-[#C8783A]">7</p>
                    <p className="mt-0.5 text-[9px] font-medium text-black/45 leading-tight">{t.stat3Label}</p>
                  </div>
                </div>

                {/* recent sessions + AI panel */}
                <div className="mt-3 grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
                  <div className="rounded-lg border-2 border-[hsl(var(--nb-border))] bg-white p-2.5 shadow-[2px_2px_0_0_hsl(var(--nb-border))]">
                    <p className="text-[9px] font-semibold text-black/40">{t.recentLabel}</p>
                    <div className="mt-1.5 space-y-1.5">
                      {t.sessions.map((s, i) => (
                        <div key={s.name} className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: MODE_COLORS[i] }} />
                          <div className="min-w-0">
                            <p className="truncate text-[10px] font-semibold text-[#3F5A63]">{s.name}</p>
                            <p className="truncate text-[9px] text-black/40">{s.meta}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border-2 border-[hsl(var(--nb-border))] bg-[#3F5A63] p-2.5 text-white shadow-[2px_2px_0_0_hsl(var(--nb-border))]">
                    <div className="flex items-center gap-1 text-[9px] font-semibold text-[#8FC44A]">
                      <Sparkles className="h-3 w-3" /> {t.aiLabel}
                    </div>
                    <p className="mt-1.5 text-[9.5px] leading-snug text-white/85">{t.aiText}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
