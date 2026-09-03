// ── Contact us ──────────────────────────────────────────────────────────────
// Direct contact info only, no card chrome — a teacher with a question wants
// the fastest way to reach a human, not a form or a grid of boxes to read
// through first.

import { useTranslation } from "react-i18next";
import { Mail, Phone, School, UserRound, GraduationCap } from "lucide-react";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Seo } from "@/components/Seo";

const SUPPORT_EMAIL = "hello@nefelha.com";
// TODO: placeholder — swap for the real support line once one exists.
const SUPPORT_PHONE = "+966 50 000 0000";

const Contact = () => {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const t = isAr
    ? {
        kicker: "تواصل معنا",
        title: "عندك سؤال؟ إحنا نسمعك",
        emailLabel: "البريد الإلكتروني",
        phoneLabel: "الهاتف",
        replyTime: "الرد خلال يوم عمل",
        clientsTitle: "نشتغل مع",
        schools: "المدارس",
        academies: "الأكاديميات",
        teachers: "المعلمين المستقلين",
      }
    : {
        kicker: "CONTACT",
        title: "Have a question? We're listening",
        emailLabel: "Email",
        phoneLabel: "Phone",
        replyTime: "Reply within a working day",
        clientsTitle: "Who we work with",
        schools: "Schools",
        academies: "Academies",
        teachers: "Independent teachers",
      };

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: "hsl(var(--cream-panel))", fontFamily: "'Outfit', 'Almarai', system-ui, sans-serif" }}
    >
      <Seo
        path="/contact"
        titleAr="تواصل معنا — نفلها"
        titleEn="Contact Us — nefelha"
        descriptionAr="راسل فريق نفلها. أسئلة المعلمين، شراكات المدارس، والدعم الفني — نقرأ كل رسالة ونرد خلال يوم عمل."
        descriptionEn="Get in touch with the nefelha team. Teacher questions, school partnerships, and technical support — we read every message and reply within a working day."
      />
      <SiteNav />

      {/* ---------------- HERO ---------------- */}
      <section className="wrap px-5 sm:px-8 md:px-14 pt-10 sm:pt-16 pb-14">
        <span className={`text-[12px] font-semibold text-[#3F5A63] ${isAr ? "tracking-normal" : "tracking-[0.25em]"}`}>
          {t.kicker}
        </span>
        <h1
          className="mt-3 max-w-2xl leading-[1.1] tracking-tight text-[32px] sm:text-[46px]"
          style={{ fontFamily: "'ArslanWessam', 'Almarai', sans-serif", color: "#3F5A63" }}
        >
          {t.title}
        </h1>
      </section>

      {/* ---------------- CONTACT INFO — plain, no cards ---------------- */}
      <section className="wrap px-5 sm:px-8 md:px-14 pb-20 sm:pb-28">
        <div className="max-w-xl divide-y divide-black/10 border-t border-b border-black/10">
          <a href={`mailto:${SUPPORT_EMAIL}`} className="group flex items-center gap-4 py-6">
            <Mail className="h-5 w-5 shrink-0" style={{ color: "#8FC44A" }} />
            <div className="min-w-0">
              <div className="text-[11px] font-semibold tracking-widest uppercase text-black/40">{t.emailLabel}</div>
              <div className="text-[19px] font-semibold group-hover:underline underline-offset-4" style={{ color: "#3F5A63" }} dir="ltr">
                {SUPPORT_EMAIL}
              </div>
            </div>
            <span className="ms-auto text-[12px] text-black/35 shrink-0">{t.replyTime}</span>
          </a>

          <a href={`tel:${SUPPORT_PHONE.replace(/\s+/g, "")}`} className="group flex items-center gap-4 py-6">
            <Phone className="h-5 w-5 shrink-0" style={{ color: "#8FC44A" }} />
            <div className="min-w-0">
              <div className="text-[11px] font-semibold tracking-widest uppercase text-black/40">{t.phoneLabel}</div>
              <div className="text-[19px] font-semibold group-hover:underline underline-offset-4" style={{ color: "#3F5A63" }} dir="ltr">
                {SUPPORT_PHONE}
              </div>
            </div>
          </a>
        </div>

        <div className="mt-10 max-w-xl">
          <div className="text-[11px] font-semibold tracking-widest uppercase text-black/40">{t.clientsTitle}</div>
          <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
            <span className="flex items-center gap-2 text-[15px] font-medium" style={{ color: "#3F5A63" }}>
              <School className="h-4 w-4 opacity-60" />{t.schools}
            </span>
            <span className="flex items-center gap-2 text-[15px] font-medium" style={{ color: "#3F5A63" }}>
              <GraduationCap className="h-4 w-4 opacity-60" />{t.academies}
            </span>
            <span className="flex items-center gap-2 text-[15px] font-medium" style={{ color: "#3F5A63" }}>
              <UserRound className="h-4 w-4 opacity-60" />{t.teachers}
            </span>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
};

export default Contact;
