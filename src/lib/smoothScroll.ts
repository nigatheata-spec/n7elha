import { useEffect } from "react";
import gsap from "gsap";

// The landing page's scroll skew: the page leans with the scroll speed and
// settles back when you stop.
//
// Scrolling itself stays native. The page used to hand scrolling to Lenis,
// which moves the page from JavaScript every frame; Firefox and phones
// stuttered under it. Now the browser scrolls on its own and this only reads
// the speed from scroll events.
//
// The skew is applied per section ([data-skew]), and only to the sections on
// or near the screen; the rest stay untransformed and off the GPU. skewY moves
// a point by an amount that depends only on its x, so stacked full-width
// sections tilted separately still line up exactly at their edges. Sections
// carry isolate/z classes so switching their transform on and off never
// changes what paints over what.
//
// Runs on phones too: with scrolling left native, the tilt alone is light.
export function useSmoothScroll(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-skew]"));
    const near = new Set<HTMLElement>();
    const state = { skew: 0 };
    const apply = () => {
      const t = Math.abs(state.skew) > 0.01 ? `skewY(${state.skew.toFixed(3)}deg)` : "";
      near.forEach(el => { el.style.transform = t; });
    };

    // Promote a section a screen before it arrives, so it's ready when seen.
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        if (e.isIntersecting) {
          near.add(el);
          el.style.willChange = "transform";
        } else {
          near.delete(el);
          el.style.willChange = "";
          el.style.transform = "";
        }
      }
      apply();
    }, { rootMargin: "100% 0px" });
    els.forEach(el => io.observe(el));

    const skewTo = gsap.quickTo(state, "skew", { duration: 0.4, ease: "power3.out", onUpdate: apply });
    let lastY = window.scrollY, lastT = performance.now();
    let resetTimeout: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      const y = window.scrollY, t = performance.now();
      const perFrame = ((y - lastY) / Math.max(1, t - lastT)) * 16.7;   // px per 60fps frame
      lastY = y; lastT = t;
      skewTo(gsap.utils.clamp(-2.8, 2.8, perFrame * 0.48));
      clearTimeout(resetTimeout);
      resetTimeout = setTimeout(() => skewTo(0), 120);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(resetTimeout);
      io.disconnect();
      gsap.killTweensOf(state);
      els.forEach(el => { el.style.transform = ""; el.style.willChange = ""; });
    };
  }, [enabled]);
}
