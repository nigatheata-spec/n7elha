import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, Play, Mail, Github, Twitter, Instagram } from "lucide-react";
import logoMark from "@/assets/logo-mark.png";

export const SiteFooter = () => {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const t = isAr
    ? {
        ctaTitle: "جاهز تجرّب نحلها مع فصلك؟",
        ctaSub: "إنشاء الحساب مجاني، وأول اختبار يحتاج دقائق فقط.",
        ctaBtn: "أنشئ حسابك الآن",
        ctaJoin: "ادخل كطالب",
        footerTagline: "منصة الاختبارات التفاعلية للمعلمين باللغة العربية.",
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
        footerRights: "© 2026 نحلها. جميع الحقوق محفوظة.",
      }
    : {
        ctaTitle: "Ready to try n7elha with your class?",
        ctaSub: "Creating an account is free, and your first quiz takes just minutes.",
        ctaBtn: "Create your account",
        ctaJoin: "Join as student",
        footerTagline: "The interactive quiz platform built for Arabic-speaking classrooms.",
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
        footerRights: "© 2026 n7elha. All rights reserved.",
      };

  return (
    <footer className="relative bg-[#2B3F45] text-white">

      {/* CTA card — pops up from the footer top */}
      <div className="px-5 sm:px-8 md:px-14">
        <div className="relative -top-10 rounded-[24px] bg-white border-2 border-[hsl(var(--nb-border))] shadow-[6px_6px_0_0_hsl(var(--nb-border))] p-8 sm:p-12 md:p-14 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="max-w-xl">
            <h3 className="text-[24px] sm:text-[32px] font-semibold tracking-tight leading-[1.15] text-[#2B3F45]">
              {t.ctaTitle}
            </h3>
            <p className="mt-3 text-black/55 text-[15px]">{t.ctaSub}</p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <Link
              to={user ? "/app" : "/auth?mode=signup"}
              className="inline-flex items-center gap-2 rounded-full border-2 border-[hsl(var(--nb-border))] bg-[#2B3F45] text-white px-6 py-3 text-[14px] font-semibold shadow-[4px_4px_0_0_hsl(var(--nb-border))] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_hsl(var(--nb-border))] transition-all"
            >
              {t.ctaBtn}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              to="/play"
              className="inline-flex items-center gap-2 rounded-full border-2 border-[hsl(var(--nb-border))] bg-white text-[#2B3F45] px-6 py-3 text-[14px] font-semibold shadow-[4px_4px_0_0_hsl(var(--nb-border))] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_hsl(var(--nb-border))] transition-all"
            >
              {t.ctaJoin}
              <Play className="h-4 w-4 fill-[#2B3F45]" />
            </Link>
          </div>
        </div>
      </div>

      {/* Footer content */}
      <div className="px-5 sm:px-8 md:px-14 pb-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2">
              <img src={logoMark} alt="n7elha" className="h-8 w-8 object-contain brightness-0 invert" />
              <span className="text-[17px] font-medium tracking-tight text-white">n7elha</span>
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
              <a href="mailto:hello@n7elha.com" className="h-9 w-9 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:bg-white hover:text-[#2B3F45] transition">
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
            { label: t.footerContact, to: "/partners" },
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
