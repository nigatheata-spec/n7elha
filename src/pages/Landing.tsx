import { Link } from "react-router-dom";
import { LIME, SAND, TEAL } from "@/components/teacher/DashboardAccents";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, Play } from "lucide-react";
import { useSmoothScroll } from "@/lib/smoothScroll";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Seo } from "@/components/Seo";
import productMockup from "@/assets/product-mockup.png";
import phoneJoin from "@/assets/phone-join.png";
import phoneClassic from "@/assets/phone-classic.png";
import phoneCrypto from "@/assets/phone-crypto.png";
import saudiMap from "@/assets/saudi-map.svg";

/* ---------- helpers ---------- */

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

        phonesKicker: "على جوال الطالب",
        phonesTitle: "نفس السؤال، عوالم مختلفة",
        phonesSub: "الطالب يدخل برمز من أربعة أرقام، ثم يلعب. كل نمط يغيّر الشكل والإحساس بالكامل، فنفس أسئلتك تصير تجربة جديدة كل حصة.",
        phoneJoinCap: "يدخل بالرمز",
        phoneClassicCap: "الوضع الكلاسيكي",
        phoneCryptoCap: "سباق التشفير",

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

        phonesKicker: "ON THE STUDENT'S PHONE",
        phonesTitle: "The same question, different worlds",
        phonesSub: "A student joins with a four-digit code, then plays. Each mode changes the look and the feel completely, so the questions you already wrote become a new experience every lesson.",
        phoneJoinCap: "Joins with a code",
        phoneClassicCap: "Classic",
        phoneCryptoCap: "Crypto Rush",

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
      style={{ background: "hsl(var(--cream-panel))", fontFamily: "'Outfit', 'Almarai', system-ui, sans-serif" }}
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

        {/* Positioned so it paints over the hero shapes that run up behind it. */}
        <div className="relative z-10"><SiteNav /></div>

        {/* ---------------- HERO ---------------- */}
        <div className="relative">
        {/* Brand shapes (the business-card look), running from the very top
            of the page up behind the nav so the top reads as one piece. Drawn
            for left-to-right and mirrored in Arabic, so they always sit on the
            mockup's side. The layer clips itself; nothing can scroll sideways. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-40 bottom-0 overflow-hidden">
          <div className="absolute -top-10 -end-20 w-[300px] md:w-[600px] rtl:-scale-x-100">
            <svg viewBox="0 0 400 400" className="accent-drift w-full" style={{ animationDuration: "24s" }}>
              <path fill={SAND} d="M400 0H70C20 40 48 118 100 172C154 228 132 300 204 356C254 396 338 404 400 392Z" />
              <path fill={LIME} d="M400 0H154C102 34 130 104 174 150C222 200 202 262 266 310C308 342 360 340 400 330Z" />
            </svg>
          </div>
          <div className="absolute -bottom-10 -end-10 w-[240px] md:w-[440px] rtl:-scale-x-100">
            <svg viewBox="0 0 400 300" className="accent-drift w-full" style={{ animationDuration: "28s", animationDelay: "-9s" }}>
              <path fill={TEAL} d="M400 300V120C360 104 318 124 296 166C266 226 198 226 148 258C118 278 98 292 90 300Z" />
            </svg>
          </div>
          <svg viewBox="0 0 240 140" className="accent-drift absolute top-48 start-[38%] w-[200px] hidden lg:block" style={{ animationDuration: "20s", animationDelay: "-5s" }}>
            <ellipse cx="120" cy="70" rx="112" ry="52" transform="rotate(-14 120 70)" fill="none" stroke="#12262B" strokeWidth="1.5" opacity="0.4" />
          </svg>
        </div>
        <div className="wrap relative grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] items-center gap-8 lg:gap-14 px-5 sm:px-8 md:px-14 pt-10 sm:pt-16 pb-28 sm:pb-32">
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
                to="/join"
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
        </div>

        {/* ---------------- OUR STORY ---------------- */}
        {/* A teal band with wavy edges instead of a flat dark block. It overlaps
            the sections above and below by the wave's height, so their shapes
            run under the waves instead of stopping at a straight seam. The
            waves stay inside that overlap, so no seam can show through. */}
        <section className="relative z-10 -my-[72px] text-white">
          <svg aria-hidden viewBox="0 0 1440 72" preserveAspectRatio="none" className="relative block w-full h-[72px] -mb-px">
            <path fill={TEAL} d="M0 44C220 6 470 64 760 30C1010 2 1240 8 1440 26V72H0Z" />
          </svg>
          <div className="px-5 sm:px-8 md:px-14 py-14 sm:py-20" style={{ background: TEAL }}>
          <div className="wrap grid grid-cols-1 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] gap-8 lg:gap-16">
            <div>
              <span className={`text-[12px] font-semibold ${isAr ? "tracking-normal" : "tracking-[0.25em]"}`} style={{ color: SAND }}>{t.storyKicker}</span>
              <h2
                className="mt-3 text-[26px] sm:text-[34px] tracking-tight leading-[1.15]"
                style={{ color: "#FFFFFF", fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}
              >
                {t.storyTitle}
              </h2>
            </div>
            <div className="max-w-xl relative">
              <div className="h-1 w-16 rounded-full" style={{ background: LIME }} />
              <p className="mt-6 text-[17px] sm:text-[19px] leading-relaxed text-white font-medium">{t.sp1}</p>
              <p className="mt-5 text-[15px] leading-relaxed text-white/80">{t.sp2}</p>
              <p className="mt-5 text-[15px] leading-relaxed text-white/80">{t.sp3}</p>
            </div>
          </div>
          </div>
          <svg aria-hidden viewBox="0 0 1440 72" preserveAspectRatio="none" className="relative block w-full h-[72px] -mt-px">
            <path fill={TEAL} d="M0 0H1440V36C1200 70 960 14 690 46C430 74 200 64 0 30Z" />
          </svg>
        </section>

        {/* ---------------- WHAT WE BELIEVE ---------------- */}
        <div className="relative">
        {/* A teal and sand wave coming in from the page edge and crossing from
            this section into the next, so the two read as one stretch of page
            instead of the wave being cut where a section ends. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute bottom-20 md:bottom-28 -end-8 w-[100px] md:w-[300px] rtl:-scale-x-100">
            <svg viewBox="0 0 300 600" className="accent-drift w-full" style={{ animationDuration: "30s", animationDelay: "-11s" }}>
              <path fill={SAND} d="M300 0C226 22 186 92 196 168C206 248 104 280 84 360C62 446 160 540 300 600Z" />
              <path fill={TEAL} d="M300 60C252 82 232 140 240 200C248 266 168 294 154 362C140 432 210 506 300 548Z" />
            </svg>
          </div>
        </div>
        {/* The two upper corner shapes, above the teal band: each ends in a
            round head that rises over the band's wave, like it's flowing up
            into it. Own layer, since the section below clips its top. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-12 h-[240px] md:h-[420px] overflow-hidden z-20">
          <div className="absolute top-0 -start-16 w-[200px] md:w-[360px] ltr:-scale-x-100">
            <svg viewBox="0 0 400 400" className="accent-drift w-full" style={{ animationDuration: "26s" }}>
              <path fill={SAND} d="M400 80H150L126 58C118 44 100 34 80 34C58 34 44 44 43.9 60C45.3 96.8 68.1 138.9 100 172C154 228 132 300 204 356C254 396 338 404 400 392Z" />
              <path fill={LIME} d="M400 56C340 30 220 18 168 32C142 40 129 48 126.3 60C129.4 90.5 149.2 124 174 150C222 200 202 262 266 310C308 342 360 340 400 330Z" />
            </svg>
          </div>
          <div className="absolute top-0 -end-16 w-[200px] md:w-[360px] rtl:-scale-x-100">
            <svg viewBox="0 0 400 400" className="accent-drift w-full" style={{ animationDuration: "28s", animationDelay: "-13s" }}>
              <path fill={SAND} d="M400 0H200L170 60C156 42 136 32 112 32C88 32 70 42 69.7 60C72.2 87.1 87.6 116.6 112 140C164 190 150 252 214 300C262 336 344 344 400 332Z" />
              <path fill={TEAL} d="M400 0H178C140 26 156 84 192 120C232 160 222 214 274 252C314 282 362 284 400 276Z" />
            </svg>
          </div>
        </div>
        <section className="relative isolate overflow-hidden px-5 sm:px-8 md:px-14 pt-24 sm:pt-32 pb-12 sm:pb-16">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            {/* beside the phones, on the lime side: a thin oval with a teal and a lime drop */}
            <div className="absolute top-[54%] start-[6%] w-[220px] h-[180px] hidden md:block">
              <svg viewBox="0 0 240 140" className="accent-drift absolute inset-x-0 top-0 w-full" style={{ animationDuration: "22s", animationDelay: "-9s" }}>
                <ellipse cx="120" cy="70" rx="112" ry="52" transform="rotate(-20 120 70)" fill="none" stroke="#12262B" strokeWidth="1.5" opacity="0.4" />
              </svg>
              <svg viewBox="0 0 120 120" className="accent-drift absolute top-[46%] start-[14%] w-[64px]" style={{ animationDuration: "19s", animationDelay: "-5s" }}>
                <path fill={TEAL} d="M64 6C94 8 116 34 112 66C108 98 82 116 52 112C22 108 4 84 8 56C12 26 34 4 64 6Z" />
              </svg>
              <svg viewBox="0 0 120 120" className="accent-drift absolute top-[6%] end-[6%] w-[34px]" style={{ animationDuration: "16s", animationDelay: "-2s" }}>
                <path fill={LIME} d="M64 6C94 8 116 34 112 66C108 98 82 116 52 112C22 108 4 84 8 56C12 26 34 4 64 6Z" />
              </svg>
            </div>
          </div>
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
          </div>

          {/* Three real student screens, fanned: the side phones tuck behind
              the center one so the three read as a single object. Forced LTR
              so the fan stays symmetrical in Arabic. */}
          <div dir="ltr" className="wrap mt-14 sm:mt-20 flex items-end justify-center">
            <img
              src={phoneJoin}
              alt={t.phoneJoinCap}
              loading="lazy"
              className="w-[27%] max-w-[196px] h-auto select-none origin-bottom -rotate-[9deg] translate-y-3 -mr-[6%] drop-shadow-[0_18px_30px_rgba(20,33,42,0.28)]"
            />
            <img
              src={phoneClassic}
              alt={t.phoneClassicCap}
              loading="lazy"
              className="relative z-10 w-[31%] max-w-[226px] h-auto select-none drop-shadow-[0_22px_36px_rgba(20,33,42,0.32)]"
            />
            <img
              src={phoneCrypto}
              alt={t.phoneCryptoCap}
              loading="lazy"
              className="w-[27%] max-w-[196px] h-auto select-none origin-bottom rotate-[9deg] translate-y-3 -ml-[6%] drop-shadow-[0_18px_30px_rgba(20,33,42,0.28)]"
            />
          </div>

          <p className="mt-12 sm:mt-14 mx-auto max-w-2xl text-center text-[17px] sm:text-[20px] leading-relaxed text-black/70 font-medium">
            {t.feelBody}
          </p>
        </section>

        {/* ---------------- FOR WHO ---------------- */}
        <section className="wrap relative px-5 sm:px-8 md:px-14 pt-10 sm:pt-14 pb-16 sm:pb-24">
          {/* the gap between the text and the map gets a small lime drop and an oval */}
          <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block">
            <svg viewBox="0 0 240 140" className="accent-drift absolute top-[30%] left-1/2 -translate-x-1/2 w-[170px]" style={{ animationDuration: "22s", animationDelay: "-7s" }}>
              <ellipse cx="120" cy="70" rx="112" ry="52" transform="rotate(18 120 70)" fill="none" stroke="#12262B" strokeWidth="1.5" opacity="0.35" />
            </svg>
            <svg viewBox="0 0 120 120" className="accent-drift absolute top-[52%] left-[54%] w-[56px]" style={{ animationDuration: "18s", animationDelay: "-3s" }}>
              <path fill={LIME} d="M64 6C94 8 116 34 112 66C108 98 82 116 52 112C22 108 4 84 8 56C12 26 34 4 64 6Z" />
            </svg>
          </div>
          <div className="relative grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20">
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
        </div>

        <SiteFooter />
      </div>
    </div>
  );
};

export default Landing;
