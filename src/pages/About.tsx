import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Globe, MousePointerClick, LayoutGrid, ArrowUpRight } from "lucide-react";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";

const About = () => {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const t = isAr
    ? {
        kicker: "من نحن",
        title: "صُممت للمعلم العربي أولاً",
        sub: "نحلها منصة اختبارات تفاعلية بُنيت من الصفر حول اللغة العربية — لا ترجمة لاحقة، ولا واجهة أُدرجت فيها العربية كخيار ثانوي.",

        p1: "سواء كنت معلمًا في مدرسة حكومية تبحث عن طريقة تجعل مراجعة الدرس أكثر حيوية، أو مدرّسًا خاصًا يريد تتبع مستوى كل طالب بدقة — نحلها صُممت لك.",
        p2: "لا يشترط أن تكون خبيرًا في التكنولوجيا. المنصة تعمل من المتصفح مباشرة، ولا تحتاج الطلاب إلى تحميل أي تطبيق. رمز قصير، وينضم الجميع في ثوانٍ.",
        p3: "الأسئلة باللغة العربية، التقارير باللغة العربية، وتجربة الطالب مصممة للشاشات الصغيرة التي يحملها طلابك في جيوبهم.",

        valuesKicker: "ما الذي يوجّهنا",
        valuesTitle: "ثلاثة مبادئ لا نتنازل عنها",
        v1t: "العربية أولاً، لا استثناءً", v1d: "من اتجاه الواجهة إلى تحليل الإجابات، كل قرار تصميم يبدأ من اللغة العربية أولًا.",
        v2t: "بلا احتكاك", v2d: "لا تحميل تطبيقات، لا حسابات للطلاب. رمز قصير، وضغطة واحدة، وأنت داخل الجلسة.",
        v3t: "مرونة في طريقة المراجعة", v3d: "نفس الأسئلة، ثمانية أنماط مختلفة — لأن الفصل الذي يلعب يتذكر أكثر من الفصل الذي يُختبر فقط.",

        ctaLine: "جرّب نحلها مع فصلك، وشاهد الفرق من أول جلسة.",
        ctaLink: "استكشف الخدمات",
      }
    : {
        kicker: "ABOUT US",
        title: "Built around the Arabic-speaking teacher",
        sub: "n7elha is an interactive quiz platform built from the ground up around Arabic — not translated after the fact, not an interface with Arabic bolted on as an afterthought.",

        p1: "Whether you're a school teacher looking to make lesson reviews more engaging, or a private tutor who wants to track each student's level with precision — n7elha was built for you.",
        p2: "You don't need to be tech-savvy. The platform runs entirely in the browser — students don't download anything. One short code and everyone's in within seconds.",
        p3: "Questions in Arabic, reports in Arabic, and a student experience designed for the small screens they carry in their pockets.",

        valuesKicker: "WHAT GUIDES US",
        valuesTitle: "Three principles we don't compromise on",
        v1t: "Arabic first, not an afterthought", v1d: "From interface direction to answer analytics, every design decision starts from Arabic first.",
        v2t: "Zero friction", v2d: "No app downloads, no student accounts. A short code, one tap, and you're in the session.",
        v3t: "Flexible review, not one format", v3d: "The same questions, eight different modes — because a classroom that plays remembers more than one that's only tested.",

        ctaLine: "Try n7elha with your class and see the difference from the first session.",
        ctaLink: "Explore services",
      };

  const values = [
    { icon: <Globe className="h-5 w-5" />, title: t.v1t, desc: t.v1d },
    { icon: <MousePointerClick className="h-5 w-5" />, title: t.v2t, desc: t.v2d },
    { icon: <LayoutGrid className="h-5 w-5" />, title: t.v3t, desc: t.v3d },
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

      {/* ---------------- WHO IT'S FOR ---------------- */}
      <section className="px-5 sm:px-8 md:px-14 py-16 sm:py-24 border-t border-black/5">
        <div className="max-w-2xl space-y-6 text-[15px] leading-relaxed text-black/65">
          <p>{t.p1}</p>
          <p>{t.p2}</p>
          <p>{t.p3}</p>
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
            <div key={v.title} className={`group ${i % 2 === 0 ? "-rotate-[0.5deg]" : "rotate-[0.6deg]"} hover:rotate-0 transition-transform duration-300`}>
              <div className="relative rounded-2xl border-2 border-white/15 bg-white/[0.06] p-6 backdrop-blur-sm group-hover:bg-white/[0.1] group-hover:-translate-x-1 group-hover:-translate-y-1 transition-all">
                <div className="h-10 w-10 rounded-2xl border-2 border-white/20 bg-[#FF8254]/15 text-[#FF8254] flex items-center justify-center">
                  {v.icon}
                </div>
                <h3 className="mt-5 text-[16px] font-semibold leading-tight text-white">{v.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-white/65">{v.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-14 text-[15px] leading-relaxed text-white/65">
          {t.ctaLine}{" "}
          <Link to="/services" className="inline-flex items-center gap-1 font-semibold text-white">
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
