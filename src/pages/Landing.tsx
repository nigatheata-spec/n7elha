import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, Play, Upload, Users, Trophy } from "lucide-react";
import { useSmoothScroll } from "@/lib/smoothScroll";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Seo } from "@/components/Seo";
import productMockup from "@/assets/product-mockup.png";
import saudiMap from "@/assets/saudi-map.svg";

/* ---------- helpers ---------- */

const Step = ({ n, icon, title, desc }: { n: string; icon: React.ReactNode; title: string; desc: string }) => (
  <div className="relative">
    <span
      className="absolute -top-3 start-0 text-[64px] sm:text-[72px] font-black leading-none text-white/10 select-none"
      style={{ fontFamily: "monospace" }}
    >
      {n}
    </span>
    <div className="relative pt-8">
      <div className="h-10 w-10 rounded-full bg-background text-[#3F5A63] flex items-center justify-center">{icon}</div>
      <h3 className="mt-5 text-[18px] font-semibold text-white">{title}</h3>
      <p className="mt-2 text-[13.5px] leading-relaxed text-white/60">{desc}</p>
    </div>
  </div>
);

const Landing = () => {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  useSmoothScroll();

  const t = isAr
    ? {
        line1: "نخلي الطالب",
        line2a: "يحب التعلّم",
        line2b: "",
        line3a: "",
        line3b: "مو يكرهه",
        sub: "نفلها مو نظام إدارة تعلّم (LMS) ثاني، ولا أداة اختبارات. إحنا نغيّر نظرة الطالب للتعلّم — نخليه ينتظر الحصة، مو يتهرّب منها. تجربة مصمّمة للفصل العربي من الأساس: أنت جهّز درسك، وإحنا نحوّله لشي يحبه طلابك.",
        cta: "ابدأ معنا",
        joinGame: "ادخل اللعبة",

        mapCaption: "من هنا نبدأ",
        storyKicker: "قصتنا",
        storyTitle: "الطالب حاضر بجسمه، غايب بعقله",
        sp1: "نعرف زين شكل الحصة: الطالب قاعد قدامك بس عقله بمكان ثاني. عيونه على الساعة، أو على الجوال تحت الطاولة، يعدّ الدقايق للجرس. مو لأنه ما يفهم — الطريقة اللي يتعلّم فيها ميتة، ما تعطيه سبب يهتم.",
        sp2: "والمعلم يحارب معركة خاسرة. ينافس جوالات وتطبيقات على انتباهٍ ما عاد يطول أكثر من دقايق. يجتهد ويجهّز زين، بس الصف طافي قبل لا يبدأ الدرس.",
        sp3: "هالمفهوم — تجربة تعليمية تخلي الطالب يحب التعلّم بدل ما يهرب منه — ما موجود في الفصول العربية. قررنا نكون أول واحد يبنيه. من هني طلعت نفلها.",

        feelKicker: "ما نؤمن به",
        feelLine1: "التفاعل مو رقم",
        feelLine2: "في تقرير",
        feelBody: "هو إحساس نبيه لكل طالب: لحظة يدخل فيها الحصة وهو متحمّس، مو طافي. لحظة يتفاعل مع السؤال لأنه يبي، مو لأنه مجبور. هذا اللي نصمّمه، سؤال ورا سؤال.",

        howKicker: "كيف تعمل؟",
        howTitle: "ثلاث خطوات بس",
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
        line1: "Make students",
        line2a: "love learning",
        line2b: "",
        line3a: "",
        line3b: "not dread it.",
        sub: "nefelha isn't another LMS, and it isn't a quiz tool. We change how students feel about learning — so they look forward to class instead of running from it. Built for the Arabic classroom from the ground up: you prepare the lesson, we turn it into something your students love.",
        cta: "Get started",
        joinGame: "JOIN GAME",

        mapCaption: "This is where we start",
        storyKicker: "OUR STORY",
        storyTitle: "Students show up. Their minds don't.",
        sp1: "We know exactly what class looks like. The student's body is there, but their mind is somewhere else. Eyes on the clock. Scrolling under the desk. Counting down to the bell. Not because they don't understand — it's because the way we teach gives them no reason to care.",
        sp2: "The teacher is fighting a losing battle over attention. Competing with devices they can't beat. Working hard, preparing well, but the room checks out before the lesson even starts.",
        sp3: "The idea of making students actually want to learn — of creating an experience that intrinsically engages instead of coercing compliance — doesn't exist yet in Arabic classrooms. We decided to build it first. That's how nefelha started.",

        feelKicker: "WHAT WE BELIEVE",
        feelLine1: "Engagement isn't a number",
        feelLine2: "on a report",
        feelBody: "It's a feeling every student needs: the moment they walk into class excited instead of checked out. The moment they answer because they want to, not because they have to. That's what we design, one question at a time.",

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
        forWho1: "Whether you're a school teacher looking to make lesson reviews more engaging, or a private tutor who wants to track each student's level with precision — nefelha was built for you.",
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
      <Seo
        path="/"
        titleAr="نفلها — نخلي الطلاب يحبون التعلّم | تجربة تفاعلية للفصل العربي"
        titleEn="nefelha — Make Students Love Learning | Interactive Classroom Experience"
        descriptionAr="نفلها مو نظام LMS ولا أداة اختبارات — إحنا نغيّر نظرة الطالب للتعلّم ونخليه يحب الحصة. تجربة تفاعلية للفصل العربي، تشتغل بدون أي تطبيق على أجهزة الطلاب."
        descriptionEn="nefelha isn't an LMS or a quiz tool. It's an interactive classroom experience that makes students love learning, not dread it. AI-powered, Arabic-first, nine play modes — no apps needed."
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "EducationalOrganization",
          name: "نفلها",
          alternateName: "nefelha",
          url: "https://www.nefelha.com/",
          description: "نفلها شركة ناشئة سعودية تبني تجربة تعليمية تفاعلية تخلي الطلاب يحبون التعلّم — بتوليد أسئلة بالذكاء الاصطناعي وتسعة أنماط لعب مباشرة بلا تطبيقات.",
          areaServed: { "@type": "Country", name: "Saudi Arabia" },
          address: { "@type": "PostalAddress", addressCountry: "SA" },
          inLanguage: ["ar", "en"],
        }}
      />
      <div className="relative w-full">

        <SiteNav />

        {/* ---------------- HERO ---------------- */}
        <div className="wrap relative grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] items-center gap-8 lg:gap-14 px-5 sm:px-8 md:px-14 pt-10 sm:pt-16 pb-14 sm:pb-20">
          <div className="relative z-10">
            <h1
              className="leading-[1.05] tracking-tight text-[38px] sm:text-[52px] md:text-[68px]"
              style={{ fontFamily: "'ArslanWessam', 'Almarai', sans-serif", color: "#3F5A63" }}
            >
              <span className="block">{t.line1}</span>
              <span className="block">
                <span className="italic" style={{ color: "#8FC44A" }}>{t.line2a}</span>
                {" "}<span>{t.line2b}</span>
              </span>
              <span className="block">
                {t.line3a && <span>{t.line3a} </span>}
                <span style={{ color: "#3F5A63" }}>{t.line3b}</span>
              </span>
            </h1>

            <p className="mt-5 text-[15px] sm:text-[16px] leading-relaxed text-black/70 max-w-[27rem] animate-fade-up animation-delay-200">
              {t.sub}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3 animate-fade-up animation-delay-300">
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
                className="group inline-flex items-center gap-3 rounded-full border-2 border-[hsl(var(--nb-border))] bg-[#8FC44A] text-[#3F5A63] pl-6 pr-2 py-2 text-[15px] font-medium shadow-[4px_4px_0_0_hsl(var(--nb-border))] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_hsl(var(--nb-border))] transition-all"
              >
                {t.joinGame}
                <span className="h-9 w-9 rounded-full bg-white text-[#8FC44A] flex items-center justify-center">
                  <Play className="h-4 w-4 fill-[#8FC44A]" strokeLinejoin="round" strokeWidth={4} />
                </span>
              </Link>

            </div>
          </div>

          {/* RIGHT */}
          <div className="relative flex items-center justify-center">
            <img
              src={productMockup}
              alt=""
              className="w-full max-w-[520px] h-auto select-none"
            />
          </div>
        </div>

        {/* ---------------- OUR STORY ---------------- */}
        <section className="bg-[#14212A] text-white px-5 sm:px-8 md:px-14 py-20 sm:py-28">
          <div className="wrap grid grid-cols-1 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] gap-8 lg:gap-16">
            <div>
              <span className={`text-[12px] font-semibold text-[#8FC44A] ${isAr ? "tracking-normal" : "tracking-[0.25em]"}`}>{t.storyKicker}</span>
              <h2
                className="mt-3 text-[26px] sm:text-[34px] tracking-tight leading-[1.15]"
                style={{ color: "#FFFFFF", fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}
              >
                {t.storyTitle}
              </h2>
            </div>
            <div className="max-w-xl relative">
              <div className="h-1 w-16 bg-[#8FC44A] rounded-full" />
              <p className="mt-6 text-[17px] sm:text-[19px] leading-relaxed text-white font-medium">{t.sp1}</p>
              <p className="mt-5 text-[15px] leading-relaxed text-white/60">{t.sp2}</p>
              <p className="mt-5 text-[15px] leading-relaxed text-white/60">{t.sp3}</p>
            </div>
          </div>
        </section>

        {/* ---------------- WHAT WE BELIEVE ---------------- */}
        <section className="px-5 sm:px-8 md:px-14 py-24 sm:py-32">
          <div className="wrap max-w-3xl mx-auto text-center">
            <span className={`text-[12px] font-semibold text-[#8FC44A] ${isAr ? "tracking-normal" : "tracking-[0.25em]"}`}>
              {t.feelKicker}
            </span>
            <h2
              className="mt-4 text-[32px] sm:text-[48px] md:text-[58px] tracking-tight leading-[1.12]"
              style={{ fontFamily: "'ArslanWessam', 'Almarai', sans-serif", color: "#3F5A63" }}
            >
              <span className="block">{t.feelLine1}</span>
              <span className="block italic" style={{ color: "#8FC44A" }}>{t.feelLine2}</span>
            </h2>
            <p className="mt-7 mx-auto max-w-xl text-[16px] sm:text-[17px] leading-relaxed text-black/60">
              {t.feelBody}
            </p>
          </div>
        </section>

        {/* ---------------- HOW IT WORKS ---------------- */}
        <section id="how" className="bg-[#3F5A63] text-white px-5 sm:px-8 md:px-14 py-20 sm:py-28">
          <div className="wrap"><div className="max-w-2xl">
            <span className={`text-[12px] font-semibold text-[#8FC44A] ${isAr ? "tracking-normal" : "tracking-[0.25em]"}`}>{t.howKicker}</span>
            <h2 className="mt-3 text-[28px] sm:text-[40px] tracking-tight leading-[1.1]" style={{ color: "#FFFFFF", fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}>
              {t.howTitle}
            </h2>
          </div>

          <div className="relative mt-12 sm:mt-16 grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-6">
            <svg
              className="hidden md:block absolute left-0 top-[26px] w-full h-10 pointer-events-none"
              viewBox="0 0 100 10"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M 16 5 Q 33 -2, 50 5 T 84 5"
                fill="none"
                stroke="#8FC44A"
                strokeWidth="0.5"
                strokeDasharray="2.4 2.4"
                strokeLinecap="round"
                opacity="0.55"
              />
            </svg>
            <Step n="01" icon={<Upload className="h-5 w-5" />} title={t.s1} desc={t.s1d} />
            <Step n="02" icon={<Users className="h-5 w-5" />} title={t.s2} desc={t.s2d} />
            <Step n="03" icon={<Trophy className="h-5 w-5" />} title={t.s3} desc={t.s3d} />
          </div>
          </div>
        </section>

        {/* ---------------- FOR WHO ---------------- */}
        <section className="wrap px-5 sm:px-8 md:px-14 py-16 sm:py-24 border-t border-black/5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20">
            <div>
              <span className={`text-[12px] font-semibold text-[#3F5A63] ${isAr ? "tracking-normal" : "tracking-[0.25em]"}`}>
                {t.forWhoKicker}
              </span>
              <h2 className="mt-4 text-[26px] sm:text-[36px] tracking-tight leading-[1.15]" style={{ color: "#3F5A63", fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}>
                {t.forWhoTitle}
              </h2>
              <img src={saudiMap} alt={isAr ? "المملكة العربية السعودية" : "Saudi Arabia"} className="mt-8 w-full max-w-[19rem]" />
              <p className="mt-4 text-[13px] font-semibold text-[#3F5A63]">{t.mapCaption}</p>
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

export default Landing;
