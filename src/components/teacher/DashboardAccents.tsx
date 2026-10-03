/* Soft, flowing color shapes that come in from the edges of the dashboard,
   in the brand's lime, sand and teal (the business-card look). Purely
   decorative: behind the content, ignores the pointer, hidden from screen
   readers, and still for anyone who asks for reduced motion. */

const LIME = "#A9CB1E";
const SAND = "#EAD7B0";
const TEAL = "#0E7C7B";
const INK = "#12262B";

export const DashboardAccents = () => (
  <div aria-hidden className="pointer-events-none absolute -inset-4 md:-inset-8 -z-10 overflow-hidden">
    {/* top corner: sand wave under a lime wave */}
    <svg viewBox="0 0 400 400" className="accent-drift absolute -top-10 -left-16 w-[260px] md:w-[520px]" style={{ animationDuration: "22s" }}>
      <path fill={SAND} d="M0 0H330C380 40 352 118 300 172C246 228 268 300 196 356C146 396 62 404 0 392Z" />
      <path fill={LIME} d="M0 0H246C298 34 270 104 226 150C178 200 198 262 134 310C92 342 40 340 0 330Z" />
    </svg>

    {/* opposite corner: teal wave over a sand rim */}
    <svg viewBox="0 0 400 400" className="accent-drift absolute -bottom-12 -right-16 w-[280px] md:w-[580px]" style={{ animationDuration: "26s", animationDelay: "-8s" }}>
      <path fill={SAND} d="M400 400H40C10 352 52 300 110 278C182 250 170 168 236 120C284 86 352 84 400 92Z" />
      <path fill={TEAL} d="M400 400H112C88 362 124 322 172 304C232 282 226 214 278 176C318 148 366 150 400 160Z" />
    </svg>

    {/* a small lime drop drifting on the far side of the hero */}
    <svg viewBox="0 0 120 120" className="accent-drift absolute top-[300px] -right-6 w-[70px] md:w-[110px] hidden sm:block" style={{ animationDuration: "18s", animationDelay: "-4s" }}>
      <path fill={LIME} d="M64 6C94 8 116 34 112 66C108 98 82 116 52 112C22 108 4 84 8 56C12 26 34 4 64 6Z" />
    </svg>

    {/* thin line-art ovals, one per side */}
    <svg viewBox="0 0 240 140" className="accent-drift absolute top-10 right-[6%] w-[150px] md:w-[230px] hidden sm:block" style={{ animationDuration: "20s", animationDelay: "-12s" }}>
      <ellipse cx="120" cy="70" rx="112" ry="52" transform="rotate(-14 120 70)" fill="none" stroke={INK} strokeWidth="1.5" opacity="0.55" />
    </svg>
    <svg viewBox="0 0 200 200" className="accent-drift absolute top-[460px] left-[2%] w-[120px] md:w-[170px] hidden md:block" style={{ animationDuration: "24s", animationDelay: "-6s" }}>
      <ellipse cx="100" cy="100" rx="88" ry="60" transform="rotate(32 100 100)" fill="none" stroke={INK} strokeWidth="1.5" opacity="0.45" />
      <circle cx="160" cy="54" r="10" fill={TEAL} />
    </svg>
  </div>
);
