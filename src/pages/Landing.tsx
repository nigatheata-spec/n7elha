import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, Play, Upload, Users, Trophy } from "lucide-react";
import { useSmoothScroll } from "@/lib/smoothScroll";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { ProductPreview } from "@/components/site/ProductPreview";
import heroPerson from "@/assets/hero-person.png";
import saudiMap from "@/assets/saudi-map.svg";

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

        mapCaption: "من هنا نبدأ",
        storyKicker: "قصتنا",
        storyTitle: "كنّا الطلاب الذين لا يرفعون أيديهم",
        sp1: "نعرف تمامًا كيف تبدو حصة المراجعة. المعلم يسأل، والصف يصمت. ليس لأن أحدًا لم يفهم الدرس، بل لأن لا أحد يريد أن يكون أول من يجيب ويخطئ أمام الجميع.",
        sp2: "جرّبنا المنصات الجاهزة. كانت مصممة بلغة أخرى وذهنية أخرى، والعربية فيها مجرد ترجمة أُضيفت لاحقًا. الأسئلة تنكسر، والاتجاه يختل، والتجربة تبدو غريبة عن صفوفنا.",
        sp3: "فقررنا أن نبني ما كنا نتمنى وجوده ونحن على تلك المقاعد: منصة تجعل المراجعة شيئًا ينتظره الطالب، لا شيئًا يتهرب منه. هكذا وُلدت نفلها.",

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

        mapCaption: "This is where we start",
        storyKicker: "OUR STORY",
        storyTitle: "We were the students who never raised their hands",
        sp1: "We know exactly what a review lesson looks like. The teacher asks, and the room goes quiet. Not because nobody understood, but because nobody wants to be the first one to answer and get it wrong in front of everyone.",
        sp2: "We tried the platforms that already existed. They were designed in another language and another mindset, with Arabic added afterwards as a translation. Questions break, direction flips, and the whole thing feels foreign to our classrooms.",
        sp3: "So we built what we wished we had while we were still sitting in those seats: a platform that makes review something students look forward to instead of something they avoid. That is how nfelha started.",

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
        <div className="wrap relative grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] items-center gap-8 lg:gap-10 px-5 sm:px-8 md:px-14 pt-8 sm:pt-12 pb-0">
          <div className="relative z-10">
            <h1
              className="leading-[1.05] tracking-tight text-[38px] sm:text-[52px] md:text-[68px]"
              style={{ fontFamily: "'ArslanWessam', 'Almarai', sans-serif", color: "#3F5A63" }}
            >
              <span className="block">{t.line1}</span>
              <span className="block">
                <span className="italic" style={{ color: "#FF8254" }}>{t.line2a}</span>
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
          <div className="relative min-h-[440px] sm:min-h-[560px]">
            <div className="absolute top-2 end-2 sm:end-4 w-[88%] sm:w-[78%] aspect-square rounded-[24px] sm:rounded-[28px] bg-[#3F5A63] border-2 border-[hsl(var(--nb-border))] shadow-[6px_6px_0_0_hsl(var(--nb-border))]" />
            <img
              src={heroPerson}
              alt="معلم نفلها"
              className="absolute bottom-0 end-2 sm:end-4 w-[88%] sm:w-[78%] h-full object-contain object-bottom select-none pointer-events-none drop-shadow-2xl z-20"
            />
          </div>
        </div>

        <ProductPreview />

        {/* ---------------- OUR STORY ---------------- */}
        <section className="bg-[#14212A] text-white px-5 sm:px-8 md:px-14 py-20 sm:py-28">
          <div className="wrap grid grid-cols-1 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] gap-8 lg:gap-16">
            <div>
              <span className={`text-[12px] font-semibold text-[#FF8254] ${isAr ? "tracking-normal" : "tracking-[0.25em]"}`}>{t.storyKicker}</span>
              <h2
                className="mt-3 text-[26px] sm:text-[34px] tracking-tight leading-[1.15]"
                style={{ color: "#FFFFFF", fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}
              >
                {t.storyTitle}
              </h2>
            </div>
            <div className="max-w-xl relative">
              <div className="h-1 w-16 bg-[#FF8254] rounded-full" />
              <p className="mt-6 text-[17px] sm:text-[19px] leading-relaxed text-white font-medium">{t.sp1}</p>
              <p className="mt-5 text-[15px] leading-relaxed text-white/60">{t.sp2}</p>
              <p className="mt-5 text-[15px] leading-relaxed text-white/60">{t.sp3}</p>
            </div>
          </div>
        </section>

        {/* ---------------- HOW IT WORKS ---------------- */}
        <section id="how" className="bg-[#3F5A63] text-white px-5 sm:px-8 md:px-14 py-20 sm:py-28">
          <div className="wrap"><div className="max-w-2xl">
            <span className={`text-[12px] font-semibold text-[#FF8254] ${isAr ? "tracking-normal" : "tracking-[0.25em]"}`}>{t.howKicker}</span>
            <h2 className="mt-3 text-[28px] sm:text-[40px] tracking-tight leading-[1.1]" style={{ color: "#FFFFFF", fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}>
              {t.howTitle}
            </h2>
          </div>

          <div className="mt-10 sm:mt-14 grid grid-cols-1 md:grid-cols-3 gap-5">
            <Step n="01" icon={<Upload className="h-5 w-5" />} title={t.s1} desc={t.s1d} tilt="-rotate-[0.6deg]" />
            <Step n="02" icon={<Users className="h-5 w-5" />} title={t.s2} desc={t.s2d} tilt="rotate-[0.8deg]" />
            <Step n="03" icon={<Trophy className="h-5 w-5" />} title={t.s3} desc={t.s3d} tilt="-rotate-[0.9deg]" />
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

/* ---------- helpers ---------- */



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
