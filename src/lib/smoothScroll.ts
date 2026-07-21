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

      const v = gsap.utils.clamp(-3.5, 3.5, e.velocity * 0.6);

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

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    const rafId = requestAnimationFrame(raf);

    gsap.ticker.lagSmoothing(0);
    ScrollTrigger.refresh();

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(resetTimeout);
      lenis.destroy();
    };
  }, [enabled]);
}
