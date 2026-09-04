import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Home } from "lucide-react";
import logoMark from "@/assets/logo-mark.png";
import { Seo } from "@/components/Seo";

const NotFound = () => {
  const location = useLocation();
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const copy = isAr
    ? {
        code: "404",
        title: "الصفحة غير موجودة",
        sub: "يبدو أن هذا الرابط انتقل أو لم يعد موجوداً.",
        home: "العودة للرئيسية",
      }
    : {
        code: "404",
        title: "Page not found",
        sub: "This link may have moved or no longer exists.",
        home: "Back to home",
      };

  return (
    <div
      dir="ltr"
      className="relative min-h-screen w-full flex flex-col items-center justify-center p-6 overflow-hidden"
      style={{ background: "#1a2634" }}
    >
      <Seo
        path={location.pathname}
        titleAr="الصفحة غير موجودة"
        titleEn="Page Not Found"
        descriptionAr="يبدو أن هذا الرابط انتقل أو لم يعد موجوداً."
        descriptionEn="This link may have moved or no longer exists."
        index={false}
      />

      {/* 404 background */}
      <div className="absolute inset-0 flex items-center justify-center md:items-end md:pb-0 pointer-events-none overflow-hidden">
        <div className="flex flex-col md:flex-row items-start justify-center gap-2 opacity-[0.15] transform scale-100 md:scale-150">
          <p
            className="text-[230px] md:text-[575px] font-black tracking-tighter leading-none"
            style={{ color: "#8FC44A" }}
          >
            4
          </p>
          <p
            className="text-[230px] md:text-[575px] font-black tracking-tighter leading-none"
            style={{ color: "#8FC44A" }}
          >
            0
          </p>
          <p
            className="text-[230px] md:text-[575px] font-black tracking-tighter leading-none"
            style={{ color: "#8FC44A" }}
          >
            4
          </p>
          <p
            className="hidden md:block text-[575px] font-black tracking-tighter leading-none"
            style={{ color: "#8FC44A" }}
          >
            !
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-2xl text-center space-y-6 flex flex-col items-center">
        <h1
          className="text-6xl sm:text-7xl font-black tracking-tight"
          style={{ color: "white", fontFamily: "ArslanWessam, system-ui" }}
        >
          {copy.title}
        </h1>

        <p className="text-xl text-white/60 max-w-lg leading-relaxed">
          {copy.sub}
        </p>

        {/* CTA */}
        <div className="pt-4">
          <Link
            to="/"
            className="relative inline-flex items-center gap-2 rounded-full bg-black text-white px-8 py-4 text-[15px] font-bold border-2 border-black transition-all duration-150 hover:translate-x-1 hover:translate-y-1"
            style={{ boxShadow: "6px 6px 0 0 #000" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = "4px 4px 0 0 #000";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = "6px 6px 0 0 #000";
            }}
          >
            <img src={logoMark} alt="" className="h-4 w-4 object-contain filter brightness-0 invert" />
            {copy.home}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
