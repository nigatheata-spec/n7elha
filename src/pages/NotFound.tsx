import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Home, SearchX } from "lucide-react";
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
      className="min-h-screen w-full p-3 sm:p-6 lg:p-12 flex flex-col items-center justify-center"
      style={{ background: "#EBDFC7", fontFamily: "'Outfit', 'Almarai', system-ui, sans-serif" }}
    >
      <Seo
        path={location.pathname}
        titleAr="الصفحة غير موجودة"
        titleEn="Page Not Found"
        descriptionAr="يبدو أن هذا الرابط انتقل أو لم يعد موجوداً."
        descriptionEn="This link may have moved or no longer exists."
        index={false}
      />
      <div
        className="relative w-full max-w-[560px] rounded-[20px] sm:rounded-[28px] overflow-hidden shadow-[0_24px_70px_-38px_rgba(63,90,99,0.35)] bg-white p-8 sm:p-12 text-center"
      >
        <span className="pointer-events-none absolute -bottom-4 -right-4 h-8 w-8 rounded-full border-2 border-[#8FC44A]/40 select-none" />

        <Link to="/" className="inline-flex items-center gap-2 mb-8">
          <img src={logoMark} alt="nefelha" className="h-8 w-8 object-contain" />
          <span className="text-[17px] font-medium tracking-tight text-black">{isAr ? "نفلها" : "nefelha"}</span>
        </Link>

        <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-[#3F5A63]/10 text-[#3F5A63] flex items-center justify-center">
          <SearchX className="h-8 w-8" />
        </div>

        <p className="text-6xl font-semibold tracking-tight text-[#3F5A63] mb-2">{copy.code}</p>
        <h1 className="text-xl font-medium text-black mb-2">{copy.title}</h1>
        <p className="text-sm text-black/60 mb-8">{copy.sub}</p>

        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full bg-[#3F5A63] text-white px-6 py-3 text-[14px] font-medium hover:bg-[#3F5A63]/90 transition"
        >
          <Home className="h-4 w-4" />
          {copy.home}
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
