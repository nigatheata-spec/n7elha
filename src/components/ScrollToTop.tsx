import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

/* React Router keeps the window scroll offset across navigations, so leaving a
   scrolled landing page dropped you into the middle of the next one. Reset before
   paint (layout effect) so the new page is never briefly shown at the old offset.
   Skipped when the browser is restoring a back/forward position. */
export const ScrollToTop = () => {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (window.history.scrollRestoration) window.history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);

  return null;
};
