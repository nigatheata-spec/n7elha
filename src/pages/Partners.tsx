import { useTranslation } from "react-i18next";
import { Mail, Twitter, Instagram, Github, School, UserRound } from "lucide-react";
import commas from "@/assets/doodles/comma-pair.png";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Seo } from "@/components/Seo";

const Partners = () => {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const t = isAr
    ? {
        kicker: "الشركاء",
        title: "لنتحدث عن فصلك أو مدرستك",
        sub: "سواء كنت تدير مدرسة كاملة أو معلمًا واحدًا يجرّب المنصة لأول مرة، فريقنا يسمعك.",

        schoolsTitle: "للمدارس والإدارات التعليمية",
        schoolsDesc: "نعمل مع مدارس السعودية التي تريد تفعيل نفلها على مستوى عدة صفوف أو معلمين، بما في ذلك دعم أنماط الألعاب الفعلية للفصول التي لا تملك أجهزة كافية لكل طالب.",
        schoolsCta: "راسلنا لمناقشة مدرستك",

        teachersTitle: "لمعلم فردي",
        teachersDesc: "عندك سؤال عن ميزة، أو واجهت مشكلة تقنية، أو فكرة لنمط لعب جديد؟ راسلنا مباشرة — نقرأ كل رسالة.",
        teachersCta: "تواصل مع الدعم",

        contactKicker: "طرق التواصل",
        contactTitle: "راسلنا مباشرة",
        emailLabel: "البريد الإلكتروني",
        socialLabel: "تابعنا",
      }
    : {
        kicker: "PARTNERS",
        title: "Let's talk about your classroom or school",
        sub: "Whether you run a whole school or you're one teacher trying the platform for the first time, our team is listening.",

        schoolsTitle: "For schools and districts",
        schoolsDesc: "We work with schools in Saudi Arabia that want to roll out nefelha across multiple classes or teachers, including support for Physical Games mode in classrooms without a device per student.",
        schoolsCta: "Email us about your school",

        teachersTitle: "For an individual teacher",
        teachersDesc: "Have a question about a feature, hit a technical issue, or have an idea for a new game mode? Reach out directly — we read every message.",
        teachersCta: "Contact support",

        contactKicker: "GET IN TOUCH",
        contactTitle: "Reach us directly",
        emailLabel: "Email",
        socialLabel: "Follow us",
      };

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: "hsl(var(--cream-panel))", fontFamily: "'Outfit', 'Almarai', system-ui, sans-serif" }}
    >
      <Seo
        path="/partners"
        titleAr="تواصل معنا — لمدارس ومعلمي السعودية"
        titleEn="Contact Us — For Schools and Teachers in Saudi Arabia"
        descriptionAr="سواء كنت تدير مدرسة كاملة في السعودية أو معلمًا يجرّب نفلها لأول مرة، فريقنا يسمعك. تواصل معنا للشراكات أو الدعم الفني."
        descriptionEn="Whether you run a whole school in Saudi Arabia or you're one teacher trying nefelha for the first time, our team is listening. Reach out for partnerships or support."
      />
      <SiteNav />

      {/* ---------------- HERO ---------------- */}
      <section className="wrap relative overflow-hidden px-5 sm:px-8 md:px-14 pt-10 sm:pt-16 pb-14 sm:pb-20">
        <img src={commas} alt="" aria-hidden className="pointer-events-none absolute end-[6%] top-10 w-24 opacity-25 rotate-6 hidden md:block" />
        <span className={`text-[12px] font-semibold text-[#3F5A63] ${isAr ? "tracking-normal" : "tracking-[0.25em]"}`}>{t.kicker}</span>
        <h1
          className="mt-3 max-w-2xl leading-[1.1] tracking-tight text-[32px] sm:text-[46px]"
          style={{ fontFamily: "'ArslanWessam', 'Almarai', sans-serif", color: "#3F5A63" }}
        >
          {t.title}
        </h1>
        <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-black/65">{t.sub}</p>
      </section>

      {/* ---------------- TWO PATHS ---------------- */}
      <section className="wrap px-5 sm:px-8 md:px-14 py-20 sm:py-28">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="-rotate-[0.4deg] hover:rotate-0 transition-transform duration-300">
            <div className="relative rounded-2xl border-2 border-[hsl(var(--nb-border))] bg-white p-7 shadow-[5px_5px_0_0_hsl(var(--nb-border))]">
              <div className="h-12 w-12 rounded-2xl border-2 border-[hsl(var(--nb-border))] bg-[#3F5A63] text-white flex items-center justify-center">
                <School className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-[18px] font-semibold leading-tight" style={{ color: "#3F5A63" }}>{t.schoolsTitle}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-black/65">{t.schoolsDesc}</p>
              <a
                href="mailto:hello@nefelha.com?subject=School%20partnership"
                className="mt-5 inline-flex items-center gap-2 rounded-full border-2 border-[hsl(var(--nb-border))] bg-[#3F5A63] text-white px-5 py-2.5 text-[13px] font-semibold shadow-[3px_3px_0_0_hsl(var(--nb-border))] hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_hsl(var(--nb-border))] transition-all"
              >
                <Mail className="h-4 w-4" />
                {t.schoolsCta}
              </a>
            </div>
          </div>

          <div className="rotate-[0.5deg] hover:rotate-0 transition-transform duration-300">
            <div className="relative rounded-2xl border-2 border-[hsl(var(--nb-border))] bg-white p-7 shadow-[5px_5px_0_0_hsl(var(--nb-border))]">
              <div className="h-12 w-12 rounded-2xl border-2 border-[hsl(var(--nb-border))] bg-[#8FC44A] text-[#3F5A63] flex items-center justify-center">
                <UserRound className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-[18px] font-semibold leading-tight" style={{ color: "#3F5A63" }}>{t.teachersTitle}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-black/65">{t.teachersDesc}</p>
              <a
                href="mailto:hello@nefelha.com?subject=Support"
                className="mt-5 inline-flex items-center gap-2 rounded-full border-2 border-[hsl(var(--nb-border))] bg-white text-[#3F5A63] px-5 py-2.5 text-[13px] font-semibold shadow-[3px_3px_0_0_hsl(var(--nb-border))] hover:bg-[#3F5A63] hover:text-white hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_hsl(var(--nb-border))] transition-all"
              >
                <Mail className="h-4 w-4" />
                {t.teachersCta}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- CONTACT DETAILS ---------------- */}
      <section className="bg-[#14212A] text-white px-5 sm:px-8 md:px-14 py-20 sm:py-28"><div className="wrap">
        <span className={`text-[12px] font-semibold text-[#8FC44A] ${isAr ? "tracking-normal" : "tracking-[0.25em]"}`}>{t.contactKicker}</span>
        <h2 className="mt-3 text-[26px] sm:text-[36px] tracking-tight leading-[1.15] text-white" style={{ fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}>
          {t.contactTitle}
        </h2>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a
            href="mailto:hello@nefelha.com"
            className="inline-flex items-center gap-2 rounded-full border-2 border-[#22333A] bg-white px-5 py-2.5 text-[14px] font-medium text-black shadow-[3px_3px_0_0_#22333A] hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_#22333A] transition-all"
          >
            <Mail className="h-4 w-4 text-[#3F5A63]" />
            hello@nefelha.com
          </a>

          <div className="flex items-center gap-2">
            <span className="text-[13px] text-white/55">{t.socialLabel}</span>
            <a href="#" className="h-9 w-9 rounded-full border-2 border-[#22333A] bg-white text-[#3F5A63] flex items-center justify-center shadow-[2px_2px_0_0_#22333A] hover:translate-x-px hover:translate-y-px hover:shadow-[1px_1px_0_0_#22333A] transition-all">
              <Twitter className="h-4 w-4" />
            </a>
            <a href="#" className="h-9 w-9 rounded-full border-2 border-[#22333A] bg-white text-[#3F5A63] flex items-center justify-center shadow-[2px_2px_0_0_#22333A] hover:translate-x-px hover:translate-y-px hover:shadow-[1px_1px_0_0_#22333A] transition-all">
              <Instagram className="h-4 w-4" />
            </a>
            <a href="#" className="h-9 w-9 rounded-full border-2 border-[#22333A] bg-white text-[#3F5A63] flex items-center justify-center shadow-[2px_2px_0_0_#22333A] hover:translate-x-px hover:translate-y-px hover:shadow-[1px_1px_0_0_#22333A] transition-all">
              <Github className="h-4 w-4" />
            </a>
          </div>
        </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
};

export default Partners;
