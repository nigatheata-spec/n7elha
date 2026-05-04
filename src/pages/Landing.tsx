import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "react-i18next";
import { LangToggle } from "@/components/LangToggle";
import {
  ArrowUpRight,
  Play,
  User,
  MoreHorizontal,
  Menu,
  X,
  Sparkles,
  FileText,
  Radio,
  BarChart3,
  Upload,
  Users,
  Trophy,
  Mail,
  Github,
  Twitter,
  Instagram,
} from "lucide-react";
import { useState } from "react";
import heroPerson from "@/assets/hero-person.png";

const Landing = () => {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [menuOpen, setMenuOpen] = useState(false);

  const t = isAr
    ? {
        about: "من نحن",
        services: "الخدمات",
        partners: "الشركاء",
        login: "دخول",
        signup: "تسجيل",
        dashboard: "لوحتي",
        joinGame: "ادخل اللعبة",
        line1: "كل ما تحتاجه",
        line2a: "لتصنع",
        line2b: "اختباراً",
        line3a: "يلامس",
        line3b: "النجاح",
        sub: "نحلها يرافقك من فكرة الاختبار حتى تشغيله المباشر، ومن توليد الأسئلة بالذكاء الاصطناعي حتى تحليل أداء طلابك.",
        cta: "ابدأ معنا",
        customers: "معلم",
        playVideo: "شاهد الفيديو",

        featuresKicker: "لماذا نحلها؟",
        featuresTitle: "أدواتٌ صُممت ليعشقها المعلم والطالب",
        featuresSub: "كل ميزة في المنصة وُلدت من احتياج حقيقي داخل الفصل، لا مجرد رفاهية تقنية.",
        f1Title: "توليد الأسئلة بالذكاء الاصطناعي",
        f1Desc: "ارفع ملف الدرس (PDF أو Word أو PowerPoint) واترك المنصة تستخرج لك أسئلة دقيقة بمستويات صعوبة مختلفة.",
        f2Title: "بناء يدوي مرن",
        f2Desc: "حرر، أضف، وأعد ترتيب الأسئلة بسهولة. اختر الإجابات الصحيحة وحدّد الوقت المناسب لكل سؤال.",
        f3Title: "بث مباشر للفصل",
        f3Desc: "ادعُ طلابك برمز قصير، وشاهدهم ينضمون لحظة بلحظة على شاشة العرض في صفك.",
        f4Title: "تحليلات مفصلة",
        f4Desc: "اعرف من أتقن الدرس ومن يحتاج إلى مراجعة، عبر تقارير واضحة بعد كل جلسة.",

        howKicker: "كيف تعمل؟",
        howTitle: "ثلاث خطوات تفصلك عن أول جلسة",
        s1: "ارفع المحتوى",
        s1d: "ملف الدرس أو ملاحظاتك. تتكفّل المنصة بالباقي.",
        s2: "ادعُ طلابك",
        s2d: "شارك رمز اللعبة، وسينضم الجميع من أي جهاز.",
        s3: "اعرض النتائج",
        s3d: "ترتيب لحظي، وتقرير كامل بعد انتهاء الاختبار.",

        ctaTitle: "جاهز تجرّب نحلها مع فصلك؟",
        ctaSub: "إنشاء الحساب مجاني، وأول اختبار يحتاج دقائق فقط.",
        ctaBtn: "أنشئ حسابك الآن",
        ctaJoin: "ادخل كطالب",

        footerTagline: "منصة الاختبارات التفاعلية للمعلمين باللغة العربية.",
        footerProduct: "المنتج",
        footerCompany: "الشركة",
        footerLegal: "قانوني",
        footerFeatures: "المميزات",
        footerHow: "كيف يعمل",
        footerPricing: "الأسعار",
        footerAbout: "من نحن",
        footerContact: "تواصل",
        footerCareers: "الوظائف",
        footerPrivacy: "الخصوصية",
        footerTerms: "الشروط",
        footerRights: "© 2026 نحلها. جميع الحقوق محفوظة.",
      }
    : {
        about: "ABOUT",
        services: "FEATURES",
        partners: "CONTACT",
        login: "LOG IN",
        signup: "SIGN UP",
        dashboard: "DASHBOARD",
        joinGame: "JOIN GAME",
        line1: "Everything you need",
        line2a: "to craft",
        line2b: "a quiz",
        line3a: "that touches",
        line3b: "success",
        sub: "n7elha walks with you from idea to live session — from AI-generated questions to real-time student insights.",
        cta: "Get started",
        customers: "teachers",
        playVideo: "Play video",

        featuresKicker: "WHY N7ELHA?",
        featuresTitle: "Tools teachers and students actually love",
        featuresSub: "Every feature was born from a real classroom need — not a tech gimmick.",
        f1Title: "AI question generation",
        f1Desc: "Upload your lesson (PDF, Word or PowerPoint) and let the platform extract precise questions across difficulty levels.",
        f2Title: "Flexible manual builder",
        f2Desc: "Edit, add and reorder questions effortlessly. Choose correct answers and tune the timing per question.",
        f3Title: "Live classroom broadcast",
        f3Desc: "Invite your students with a short code and watch them join in real time on your projector.",
        f4Title: "Deep analytics",
        f4Desc: "Know who mastered the lesson and who needs a review, through clear reports after every session.",

        howKicker: "HOW IT WORKS",
        howTitle: "Three steps to your first live session",
        s1: "Upload content",
        s1d: "Your lesson file or notes. The platform handles the rest.",
        s2: "Invite students",
        s2d: "Share the game code — anyone can join from any device.",
        s3: "See results",
        s3d: "Live leaderboard plus a full report once the quiz ends.",

        ctaTitle: "Ready to try n7elha with your class?",
        ctaSub: "Creating an account is free, and your first quiz takes just minutes.",
        ctaBtn: "Create your account",
        ctaJoin: "Join as student",

        footerTagline: "The interactive quiz platform built for Arabic-speaking classrooms.",
        footerProduct: "Product",
        footerCompany: "Company",
        footerLegal: "Legal",
        footerFeatures: "Features",
        footerHow: "How it works",
        footerPricing: "Pricing",
        footerAbout: "About",
        footerContact: "Contact",
        footerCareers: "Careers",
        footerPrivacy: "Privacy",
        footerTerms: "Terms",
        footerRights: "© 2026 n7elha. All rights reserved.",
      };

  return (
    <div
      dir="ltr"
      className="min-h-screen w-full p-3 sm:p-6 lg:p-12 flex flex-col items-center"
      style={{ background: "#FBE9E5", fontFamily: "'Inter', 'Tajawal', system-ui, sans-serif" }}
    >
      <div className="relative w-full max-w-[1280px] bg-white rounded-[20px] sm:rounded-[28px] shadow-[0_30px_80px_-30px_rgba(60,40,90,0.25)] overflow-hidden">
        <span className="pointer-events-none absolute -bottom-6 -right-6 text-3xl text-[#F2C2B6] select-none">✦</span>

        {/* ---------------- NAV ---------------- */}
        <nav className="flex items-center justify-between px-5 sm:px-8 md:px-14 pt-6 sm:pt-8 gap-3">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <span className="h-3 w-3 rounded-full bg-black inline-block" />
            <span className="text-[17px] font-medium tracking-tight text-black">n7elha</span>
          </Link>

          <ul className="hidden lg:flex items-center gap-10 text-[13px] tracking-[0.18em] font-medium text-black/80">
            <li><a href="#features" className="hover:text-black">{t.services}</a></li>
            <li><a href="#how" className="hover:text-black">{t.about}</a></li>
            <li><a href="#footer" className="hover:text-black">{t.partners}</a></li>
          </ul>

          <div className="hidden md:flex items-center gap-2">
            <LangToggle variant="pill" />
            <Link
              to="/play"
              className="px-4 py-2 rounded-full border border-black/15 bg-white text-black text-[13px] tracking-wider font-medium hover:bg-black hover:text-white transition"
            >
              {t.joinGame}
            </Link>
            {user ? (
              <Link to="/app" className="px-5 py-2 rounded-full bg-black text-white text-[13px] tracking-wider font-medium">
                {t.dashboard}
              </Link>
            ) : (
              <>
                <Link
                  to="/auth"
                  className="px-5 py-2 rounded-full bg-[#A0301A] text-white text-[13px] tracking-wider font-medium hover:brightness-95 transition"
                >
                  {t.login}
                </Link>
                <Link
                  to="/auth?mode=signup"
                  className="px-5 py-2 rounded-full bg-black text-white text-[13px] tracking-wider font-medium hover:bg-black/85 transition"
                >
                  {t.signup}
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden h-10 w-10 rounded-full border border-black/15 flex items-center justify-center text-black"
            aria-label="Menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>

        {/* mobile menu panel */}
        {menuOpen && (
          <div className="md:hidden px-5 pt-4 pb-2 flex flex-col gap-2">
            <LangToggle variant="pill" />
            <Link to="/play" className="px-4 py-2 rounded-full border border-black/15 bg-white text-black text-[13px] tracking-wider font-medium text-center">
              {t.joinGame}
            </Link>
            {user ? (
              <Link to="/app" className="px-5 py-2 rounded-full bg-black text-white text-[13px] tracking-wider font-medium text-center">
                {t.dashboard}
              </Link>
            ) : (
              <>
                <Link to="/auth" className="px-5 py-2 rounded-full bg-[#A0301A] text-white text-[13px] tracking-wider font-medium text-center">
                  {t.login}
                </Link>
                <Link to="/auth?mode=signup" className="px-5 py-2 rounded-full bg-black text-white text-[13px] tracking-wider font-medium text-center">
                  {t.signup}
                </Link>
              </>
            )}
          </div>
        )}

        {/* ---------------- HERO ---------------- */}
        <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-8 px-5 sm:px-8 md:px-14 pt-10 sm:pt-16 pb-12">
          <div className="relative z-10">
            <h1 className="text-black font-semibold leading-[1.05] tracking-tight text-[34px] sm:text-[44px] md:text-[60px]">
              <span className="block">{t.line1}</span>
              <span className="block mt-3">
                <Highlight>{t.line2a}</Highlight> <span>{t.line2b}</span>
              </span>
              <span className="block mt-3">
                <span>{t.line3a} </span>
                <Highlight>{t.line3b}</Highlight>
              </span>
            </h1>

            <p className="mt-6 sm:mt-8 text-[14px] sm:text-[15px] leading-relaxed text-black/70 max-w-md">
              {t.sub}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to={user ? "/app" : "/auth?mode=signup"}
                className="group inline-flex items-center gap-3 rounded-full bg-black text-white pl-6 pr-2 py-2 text-[15px] font-medium hover:bg-black/85 transition"
              >
                {t.cta}
                <span className="h-9 w-9 rounded-full bg-white text-black flex items-center justify-center transition group-hover:rotate-12">
                  <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
                </span>
              </Link>

              <Link
                to="/play"
                className="group inline-flex items-center gap-3 rounded-full bg-[#A0301A] text-white pl-6 pr-2 py-2 text-[15px] font-medium hover:brightness-95 transition"
              >
                {t.joinGame}
                <span className="h-9 w-9 rounded-full bg-white text-[#A0301A] flex items-center justify-center">
                  <Play className="h-4 w-4 fill-[#A0301A]" />
                </span>
              </Link>

              <div className="h-[58px] px-5 rounded-full border border-black/15 flex flex-col items-center justify-center leading-tight">
                <span className="text-[15px] font-semibold text-black">+120</span>
                <span className="text-[10px] text-black/55">{t.customers}</span>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="relative min-h-[340px] sm:min-h-[460px]">
            <CrossPattern />

            {/* preview square (background) */}
            <div className="absolute top-2 right-2 sm:right-4 w-[88%] sm:w-[78%] aspect-square rounded-[24px] sm:rounded-[28px] bg-[#D4B483] shadow-[0_18px_50px_-20px_rgba(120,80,40,0.35)] overflow-hidden">
              {/* soft radial glow so the figure feels grounded */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(60% 55% at 50% 65%, rgba(255,236,210,0.85) 0%, rgba(212,180,131,0.55) 45%, rgba(160,48,26,0.18) 100%)",
                }}
              />
              <div className="absolute top-5 right-6 z-10 flex gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-black/40" />
                <span className="h-1.5 w-1.5 rounded-full bg-black/40" />
                <span className="h-1.5 w-1.5 rounded-full bg-black/40" />
              </div>
            </div>

            {/* hero figure — overflows the box so the head is never clipped */}
            <img
              src={heroPerson}
              alt="معلم نحلها"
              className="absolute bottom-14 sm:bottom-16 right-2 sm:right-4 w-[88%] sm:w-[78%] h-auto max-h-[108%] object-contain object-bottom select-none pointer-events-none drop-shadow-2xl z-20"
            />

            {/* avatars + play video pill */}
            <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-6 flex items-center gap-3">
              <div className="flex -space-x-2">
                {["#F2C7B6", "#F2C2B6", "#F8D7CF"].map((c, i) => (
                  <div
                    key={i}
                    className="h-9 w-9 rounded-full border-2 border-white flex items-center justify-center"
                    style={{ background: c }}
                  >
                    <User className="h-4 w-4 text-black/50" />
                  </div>
                ))}
              </div>
              <button className="flex items-center gap-2 rounded-full border border-black/15 bg-white px-3 py-1.5 text-[12px] font-medium text-black">
                {t.playVideo}
                <span className="h-6 w-6 rounded-full bg-[#A0301A] flex items-center justify-center">
                  <Play className="h-3 w-3 text-white fill-white" />
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* ---------------- FEATURES ---------------- */}
        <section id="features" className="px-5 sm:px-8 md:px-14 py-16 sm:py-24 border-t border-black/5">
          <div className="max-w-2xl">
            <span className="text-[12px] tracking-[0.25em] font-semibold text-[#A0301A]">{t.featuresKicker}</span>
            <h2 className="mt-3 text-[28px] sm:text-[40px] font-semibold tracking-tight text-black leading-[1.1]">
              {t.featuresTitle}
            </h2>
            <p className="mt-4 text-[15px] text-black/65 leading-relaxed">{t.featuresSub}</p>
          </div>

          <div className="mt-10 sm:mt-14 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Feature icon={<Sparkles className="h-5 w-5" />} title={t.f1Title} desc={t.f1Desc} />
            <Feature icon={<FileText className="h-5 w-5" />} title={t.f2Title} desc={t.f2Desc} />
            <Feature icon={<Radio className="h-5 w-5" />} title={t.f3Title} desc={t.f3Desc} />
            <Feature icon={<BarChart3 className="h-5 w-5" />} title={t.f4Title} desc={t.f4Desc} />
          </div>
        </section>

        {/* ---------------- HOW IT WORKS ---------------- */}
        <section id="how" className="px-5 sm:px-8 md:px-14 py-16 sm:py-24 border-t border-black/5 bg-[#FBE9E5]/40">
          <div className="max-w-2xl">
            <span className="text-[12px] tracking-[0.25em] font-semibold text-[#A0301A]">{t.howKicker}</span>
            <h2 className="mt-3 text-[28px] sm:text-[40px] font-semibold tracking-tight text-black leading-[1.1]">
              {t.howTitle}
            </h2>
          </div>

          <div className="mt-10 sm:mt-14 grid grid-cols-1 md:grid-cols-3 gap-5">
            <Step n="01" icon={<Upload className="h-5 w-5" />} title={t.s1} desc={t.s1d} />
            <Step n="02" icon={<Users className="h-5 w-5" />} title={t.s2} desc={t.s2d} />
            <Step n="03" icon={<Trophy className="h-5 w-5" />} title={t.s3} desc={t.s3d} />
          </div>
        </section>

        {/* ---------------- CTA BANNER ---------------- */}
        <section className="px-5 sm:px-8 md:px-14 py-16 sm:py-20 border-t border-black/5">
          <div className="rounded-[24px] bg-black text-white p-8 sm:p-12 md:p-16 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 h-48 w-48 rounded-full bg-[#A0301A]/40 blur-3xl" />
            <div className="relative max-w-2xl">
              <h3 className="text-[26px] sm:text-[36px] font-semibold tracking-tight leading-[1.15]">
                {t.ctaTitle}
              </h3>
              <p className="mt-3 text-white/70 text-[15px]">{t.ctaSub}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  to={user ? "/app" : "/auth?mode=signup"}
                  className="inline-flex items-center gap-2 rounded-full bg-white text-black px-6 py-3 text-[14px] font-semibold hover:bg-white/90 transition"
                >
                  {t.ctaBtn}
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/play"
                  className="inline-flex items-center gap-2 rounded-full bg-[#A0301A] text-white px-6 py-3 text-[14px] font-semibold hover:brightness-95 transition"
                >
                  {t.ctaJoin}
                  <Play className="h-4 w-4 fill-white" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- FOOTER ---------------- */}
        <footer id="footer" className="px-5 sm:px-8 md:px-14 pt-14 pb-10 border-t border-black/5 bg-[#FBE9E5]/60">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <Link to="/" className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-black inline-block" />
                <span className="text-[17px] font-medium tracking-tight text-black">n7elha</span>
              </Link>
              <p className="mt-4 text-[13px] text-black/60 leading-relaxed max-w-xs">{t.footerTagline}</p>
              <div className="mt-5 flex gap-3">
                <a href="#" className="h-9 w-9 rounded-full border border-black/15 flex items-center justify-center text-black/70 hover:bg-black hover:text-white transition">
                  <Twitter className="h-4 w-4" />
                </a>
                <a href="#" className="h-9 w-9 rounded-full border border-black/15 flex items-center justify-center text-black/70 hover:bg-black hover:text-white transition">
                  <Instagram className="h-4 w-4" />
                </a>
                <a href="#" className="h-9 w-9 rounded-full border border-black/15 flex items-center justify-center text-black/70 hover:bg-black hover:text-white transition">
                  <Github className="h-4 w-4" />
                </a>
                <a href="mailto:hello@n7elha.com" className="h-9 w-9 rounded-full border border-black/15 flex items-center justify-center text-black/70 hover:bg-black hover:text-white transition">
                  <Mail className="h-4 w-4" />
                </a>
              </div>
            </div>

            <FooterCol
              title={t.footerProduct}
              items={[
                { label: t.footerFeatures, href: "#features" },
                { label: t.footerHow, href: "#how" },
                { label: t.footerPricing, href: "#" },
              ]}
            />
            <FooterCol
              title={t.footerCompany}
              items={[
                { label: t.footerAbout, href: "#" },
                { label: t.footerContact, href: "mailto:hello@n7elha.com" },
                { label: t.footerCareers, href: "#" },
              ]}
            />
            <FooterCol
              title={t.footerLegal}
              items={[
                { label: t.footerPrivacy, href: "#" },
                { label: t.footerTerms, href: "#" },
              ]}
            />
          </div>

          <div className="mt-12 pt-6 border-t border-black/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[12px] text-black/55">
            <span>{t.footerRights}</span>
            <span className="tracking-wider">Made with ♥ for teachers.</span>
          </div>
        </footer>
      </div>
    </div>
  );
};

/* ---------- helpers ---------- */

const Highlight = ({ children }: { children: React.ReactNode }) => (
  <span className="relative inline-block px-3">
    <span aria-hidden className="absolute inset-0 rounded-full bg-[#A0301A]" style={{ transform: "skewX(-2deg)" }} />
    <span className="relative italic font-semibold text-white">{children}</span>
  </span>
);

const Feature = ({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) => (
  <div className="rounded-2xl border border-black/10 bg-white p-6 hover:border-[#A0301A]/40 hover:shadow-[0_18px_40px_-20px_rgba(160,48,26,0.25)] transition">
    <div className="h-10 w-10 rounded-full bg-[#A0301A] text-white flex items-center justify-center">
      {icon}
    </div>
    <h3 className="mt-5 text-[17px] font-semibold text-black">{title}</h3>
    <p className="mt-2 text-[13.5px] leading-relaxed text-black/65">{desc}</p>
  </div>
);

const Step = ({ n, icon, title, desc }: { n: string; icon: React.ReactNode; title: string; desc: string }) => (
  <div className="rounded-2xl bg-white border border-black/10 p-6">
    <div className="flex items-center justify-between">
      <span className="text-[12px] font-mono tracking-widest text-black/40">{n}</span>
      <div className="h-9 w-9 rounded-full bg-[#FBE9E5] text-[#A0301A] flex items-center justify-center">{icon}</div>
    </div>
    <h3 className="mt-6 text-[18px] font-semibold text-black">{title}</h3>
    <p className="mt-2 text-[13.5px] leading-relaxed text-black/65">{desc}</p>
  </div>
);

const FooterCol = ({ title, items }: { title: string; items: { label: string; href: string }[] }) => (
  <div>
    <h4 className="text-[12px] tracking-[0.2em] font-semibold text-black/80">{title}</h4>
    <ul className="mt-4 space-y-2.5">
      {items.map((it) => (
        <li key={it.label}>
          <a href={it.href} className="text-[13px] text-black/65 hover:text-black transition">
            {it.label}
          </a>
        </li>
      ))}
    </ul>
  </div>
);

const CrossPattern = () => (
  <svg
    className="absolute inset-0 w-full h-full pointer-events-none"
    viewBox="0 0 500 500"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
  >
    {[
      [80, 60], [240, 60], [400, 60],
      [80, 220], [400, 220],
      [80, 380], [240, 380], [400, 380],
    ].map(([x, y], i) => (
      <g key={i} stroke="#1a1a1a" strokeWidth="1">
        <line x1={x - 22} y1={y} x2={x + 22} y2={y} />
        <line x1={x} y1={y - 22} x2={x} y2={y + 22} />
        <path
          d={`M ${x} ${y - 6} L ${x + 2} ${y} L ${x} ${y + 6} L ${x - 2} ${y} Z M ${x - 6} ${y} L ${x} ${y - 2} L ${x + 6} ${y} L ${x} ${y + 2} Z`}
          fill="#1a1a1a"
          stroke="none"
        />
      </g>
    ))}
  </svg>
);

export default Landing;
