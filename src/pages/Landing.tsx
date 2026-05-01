import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "react-i18next";
import { LangToggle } from "@/components/LangToggle";
import { ArrowUpRight, Play, User, TrendingDown, MoreHorizontal } from "lucide-react";
import heroPerson from "@/assets/hero-person.png";

/**
 * Landing page — replicated 1:1 from the provided reference image.
 * Lavender page bg, white inner card, lime highlights on hero words,
 * dark pill CTA, decorative cross/star pattern, purple preview square,
 * floating "Mike Jones" tag and "Increase efficiency" card, avatar trio
 * + "Play video" pill, brand logos row.
 */
const Landing = () => {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const t = isAr
    ? {
        about: "من نحن",
        services: "الخدمات",
        partners: "الشركاء",
        login: "دخول",
        signup: "تسجيل",
        dashboard: "لوحتي",
        line1: "كل ما تحتاجه",
        line2a: "لتصنع",
        line2b: "اختباراً",
        line3a: "يلامس",
        line3b: "النجاح",
        sub: "نحلها يرافقك من فكرة الاختبار حتى تشغيله المباشر، ومن توليد الأسئلة بالذكاء الاصطناعي حتى تحليل أداء طلابك.",
        cta: "ابدأ معنا",
        customers: "معلم",
        playVideo: "شاهد الفيديو",
        increase: "ارتفاع",
        company: "في كفاءة الفصل",
        eff: "الدراسي",
        seeMore: "اعرف أكثر",
      }
    : {
        about: "ABOUT US",
        services: "SERVICES",
        partners: "PARTNERS",
        login: "LOG IN",
        signup: "SIGN UP",
        dashboard: "DASHBOARD",
        line1: "It takes only",
        line2a: "a wish",
        line2b: "to touch",
        line3a: "a great",
        line3b: "success",
        sub: "We own the full process, from coding to qa and final deployment, and transform your requirements into the finished product",
        cta: "Let's collaborate",
        customers: "customers",
        playVideo: "Play video",
        increase: "Increase",
        company: "of the company's",
        eff: "efficiency",
        seeMore: "See more",
      };

  return (
    <div
      dir="ltr"
      className="min-h-screen w-full p-4 md:p-8 lg:p-12 flex items-center justify-center"
      style={{ background: "#FBE9E5", fontFamily: "'Inter', 'Tajawal', system-ui, sans-serif" }}
    >
      <div className="relative w-full max-w-[1280px] bg-white rounded-[28px] shadow-[0_30px_80px_-30px_rgba(60,40,90,0.25)] overflow-hidden">
        <span className="pointer-events-none absolute -bottom-6 -right-6 text-3xl text-[#F2C2B6] select-none">✦</span>

        {/* ---------------- NAV ---------------- */}
        <nav className="flex items-center justify-between px-8 md:px-14 pt-8">
          <Link to="/" className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-black inline-block" />
            <span className="text-[17px] font-medium tracking-tight text-black">n7elha</span>
          </Link>

          <ul className="hidden md:flex items-center gap-10 text-[13px] tracking-[0.18em] font-medium text-black/80">
            <li><a href="#about" className="hover:text-black">{t.about}</a></li>
            <li><a href="#services" className="hover:text-black">{t.services}</a></li>
            <li><a href="#partners" className="hover:text-black">{t.partners}</a></li>
            <li className="text-black/40"><MoreHorizontal className="h-4 w-4" /></li>
          </ul>

          <div className="flex items-center gap-2">
            <LangToggle variant="pill" />
            {user ? (
              <Link
                to="/app"
                className="px-5 py-2 rounded-full bg-black text-white text-[13px] tracking-wider font-medium"
              >
                {t.dashboard}
              </Link>
            ) : (
              <>
                <Link
                  to="/auth"
                  className="px-5 py-2 rounded-full bg-[#A0301A] text-white text-[13px] tracking-wider font-medium border border-black/5 hover:brightness-95 transition"
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
        </nav>

        {/* ---------------- HERO ---------------- */}
        <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-8 px-8 md:px-14 pt-16 pb-12">
          <div className="relative z-10">
            <h1 className="text-black font-semibold leading-[1.05] tracking-tight text-[44px] md:text-[60px]">
              <span className="block">{t.line1}</span>
              <span className="block mt-3">
                <Highlight>{t.line2a}</Highlight>{" "}
                <span>{t.line2b}</span>
              </span>
              <span className="block mt-3">
                <span>{t.line3a} </span>
                <Highlight>{t.line3b}</Highlight>
              </span>
            </h1>

            <p className="mt-8 text-[14px] leading-relaxed text-black/70 max-w-md">
              {t.sub}
            </p>

            <div className="mt-9 flex items-center gap-5">
              <Link
                to={user ? "/app" : "/auth?mode=signup"}
                className="group inline-flex items-center gap-3 rounded-full bg-black text-white pl-6 pr-2 py-2 text-[15px] font-medium hover:bg-black/85 transition"
              >
                {t.cta}
                <span className="h-9 w-9 rounded-full bg-white text-black flex items-center justify-center transition group-hover:rotate-12">
                  <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
                </span>
              </Link>

              <div className="h-[58px] px-5 rounded-full border border-black/15 flex flex-col items-center justify-center leading-tight">
                <span className="text-[15px] font-semibold text-black">+120k</span>
                <span className="text-[10px] text-black/55">{t.customers}</span>
              </div>
            </div>

            {/* logos row */}
            <div className="mt-14 flex items-center gap-10 opacity-80">
              <div className="flex flex-col leading-none">
                <span className="font-black italic text-[22px] tracking-tight text-black">YAHOO!</span>
                <span className="text-[8px] tracking-[0.3em] text-black/60 mt-0.5">FINANCE</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-5 w-5 rounded bg-black text-white text-[12px] font-black flex items-center justify-center">N</span>
                <span className="text-[16px] font-semibold text-black">Nasdaq</span>
              </div>
              <div className="text-[16px] font-semibold tracking-tight text-black">PST<span className="inline-block">©</span>MPANY</div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="relative min-h-[460px]">
            {/* decorative cross/plus pattern */}
            <CrossPattern />

            {/* purple preview square */}
            <div className="absolute top-2 right-4 w-[78%] aspect-square rounded-[28px] bg-[#D4B483] shadow-[0_18px_50px_-20px_rgba(120,80,40,0.35)] overflow-hidden">
              <div className="absolute top-5 right-6 z-10 flex gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-black/40" />
                <span className="h-1.5 w-1.5 rounded-full bg-black/40" />
                <span className="h-1.5 w-1.5 rounded-full bg-black/40" />
              </div>
              <img
                src={heroPerson}
                alt="معلم نحلها"
                className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[105%] w-auto object-contain object-bottom select-none pointer-events-none"
              />
            </div>

            {/* "Mike Jones" lime tag */}
            <div className="absolute -top-2 right-2 flex flex-col items-end">
              <div className="rounded-full bg-[#A0301A] px-4 py-1.5 text-[12px] font-medium text-white border border-black/5 shadow-sm">
                Mike Jones
              </div>
              <div className="mt-2 me-3 text-[11px] font-medium text-black/70 [writing-mode:vertical-rl] rotate-180">
                +25.5%
              </div>
            </div>

            {/* avatars + play video pill */}
            <div className="absolute bottom-4 left-2 md:left-6 flex items-center gap-3">
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
                  <Play className="h-3 w-3 text-black fill-black" />
                </span>
              </button>
            </div>

            {/* "Increase efficiency" floating card */}
            <div className="absolute -bottom-2 right-0 w-[210px] rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_40px_-20px_rgba(60,40,90,0.25)]">
              <p className="text-[12px] font-semibold text-black leading-snug">
                {t.increase}
                <br />
                {t.company}
                <br />
                {t.eff}
              </p>
              <div className="mt-3 space-y-1.5 text-[11px] text-black/70">
                <div className="flex items-center gap-1.5">
                  <User className="h-3 w-3" /> John
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendingDown className="h-3 w-3" /> -25.5%
                </div>
              </div>
              <button className="mt-3 w-full rounded-full border border-black/15 bg-[#FBE9E5] py-1.5 text-[11px] font-medium text-black">
                {t.seeMore}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------- helpers ---------- */

const Highlight = ({ children }: { children: React.ReactNode }) => (
  <span className="relative inline-block px-3">
    <span
      aria-hidden
      className="absolute inset-0 rounded-full bg-[#A0301A]"
      style={{ transform: "skewX(-2deg)" }}
    />
    <span className="relative italic font-semibold text-white">{children}</span>
  </span>
);

const CrossPattern = () => (
  <svg
    className="absolute inset-0 w-full h-full pointer-events-none"
    viewBox="0 0 500 500"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
  >
    {/* thin cross lines (4-pointed sparkles) */}
    {[
      [80, 60], [240, 60], [400, 60],
      [80, 220], [400, 220],
      [80, 380], [240, 380], [400, 380],
    ].map(([x, y], i) => (
      <g key={i} stroke="#1a1a1a" strokeWidth="1">
        <line x1={x - 22} y1={y} x2={x + 22} y2={y} />
        <line x1={x} y1={y - 22} x2={x} y2={y + 22} />
        {/* small filled 4-point star at center */}
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
