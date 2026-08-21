import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Globe, MousePointerClick, LayoutGrid, ArrowUpRight, Compass } from "lucide-react";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";

const About = () => {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const t = isAr
    ? {
        kicker: "من نحن",
        title: "بدأت الفكرة من المقاعد الخلفية",
        sub: "نفلها شركة ناشئة سعودية تبني تجربة تعلّم تفاعلية للفصل العربي. لم نبدأ من دراسة سوق، بدأنا من تجربتنا نحن كطلاب.",

        storyKicker: "قصتنا",
        storyTitle: "كنّا الطلاب الذين لا يرفعون أيديهم",
        p1: "نعرف تمامًا كيف تبدو حصة المراجعة. المعلم يسأل، والصف يصمت. ليس لأن أحدًا لم يفهم الدرس، بل لأن لا أحد يريد أن يكون أول من يجيب ويخطئ أمام الجميع.",
        p2: "جرّبنا المنصات الجاهزة. كانت مصممة بلغة أخرى وذهنية أخرى، والعربية فيها مجرد ترجمة أُضيفت لاحقًا. الأسئلة تنكسر، والاتجاه يختل، والتجربة تبدو غريبة عن صفوفنا.",
        p3: "فقررنا أن نبني ما كنا نتمنى وجوده ونحن على تلك المقاعد: منصة تجعل المراجعة شيئًا ينتظره الطالب، لا شيئًا يتهرب منه. هكذا وُلدت نفلها.",

        factsKicker: "ما بنيناه حتى الآن",
        f1n: "٩", f1l: "أنماط لعب مختلفة، من سباق سريع إلى لوح مطبوع",
        f2n: "٣", f2l: "صيغ ملفات يقرأها الذكاء الاصطناعي: PDF وWord وPowerPoint",
        f3n: "٠", f3l: "تطبيقات على الطالب تحميلها للانضمام",
        f4n: "٤", f4l: "أحرف فقط في رمز الدخول للجلسة",

        missionKicker: "إلى أين نتجه",
        missionTitle: "طموحنا يبدأ من الخليج",
        m1: "هدفنا أن يصبح التعلّم التفاعلي هو الأصل في فصول الخليج، لا الاستثناء الذي يحدث مرة في الفصل الدراسي.",
        m2: "نبني نفلها لتعمل في الفصل الواقعي كما هو: الفصل الذي لا يملك جهازًا لكل طالب، والفصل الذي يملك. لهذا السبب تحديدًا بنينا نمط الألعاب الفعلية بلوح مطبوع ورموز QR، حتى لا تكون التقنية شرطًا لدخول التجربة.",

        valuesKicker: "ما الذي يوجّهنا",
        valuesTitle: "ثلاثة مبادئ لا نتنازل عنها",
        v1t: "العربية أولاً، لا استثناءً", v1d: "من اتجاه الواجهة إلى تحليل الإجابات، كل قرار تصميم يبدأ من اللغة العربية أولًا.",
        v2t: "بلا احتكاك", v2d: "لا تحميل تطبيقات، لا حسابات للطلاب. رمز قصير، وضغطة واحدة، وأنت داخل الجلسة.",
        v3t: "مرونة في طريقة المراجعة", v3d: "نفس الأسئلة، تسعة أنماط مختلفة، لأن الفصل الذي يلعب يتذكر أكثر من الفصل الذي يُختبر فقط.",

        ctaLine: "جرّب نفلها مع فصلك، وشاهد الفرق من أول جلسة.",
        ctaLink: "استكشف الخدمات",
      }
    : {
        kicker: "ABOUT US",
        title: "It started in the back row",
        sub: "nfelha is a Saudi startup building an interactive learning experience for the Arabic classroom. We did not begin with market research. We began with our own time as students.",

        storyKicker: "OUR STORY",
        storyTitle: "We were the students who never raised their hands",
        p1: "We know exactly what a review lesson looks like. The teacher asks, and the room goes quiet. Not because nobody understood, but because nobody wants to be the first one to answer and get it wrong in front of everyone.",
        p2: "We tried the platforms that already existed. They were designed in another language and another mindset, with Arabic added afterwards as a translation. Questions break, direction flips, and the whole thing feels foreign to our classrooms.",
        p3: "So we built what we wished we had while we were still sitting in those seats: a platform that makes review something students look forward to instead of something they avoid. That is how nfelha started.",

        factsKicker: "WHAT WE HAVE BUILT SO FAR",
        f1n: "9", f1l: "distinct game modes, from a fast race to a printed board",
        f2n: "3", f2l: "file formats the AI reads: PDF, Word and PowerPoint",
        f3n: "0", f3l: "apps a student has to install to join",
        f4n: "4", f4l: "characters in the code that opens a live session",

        missionKicker: "WHERE WE ARE HEADED",
        missionTitle: "Our ambition starts with the Gulf",
        m1: "We want interactive learning to become the default in GCC classrooms, not the exception that happens once a semester.",
        m2: "We build nfelha for the classroom as it actually is: the one without a device for every student, and the one with. That is exactly why we built Physical Games, a printed board and QR codes, so that technology is never the price of admission.",

        valuesKicker: "WHAT GUIDES US",
        valuesTitle: "Three principles we don't compromise on",
        v1t: "Arabic first, not an afterthought", v1d: "From interface direction to answer analytics, every design decision starts from Arabic first.",
        v2t: "Zero friction", v2d: "No app downloads, no student accounts. A short code, one tap, and you're in the session.",
        v3t: "Flexible review, not one format", v3d: "The same questions, nine different modes, because a classroom that plays remembers more than one that's only tested.",

        ctaLine: "Try nfelha with your class and see the difference from the first session.",
        ctaLink: "Explore services",
      };

  const values = [
    { icon: <Globe className="h-5 w-5" />, title: t.v1t, desc: t.v1d },
    { icon: <MousePointerClick className="h-5 w-5" />, title: t.v2t, desc: t.v2d },
    { icon: <LayoutGrid className="h-5 w-5" />, title: t.v3t, desc: t.v3d },
  ];

  /* Deliberately product facts rather than vanity metrics: every one of these is
     checkable against the app itself, which is the point. */
  const facts = [
    { n: t.f1n, l: t.f1l },
    { n: t.f2n, l: t.f2l },
    { n: t.f3n, l: t.f3l },
    { n: t.f4n, l: t.f4l },
  ];

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: "hsl(var(--cream-panel))", fontFamily: "'Outfit', 'Almarai', system-ui, sans-serif" }}
    >
      <SiteNav />

      {/* ---------------- HERO ---------------- */}
      <section className="px-5 sm:px-8 md:px-14 pt-10 sm:pt-16 pb-14 sm:pb-20">
        <span className={`text-[12px] font-semibold text-[#3F5A63] ${isAr ? "tracking-normal" : "tracking-[0.25em]"}`}>{t.kicker}</span>
        <h1
          className="mt-3 max-w-2xl leading-[1.1] tracking-tight text-[32px] sm:text-[46px]"
          style={{ fontFamily: "'ArslanWessam', 'Almarai', sans-serif", color: "#3F5A63" }}
        >
          {t.title}
        </h1>
        <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-black/65">{t.sub}</p>
      </section>

      {/* ---------------- ORIGIN STORY ---------------- */}
      <section className="px-5 sm:px-8 md:px-14 py-16 sm:py-24 border-t border-black/5">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] gap-8 lg:gap-16">
          <div>
            <span className={`text-[12px] font-semibold text-[#FF8254] ${isAr ? "tracking-normal" : "tracking-[0.25em]"}`}>{t.storyKicker}</span>
            <h2
              className="mt-3 text-[26px] sm:text-[34px] tracking-tight leading-[1.15]"
              style={{ color: "#3F5A63", fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}
            >
              {t.storyTitle}
            </h2>
          </div>

          {/* The quote bar carries the origin story: a full left border would be the
              banned side-stripe, so the emphasis comes from scale and the pulled-in rule above. */}
          <div className="max-w-xl">
            <div className="h-1 w-16 bg-[#FF8254] rounded-full" />
            <p className="mt-6 text-[17px] sm:text-[19px] leading-relaxed text-[#3F5A63] font-medium">{t.p1}</p>
            <p className="mt-5 text-[15px] leading-relaxed text-black/65">{t.p2}</p>
            <p className="mt-5 text-[15px] leading-relaxed text-black/65">{t.p3}</p>
          </div>
        </div>
      </section>

      {/* ---------------- PRODUCT FACTS ---------------- */}
      <section className="px-5 sm:px-8 md:px-14 py-16 sm:py-20 border-t border-black/5">
        <span className={`text-[12px] font-semibold text-black/40 ${isAr ? "tracking-normal" : "tracking-[0.25em]"}`}>{t.factsKicker}</span>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {facts.map(f => (
            <div
              key={f.l}
              className="rounded-2xl border-2 border-[hsl(var(--nb-border))] bg-white p-6 shadow-[4px_4px_0_0_hsl(var(--nb-border))]"
            >
              <div
                className="text-[44px] leading-none tracking-tight"
                style={{ color: "#3F5A63", fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}
              >
                {f.n}
              </div>
              <p className="mt-3 text-[13.5px] leading-relaxed text-black/60">{f.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- MISSION ---------------- */}
      <section className="px-5 sm:px-8 md:px-14 py-16 sm:py-24 border-t border-black/5">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border-2 border-[hsl(var(--nb-border))] bg-white px-4 py-1.5 shadow-[3px_3px_0_0_hsl(var(--nb-border))]">
            <Compass className="h-4 w-4 text-[#FF8254]" />
            <span className={`text-[11px] font-semibold text-[#3F5A63] ${isAr ? "tracking-normal" : "tracking-[0.2em]"}`}>{t.missionKicker}</span>
          </div>
          <h2
            className="mt-6 text-[28px] sm:text-[40px] tracking-tight leading-[1.1]"
            style={{ color: "#3F5A63", fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}
          >
            {t.missionTitle}
          </h2>
          <p className="mt-6 text-[16px] sm:text-[17px] leading-relaxed text-black/70">{t.m1}</p>
          <p className="mt-4 text-[15px] leading-relaxed text-black/65">{t.m2}</p>
        </div>
      </section>

      {/* ---------------- VALUES ---------------- */}
      <section className="bg-[#3F5A63] text-white px-5 sm:px-8 md:px-14 py-16 sm:py-24">
        <div className="max-w-2xl">
          <span className={`text-[12px] font-semibold text-white/60 ${isAr ? "tracking-normal" : "tracking-[0.25em]"}`}>{t.valuesKicker}</span>
          <h2 className="mt-3 text-[26px] sm:text-[36px] tracking-tight leading-[1.15] text-white" style={{ fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}>
            {t.valuesTitle}
          </h2>
        </div>

        <div className="mt-10 sm:mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {values.map((v, i) => (
            <div key={v.title} className={`group h-full ${i % 2 === 0 ? "-rotate-[0.5deg]" : "rotate-[0.6deg]"} hover:rotate-0 transition-transform duration-300`}>
              <div className="relative h-full rounded-2xl border-2 border-[#22333A] bg-white p-6 shadow-[5px_5px_0_0_#22333A] group-hover:shadow-[8px_8px_0_0_#22333A] group-hover:-translate-x-1 group-hover:-translate-y-1 transition-all">
                <div className="h-10 w-10 rounded-2xl border-2 border-[#22333A] bg-[#FF8254] text-white flex items-center justify-center">
                  {v.icon}
                </div>
                <h3 className="mt-5 text-[16px] font-semibold leading-tight text-[#22333A]">{v.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-black/65">{v.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-14 text-[15px] leading-relaxed text-white/65">
          {t.ctaLine}{" "}
          <Link to="/services" className="inline-flex items-center gap-1 font-semibold text-white underline decoration-[#FF8254] decoration-2 underline-offset-4">
            {t.ctaLink}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </p>
      </section>

      <SiteFooter />
    </div>
  );
};

export default About;
