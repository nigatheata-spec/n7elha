import { LIME, SAND, TEAL } from "@/components/teacher/DashboardAccents";

/* The home page's brand shapes for the inner pages (About, Features, Schools,
   Blog, Contact...): a sand and lime corner coming in behind the nav and hero,
   and a sand and teal wave on the opposite edge further down, where the dark
   bands cover part of it so it reads as running underneath. Drawn for the
   end side and mirrored in Arabic, so they always sit away from the text.
   Place it as the first child of a page root that is `relative isolate`. It
   sits behind everything, ignores the pointer and never scrolls sideways. */
export const PageShapes = () => (
  <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
    <div className="absolute -top-12 -end-16 w-[230px] md:w-[460px] rtl:-scale-x-100">
      <svg viewBox="0 0 400 400" className="w-full">
        <path fill={SAND} d="M400 0H70C20 40 48 118 100 172C154 228 132 300 204 356C254 396 338 404 400 392Z" />
        <path fill={LIME} d="M400 0H154C102 34 130 104 174 150C222 200 202 262 266 310C308 342 360 340 400 330Z" />
      </svg>
    </div>
    <div className="absolute top-[56%] -start-8 w-[100px] md:w-[260px] ltr:-scale-x-100">
      <svg viewBox="0 0 300 600" className="w-full">
        <path fill={SAND} d="M300 0C226 22 186 92 196 168C206 248 104 280 84 360C62 446 160 540 300 600Z" />
        <path fill={TEAL} d="M300 60C252 82 232 140 240 200C248 266 168 294 154 362C140 432 210 506 300 548Z" />
      </svg>
    </div>
  </div>
);
