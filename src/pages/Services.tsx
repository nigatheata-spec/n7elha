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

        platformKicker: "منصة وحيدة",
        platformTitle: "منصة واحدة لكل المواد",
        platformDesc: "إسلامية، عربي، رياضيات، علوم — نفس المنصة، نفس الأدوات، نفس التجربة. ما تحتاج شراء منفصل لكل قسم. المعلم في الفيزياء والمعلمة في اللغة العربية، كلهم على نفس النظام.",

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

        platformKicker: "ONE PLATFORM",
        platformTitle: "One Platform for Every Subject",
        platformDesc: "Islamic Studies, Arabic, Math, Science — same platform, same tools, same experience. One purchase covers every subject. Your physics teacher and your Arabic teacher work on the same system.",

        howKicker: "HOW IT WORKS",
        howTitle: "Three steps to your first live session",
        s1: "Upload content", s1d: "Your lesson file or notes. The platform handles the rest.",
        s2: "Invite students", s2d: "Share the game code — anyone can join from any device.",
        s3: "See results", s3d: "Live leaderboard plus a full report once the quiz ends.",
      };

  const modes: { icon: React.ReactNode; title: string; desc: string }[] = [
    { icon: <Trophy className="h-5 w-5" />, title: t.m1, desc: t.m1d },
    { icon: <Coins className="h-5 w-5" />, title: t.m2, desc: t.m2d },
    { icon: <ShieldAlert className="h-5 w-5" />, title: t.m3, desc: t.m3d },
    { icon: <Flame className="h-5 w-5" />, title: t.m4, desc: t.m4d },
    { icon: <Mountain className="h-5 w-5" />, title: t.m5, desc: t.m5d },
    { icon: <Skull className="h-5 w-5" />, title: t.m6, desc: t.m6d },
    { icon: <Swords className="h-5 w-5" />, title: t.m7, desc: t.m7d },
    { icon: <Palette className="h-5 w-5" />, title: t.m8, desc: t.m8d },
    { icon: <QrCode className="h-5 w-5" />, title: t.m9, desc: t.m9d },
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureLarge icon={<Sparkles className="h-6 w-6" />} title={t.f1Title} desc={t.f1Desc} tilt="-rotate-[0.5deg]" />
          <Feature icon={<FileText className="h-5 w-5" />} title={t.f2Title} desc={t.f2Desc} tilt="rotate-[0.9deg]" />
          <Feature icon={<Radio className="h-5 w-5" />} title={t.f3Title} desc={t.f3Desc} tilt="-rotate-[0.8deg]" />
          <FeatureLarge icon={<BarChart3 className="h-6 w-6" />} title={t.f4Title} desc={t.f4Desc} tilt="rotate-[0.5deg]" />
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

        <div className="mt-10 sm:mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modes.map((m, i) => (
            <div key={m.title} className={`group h-full ${i % 2 === 0 ? "-rotate-[0.4deg]" : "rotate-[0.5deg]"} hover:rotate-0 transition-transform duration-300`}>
              <div className="relative h-full rounded-2xl border-2 border-[#0B1418] bg-[#3F5A63] p-5 shadow-[4px_4px_0_0_#0B1418] group-hover:shadow-[7px_7px_0_0_#0B1418] group-hover:-translate-x-1 group-hover:-translate-y-1 transition-all">
                <div className="h-9 w-9 rounded-xl border-2 border-[#0B1418] bg-[#8FC44A] text-[#3F5A63] flex items-center justify-center">
                  {m.icon}
                </div>
                <h3 className="mt-4 text-[15px] font-semibold leading-tight text-white">{m.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/65">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
        </div>
      </section>

      {/* ---------------- PHYSICAL + DIGITAL GAMES ---------------- */}
      <section className="wrap px-5 sm:px-8 md:px-14 py-20 sm:py-28 bg-[#F5F1E8]">
        <div className="max-w-3xl">
          <span className={`text-[12px] font-semibold text-[#3F5A63] ${isAr ? "tracking-normal" : "tracking-[0.25em]"}`}>{t.physicalKicker}</span>
          <h2 className="mt-3 text-[28px] sm:text-[40px] tracking-tight leading-[1.1] mb-4" style={{ color: "#3F5A63", fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}>
            {t.physicalTitle}
          </h2>
          <p className="text-[15px] leading-relaxed text-black/70">{t.physicalDesc}</p>
        </div>
      </section>

      {/* ---------------- ONE PLATFORM, EVERY SUBJECT ---------------- */}
      <section className="wrap px-5 sm:px-8 md:px-14 py-20 sm:py-28">
        <div className="max-w-3xl">
          <span className={`text-[12px] font-semibold text-[#3F5A63] ${isAr ? "tracking-normal" : "tracking-[0.25em]"}`}>{t.platformKicker}</span>
          <h2 className="mt-3 text-[28px] sm:text-[40px] tracking-tight leading-[1.1] mb-4" style={{ color: "#3F5A63", fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}>
            {t.platformTitle}
          </h2>
          <p className="text-[15px] leading-relaxed text-black/70">{t.platformDesc}</p>
        </div>
      </section>

      {/* ---------------- HOW IT WORKS ---------------- */}
      <section id="how" className="wrap px-5 sm:px-8 md:px-14 py-20 sm:py-28">
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

      <SiteFooter />
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

export default Services;
