import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "react-i18next";
import {
  ArrowUpRight,
  Play,
  Sparkles,
  FileText,
  Radio,
  BarChart3,
  Upload,
  Users,
  Trophy,
} from "lucide-react";
import { useSmoothScroll } from "@/lib/smoothScroll";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { ProductPreview } from "@/components/site/ProductPreview";
import heroAstro from "@/assets/astro-hero.png";

const Landing = () => {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  useSmoothScroll();

  const t = isAr
    ? {
        line1: "صمّم اختبارك",
        line2a: "وشغّله",
        line2b: "",
        line3a: "",
        line3b: "في دقائق",
        sub: "نفلها يرافقك من فكرة الاختبار حتى تشغيله المباشر، ومن توليد الأسئلة بالذكاء الاصطناعي حتى تحليل أداء طلابك.",
        cta: "ابدأ معنا",
        customers: "أنماط لعب",
        joinGame: "ادخل اللعبة",

        panel1Title: "نساعد المعلم في التخطيط، التحضير، والبث المباشر.",
        panel1Link: "الميزات",
        panel2Title: "تجربة اختبار متكاملة من الفكرة حتى النتيجة.",
        panel2Desc: "نمنح فصلك حضورًا تفاعليًا يعكس أسلوبك في التدريس.",

        featuresKicker: "لماذا نفلها؟",
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
        seeAllServices: "كل الخدمات",

        howKicker: "كيف تعمل؟",
        howTitle: "ثلاث خطوات تفصلك عن أول جلسة",
        s1: "ارفع المحتوى",
        s1d: "ملف الدرس أو ملاحظاتك. تتكفّل المنصة بالباقي.",
        s2: "ادعُ طلابك",
        s2d: "شارك رمز اللعبة، وسينضم الجميع من أي جهاز.",
        s3: "اعرض النتائج",
        s3d: "ترتيب لحظي، وتقرير كامل بعد انتهاء الاختبار.",

        forWhoKicker: "لمن هذه المنصة؟",
        forWhoTitle: "صُممت للمعلم العربي أولاً",
        forWho1: "سواء كنت معلمًا في مدرسة حكومية تبحث عن طريقة تجعل مراجعة الدرس أكثر حيوية، أو مدرّسًا خاصًا يريد تتبع مستوى كل طالب بدقة — نفلها صُممت لك.",
        forWho2: "لا يشترط أن تكون خبيرًا في التكنولوجيا. المنصة تعمل من المتصفح مباشرة، ولا تحتاج الطلاب إلى تحميل أي تطبيق. رمز قصير، وينضم الجميع في ثوانٍ.",
        forWho3: "الأسئلة باللغة العربية، التقارير باللغة العربية، وتجربة الطالب مصممة للشاشات الصغيرة التي يحملها طلابك في جيوبهم.",
        readMore: "اقرأ المزيد عنّا",
      }
    : {
        line1: "Build your quiz.",
        line2a: "Launch it",
        line2b: "",
        line3a: "",
        line3b: "in minutes.",
        sub: "nfelha walks with you from idea to live session — from AI-generated questions to real-time student insights.",
        cta: "Get started",
        customers: "game modes",
        joinGame: "JOIN GAME",

        panel1Title: "We help teachers with planning, prep, and live broadcast.",
        panel1Link: "Features",
        panel2Title: "An end-to-end quiz experience.",
        panel2Desc: "We give your classroom a presence that matches how you teach.",

        featuresKicker: "WHY NFELHA?",
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
        seeAllServices: "See all services",

        howKicker: "HOW IT WORKS",
        howTitle: "Three steps to your first live session",
        s1: "Upload content",
        s1d: "Your lesson file or notes. The platform handles the rest.",
        s2: "Invite students",
        s2d: "Share the game code — anyone can join from any device.",
        s3: "See results",
        s3d: "Live leaderboard plus a full report once the quiz ends.",

        forWhoKicker: "WHO IS IT FOR",
        forWhoTitle: "Built around the Arabic-speaking teacher",
        forWho1: "Whether you're a school teacher looking to make lesson reviews more engaging, or a private tutor who wants to track each student's level with precision — nfelha was built for you.",
        forWho2: "You don't need to be tech-savvy. The platform runs entirely in the browser — students don't download anything. One short code and everyone's in within seconds.",
        forWho3: "Questions in Arabic, reports in Arabic, and a student experience designed for the small screens they carry in their pockets.",
        readMore: "Read more about us",
      };

  return (
    <div
      id="scroll-skew"
      className="min-h-screen w-full"
      style={{ background: "hsl(var(--cream-panel))", fontFamily: "'Outfit', 'Almarai', system-ui, sans-serif", willChange: "transform" }}
    >
      <div className="relative w-full">

        <SiteNav />

        {/* ---------------- HERO ---------------- */}
        <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-8 px-5 sm:px-8 md:px-14 pt-10 sm:pt-16 pb-0">
          <div className="relative z-10">
            <h1
              className="leading-[1.1] tracking-tight text-[34px] sm:text-[44px] md:text-[60px]"
              style={{ fontFamily: "'ArslanWessam', 'Almarai', sans-serif", color: "#3F5A63" }}
            >
              <span className="block">{t.line1}</span>
              <span className="block mt-2">
                <span className="italic" style={{ color: "#FF8254" }}>{t.line2a}</span>
                {" "}<span>{t.line2b}</span>
              </span>
              <span className="block mt-2">
                {t.line3a && <span>{t.line3a} </span>}
                <span style={{ color: "#3F5A63" }}>{t.line3b}</span>
              </span>
            </h1>

            <p className="mt-6 sm:mt-8 text-[14px] sm:text-[15px] leading-relaxed text-black/70 max-w-md animate-fade-up animation-delay-200">
              {t.sub}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4 animate-fade-up animation-delay-300">
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
                to="/play"
                className="group inline-flex items-center gap-3 rounded-full border-2 border-[hsl(var(--nb-border))] bg-white text-[#3F5A63] pl-6 pr-2 py-2 text-[15px] font-medium shadow-[4px_4px_0_0_hsl(var(--nb-border))] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_hsl(var(--nb-border))] transition-all"
              >
                {t.joinGame}
                <span className="h-9 w-9 rounded-full bg-[#3F5A63] text-white flex items-center justify-center">
                  <Play className="h-4 w-4 fill-white" />
                </span>
              </Link>

              <div className="h-[58px] px-5 rounded-full border-2 border-[hsl(var(--nb-border))] flex flex-col items-center justify-center leading-tight shadow-[3px_3px_0_0_hsl(var(--nb-border))]">
                <span className="text-[15px] font-semibold text-black">9</span>
                <span className="text-[10px] text-black/55">{t.customers}</span>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="relative flex items-end justify-center">
            <img
              src={heroAstro}
              alt="روّاد نفلها"
              className="relative z-10 w-[88%] sm:w-[78%] max-w-[500px] select-none pointer-events-none drop-shadow-md"
              style={{ filter: "hue-rotate(-135deg)" }}
            />
          </div>
        </div>

        {/* ---------------- SPLIT PANEL ---------------- */}
        <div className="relative -mt-2 px-5 sm:px-8 md:px-14 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 rounded-[24px] overflow-hidden border-2 border-[hsl(var(--nb-border))] shadow-[6px_6px_0_0_hsl(var(--nb-border))]">
            <Link
              to="/services"
              className="group relative p-8 sm:p-10 min-h-[180px] flex flex-col justify-between bg-[#FF8254]"
            >
              <p className="text-[19px] sm:text-[23px] leading-snug font-medium text-white max-w-[280px]">
                {t.panel1Title}
              </p>
              <span className="inline-flex items-center gap-1.5 text-white text-[13px] font-semibold">
                {t.panel1Link}
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </Link>
            <div className="relative p-8 sm:p-10 min-h-[180px] flex flex-col justify-between bg-[#2B3F45] border-t-2 sm:border-t-0 sm:border-s-2 border-[hsl(var(--nb-border))]">
              <div className="flex items-start justify-between gap-4">
                <p className="text-[19px] sm:text-[23px] leading-snug font-medium text-white max-w-[260px]">
                  {t.panel2Title}
                </p>
                <span className="relative h-7 w-11 shrink-0 mt-1" aria-hidden>
                  <span className="absolute left-0 top-0 h-7 w-7 rounded-full bg-white/25" />
                  <span className="absolute right-0 top-0 h-7 w-7 rounded-full bg-[#FF8254]" />
                </span>
              </div>
              <p className="text-[13.5px] leading-relaxed text-white/55 max-w-xs">
                {t.panel2Desc}
              </p>
            </div>
          </div>
        </div>

        <ProductPreview />

        {/* ---------------- FEATURES ---------------- */}
        <section id="features" className="px-5 sm:px-8 md:px-14 py-16 sm:py-24 border-t border-black/5">
          <div className="max-w-2xl flex items-end justify-between gap-6 flex-wrap">
            <div>
              <span className={`text-[12px] font-semibold text-[#3F5A63] ${isAr ? "tracking-normal" : "tracking-[0.25em]"}`}>{t.featuresKicker}</span>
              <h2 className="mt-3 text-[28px] sm:text-[40px] tracking-tight leading-[1.1]" style={{ color: "#3F5A63", fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}>
                {t.featuresTitle}
              </h2>
              <p className="mt-4 text-[15px] text-black/65 leading-relaxed">{t.featuresSub}</p>
            </div>
          </div>

          <div className="mt-10 sm:mt-14 grid grid-cols-1 md:grid-cols-3 gap-4">
            <FeatureLarge icon={<Sparkles className="h-6 w-6" />} title={t.f1Title} desc={t.f1Desc} tilt="-rotate-[0.5deg]" />
            <Feature icon={<FileText className="h-5 w-5" />} title={t.f2Title} desc={t.f2Desc} tilt="rotate-[0.9deg]" />
            <Feature icon={<Radio className="h-5 w-5" />} title={t.f3Title} desc={t.f3Desc} tilt="-rotate-[0.8deg]" />
            <FeatureLarge icon={<BarChart3 className="h-6 w-6" />} title={t.f4Title} desc={t.f4Desc} tilt="rotate-[0.5deg]" />
          </div>

          <Link to="/services" className="mt-8 inline-flex items-center gap-1.5 text-[14px] font-semibold" style={{ color: "#3F5A63" }}>
            {t.seeAllServices}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </section>

        {/* ---------------- HOW IT WORKS ---------------- */}
        <section id="how" className="px-5 sm:px-8 md:px-14 py-16 sm:py-24 border-t border-black/5">
          <div className="max-w-2xl">
            <span className={`text-[12px] font-semibold text-[#3F5A63] ${isAr ? "tracking-normal" : "tracking-[0.25em]"}`}>{t.howKicker}</span>
            <h2 className="mt-3 text-[28px] sm:text-[40px] tracking-tight leading-[1.1]" style={{ color: "#3F5A63", fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}>
              {t.howTitle}
            </h2>
          </div>

          <div className="mt-10 sm:mt-14 grid grid-cols-1 md:grid-cols-3 gap-5">
            <Step n="01" icon={<Upload className="h-5 w-5" />} title={t.s1} desc={t.s1d} tilt="-rotate-[0.6deg]" />
            <Step n="02" icon={<Users className="h-5 w-5" />} title={t.s2} desc={t.s2d} tilt="rotate-[0.8deg]" />
            <Step n="03" icon={<Trophy className="h-5 w-5" />} title={t.s3} desc={t.s3d} tilt="-rotate-[0.9deg]" />
          </div>
        </section>

        {/* ---------------- FOR WHO ---------------- */}
        <section className="px-5 sm:px-8 md:px-14 py-16 sm:py-24 border-t border-black/5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20">
            <div>
              <span className={`text-[12px] font-semibold text-[#3F5A63] ${isAr ? "tracking-normal" : "tracking-[0.25em]"}`}>
                {t.forWhoKicker}
              </span>
              <h2 className="mt-4 text-[26px] sm:text-[36px] tracking-tight leading-[1.15]" style={{ color: "#3F5A63", fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}>
                {t.forWhoTitle}
              </h2>
            </div>
            <div className="space-y-6 text-[15px] leading-relaxed text-black/65">
              <p>{t.forWho1}</p>
              <p>{t.forWho2}</p>
              <p>{t.forWho3}</p>
              <Link to="/about" className="inline-flex items-center gap-1.5 text-[14px] font-semibold" style={{ color: "#3F5A63" }}>
                {t.readMore}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <SiteFooter />
      </div>
    </div>
  );
};

/* ---------- helpers ---------- */

const FeatureLarge = ({ icon, title, desc, tilt = "-rotate-[0.6deg]" }: { icon: React.ReactNode; title: string; desc: string; tilt?: string }) => (
  <div className={`md:col-span-2 group ${tilt} hover:rotate-0 transition-transform duration-300`}>
    <div className="relative rounded-2xl border-2 border-[hsl(var(--nb-border))] bg-white p-7 shadow-[5px_5px_0_0_hsl(var(--nb-border))] group-hover:shadow-[8px_8px_0_0_hsl(var(--nb-border))] group-hover:-translate-x-1 group-hover:-translate-y-1 transition-all">
      <div className="flex items-start gap-5">
        <div className="h-12 w-12 rounded-2xl border-2 border-[hsl(var(--nb-border))] bg-[#3F5A63] text-white flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <h3 className="text-[18px] font-semibold leading-tight" style={{ color: "#3F5A63" }}>{title}</h3>
          <p className="mt-2 text-[14px] leading-relaxed text-black/65 max-w-lg">{desc}</p>
        </div>
      </div>
    </div>
  </div>
);

const Feature = ({ icon, title, desc, tilt = "rotate-[0.8deg]" }: { icon: React.ReactNode; title: string; desc: string; tilt?: string }) => (
  <div className={`group ${tilt} hover:rotate-0 transition-transform duration-300`}>
    <div className="relative rounded-2xl border-2 border-[hsl(var(--nb-border))] bg-white p-6 shadow-[5px_5px_0_0_hsl(var(--nb-border))] group-hover:shadow-[8px_8px_0_0_hsl(var(--nb-border))] group-hover:-translate-x-1 group-hover:-translate-y-1 transition-all">
      <div className="h-10 w-10 rounded-2xl border-2 border-[hsl(var(--nb-border))] bg-[#3F5A63]/10 text-[#3F5A63] flex items-center justify-center group-hover:bg-[#3F5A63] group-hover:text-white transition-colors">
        {icon}
      </div>
      <h3 className="mt-5 text-[17px] font-semibold leading-tight" style={{ color: "#3F5A63" }}>{title}</h3>
      <p className="mt-2 text-[13.5px] leading-relaxed text-black/65">{desc}</p>
    </div>
  </div>
);

const Step = ({ n, icon, title, desc, tilt = "-rotate-[0.7deg]" }: { n: string; icon: React.ReactNode; title: string; desc: string; tilt?: string }) => (
  <div className={`group ${tilt} hover:rotate-0 transition-transform duration-300`}>
  <div className="relative rounded-2xl bg-white border-2 border-[hsl(var(--nb-border))] p-6 shadow-[5px_5px_0_0_hsl(var(--nb-border))] group-hover:shadow-[8px_8px_0_0_hsl(var(--nb-border))] group-hover:-translate-x-1 group-hover:-translate-y-1 transition-all">
    <div className="flex items-center justify-between">
      <span className="text-[12px] font-mono tracking-widest text-black/40">{n}</span>
      <div className="h-9 w-9 rounded-full bg-background text-[#3F5A63] flex items-center justify-center">{icon}</div>
    </div>
    <h3 className="mt-6 text-[18px] font-semibold text-black">{title}</h3>
    <p className="mt-2 text-[13.5px] leading-relaxed text-black/65">{desc}</p>
  </div>
  </div>
);

export default Landing;
