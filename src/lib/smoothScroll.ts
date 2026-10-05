import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";

// Smooth wheel scrolling for the landing page, plus the skew: the page leans
// with the scroll speed and settles back when you stop.
//
// The skew is applied per section ([data-skew]), and only to the sections on
// or near the screen; the rest are left untransformed and off the GPU. Tilting
// the whole page as one layer meant re-compositing the full page height every
// frame, which stuttered. skewY moves a point by an amount that depends only on
// its x, so stacked full-width sections tilted separately still line up
// exactly at their edges. Sections carry isolate/z classes so switching their
// transform on and off never changes what paints over what.
//
// Mouse/trackpad only: on phones the tilt stuttered and a finger scroll barely
// triggers it, so they get plain native scrolling.
export function useSmoothScroll(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => 1 - Math.pow(1 - t, 4),
    });

    const skew = window.matchMedia("(pointer: fine)").matches
      && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const els = skew ? Array.from(document.querySelectorAll<HTMLElement>("[data-skew]")) : [];
    const near = new Set<HTMLElement>();
    const state = { skew: 0 };
    const apply = () => {
      const t = state.skew ? `skewY(${state.skew.toFixed(3)}deg)` : "";
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

    let resetTimeout: ReturnType<typeof setTimeout>;
    if (skew) {
      const skewTo = gsap.quickTo(state, "skew", { duration: 0.4, ease: "power3.out", onUpdate: apply });
      lenis.on("scroll", (e: { velocity: number }) => {
        skewTo(gsap.utils.clamp(-2.8, 2.8, e.velocity * 0.48));
        clearTimeout(resetTimeout);
        resetTimeout = setTimeout(() => skewTo(0), 120);
      });
    }

    // Each frame schedules a fresh id, so cleanup has to cancel the LATEST one.
    // Cancelling only the first left the loop running against a destroyed Lenis,
    // leaking another loop every time the landing page remounted.
    let rafId = 0;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(resetTimeout);
      lenis.destroy();
      io.disconnect();
      gsap.killTweensOf(state);
      els.forEach(el => { el.style.transform = ""; el.style.willChange = ""; });
    };
  }, [enabled]);
}
