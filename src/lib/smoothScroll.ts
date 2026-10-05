import { useEffect } from "react";
import Lenis from "lenis";

// Smooth wheel scrolling for the landing page. There used to be a skew on the
// whole page while it scrolled; it's gone on purpose: tilting a page-height
// layer every frame stuttered on phones and in Firefox, and the tilt opened
// hairline seams between the teal band's waves and its body.
export function useSmoothScroll(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => 1 - Math.pow(1 - t, 4),
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

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, [enabled]);
}
