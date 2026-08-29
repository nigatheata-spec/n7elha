import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Building2, Users, QrCode, BarChart3, ArrowUpRight } from "lucide-react";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Seo } from "@/components/Seo";
import { HeroProductScene } from "@/components/site/HeroProductScene";

const Schools = () => {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const t = isAr
    ? {
        kicker: "للمدارس",
        title: "نفلها لمدرستك بالكامل، لا لصف واحد فقط",
        sub: "منصة تفاعل صفي واحدة تُدار على مستوى المدرسة كلها — بلا حاجة لجهاز لكل طالب في كل صف.",

        f1Title: "تفعيل عبر عدة صفوف ومعلمين",
        f1Desc: "كل معلم يبني اختباراته الخاصة ويستضيف جلساته بشكل مستقل، وأنت تدير التفعيل على مستوى المدرسة دون أن تتوقف على معلم واحد.",
        f2Title: "يعمل حتى بلا جهاز لكل طالب",
        f2Desc: "نمط الألعاب الفعلية يستخدم لوحًا مطبوعًا ورموز QR يمسحها جهاز واحد فقط — مناسب تمامًا للفصول التي لا تملك تقنية كافية لكل طالب.",
        f3Title: "تقارير تفصيلية لكل جلسة",
        f3Desc: "بعد كل اختبار، تقرير واضح يوضح أداء كل طالب وكل سؤال على حدة، بالعربية أولًا.",

        seeKicker: "شكل الحصة",
        seeTitle: "هكذا تبدو الحصة عند التشغيل",
        seeSub: "شاشة المعلم على البروجكتر، وجوال الطالب في يده. رمز واحد يربطهما، ولا تطبيق يُحمَّل.",

        ctaKicker: "الخطوة التالية",
        ctaTitle: "لنتحدث عن مدرستك",
        ctaSub: "راسلنا بعدد الصفوف والمعلمين الذين تريد تفعيل نفلها لهم، وسنرد خلال يوم عمل.",
        ctaLink: "تواصل معنا",
      }
    : {
        kicker: "FOR SCHOOLS",
        title: "nefelha for your whole school, not just one class",
        sub: "One classroom engagement platform managed school-wide — no device-per-student requirement in every room.",

        f1Title: "Roll out across classes and teachers",
        f1Desc: "Each teacher builds their own quizzes and hosts their own sessions independently, while you manage adoption at the school level without depending on a single teacher.",
        f2Title: "Works without a device per student",
        f2Desc: "Physical Games mode uses a printed board and QR codes scanned by a single shared device — built for classrooms that don't have enough devices for every student.",
        f3Title: "Detailed reporting per session",
        f3Desc: "After every quiz, a clear report shows how each student performed on each question, Arabic-first.",

        seeKicker: "IN THE ROOM",
        seeTitle: "What a live session actually looks like",
        seeSub: "The teacher's screen on the projector, the student's phone in their hand. One code links them — nothing to install.",

        ctaKicker: "NEXT STEP",
        ctaTitle: "Let's talk about your school",
        ctaSub: "Tell us how many classes and teachers you want to roll nefelha out to, and we'll get back to you within a business day.",
        ctaLink: "Get in touch",
      };

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: "hsl(var(--cream-panel))", fontFamily: "'Outfit', 'Almarai', system-ui, sans-serif" }}
    >
      <Seo
        path="/schools"
        titleAr="نفلها للمدارس — منصة تعليمية للمدارس في السعودية"
        titleEn="nefelha for Schools — Student Engagement Platform for Saudi Schools"
        descriptionAr="منصة تعليمية للمدارس في السعودية: فعّل نفلها عبر عدة صفوف ومعلمين، بدعم كامل لفصول بلا جهاز لكل طالب عبر نمط الألعاب الفعلية."
        descriptionEn="A student engagement platform for schools in Saudi Arabia: roll out nefelha across multiple classes and teachers, with full support for classrooms without a device per student via Physical Games mode."
      />
      <SiteNav />

      {/* ---------------- HERO ---------------- */}
      <section className="wrap relative overflow-hidden px-5 sm:px-8 md:px-14 pt-10 sm:pt-16 pb-14 sm:pb-20">
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
      <section className="wrap px-5 sm:px-8 md:px-14 pb-16 sm:pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Feature icon={<Users className="h-5 w-5" />} title={t.f1Title} desc={t.f1Desc} tilt="-rotate-[0.6deg]" />
          <Feature icon={<QrCode className="h-5 w-5" />} title={t.f2Title} desc={t.f2Desc} tilt="rotate-[0.8deg]" />
          <Feature icon={<BarChart3 className="h-5 w-5" />} title={t.f3Title} desc={t.f3Desc} tilt="-rotate-[0.9deg]" />
        </div>
      </section>

      {/* ---------------- LIVE SESSION PREVIEW ---------------- */}
      <section className="wrap px-5 sm:px-8 md:px-14 pb-20 sm:pb-28 border-t border-black/5 pt-16 sm:pt-24">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] items-center gap-12 lg:gap-14">
          <div className="max-w-lg">
            <span className={`text-[12px] font-semibold text-[#8FC44A] ${isAr ? "tracking-normal" : "tracking-[0.25em]"}`}>{t.seeKicker}</span>
            <h2 className="mt-3 text-[26px] sm:text-[36px] tracking-tight leading-[1.15]" style={{ color: "#3F5A63", fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}>
              {t.seeTitle}
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-black/65">{t.seeSub}</p>
          </div>
          <div className="relative lg:pr-6">
            <HeroProductScene isAr={isAr} />
          </div>
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="bg-[#14212A] text-white px-5 sm:px-8 md:px-14 py-20 sm:py-28">
        <div className="wrap max-w-2xl">
          <div className="h-12 w-12 rounded-2xl border-2 border-[#0B1418] bg-[#8FC44A] text-[#3F5A63] flex items-center justify-center">
            <Building2 className="h-6 w-6" />
          </div>
          <span className={`mt-5 block text-[12px] font-semibold text-[#8FC44A] ${isAr ? "tracking-normal" : "tracking-[0.25em]"}`}>{t.ctaKicker}</span>
          <h2 className="mt-3 text-[26px] sm:text-[36px] tracking-tight leading-[1.15] text-white" style={{ fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}>
            {t.ctaTitle}
          </h2>
          <p className="mt-4 text-[15px] text-white/65 leading-relaxed">{t.ctaSub}</p>
          <Link
            to="/partners"
            className="mt-7 inline-flex items-center gap-2 rounded-full border-2 border-[#22333A] bg-white px-5 py-2.5 text-[14px] font-semibold text-[#14212A] shadow-[3px_3px_0_0_#22333A] hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_#22333A] transition-all"
          >
            {t.ctaLink}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
};

const Feature = ({ icon, title, desc, tilt = "rotate-[0.8deg]" }: { icon: React.ReactNode; title: string; desc: string; tilt?: string }) => (
  <div className={`group ${tilt} hover:rotate-0 transition-transform duration-300`}>
    <div className="relative h-full rounded-2xl border-2 border-[hsl(var(--nb-border))] bg-white p-6 shadow-[5px_5px_0_0_hsl(var(--nb-border))] group-hover:shadow-[8px_8px_0_0_hsl(var(--nb-border))] group-hover:-translate-x-1 group-hover:-translate-y-1 transition-all">
      <div className="h-10 w-10 rounded-2xl border-2 border-[hsl(var(--nb-border))] bg-[#3F5A63]/10 text-[#3F5A63] flex items-center justify-center group-hover:bg-[#3F5A63] group-hover:text-white transition-colors">
        {icon}
      </div>
      <h3 className="mt-5 text-[17px] font-semibold leading-tight" style={{ color: "#3F5A63" }}>{title}</h3>
      <p className="mt-2 text-[13.5px] leading-relaxed text-black/65">{desc}</p>
    </div>
  </div>
);

export default Schools;
