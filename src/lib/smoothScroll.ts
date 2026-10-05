import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";

// Smooth wheel scrolling for the landing page, plus the skew: the page leans
// with the scroll speed and settles back when you stop. The skew runs only on
// a mouse/trackpad. On phones it stuttered (a page-height layer tilted on
// every touch frame), so they get plain native scrolling. One quickTo is
// reused instead of a fresh tween per scroll event, and the drifting accent
// shapes pause while the page moves (html.is-scrolling), so a scroll frame
// only re-tilts the page instead of also re-placing a dozen animated shapes.
export function useSmoothScroll(enabled = true, skewId = "scroll-skew") {
  useEffect(() => {
    if (!enabled) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => 1 - Math.pow(1 - t, 4),
    });

    const el = document.getElementById(skewId);
    const skew = !!el
      && window.matchMedia("(pointer: fine)").matches
      && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let resetTimeout: ReturnType<typeof setTimeout>;

    if (skew && el) {
      el.style.willChange = "transform";
      const skewTo = gsap.quickTo(el, "skewY", { duration: 0.4, ease: "power3.out" });
      const root = document.documentElement;
      lenis.on("scroll", (e: { velocity: number }) => {
        skewTo(gsap.utils.clamp(-2.8, 2.8, e.velocity * 0.48));
        root.classList.add("is-scrolling");
        clearTimeout(resetTimeout);
        resetTimeout = setTimeout(() => { skewTo(0); root.classList.remove("is-scrolling"); }, 120);
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
      document.documentElement.classList.remove("is-scrolling");
      if (el) {
        gsap.killTweensOf(el);
        gsap.set(el, { clearProps: "transform,willChange" });
      }
    };
  }, [enabled, skewId]);
}
