# nefelha Design System

## Color Strategy
**Committed** — One saturated color (lime green #8FC44A) carries ~30% of surfaces; paired with a restrained teal primary (#3F5A63) and careful neutrals. Neobrutalist: hard edges, no gradients, intentional shadow depth.

### Palette
- **Primary:** `#3F5A63` (teal, ~oklch(50% 0.08 254°))
- **Accent:** `#8FC44A` (lime green, ~oklch(68% 0.18 121°))
- **Dark:** `#14212A` / `#2B3F45` (almost-black to dark blue-gray; use `#1a2634` for true darks)
- **Neutral Base:** `hsl(var(--cream-panel))` (off-cream, never pure white)
- **Borders:** `hsl(var(--nb-border))` (teal-tinted neutral for neobrutalist outlines)

### Neobrutalist Specific
- Border: `border-2` + `border-[hsl(var(--nb-border))]`
- Shadow: `shadow-[Npx_Npx_0_0_hsl(var(--nb-border))]` (hard offset, no blur)
- Background: off-cream, never white; alternating rows get light lime tint `#8FC44A/[0.08]`
- No gradients, no rounded-corner excess (radius is `rounded-2xl` max)

## Typography
- **Heading font:** "ArslanWessam" (custom, Arabic-optimized) for display
- **Body:** "Outfit" (English) + "Almarai" (Arabic) system fallback
- **Monospace:** `font-mono` for codes, room codes, stats
- **Scale:** 
  - Hero: 40px+ (`text-[40px]`)
  - Section heading: 28px (`text-[28px]`)
  - Label: 12–13px (`text-[12px]`, `text-[13px]`, tracking-wide)
- **Line height:** 1.1–1.15 for tight hierarchy; 1.5+ for body copy
- **Weights:** Bold (titles) vs. Medium/Regular (body); ≥1.25 contrast between steps

## Elevation & Space
- **Cards/Sections:** `border-2 + shadow-[4px_4px_0_0_...]` (neobrutalist pop)
- **List items:** `divide-y` with alternating row backgrounds
- **Padding:** Varied, not uniform—rhythm comes from spacing contrast
- **Gap:** Flex/grid gaps typically 3–5 (`gap-3` to `gap-5`), never flat

## Components
- **Button (CTA):** pill-shaped, `border-2`, hard shadow, 14–15px text, font-medium
- **Input:** `border-2`, rounded corners, focus state lifts shadow
- **Badge/Label:** small caps, tracking-wide, no background (color + weight only)
- **Live indicator:** "مباشر" / "LIVE" text in lime, uppercase, no icon
- **Status label:** hidden when finished (default); only running/waiting/lobby show

## Themes
- **Marketing pages** (Landing, Services): Cream background, full-color palette
- **Student join** (`/join`): Dark mood (student anticipation before entering class); charcoal/teal; minimal distraction
- **Live game** (`/play/:sessionId`): Full-screen, no chrome, mode-specific theming (e.g., Crypto Rush neon-on-black)
- **Teacher dashboard** (`/app/*`): White background, sidebar navigation, clear hierarchy

## Motion
- Scan-sweep on page enter (animated gradient swipe)
- No CSS layout animations (opacity/transform only)
- Easing: `ease-out-quart` / `ease-out-quint`
- Page transitions: 300ms fade + scale (tight, not bouncy)

## No CSS Patterns
- ❌ Side-stripe borders (border-left/right as accent)
- ❌ Gradient text
- ❌ Glassmorphism
- ❌ Nested cards
- ❌ Identical card grids

## i18n
- Arabic default (`fallbackLng: "ar"`)
- Always LTR layout (no `dir="rtl"` on body, but individual elements respect RTL content)
- Fonts stack Arabic-first: "Almarai" before system sans
