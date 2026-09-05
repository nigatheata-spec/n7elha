import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import {
  Sparkles,
  FileText,
  Radio,
  BarChart3,
  Upload,
  Users,
  Trophy,
  Swords,
  ShieldAlert,
  Flame,
  Skull,
  Mountain,
  Palette,
  QrCode,
  Coins,
} from "lucide-react";
import triDoodle from "@/assets/doodles/triangle-trio.png";
import { SQUARE_TYPES } from "@/lib/physicalGames";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Seo } from "@/components/Seo";

const Services = () => {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const t = isAr
    ? {
        kicker: "الخدمات",
        title: "كل ما يحتاجه فصلك في مكان واحد",
        sub: "نفلها مو مجموعة أدوات، ولا نظام إدارة تعلّم. هي طريقة تخلي طلابك يحبون الحصة — وخلف هالتجربة كل اللي تحتاجه: من تجهيز السؤال بالذكاء الاصطناعي إلى تحليل النتيجة، يشتغل من أول ثانية بدون تعقيد.",

        f1Title: "توليد الأسئلة بالذكاء الاصطناعي",
        f1Desc: "ارفع ملف الدرس (PDF أو Word أو PowerPoint) واترك المنصة تستخرج لك أسئلة دقيقة بمستويات صعوبة مختلفة، جاهزة للمراجعة والتعديل قبل النشر.",
        f2Title: "بناء يدوي مرن",
        f2Desc: "حرر، أضف، وأعد ترتيب الأسئلة بسهولة. اختر الإجابات الصحيحة، أضف صورًا توضيحية، وحدّد الوقت المناسب لكل سؤال على حدة.",
        f3Title: "بث مباشر للفصل",
        f3Desc: "ادعُ طلابك برمز قصير من أربعة أحرف، وشاهدهم ينضمون لحظة بلحظة على شاشة العرض في صفك — بلا تطبيقات، بلا تسجيل دخول.",
        f4Title: "تحليلات مفصلة",
        f4Desc: "اعرف من أتقن الدرس ومن يحتاج إلى مراجعة، عبر تقارير واضحة بعد كل جلسة تُظهر أداء كل طالب وكل سؤال على حدة.",

        modesKicker: "أنماط اللعب",
        modesTitle: "تسعة أنماط، هدف واحد: الطالب يطلع وهو يحب المادة",
        modesSub: "كل نمط يحوّل نفس الأسئلة إلى تجربة مختلفة — من سباق سريع إلى بقاء جماعي إلى لوح مطبوع بلا أجهزة إطلاقًا.",

        m1: "الوضع الكلاسيكي", m1d: "سباق الاختبار الأصلي — أجب بسرعة، اكسب أكثر.",
        m2: "سباق التشفير", m2d: "أجب بشكل صحيح لتكسب عملات، واستخدم قوة الاختراق لسرقة عملات المنافسين.",
        m3: "الكرة النارية", m3d: "كل إجابة خاطئة تكلفك حياة. الفائز هو آخر لاعب صامد.",
        m4: "البطاطا الساخنة", m4d: "قنبلة حية تنتقل بين اللاعبين — أجب بسرعة أو ستنفجر بين يديك.",
        m5: "أرضية الحمم", m5d: "تعاوني بالكامل: اكسبوا عملة من الإجابات الصحيحة وابنوا فوق الحمم المرتفعة.",
        m6: "بشر ضد الزومبي", m6d: "فريقان، شريطا صحة. الإجابات الصحيحة تموّل ترقيات فريقك.",
        m7: "لا تنظر للأسفل", m7d: "منصة قفز ثنائية الأبعاد — الطاقة من الإجابات الصحيحة تحرّك لاعبك وتُبقيه صاعدًا.",
        m8: "معركة الطلاء", m8d: "ساحة تلوين حرة للجميع — تحرك بعصا افتراضية واترك أثر لونك.",
        m9: "الألعاب الفعلية", m9d: "لوح مطبوع ورموز QR — بلا حاجة لجهاز لكل طالب، جهاز واحد فقط يمسح الرموز.",

        physicalKicker: "الفرق",
        physicalTitle: "ألعاب مادية و رقمية معاً",
        physicalDesc: "نفلها تجمع بين الألعاب الرقمية الكاملة وألعاب مادية بلوح ورموز QR — تجربة يلمسها الطالب ويتفاعل معها فعلياً في الفصل. جهاز واحد يمسح لكل الفصل، وما تحتاج لكل طالب جهاز خاص. نفس الأسئلة، طريقتين مختلفتين للتفاعل.",
        boardKicker: "مربعات اللوح المطبوع",

        platformKicker: "منصة وحيدة",
        platformTitle: "منصة واحدة لكل المواد",
        platformDesc: "نفس المنصة، نفس الأدوات، نفس التجربة. ما تحتاج شراء منفصل لكل قسم. المعلم في الفيزياء والمعلمة في اللغة العربية، كلهم على نفس النظام.",
        subjects: ["إسلامية", "عربي", "رياضيات", "علوم"],

        howKicker: "كيف تعمل؟",
        howTitle: "ثلاث خطوات بس",
        s1: "ارفع المحتوى", s1d: "ملف الدرس أو ملاحظاتك. تتكفّل المنصة بالباقي.",
        s2: "ادعُ طلابك", s2d: "شارك رمز اللعبة، وسينضم الجميع من أي جهاز.",
        s3: "اعرض النتائج", s3d: "ترتيب لحظي، وتقرير كامل بعد انتهاء الاختبار.",
      }
    : {
        kicker: "SERVICES",
        title: "Everything your classroom needs, in one place",
        sub: "nefelha isn't a set of tools, and it isn't an LMS. It's a way to make your students love class — and behind that experience is everything you need: from AI-powered question generation to real-time analytics, working from the first second with zero friction.",

        f1Title: "AI question generation",
        f1Desc: "Upload your lesson (PDF, Word or PowerPoint) and let the platform extract precise questions across difficulty levels, ready to review and edit before you publish.",
        f2Title: "Flexible manual builder",
        f2Desc: "Edit, add and reorder questions effortlessly. Choose correct answers, attach images, and tune the timing per question individually.",
        f3Title: "Live classroom broadcast",
        f3Desc: "Invite your students with a short four-character code and watch them join in real time on your projector — no apps, no sign-up.",
        f4Title: "Deep analytics",
        f4Desc: "Know who mastered the lesson and who needs a review, through clear reports after every session breaking down each student and each question.",

        modesKicker: "GAME MODES",
        modesTitle: "Nine modes, one goal: students leave class loving the subject",
        modesSub: "Every mode turns the same question set into a different experience — from a fast-paced race to co-op survival to a printed board with no student devices at all.",

        m1: "Classic", m1d: "The original quiz race — answer fast, earn more.",
        m2: "Crypto Rush", m2d: "Correct answers earn crypto; a hack power-up lets you steal from rivals.",
        m3: "Dodgeball", m3d: "Wrong answers cost lives. Last player standing wins.",
        m4: "Hot Potato", m4d: "A live bomb on a fuse passes between players — answer fast or get caught holding it.",
        m5: "Lava Floor", m5d: "Full co-op: earn currency from correct answers and build above the rising lava together.",
        m6: "Humans vs Zombies", m6d: "Two teams, two health bars. Correct answers fund your team's upgrades.",
        m7: "Don't Look Down", m7d: "A 2D parkour platformer — energy from correct answers moves your climber upward.",
        m8: "Paint Fight", m8d: "A free-for-all territory arena — move with a virtual joystick and leave your color's trail.",
        m9: "Physical Games", m9d: "A printed board and QR codes — no device per student, just one shared scanner.",

        physicalKicker: "THE DIFFERENCE",
        physicalTitle: "Physical + Digital Games Together",
        physicalDesc: "nefelha combines full digital games with physical games using a board and QR codes — an experience students touch and engage with in real space. One device scans for the whole class, no device needed per student. Same questions, two different ways to play.",
        boardKicker: "PRINTED BOARD SQUARES",

        platformKicker: "ONE PLATFORM",
        platformTitle: "One Platform for Every Subject",
        platformDesc: "Same platform, same tools, same experience. One purchase covers every subject. Your physics teacher and your Arabic teacher work on the same system.",
        subjects: ["Islamic Studies", "Arabic", "Math", "Science"],

        howKicker: "HOW IT WORKS",
        howTitle: "Three steps to your first live session",
        s1: "Upload content", s1d: "Your lesson file or notes. The platform handles the rest.",
        s2: "Invite students", s2d: "Share the game code — anyone can join from any device.",
        s3: "See results", s3d: "Live leaderboard plus a full report once the quiz ends.",
      };

  const features: { icon: React.ReactNode; title: string; desc: string; emphasis?: boolean }[] = [
    { icon: <Sparkles className="h-5 w-5" />, title: t.f1Title, desc: t.f1Desc, emphasis: true },
    { icon: <FileText className="h-5 w-5" />, title: t.f2Title, desc: t.f2Desc },
    { icon: <Radio className="h-5 w-5" />, title: t.f3Title, desc: t.f3Desc },
    { icon: <BarChart3 className="h-5 w-5" />, title: t.f4Title, desc: t.f4Desc, emphasis: true },
  ];

  const modes: { n: string; icon: React.ReactNode; title: string; desc: string }[] = [
    { n: "00", icon: <Trophy className="h-4 w-4" />, title: t.m1, desc: t.m1d },
    { n: "01", icon: <Coins className="h-4 w-4" />, title: t.m2, desc: t.m2d },
    { n: "02", icon: <ShieldAlert className="h-4 w-4" />, title: t.m3, desc: t.m3d },
    { n: "03", icon: <Flame className="h-4 w-4" />, title: t.m4, desc: t.m4d },
    { n: "04", icon: <Mountain className="h-4 w-4" />, title: t.m5, desc: t.m5d },
    { n: "05", icon: <Skull className="h-4 w-4" />, title: t.m6, desc: t.m6d },
    { n: "06", icon: <Swords className="h-4 w-4" />, title: t.m7, desc: t.m7d },
    { n: "07", icon: <Palette className="h-4 w-4" />, title: t.m8, desc: t.m8d },
    { n: "08", icon: <QrCode className="h-4 w-4" />, title: t.m9, desc: t.m9d },
  ];

  const steps = [
    { n: "01", icon: <Upload className="h-4 w-4" />, title: t.s1, desc: t.s1d },
    { n: "02", icon: <Users className="h-4 w-4" />, title: t.s2, desc: t.s2d },
    { n: "03", icon: <Trophy className="h-4 w-4" />, title: t.s3, desc: t.s3d },
  ];

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: "hsl(var(--cream-panel))", fontFamily: "'Outfit', 'Almarai', system-ui, sans-serif" }}
    >
      <Seo
        path="/services"
        titleAr="تجربة تعليمية تفاعلية تخلي الطلاب يحبون التعلّم — تسعة أنماط لعب"
        titleEn="Interactive Educational Experience That Makes Students Love Learning — Nine Play Modes"
        descriptionAr="تجربة تفاعلية تخلي طلابك يحبون الحصة: توليد أسئلة بالذكاء الاصطناعي، بث مباشر برمز واحد، وتسعة أنماط لعب من سباق كلاسيكي إلى حرب الزومبي — كل ما يحتاجه معلم الفصل العربي."
        descriptionEn="An interactive experience that makes students love learning: AI question generation, one-code live sessions, and nine play modes from Classic to Humans vs Zombies — everything an Arabic-classroom teacher needs."
      />
      <SiteNav />

      {/* ---------------- HERO ---------------- */}
      <section className="wrap relative overflow-hidden px-5 sm:px-8 md:px-14 pt-10 sm:pt-16 pb-14 sm:pb-20">
        <img src={triDoodle} alt="" aria-hidden className="pointer-events-none absolute end-[6%] top-10 w-24 opacity-25 rotate-6 hidden md:block" />
        <span className={`text-[12px] font-semibold text-[#3F5A63] ${isAr ? "tracking-normal" : "tracking-[0.25em]"}`}>{t.kicker}</span>
        <h1
          className="mt-3 max-w-2xl leading-[1.1] tracking-tight text-[32px] sm:text-[46px]"
          style={{ fontFamily: "'ArslanWessam', 'Almarai', sans-serif", color: "#3F5A63" }}
        >
          {t.title}
        </h1>
        <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-black/65">{t.sub}</p>
      </section>

      {/* ---------------- FEATURES ---------------- */}
      <section className="wrap px-5 sm:px-8 md:px-14 pb-16 sm:pb-24 pt-16 sm:pt-24">
        <div className="border-t-2 border-[hsl(var(--nb-border))]">
          {features.map((f, i) => (
            <FeatureRow key={f.title} n={`0${i + 1}`} icon={f.icon} title={f.title} desc={f.desc} emphasis={f.emphasis} />
          ))}
        </div>
      </section>

      {/* ---------------- GAME MODES ---------------- */}
      <section className="bg-[#14212A] text-white px-5 sm:px-8 md:px-14 py-20 sm:py-28">
        <div className="wrap"><div className="max-w-2xl">
          <span className={`text-[12px] font-semibold text-[#8FC44A] ${isAr ? "tracking-normal" : "tracking-[0.25em]"}`}>{t.modesKicker}</span>
          <h2 className="mt-3 text-[26px] sm:text-[36px] tracking-tight leading-[1.15] text-white" style={{ fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}>
            {t.modesTitle}
          </h2>
          <p className="mt-4 text-[15px] text-white/65 leading-relaxed">{t.modesSub}</p>
        </div>

        <div className="mt-10 sm:mt-14 border-t border-white/10">
          {modes.map((m) => (
            <ModeRow key={m.title} n={m.n} icon={m.icon} title={m.title} desc={m.desc} />
          ))}
        </div>
        </div>
      </section>

      {/* ---------------- PHYSICAL + DIGITAL GAMES ---------------- */}
      <section className="wrap px-5 sm:px-8 md:px-14 py-16 sm:py-20 bg-[#F5F1E8]">
        <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
          <div className="max-w-lg">
            <span className={`text-[12px] font-semibold text-[#3F5A63] ${isAr ? "tracking-normal" : "tracking-[0.25em]"}`}>{t.physicalKicker}</span>
            <h2 className="mt-3 text-[28px] sm:text-[40px] tracking-tight leading-[1.1] mb-4" style={{ color: "#3F5A63", fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}>
              {t.physicalTitle}
            </h2>
            <p className="text-[15px] leading-relaxed text-black/70">{t.physicalDesc}</p>
          </div>

          <div>
            <p className={`text-[11px] font-semibold text-black/40 mb-3 ${isAr ? "" : "tracking-[0.2em]"}`}>{t.boardKicker}</p>
            <div className="border-t border-black/15">
              {Object.values(SQUARE_TYPES).map((sq) => (
                <div key={sq.code} className="flex items-center gap-3 py-2.5 border-b border-black/15">
                  <span className="h-3.5 w-3.5 rounded-sm shrink-0" style={{ background: sq.color }} aria-hidden />
                  <span className="text-[13.5px] text-black/75">{isAr ? sq.label_ar : sq.label_en}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- ONE PLATFORM, EVERY SUBJECT ---------------- */}
      <section className="wrap px-5 sm:px-8 md:px-14 py-16 sm:py-20">
        <div className="max-w-3xl">
          <span className={`text-[12px] font-semibold text-[#3F5A63] ${isAr ? "tracking-normal" : "tracking-[0.25em]"}`}>{t.platformKicker}</span>
          <h2 className="mt-3 text-[28px] sm:text-[40px] tracking-tight leading-[1.1]" style={{ color: "#3F5A63", fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}>
            {t.platformTitle}
          </h2>
        </div>

        <div className={`mt-8 sm:mt-10 flex flex-wrap items-baseline gap-x-3 gap-y-2 ${isAr ? "" : "tracking-tight"}`}>
          {t.subjects.map((subj, i) => (
            <Fragment key={subj}>
              <span
                className="text-[26px] sm:text-[38px] leading-none"
                style={{ color: "#3F5A63", fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}
              >
                {subj}
              </span>
              {i < t.subjects.length - 1 && <span className="text-[20px] sm:text-[28px] text-[#8FC44A]">·</span>}
            </Fragment>
          ))}
        </div>

        <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-black/70">{t.platformDesc}</p>
      </section>

      {/* ---------------- HOW IT WORKS ---------------- */}
      <section id="how" className="wrap px-5 sm:px-8 md:px-14 py-16 sm:py-20">
        <div className="max-w-2xl">
          <span className={`text-[12px] font-semibold text-[#3F5A63] ${isAr ? "tracking-normal" : "tracking-[0.25em]"}`}>{t.howKicker}</span>
          <h2 className="mt-3 text-[28px] sm:text-[40px] tracking-tight leading-[1.1]" style={{ color: "#3F5A63", fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}>
            {t.howTitle}
          </h2>
        </div>

        <div className="mt-10 sm:mt-14 flex flex-col sm:flex-row sm:items-start gap-8 sm:gap-6">
          {steps.map((s, i) => (
            <Fragment key={s.n}>
              <StepItem n={s.n} icon={s.icon} title={s.title} desc={s.desc} />
              {i < steps.length - 1 && <div className="hidden sm:block flex-1 h-px bg-black/15 mt-4" />}
            </Fragment>
          ))}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
};

/* ---------- helpers ---------- */
/* No card boxes: every list below is rows separated by a single hairline
   divider, distinguished by index number, icon and type scale rather than
   a bordered/shadowed container per item. */

const FeatureRow = ({ n, icon, title, desc, emphasis }: { n: string; icon: React.ReactNode; title: string; desc: string; emphasis?: boolean }) => (
  <div className="group grid grid-cols-[40px_1fr] sm:grid-cols-[56px_44px_1fr] items-start gap-x-4 sm:gap-x-6 gap-y-3 py-7 sm:py-9 border-b-2 border-[hsl(var(--nb-border))]">
    <span className="hidden sm:block pt-2 text-[13px] font-mono tracking-widest text-black/30">{n}</span>
    <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-[#3F5A63] text-white flex items-center justify-center shrink-0 group-hover:bg-[#8FC44A] group-hover:text-[#14212A] transition-colors">
      {icon}
    </div>
    <div>
      <h3 className={emphasis ? "text-[20px] sm:text-[24px] font-semibold leading-tight" : "text-[17px] font-semibold leading-tight"} style={{ color: "#3F5A63" }}>
        {title}
      </h3>
      <p className={`mt-2 leading-relaxed text-black/65 ${emphasis ? "text-[15px] max-w-xl" : "text-[14px] max-w-lg"}`}>{desc}</p>
    </div>
  </div>
);

const ModeRow = ({ n, icon, title, desc }: { n: string; icon: React.ReactNode; title: string; desc: string }) => (
  <div className="group grid grid-cols-[36px_36px_1fr] sm:grid-cols-[48px_40px_1fr] items-start gap-x-4 sm:gap-x-6 gap-y-1.5 py-5 sm:py-6 border-b border-white/10">
    <span className="pt-1.5 text-[12px] font-mono tracking-widest text-white/30">{n}</span>
    <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg border border-white/15 text-[#8FC44A] flex items-center justify-center shrink-0 group-hover:border-[#8FC44A] transition-colors">
      {icon}
    </div>
    <div>
      <h3 className="inline text-[16px] sm:text-[17px] font-semibold leading-tight text-white underline decoration-transparent group-hover:decoration-[#8FC44A] decoration-2 underline-offset-4 transition-[text-decoration-color]">
        {title}
      </h3>
      <p className="mt-1 text-[13.5px] leading-relaxed text-white/55 max-w-xl">{desc}</p>
    </div>
  </div>
);

const StepItem = ({ n, icon, title, desc }: { n: string; icon: React.ReactNode; title: string; desc: string }) => (
  <div className="sm:flex-1 min-w-0 shrink-0">
    <div className="flex items-center gap-3">
      <span className="text-[12px] font-mono tracking-widest text-black/40">{n}</span>
      <div className="h-8 w-8 rounded-full border-2 border-[hsl(var(--nb-border))] text-[#3F5A63] flex items-center justify-center">{icon}</div>
    </div>
    <h3 className="mt-4 text-[17px] font-semibold" style={{ color: "#3F5A63" }}>{title}</h3>
    <p className="mt-1.5 text-[13.5px] leading-relaxed text-black/65 max-w-[22ch]">{desc}</p>
  </div>
);

export default Services;
