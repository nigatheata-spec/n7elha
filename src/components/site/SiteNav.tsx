import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "react-i18next";
import { LangToggle } from "@/components/LangToggle";
import { triggerLangTransition } from "@/lib/langTransitionBus";
import { Menu, X, Languages } from "lucide-react";
import { useEffect, useState } from "react";
import logoMark from "@/assets/logo-mark.png";

export const SiteNav = () => {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const t = isAr
    ? { home: "الرئيسية", about: "من نحن", services: "الخدمات", partners: "الشركاء", login: "دخول", signup: "تسجيل", dashboard: "لوحتي", joinGame: "ادخل اللعبة" }
    : { home: "HOME", about: "ABOUT", services: "FEATURES", partners: "CONTACT", login: "LOG IN", signup: "SIGN UP", dashboard: "DASHBOARD", joinGame: "JOIN GAME" };


  return (
    <>
      <nav className="px-5 sm:px-8 md:px-10 pt-5 sm:pt-6">
        <div className="flex items-center justify-between gap-3 bg-white/90 backdrop-blur-md rounded-2xl px-4 py-3 border-2 border-[hsl(var(--nb-border))] shadow-[4px_4px_0_0_hsl(var(--nb-border))]">

          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={logoMark} alt="nfelha" className="h-8 w-8 object-contain" />
            <span className="text-[17px] font-medium tracking-tight text-black">nfelha</span>
          </Link>

          <ul className={`hidden lg:flex items-center gap-10 text-[13px] font-medium text-black/80 ${isAr ? "tracking-normal" : "tracking-[0.18em]"}`}>
            {[
              { to: "/", label: t.home },
              { to: "/services", label: t.services },
              { to: "/about", label: t.about },
              { to: "/partners", label: t.partners },
            ].map(item => {
              const active = pathname === item.to;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                    className={`relative py-1 transition-colors hover:text-black ${active ? "text-black" : ""}`}
                  >
                    {item.label}
                    {/* underline marks the current page, which the nav never indicated */}
                    <span
                      className={`absolute inset-x-0 -bottom-0.5 h-[2px] rounded-full bg-[#FF8254] origin-center transition-transform duration-300 ${active ? "scale-x-100" : "scale-x-0"}`}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="hidden md:flex items-center gap-2">
            <LangToggle variant="pill" />
            <Link
              to="/play"
              className={`px-4 py-2 rounded-full border-2 border-[hsl(var(--nb-border))] bg-white text-[#3F5A63] text-[13px] font-medium shadow-[3px_3px_0_0_hsl(var(--nb-border))] hover:bg-[#3F5A63] hover:text-white hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_hsl(var(--nb-border))] transition-all ${isAr ? "" : "tracking-wider"}`}
            >
              {t.joinGame}
            </Link>
            {user ? (
              <Link to="/app" className={`px-5 py-2 rounded-full border-2 border-[hsl(var(--nb-border))] bg-[#3F5A63] text-white text-[13px] font-medium shadow-[3px_3px_0_0_hsl(var(--nb-border))] hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_hsl(var(--nb-border))] transition-all ${isAr ? "" : "tracking-wider"}`}>
                {t.dashboard}
              </Link>
            ) : (
              <>
                <Link
                  to="/auth"
                  className={`px-5 py-2 rounded-full border-2 border-[hsl(var(--nb-border))] bg-white text-[#3F5A63] text-[13px] font-medium shadow-[3px_3px_0_0_hsl(var(--nb-border))] hover:bg-[#3F5A63] hover:text-white hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_hsl(var(--nb-border))] transition-all ${isAr ? "" : "tracking-wider"}`}
                >
                  {t.login}
                </Link>
                <Link
                  to="/auth?mode=signup"
                  className={`px-5 py-2 rounded-full border-2 border-[hsl(var(--nb-border))] bg-[#3F5A63] text-white text-[13px] font-medium shadow-[3px_3px_0_0_hsl(var(--nb-border))] hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_hsl(var(--nb-border))] transition-all ${isAr ? "" : "tracking-wider"}`}
                >
                  {t.signup}
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen(true)}
            className="md:hidden h-10 w-10 rounded-full border border-black/15 flex items-center justify-center text-black"
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </nav>

      {/* mobile menu backdrop */}
      <div
        onClick={() => setMenuOpen(false)}
        className={`md:hidden fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${menuOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        aria-hidden="true"
      />

      {/* mobile menu drawer */}
      <div
        className={`md:hidden fixed inset-y-0 right-0 z-50 w-[82%] max-w-[320px] bg-white shadow-[-8px_0_40px_-12px_rgba(0,0,0,0.35)] transition-transform duration-300 ease-out flex flex-col ${menuOpen ? "translate-x-0" : "translate-x-full"}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!menuOpen}
      >
        <div className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-black/[0.06]">
          <Link to="/" className="flex items-center gap-2 shrink-0" onClick={() => setMenuOpen(false)}>
            <img src={logoMark} alt="nfelha" className="h-7 w-7 object-contain" />
            <span className="text-[16px] font-medium tracking-tight text-black">nfelha</span>
          </Link>
          <button
            onClick={() => setMenuOpen(false)}
            className="h-9 w-9 rounded-full border border-black/15 flex items-center justify-center text-black"
            aria-label="Close menu"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="px-5 py-6 flex flex-col gap-3 overflow-y-auto">
          <button
            onClick={() => { triggerLangTransition(); i18n.changeLanguage(isAr ? "en" : "ar"); }}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full border-2 border-[hsl(var(--nb-border))] bg-white text-[#3F5A63] text-[13px] tracking-wider font-medium shadow-[3px_3px_0_0_hsl(var(--nb-border))]"
          >
            <Languages className="h-4 w-4" />
            {isAr ? "English" : "العربية"}
          </button>
          <Link to="/" onClick={() => setMenuOpen(false)} aria-current={pathname === "/" ? "page" : undefined} className={`w-full px-4 py-2.5 rounded-full border-2 border-[hsl(var(--nb-border))] text-[13px] tracking-wider font-medium text-center shadow-[3px_3px_0_0_hsl(var(--nb-border))] ${pathname === "/" ? "bg-[#3F5A63] text-white" : "bg-white text-[#3F5A63]"}`}>
            {t.home}
          </Link>
          <Link to="/services" onClick={() => setMenuOpen(false)} aria-current={pathname === "/services" ? "page" : undefined} className={`w-full px-4 py-2.5 rounded-full border-2 border-[hsl(var(--nb-border))] text-[13px] tracking-wider font-medium text-center shadow-[3px_3px_0_0_hsl(var(--nb-border))] ${pathname === "/services" ? "bg-[#3F5A63] text-white" : "bg-white text-[#3F5A63]"}`}>
            {t.services}
          </Link>
          <Link to="/about" onClick={() => setMenuOpen(false)} aria-current={pathname === "/about" ? "page" : undefined} className={`w-full px-4 py-2.5 rounded-full border-2 border-[hsl(var(--nb-border))] text-[13px] tracking-wider font-medium text-center shadow-[3px_3px_0_0_hsl(var(--nb-border))] ${pathname === "/about" ? "bg-[#3F5A63] text-white" : "bg-white text-[#3F5A63]"}`}>
            {t.about}
          </Link>
          <Link to="/partners" onClick={() => setMenuOpen(false)} aria-current={pathname === "/partners" ? "page" : undefined} className={`w-full px-4 py-2.5 rounded-full border-2 border-[hsl(var(--nb-border))] text-[13px] tracking-wider font-medium text-center shadow-[3px_3px_0_0_hsl(var(--nb-border))] ${pathname === "/partners" ? "bg-[#3F5A63] text-white" : "bg-white text-[#3F5A63]"}`}>
            {t.partners}
          </Link>
          <Link to="/play" onClick={() => setMenuOpen(false)} className="w-full px-4 py-2.5 rounded-full border-2 border-[hsl(var(--nb-border))] bg-white text-[#3F5A63] text-[13px] tracking-wider font-medium text-center shadow-[3px_3px_0_0_hsl(var(--nb-border))]">
            {t.joinGame}
          </Link>
          {user ? (
            <Link to="/app" onClick={() => setMenuOpen(false)} className="w-full px-5 py-2.5 rounded-full border-2 border-[hsl(var(--nb-border))] bg-white text-[#3F5A63] text-[13px] tracking-wider font-medium text-center shadow-[3px_3px_0_0_hsl(var(--nb-border))]">
              {t.dashboard}
            </Link>
          ) : (
            <>
              <Link to="/auth" onClick={() => setMenuOpen(false)} className="w-full px-5 py-2.5 rounded-full border-2 border-[hsl(var(--nb-border))] bg-white text-[#3F5A63] text-[13px] tracking-wider font-medium text-center shadow-[3px_3px_0_0_hsl(var(--nb-border))]">
                {t.login}
              </Link>
              <Link to="/auth?mode=signup" onClick={() => setMenuOpen(false)} className="w-full px-5 py-2.5 rounded-full border-2 border-[hsl(var(--nb-border))] bg-white text-[#3F5A63] text-[13px] tracking-wider font-medium text-center shadow-[3px_3px_0_0_hsl(var(--nb-border))]">
                {t.signup}
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );
};
