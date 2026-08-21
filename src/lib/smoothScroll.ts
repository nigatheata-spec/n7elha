import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function useSmoothScroll(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => 1 - Math.pow(1 - t, 4),
    });

    let resetTimeout: ReturnType<typeof setTimeout>;

    lenis.on("scroll", (e: { velocity: number }) => {
      ScrollTrigger.update();

      const v = gsap.utils.clamp(-2.8, 2.8, e.velocity * 0.48);

      gsap.to("#scroll-skew", {
        skewY: v,
        duration: 0.4,
        ease: "power3.out",
        overwrite: true,
      });

      clearTimeout(resetTimeout);
      resetTimeout = setTimeout(() => {
        gsap.to("#scroll-skew", { skewY: 0, duration: 0.6, ease: "power3.out" });
      }, 120);
    });

    // Each frame schedules a fresh id, so cleanup has to cancel the LATEST one.
    // Cancelling only the first left the loop running against a destroyed Lenis,
    // leaking another loop every time the landing page remounted.
    let rafId = 0;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    gsap.ticker.lagSmoothing(0);
    ScrollTrigger.refresh();

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(resetTimeout);
      lenis.destroy();
    };
  }, [enabled]);
}
