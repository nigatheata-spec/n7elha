import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, Mail, Github, Twitter, Instagram } from "lucide-react";
import logoMark from "@/assets/logo-mark.png";
import { LIME } from "@/components/teacher/DashboardAccents";

export const SiteFooter = () => {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const t = isAr
    ? {
        ctaTitle: "خلّ طلابك يجرّبون حصة يحبونها",
        ctaSub: "مجاني تبدأ، وبدقايق تشغّل. جرّب نفلها مع فصلك وشوف الفرق من أول حصة.",
        ctaBtn: "ابدأ معنا",
        footerTagline: "نخلي الطلاب يحبون التعلّم — تجربة تفاعلية للفصل العربي.",
        footerProduct: "المنتج",
        footerCompany: "الشركة",
        footerLegal: "قانوني",
        footerFeatures: "المميزات",
        footerHow: "كيف يعمل",
        footerPricing: "الأسعار",
        footerAbout: "من نحن",
        footerContact: "تواصل",
        footerCareers: "الوظائف",
        footerPrivacy: "الخصوصية",
        footerTerms: "الشروط",
        footerRights: "© 2026 نفلها. جميع الحقوق محفوظة.",
      }
    : {
        ctaTitle: "Let your students experience a class they actually love",
        ctaSub: "Free to start, minutes to launch. Try nefelha with your class and see the difference from session one.",
        ctaBtn: "Get started",
        footerTagline: "Make students love learning — interactive classroom experience for the Arabic world.",
        footerProduct: "Product",
        footerCompany: "Company",
        footerLegal: "Legal",
        footerFeatures: "Features",
        footerHow: "How it works",
        footerPricing: "Pricing",
        footerAbout: "About",
        footerContact: "Contact",
        footerCareers: "Careers",
        footerPrivacy: "Privacy",
        footerTerms: "Terms",
        footerRights: "© 2026 nefelha. All rights reserved.",
      };

  return (
    <footer className="relative text-white">

      {/* CTA: a lime shape with soft, uneven edges instead of a boxed card.
          It sits over the footer's wavy top so the two overlap like the
          shapes elsewhere on the page. The shape is drawn as one stretched
          path behind the content, so it grows with the text at any width. */}
      <div className="relative z-10 px-5 sm:px-8 md:px-14 -mb-14 sm:-mb-16">
        <div className="wrap relative">
          <svg aria-hidden viewBox="0 0 1000 300" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
            <path fill={LIME} d="M38 58C58 14 142 6 262 12C420 20 560 2 722 8C862 14 958 22 982 70C1002 118 992 198 978 238C960 288 862 296 722 290C562 284 402 298 252 292C122 288 32 284 16 236C2 190 18 104 38 58Z" />
          </svg>
          <div className="relative px-8 sm:px-14 md:px-16 py-10 sm:py-14 flex flex-col md:flex-row items-start md:items-center justify-between gap-7">
            <div className="max-w-xl">
              <h3 className="text-[24px] sm:text-[32px] font-semibold tracking-tight leading-[1.15] text-[#12262B]">
                {t.ctaTitle}
              </h3>
              <p className="mt-3 text-[#12262B]/70 text-[15px]">{t.ctaSub}</p>
            </div>
            <div className="shrink-0">
              <Link
                to={user ? "/app" : "/auth?mode=signup"}
                className="group inline-flex items-center gap-3 rounded-full border-2 border-[hsl(var(--nb-border))] bg-[#2B3F45] text-white pl-6 pr-2 py-2 text-[15px] font-medium shadow-[4px_4px_0_0_hsl(var(--nb-border))] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_hsl(var(--nb-border))] transition-all"
              >
                {t.ctaBtn}
                <span className="h-9 w-9 rounded-full bg-white text-[#2B3F45] flex items-center justify-center transition group-hover:rotate-12">
                  <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* the footer's wavy top edge */}
      <svg aria-hidden viewBox="0 0 1440 72" preserveAspectRatio="none" className="relative block w-full h-[72px] -mb-px">
        <path fill="#2B3F45" d="M0 30C240 66 500 8 780 36C1040 62 1250 12 1440 34V72H0Z" />
      </svg>

      <div className="bg-[#2B3F45] pt-16 sm:pt-20">
      {/* Footer content */}
      <div className="px-5 sm:px-8 md:px-14 pb-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2">
              <img src={logoMark} alt="nefelha" className="h-8 w-8 object-contain brightness-0 invert" />
              <span className="text-[17px] font-medium tracking-tight text-white">{isAr ? "نفلها" : "nefelha"}</span>
            </Link>
            <p className="mt-4 text-[13px] text-white/50 leading-relaxed max-w-xs">{t.footerTagline}</p>
            <div className="mt-5 flex gap-3">
              <a href="#" className="h-9 w-9 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:bg-white hover:text-[#2B3F45] transition">
                <Twitter className="h-4 w-4" />
              </a>
              <a href="#" className="h-9 w-9 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:bg-white hover:text-[#2B3F45] transition">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="#" className="h-9 w-9 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:bg-white hover:text-[#2B3F45] transition">
                <Github className="h-4 w-4" />
              </a>
              <a href="mailto:hello@nefelha.com" className="h-9 w-9 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:bg-white hover:text-[#2B3F45] transition">
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>

          <FooterCol title={t.footerProduct} items={[
            { label: t.footerFeatures, to: "/services" },
            { label: t.footerHow, to: "/services#how" },
            { label: t.footerPricing, to: "#" },
          ]} />
          <FooterCol title={t.footerCompany} items={[
            { label: t.footerAbout, to: "/about" },
            { label: t.footerContact, to: "/contact" },
            { label: t.footerCareers, to: "#" },
          ]} />
          <FooterCol title={t.footerLegal} items={[
            { label: t.footerPrivacy, to: "#" },
            { label: t.footerTerms, to: "#" },
          ]} />
        </div>

        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[12px] text-white/35">
          <span>{t.footerRights}</span>
          <span className="tracking-wider">Built for teachers.</span>
        </div>
      </div>
      </div>
    </footer>
  );
};

const FooterCol = ({ title, items }: { title: string; items: { label: string; to: string }[] }) => (
  <div>
    <h4 className="text-[12px] tracking-[0.2em] font-semibold text-white/50">{title}</h4>
    <ul className="mt-3 space-y-1.5">
      {items.map((it) => (
        <li key={it.label}>
          <Link to={it.to} className="text-[13px] text-white/60 hover:text-white transition">
            {it.label}
          </Link>
        </li>
      ))}
    </ul>
  </div>
);
