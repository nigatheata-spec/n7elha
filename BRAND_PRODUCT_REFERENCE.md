# nefelha (نفلها) — Brand & Product Reference

Extracted directly from the codebase at `/Users/3as/n7elha-work`. Every value below is copied verbatim from source; nothing is inferred or paraphrased unless explicitly marked. File paths are relative to the repo root.

---

## 1. Colors

**Source of truth:** CSS custom properties in HSL, defined in [`src/index.css`](src/index.css) (`:root`, `.dark`, and five game-theme classes), consumed via [`tailwind.config.ts`](tailwind.config.ts) which maps `hsl(var(--token))` to Tailwind color names. There is no separate tokens package or SCSS.

### 1.1 Primary brand color

**`#3F5A63`** (dark-slate-grey) is the single color the product is most identified by. Evidence:
- It is the `--primary` value in the default (light) `:root` theme.
- It is the PWA `theme-color` in [`index.html:26`](index.html) and `theme_color` in [`public/manifest.json`](public/manifest.json).
- It is the hardcoded accent used across marketing pages (SiteNav buttons, headings) as the literal hex `#3F5A63`.

### 1.2 Default theme (`:root` — light), `src/index.css` lines 15–68

| Token | Value as written | Hex equivalent | Role | Comment in code |
|---|---|---|---|---|
| `--background` | `40 47% 85%` | `#EBDFC7` | Page background | "sand-dune #EBDFC7" |
| `--cream-panel` | `43 58% 94%` | `#FBF4E4` | Soft hero surface | "soft creamy hero surface" |
| `--foreground` | `199 23% 18%` | `#233238` | Default text | — |
| `--card` | `0 0% 100%` | `#FFFFFF` | Card background | — |
| `--card-foreground` | `199 23% 18%` | `#233238` | Card text | — |
| `--popover` | `0 0% 100%` | `#FFFFFF` | Popover background | — |
| `--popover-foreground` | `199 23% 18%` | `#233238` | Popover text | — |
| `--primary` | `199 23% 32%` | `#3F5A63` | **Primary brand color** | "dark-slate-grey #3F5A63" |
| `--primary-foreground` | `37 46% 95%` | `#FBF3E7` | Text on primary | — |
| `--primary-glow` | `199 23% 42%` | `#4C7480` | Primary glow variant | — |
| `--secondary` | `37 46% 92%` | `#F5EBDA` | Secondary surface | — |
| `--secondary-foreground` | `199 23% 18%` | `#233238` | Text on secondary | — |
| `--muted` | `37 40% 90%` | `#F0E6D3` | Muted surface | — |
| `--muted-foreground` | `199 15% 38%` | `#4C5C61` | Muted text | — |
| `--accent` | `86 51% 53%` | `#8FC44A` | Accent | "lime-glow #8FC44A" |
| `--accent-foreground` | `0 0% 100%` | `#FFFFFF` | Text on accent | — |
| `--destructive` | `0 84% 60%` | `#EF4444` | Error/destructive | — |
| `--destructive-foreground` | `0 0% 100%` | `#FFFFFF` | Text on destructive | — |
| `--success` | `199 23% 32%` | `#3F5A63` | Success (same as primary in this theme) | — |
| `--success-foreground` | `0 0% 100%` | `#FFFFFF` | Text on success | — |
| `--border` | `199 23% 18% / 0.12` | `#233238` at 12% opacity | Border | — |
| `--input` | `37 30% 88%` | `#E9DEC9` | Input background | — |
| `--ring` | `86 51% 53%` | `#8FC44A` | Focus ring | — |
| `--nb-border` | `199 23% 18%` | `#233238` | Solid neobrutalist button border/shadow edge | "solid dark-slate — hard button border + shadow edge" |
| `--sidebar-background` | `199 23% 32%` | `#3F5A63` | Teacher sidebar bg | — |
| `--sidebar-foreground` | `43 58% 94%` | `#FBF4E4` | Sidebar text | — |
| `--sidebar-primary` | `86 51% 53%` | `#8FC44A` | Sidebar active/primary | — |
| `--sidebar-primary-foreground` | `0 0% 100%` | `#FFFFFF` | Text on sidebar primary | — |
| `--sidebar-accent` | `199 23% 27%` | `#354D54` | Sidebar hover/accent | — |
| `--sidebar-accent-foreground` | `43 58% 94%` | `#FBF4E4` | Text on sidebar accent | — |
| `--sidebar-border` | `43 58% 94% / 0.18` | `#FBF4E4` at 18% opacity | Sidebar border | — |
| `--sidebar-ring` | `86 51% 53%` | `#8FC44A` | Sidebar focus ring | — |
| `--gradient-hero` | `hsl(199 23% 30%)` | `#3C575F` | Hero gradient base | — |
| `--gradient-cyan` | `hsl(16 100% 60%)` | `#FF5C1A` | Named "cyan" gradient — value is actually orange | — |
| `--shadow-soft` | `0 8px 30px -12px hsl(199 23% 18% / 0.18)` | n/a (shadow) | Soft shadow | — |
| `--shadow-glow` | `none` | n/a | Glow shadow (disabled) | — |
| `--radius` | `1rem` | n/a | Border radius base | — |

### 1.3 `.dark` theme, `src/index.css` lines 71–108

| Token | Value | Hex | Role |
|---|---|---|---|
| `--background` | `213 39% 9%` | `#0E1521` | Page background |
| `--foreground` | `36 20% 96%` | `#F6F2ED` | Default text |
| `--card` | `213 35% 12%` | `#151E2B` | Card background |
| `--card-foreground` | `36 20% 96%` | `#F6F2ED` | Card text |
| `--popover` | `213 35% 12%` | `#151E2B` | Popover background |
| `--popover-foreground` | `36 20% 96%` | `#F6F2ED` | Popover text |
| `--primary` | `189 100% 50%` | `#00C2FF` | Primary (dark theme) |
| `--primary-foreground` | `213 39% 9%` | `#0E1521` | Text on primary |
| `--secondary` | `213 30% 16%` | `#1D2937` | Secondary surface |
| `--secondary-foreground` | `36 20% 96%` | `#F6F2ED` | Text on secondary |
| `--muted` | `213 30% 16%` | `#1D2937` | Muted surface |
| `--muted-foreground` | `215 16% 65%` | `#909BAB` | Muted text |
| `--accent` | `32 47% 64%` | `#D2A26D` | Accent |
| `--accent-foreground` | `213 39% 9%` | `#0E1521` | Text on accent |
| `--destructive` | `0 84% 60%` | `#EF4444` | Error |
| `--destructive-foreground` | `0 0% 100%` | `#FFFFFF` | Text on destructive |
| `--success` | `158 80% 45%` | `#14CE85` | Success |
| `--success-foreground` | `0 0% 100%` | `#FFFFFF` | Text on success |
| `--border` | `213 30% 18%` | `#20304 3` (see note) | Border — no opacity suffix in dark theme, unlike light |
| `--input` | `213 30% 18%` | `#213040` | Input background |
| `--ring` | `189 100% 50%` | `#00C2FF` | Focus ring |
| `--sidebar-background` | `213 39% 7%` | `#0A101A` | Sidebar bg |
| `--sidebar-foreground` | `36 20% 96%` | `#F6F2ED` | Sidebar text |
| `--sidebar-primary` | `189 100% 50%` | `#00C2FF` | Sidebar primary |
| `--sidebar-primary-foreground` | `213 39% 9%` | `#0E1521` | Text on sidebar primary |
| `--sidebar-accent` | `213 30% 14%` | `#1A2532` | Sidebar accent |
| `--sidebar-accent-foreground` | `36 20% 96%` | `#F6F2ED` | Text on sidebar accent |
| `--sidebar-border` | `213 30% 16%` | `#1D2937` | Sidebar border |
| `--sidebar-ring` | `189 100% 50%` | `#00C2FF` | Sidebar focus ring |

**Note:** the light theme and dark theme are not the same palette shifted in lightness — they use entirely different hues (warm sand/slate in light, cool navy/cyan in dark). This is a deliberate two-palette design, not a single-palette light/dark pair.

### 1.4 Per-game-mode theme classes (all in `src/index.css`, applied as a wrapper class e.g. `.theme-game`)

These override the root tokens for full-screen gameplay views. Reported as light-theme-independent (each is its own fixed palette regardless of `.dark`).

**`.theme-game`** (Crypto Rush) — lines 111–134, comment: "pure black terminal with green (classic hacker)"
| Token | Value | Hex |
|---|---|---|
| `--background` | `0 0% 3%` | `#080808` |
| `--foreground` | `120 100% 60%` | `#33FF33` |
| `--card` | `0 0% 5%` | `#0D0D0D` |
| `--primary` | `120 100% 55%` | `#1AFF1A` |
| `--secondary` | `0 0% 8%` | `#141414` |
| `--secondary-foreground` | `120 80% 50%` | `#19E619` |
| `--muted` | `0 0% 10%` | `#1A1A1A` |
| `--muted-foreground` | `120 40% 45%` | `#3D7A3D` |
| `--accent` | `120 100% 55%` | `#1AFF1A` |
| `--destructive` | `0 84% 60%` | `#EF4444` |
| `--success` | `120 100% 55%` | `#1AFF1A` |
| `--border` | `120 100% 55% / 0.22` | `#1AFF1A` at 22% opacity |
| `--input` | `0 0% 6%` | `#0F0F0F` |
| `--ring` | `120 100% 55%` | `#1AFF1A` |

**`.theme-dodgeball`** (comment says "Time Wizard theme — midnight indigo + amber constellation", despite class name being `dodgeball`) — lines 138–159
| Token | Value | Hex |
|---|---|---|
| `--background` | `240 40% 7%` | `#0D0D1A` |
| `--foreground` | `220 20% 96%` | `#F1F2F5` |
| `--card` | `240 35% 11%` | `#14141F` |
| `--primary` | `220 20% 97%` | `#F4F5F7` |
| `--secondary` | `270 50% 22%` | `#3C1F54` |
| `--secondary-foreground` | `270 80% 85%` | `#D9BFF5` |
| `--muted` | `240 25% 18%` | `#25243A` |
| `--muted-foreground` | `220 20% 65%` | `#9CA1AD` |
| `--accent` | `270 80% 65%` | `#A855F0` — comment: "mystic violet" |
| `--destructive` | `350 80% 60%` | `#EA3D6B` |
| `--success` | `150 70% 55%` | `#40D98C` |
| `--border` | `220 20% 90% / 0.25` | `#E4E6EA` at 25% opacity |
| `--input` | `240 40% 5%` | `#0A0A14` |
| `--ring` | `220 20% 97%` | `#F4F5F7` |

**`.theme-hotpotato`** (comment: "Pass It theme — gunmetal steel + PCB yellow-green accent") — lines 162–185
| Token | Value | Hex |
|---|---|---|
| `--background` | `210 22% 7%` | `#0F1417` |
| `--foreground` | `210 15% 88%` | `#DBDFE1` |
| `--card` | `210 18% 11%` | `#171C1F` |
| `--primary` | `71 48% 47%` | `#8FA038` — comment: "PCB silkscreen — muted, not neon" |
| `--secondary` | `210 18% 17%` | `#252C30` |
| `--muted` | `210 15% 14%` | `#1E2224` |
| `--muted-foreground` | `210 8% 52%` | `#7D8285` |
| `--accent` | `0 85% 55%` | `#EC1A1A` — comment: "alarm red" |
| `--destructive` | `0 90% 55%` | `#F00D0D` |
| `--success` | `142 65% 48%` | `#28C168` |
| `--border` | `210 20% 20%` | `#2B3338` |
| `--input` | `210 18% 10%` | `#15191C` |
| `--ring` | `71 48% 47%` | `#8FA038` |

**`.theme-lavafloor`** — lines 214–236 (comment: "deep volcanic red")
| Token | Value | Hex |
|---|---|---|
| `--background` | `14 50% 8%` | `#211008` |
| `--foreground` | `20 20% 92%` | `#EDE7E3` |
| `--card` | `14 40% 12%` | `#2B1810` |
| `--primary` | `14 72% 52%` | `#DE5424` |
| `--secondary` | `25 62% 46%` | `#BC7728` |
| `--muted` | `14 25% 22%` | `#4A3A32` |
| `--accent` | `33 78% 52%` | `#E1962C` |
| `--destructive` | `0 85% 55%` | `#F01A1A` |
| `--success` | `142 65% 42%` | `#20A85A` |
| `--border` | `14 42% 30%` | `#6B3F2C` |
| `--input` | `14 40% 14%` | `#331C13` |
| `--ring` | `14 72% 52%` | `#DE5424` |

**`.theme-hvz`** (Humans vs Zombies) — lines 238–258
| Token | Value | Hex |
|---|---|---|
| `--background` | `150 15% 6%` | `#0E1310` |
| `--foreground` | `90 10% 90%` | `#E4E5E1` |
| `--card` | `150 12% 10%` | `#161B18` |
| `--primary` | `100 55% 45%` | `#4FB030` |
| `--secondary` | `210 70% 50%` | `#2680E0` |
| `--muted` | `150 10% 18%` | `#292F2C` |
| `--accent` | `100 55% 45%` | `#4FB030` |
| `--destructive` | `0 85% 55%` | `#F01A1A` |
| `--success` | `142 65% 42%` | `#20A85A` |
| `--border` | `150 20% 22%` | `#334339` |
| `--input` | `150 15% 12%` | `#1A211C` |
| `--ring` | `100 55% 45%` | `#4FB030` |

No `.theme-paintfight`, `.theme-dontlookdown`, or `.theme-physical` class exists — **NOT FOUND IN CODEBASE**. Those modes use the default `:root`/`.dark` tokens plus per-mode hardcoded hex values inside their own render files (out of scope for a token audit).

### 1.5 Hardcoded hex colors outside the token system

These appear as literal string values rather than CSS variables and are used repeatedly across marketing pages and mode definitions:
- `#8FC44A` — lime accent, used for kicker labels on `Landing.tsx`, `Schools.tsx`, `Partners.tsx` (matches `--accent`)
- `#3F5A63` — dark-slate, used for SiteNav buttons, kicker labels (matches `--primary`)
- Per-mode accent colors, from `MODES` array in [`src/pages/teacher/HostGame.tsx`](src/pages/teacher/HostGame.tsx):

| Mode id | accent hex |
|---|---|
| classic | `#8FC44A` |
| crypto_rush | `#3a9e6e` |
| dodgeball | `#3F5A63` |
| hotpotato | `#C8783A` |
| lavafloor | `#8B4A3A` |
| humansvszombies | `#4a7a3a` |
| dontlookdown | `#2f6f8f` |
| paintfight | `#c2410c` |
| physical | `#5b4636` |

---

## 2. Typography

**Sources:**
- Google Fonts `@import` at the top of [`src/index.css:1`](src/index.css)
- A self-hosted `@font-face` in [`src/index.css:3–8`](src/index.css)
- A separate Google Fonts `<link>` in [`index.html:35–37`](index.html)
- Font family declarations in [`tailwind.config.ts`](tailwind.config.ts) (`theme.extend.fontFamily`)
- Runtime font-family assignment on `body` in [`src/index.css:262–268`](src/index.css)

### 2.1 Every font family declared, exact names

From `src/index.css:1`:
```
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Almarai:wght@300;400;700;800&family=JetBrains+Mono:wght@400;700&family=Press+Start+2P&display=swap');
```
- **Outfit** — weights loaded: 400, 500, 600, 700
- **Almarai** — weights loaded: 300, 400, 700, 800
- **JetBrains Mono** — weights loaded: 400, 700
- **Press Start 2P** — weight loaded: 400 (default only; no weight list given for this family)

From `src/index.css:3–8` (self-hosted, not Google Fonts):
```css
@font-face {
  font-family: 'ArslanWessam';
  src: url('/fonts/arslan_wessam_b.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
```
- **ArslanWessam** — file: `public/fonts/arslan_wessam_b.ttf`, weight: `normal` only.

From [`index.html:35–37`](index.html):
```html
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600;700&display=swap" rel="stylesheet" />
```
- **Caveat** — weights loaded: 400, 500, 600, 700

From [`tailwind.config.ts`](tailwind.config.ts), `theme.extend.fontFamily`:
```ts
fontFamily: {
  sans: ['Tajawal', 'Cairo', 'system-ui', 'sans-serif'],
  display: ['Cairo', 'Tajawal', 'system-ui', 'sans-serif'],
  mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
  handwritten: ['Caveat', 'cursive'],
},
```
**Note (discrepancy, reported as found, not resolved):** Tailwind's `font-sans`/`font-display` utilities reference **Tajawal** and **Cairo**, but neither font is loaded anywhere in the codebase (no `@import`, no `<link>`, no `@font-face` for Tajawal or Cairo exists). They are **NOT FOUND as loaded fonts** — only declared as a Tailwind utility fallback list. The actual body font is set separately (see 2.4).

### 2.2 Arabic vs Latin typefaces, explicitly separated

| Typeface | Script | Where declared |
|---|---|---|
| **Almarai** | Arabic (also has Latin glyphs, but used for Arabic body text) | `src/index.css:1` import; used as the default Arabic body font (2.4) |
| **ArslanWessam** | Arabic (decorative/display) | `src/index.css:3-8`; consumers of this family not confirmed in the files read — declared but not traced to a specific component in this audit |
| **Tajawal**, **Cairo** | Arabic | Declared in `tailwind.config.ts` `fontFamily.sans` / `fontFamily.display` only — **not loaded**, so effectively unused as rendered fonts |
| **Outfit** | Latin | `src/index.css:1` import; used for English body text (2.4) and inline on `Landing.tsx` |
| **JetBrains Mono** | Latin (monospace) | `src/index.css:1` import; mapped to `.font-mono` utility class (`src/index.css:268`) and `tailwind.config.ts` `fontFamily.mono` |
| **Press Start 2P** | Latin (pixel/retro display) | `src/index.css:1` import — declared, specific component usage not confirmed in files read |
| **Caveat** | Latin (handwritten script) | `index.html:35-37`; mapped to `.font-handwritten` / `tailwind.config.ts` `fontFamily.handwritten`; per `CLAUDE.md`, used by `HandWrittenTitle` (`src/components/ui/hand-writing-text.tsx`), Latin-only — Arabic text is animated as one unit instead of per-character |

### 2.3 Where each font loads from — file paths / URLs

| Font | Source | Exact path/URL |
|---|---|---|
| Outfit | Google Fonts | `https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700` |
| Almarai | Google Fonts | `https://fonts.googleapis.com/css2?family=Almarai:wght@300;400;700;800` |
| JetBrains Mono | Google Fonts | `https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700` |
| Press Start 2P | Google Fonts | `https://fonts.googleapis.com/css2?family=Press+Start+2P` |
| Caveat | Google Fonts | `https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600;700` |
| ArslanWessam | Self-hosted file | `/fonts/arslan_wessam_b.ttf` → repo path `public/fonts/arslan_wessam_b.ttf` |
| Tajawal, Cairo | Declared only, no source | NOT FOUND IN CODEBASE (no import/link/font-face) |

### 2.4 Heading vs body vs UI assignment

From `src/index.css`, `@layer base`:
```css
body {
  @apply bg-background text-foreground;
  font-family: 'Almarai', system-ui, sans-serif;
  font-feature-settings: "ss01";
}
html[lang="en"] body { font-family: 'Outfit', 'Almarai', system-ui, sans-serif; line-height: 1.55; }
html[lang="ar"] body { font-family: 'Almarai', system-ui, sans-serif; line-height: 1.55; }
.font-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
```
- **Body default (fallback before `lang` resolves):** Almarai
- **Body, English (`html[lang="en"]`):** Outfit, falling back to Almarai
- **Body, Arabic (`html[lang="ar"]`):** Almarai
- **Monospace utility (`.font-mono`):** JetBrains Mono
- There is no separate documented "heading" font override at the base layer — headings inherit the body font-family unless a component sets one inline (e.g. `Landing.tsx:120` sets `fontFamily: "'Outfit', 'Almarai', system-ui, sans-serif"` directly on its wrapper div).
- **Handwritten utility:** Caveat (`tailwind.config.ts` `fontFamily.handwritten`)

### 2.5 Fallback stacks, exactly as written

- `'Almarai', system-ui, sans-serif` (default body)
- `'Outfit', 'Almarai', system-ui, sans-serif` (English body / Landing hero)
- `'JetBrains Mono', ui-monospace, monospace` (`.font-mono`)
- `['Tajawal', 'Cairo', 'system-ui', 'sans-serif']` (Tailwind `font-sans`, unloaded fonts)
- `['Cairo', 'Tajawal', 'system-ui', 'sans-serif']` (Tailwind `font-display`, unloaded fonts)
- `['JetBrains Mono', 'ui-monospace', 'monospace']` (Tailwind `font-mono`)
- `['Caveat', 'cursive']` (Tailwind `font-handwritten`)

---

## 3. Logo and Brand Assets

### 3.1 Every logo file, path and format

| File | Format | Dimensions (from `file`) | Used in |
|---|---|---|---|
| `src/assets/logo-mark.png` | PNG (8-bit colormap) | 1024 × 1024 | `src/components/Logo.tsx` (the shared header/nav logo component) |
| `src/assets/logo-light.png` | PNG (8-bit colormap) | 1024 × 1024 | `src/components/TeacherLayout.tsx`, `src/pages/Auth.tsx`, `src/pages/play/LavaFloorGame.tsx`, `src/pages/play/Game.tsx`, `src/pages/play/DodgeballGame.tsx`, `src/pages/play/HotPotatoGame.tsx`, `src/pages/play/Join.tsx` |
| `src/assets/logo-full.png` | PNG (RGBA) | 1343 × 800 | **Imported nowhere in `src/`** — orphaned asset, present on disk but unreferenced by any component |

No SVG logo file exists — **NOT FOUND IN CODEBASE** ("For SVG logos, report the fill colors" does not apply; there is no SVG logo, only the two brand SVGs below which are illustrative, not logos).

### 3.2 Variant identification

The task asks to identify variants (full lockup / icon-only / Arabic wordmark / Latin wordmark / light-bg version / dark-bg version / favicon). Based on filenames and actual usage:

- **Icon/mark only:** `logo-mark.png` — used with `alt="nefelha"` and paired with a separate text span in `Logo.tsx` (the wordmark is HTML text, not baked into the image)
- **"Light" variant:** `logo-light.png` — used across dark-background game screens and the auth page; name implies it renders light-colored/for dark backgrounds, but this is inferred from naming and usage context, not confirmed by inspecting pixel content
- **Full lockup:** `logo-full.png` exists on disk (1343×800, wide aspect suggesting mark+wordmark combined) but is **not used anywhere** — cannot confirm its content or intended variant beyond the filename
- **Dedicated Arabic wordmark file, dedicated Latin wordmark file, dedicated dark-background file:** NOT FOUND IN CODEBASE — the wordmark is rendered as live text (see 3.4), not as a separate logo image per language
- **Favicon:** `public/favicon.ico`, `public/favicon-16x16.png`, `public/favicon-32x32.png`, `public/favicon-96x96.png`, referenced in `index.html:6-9`. Additional platform icons: `public/apple-icon*.png` (9 sizes), `public/android-icon*.png` (6 sizes), `public/ms-icon*.png` (4 sizes), all referenced in `index.html`.

### 3.3 SVG fill colors

No SVG logo exists to report fills for. Two non-logo brand SVGs were found in `src/assets/`:

| File | Fill colors found (`fill="..."` attributes) |
|---|---|
| `src/assets/saudi-map.svg` | `#3F5A63`, `none` |
| `src/assets/saudi-map-light.svg` | `#EFE6D4`, `none` |

### 3.4 Exact Arabic spelling of the brand name, as it appears in the UI

**نفلها**

Verified in multiple source locations, verbatim:
- `src/lib/i18n.ts:8` — `brand: "نفلها"`
- `src/components/Logo.tsx:13` — `{isAr ? "نفلها" : "nefelha"}`
- `index.html:34` — `<title>نفلها — التعلم التفاعلي للفصل العربي | nefelha</title>`
- `public/manifest.json` — `"name": "نفلها - nefelha"`, `"short_name": "نفلها"`
- `src/components/site/SiteNav.tsx:41` — `{isAr ? "نفلها" : "nefelha"}`

### 3.5 Exact Latin transliteration, as it appears, with exact capitalization

**nefelha** — always fully lowercase, never capitalized, in every source location checked:
- `src/lib/i18n.ts:72` — `brand: "nefelha"`
- `src/components/Logo.tsx:13` — `{isAr ? "نفلها" : "nefelha"}`
- `index.html:34` — title tag ends in `| nefelha`
- `src/pages/Landing.tsx:132` — `alternateName: "nefelha"` (JSON-LD structured data)
- `package.json:2` — `"name": "knowledge-hack"` — **note:** the npm package name is `knowledge-hack`, not `nefelha` (this is the internal/repo project name, distinct from the product's public brand name)

---

## 4. Product Terminology

### 4.1 What the product calls a quiz/session

From `src/lib/i18n.ts` (both languages, key → value):
| Key | Arabic | English |
|---|---|---|
| `create_quiz` | إنشاء اختبار | Create Quiz |
| `my_quizzes` | اختبارات | Quizzes |
| `hosted_games` | السجل | History |
| `host_game` | استضافة لعبة | Host Game |
| `game_code` | رمز اللعبة | Game Code |
| `lobby` | الردهة | Lobby |
| `start_game` | بدء اللعبة | Start Game |
| `end_game` | إنهاء اللعبة | End Game |
| `questions` | أسئلة | questions |

The underlying database table is literally named `quizzes` (per `CLAUDE.md` schema section), and a live instance of a quiz is a `game_sessions` row — the product-facing term for that live instance is "Game" / "لعبة" (e.g. `game_code`, `host_game`), while the underlying content asset is a "Quiz" / "اختبار".

### 4.2 Names of every game mode

Exact source: `MODES` array, [`src/pages/teacher/HostGame.tsx`](src/pages/teacher/HostGame.tsx), lines 18–116. Reported as `label` (English) / `labelAr` (Arabic), with each mode's tagline (`desc`/`descAr`) verbatim:

| id | label | labelAr | desc | descAr |
|---|---|---|---|---|
| `classic` | Classic | كلاسيكي | Answer fast, earn more — the original quiz race | أجب بسرعة، اكسب أكثر — سباق الأسئلة الأصلي |
| `crypto_rush` | Cyber War | حرب الاختراقات | Answer questions, earn crypto, hack rivals | أجب على الأسئلة، اكسب كريبتو، اخترق منافسيك |
| `dodgeball` | Speed Challenge | تحدي السرعة | Answer fast or get eliminated — last student standing wins | أجب بسرعة وإلا ستُستبعد — آخر طالب يبقى يفوز |
| `hotpotato` | Pass It | مرّرها | Live bomb on a fuse — pass it before it blows | قنبلة موقوتة — مرّرها قبل أن تنفجر |
| `lavafloor` | Lava Floor | أرضية الحمم | Survive together before the lava rises | اصمدوا معاً قبل أن تبتلعكم الحمم |
| `humansvszombies` | Humans vs Zombies | البشر ضد الزومبي | Two teams, two health bars — heal, upgrade, sabotage, survive | فريقان، شريطا صحة — عالج، طوّر، خرّب، انجُ |
| `dontlookdown` | Don't Look Down | لا تنظر للأسفل | Climb a tower — answers are the fuel for every jump | تسلّق البرج — الإجابات هي وقود كل قفزة |
| `paintfight` | Paint Fight | معركة الطلاء | Free-for-all territory battle — answers refill your paint | معركة حرة على الأرض — الإجابات تعيد ملء طلائك |
| `physical` | Physical Games | الألعاب الفيزيائية | Play on a printed board — scan squares for questions, no student devices needed | العب على لوحة مطبوعة — امسح المربعات للحصول على أسئلة، بدون أجهزة للطلاب |
| `homework` | Homework | واجب منزلي | Share a link instead of a code — students answer on their own time | شارك رابطاً بدل الرمز — يحلّه الطلاب في وقتهم الخاص |

**Note:** the internal `settings.mode` slug for Crypto Rush is `crypto_rush`, but the user-facing display name shown to teachers in the mode picker is **"Cyber War"** / **"حرب الاختراقات"**, not "Crypto Rush" — the CLAUDE.md documentation and the actual UI copy use different names for the same mode. Similarly `dodgeball`'s displayed name is **"Speed Challenge"** / **"تحدي السرعة"**, not "Dodgeball".

### 4.3 Physical game component names

Exact source: `SQUARE_TYPES`, [`src/lib/physicalGames.ts`](src/lib/physicalGames.ts), lines 29–36:

| code | kind | difficulty | color | label_en | label_ar |
|---|---|---|---|---|---|
| 1 | difficulty | easy | `#3a9e6e` | Green — Easy | أخضر — سهل |
| 2 | difficulty | medium | `#8a8a8a` | White — Normal | أبيض — عادي |
| 3 | difficulty | hard | `#c0392b` | Red — Hard | أحمر — صعب |
| 4 | rest | — | `#2f6f8f` | Teal — Rest | تركواز — استراحة |
| 5 | double | medium | `#e0b400` | Yellow — Double | أصفر — مضاعف |
| 6 | wildcard | — | `#8e44ad` | ? — Wildcard | ؟ — عشوائي |

The printed board itself and the object linking a physical board to a session are both called a **"kit"** in code (`kits` table, `kitId`, `findActiveSessionForKit`) — no distinct Arabic term for "kit" was found in `physicalGames.ts` beyond the square-type labels above.

### 4.4 Tagline / slogan / brand line

Exact source: `src/lib/i18n.ts` lines 9–11 (`tagline`, `hero_title`, `hero_sub` keys):

| Key | Arabic | English |
|---|---|---|
| `tagline` | منصة الاختبارات الذكية للمعلمين | Smart quiz platform for teachers |
| `hero_title` | اختبارات تفاعلية. لعب ذكي. تعلم لا يُنسى. | Interactive quizzes. Smart play. Unforgettable learning. |
| `hero_sub` | أنشئ اختباراتك يدوياً أو بالذكاء الاصطناعي من ملفاتك، استضف لعبة مباشرة، وراقب طلابك في الوقت الفعلي. | Build quizzes manually or with AI from your documents, host live games, and watch your classroom in real time. |

A second, different hero line set exists on the actual marketing homepage, [`src/pages/Landing.tsx`](src/pages/Landing.tsx) lines 36–114 (the `t` object, `isAr` branch shown first, English second):

| Key | Arabic | English |
|---|---|---|
| `line1`+`line2a`/`line3b` (hero headline, assembled from fragments) | نخلي الطالب / يحب التعلّم / (blank) / (blank) / مو يكرهه | Make students / love learning / (blank) / (blank) / not dread it. |
| `sub` | نفلها مو نظام إدارة تعلّم (LMS) ثاني، ولا أداة اختبارات. إحنا نغيّر نظرة الطالب للتعلّم — نخليه ينتظر الحصة، مو يتهرّب منها. تجربة مصمّمة للفصل العربي من الأساس: أنت جهّز درسك، وإحنا نحوّله لشي يحبه طلابك. | nefelha isn't another LMS, and it isn't a quiz tool. We change how students feel about learning — so they look forward to class instead of running from it. Built for the Arabic classroom from the ground up: you prepare the lesson, we turn it into something your students love. |

The `<title>` tag ([`index.html:34`](index.html)) also carries a brand line:
```
نفلها — التعلم التفاعلي للفصل العربي | nefelha
```
And the Landing page's `<Seo>` component ([`src/pages/Landing.tsx:124-127`](src/pages/Landing.tsx)) sets route-specific title/description tags:
- `titleAr`: نفلها — نخلي الطلاب يحبون التعلّم | تجربة تفاعلية للفصل العربي
- `titleEn`: nefelha — Make Students Love Learning | Interactive Classroom Experience
- `descriptionAr`: نفلها مو نظام LMS ولا أداة اختبارات — إحنا نغيّر نظرة الطالب للتعلّم ونخليه يحب الحصة. تجربة تفاعلية للفصل العربي، تشتغل بدون أي تطبيق على أجهزة الطلاب.
- `descriptionEn`: nefelha isn't an LMS or a quiz tool. It's an interactive classroom experience that makes students love learning, not dread it. AI-powered, Arabic-first, nine play modes — no apps needed.

**Note:** these two hero copy sets (`i18n.ts` "Smart quiz platform for teachers" vs. `Landing.tsx` "Make students love learning") disagree on brand positioning — `i18n.ts`'s tagline frames the product as a quiz/testing tool, while `Landing.tsx`'s copy explicitly denies that framing ("nefelha isn't another LMS... isn't a quiz tool"). Reporting both since both exist in code; `i18n.ts`'s `tagline`/`hero_title`/`hero_sub` keys do not appear to be rendered on the actual Landing page (which uses its own local `t` object instead) — their live usage elsewhere in the app was not traced in this audit.

---

## 5. Subjects

**NOT FOUND IN CODEBASE as a fixed list.** `subject` is a free-text string field on the `quizzes` table (confirmed in [`src/pages/teacher/QuizEditor.tsx`](src/pages/teacher/QuizEditor.tsx): `const [subject, setSubject] = useState("")`, saved directly via `supabase.from("quizzes").update({ ..., subject, ... })`). There is no `SUBJECTS` array, enum, or dropdown of predefined subject options anywhere in `src/`. Teachers type an arbitrary subject string per quiz; whatever value they enter is later displayed verbatim as a `Badge` in `Dashboard.tsx` (`{q.subject && <Badge ...>{q.subject}</Badge>}`).

---

## 6. Teacher Dashboard Labels (Results/Analytics)

Exact source: [`src/pages/teacher/GameResults.tsx`](src/pages/teacher/GameResults.tsx). All strings below use the file's own `ar ? "<Arabic>" : "<English>"` pattern, reproduced verbatim with line numbers.

| Line | Arabic | English | Context |
|---|---|---|---|
| 139 | جارٍ التحميل... | LOADING... | Loading state |
| 161 | فاز الزومبي — عدوى كاملة | Zombies Win — Fully Infected | HvZ result banner |
| 162 | فاز البشر — نجوا من الفناء | Humans Win — Survived the Apocalypse | HvZ result banner |
| 163 | انتهت اللعبة | Game Over | Default result banner |
| 185 | المركز الأول | 1st Place | Podium |
| 204 | الثاني | 2nd | Podium |
| 214 | الثالث | 3rd | Podium |
| 226 | تخطي | Skip | Skip cinematic button |
| 253 | رجوع | Back | Back button |
| 257 | اللعبة | Game | Fallback title when quiz has none |
| 261 | المدة | Duration | **Stat metric label** |
| 263 | اللاعبون | Players | **Stat metric label** |
| 264 | الدقة | Accuracy | **Stat metric label** |
| 300–321 | خارج / آخر الناجين | Out / Last Standing | Dodgeball-mode player row status |
| 346 | خارج / حي | OUT / ALIVE | Dodgeball-mode status pill |
| 370 | لوحة الصدارة / الأسئلة | Leaderboard / Questions | Tab labels |
| 376 | تصدير | Export | Export button |
| 386–392 | # / اللاعب / المساحة / النقاط / الحالة / صحيح / الدقة / الاختراقات / الفريق / الارتفاع | # / Player / Territory / Points / Status / Correct / Accuracy / Hacks / Team / Height | **Full results-table column headers, mode-conditional** |
| 423 | أُقصي / بطل | ELIMINATED / CHAMPION | Row badge |
| 440–441 | زومبي / بشر | zombie / human | Team label |
| 464 | لا توجد بيانات أسئلة متاحة | No question data available | Empty state |

**Real metric names used as column headers (line 386–392), by mode:**
- Always present: `#`, Player / اللاعب, Correct / صحيح, Accuracy / الدقة
- `paintfight`: adds Territory / المساحة
- Point-based modes (`classic`, `crypto_rush`, etc. — "isPointsMode"): adds Points / النقاط
- Other modes: adds Status / الحالة
- `crypto_rush` only: adds Hacks / الاختراقات
- `humansvszombies` only: adds Team / الفريق
- `dontlookdown` only: adds Height / الارتفاع

Top-of-page summary stats (lines 261–264): **Duration / المدة**, **Players / اللاعبون**, **Accuracy / الدقة**.

---

## 7. Call to Action Copy

### 7.1 Header/nav CTAs — always visible, [`src/components/site/SiteNav.tsx`](src/components/site/SiteNav.tsx), the `t` object:

| Key | Arabic | English |
|---|---|---|
| `joinGame` | ادخل اللعبة | JOIN GAME |
| `login` | دخول | LOG IN |
| `signup` | تسجيل | SIGN UP |
| `dashboard` | لوحتي | DASHBOARD |

### 7.2 Homepage primary CTA, [`src/pages/Landing.tsx`](src/pages/Landing.tsx) `t` object (line 44/83):

| Arabic | English |
|---|---|
| ابدأ معنا | Get started |

Secondary link (line 45/84): ادخل اللعبة / JOIN GAME (same string as SiteNav)

Tertiary link, "read more" (line 73/112): اقرأ المزيد عنّا / Read more about us

### 7.3 Schools page CTA block, [`src/pages/Schools.tsx`](src/pages/Schools.tsx) (`ctaKicker`/`ctaTitle`/`ctaSub`/`ctaLink`):

| Key | Arabic | English |
|---|---|---|
| ctaKicker | الخطوة التالية | NEXT STEP |
| ctaTitle | لنتحدث عن مدرستك | Let's talk about your school |
| ctaSub | راسلنا بعدد الصفوف والمعلمين الذين تريد تفعيل نفلها لهم، وسنرد خلال يوم عمل. | Tell us how many classes and teachers you want to roll nefelha out to, and we'll get back to you within a business day. |
| ctaLink | تواصل معنا | Get in touch |

### 7.4 Partners page CTAs, [`src/pages/Partners.tsx`](src/pages/Partners.tsx):

| Key | Arabic | English |
|---|---|---|
| title | لنتحدث عن فصلك أو مدرستك | Let's talk about your classroom or school |
| schoolsCta | راسلنا لمناقشة مدرستك | Email us about your school |
| teachersCta | تواصل مع الدعم | Contact support |

### 7.5 Contact page, [`src/pages/Contact.tsx`](src/pages/Contact.tsx):

No form-submission CTA exists on this page — it is direct contact info only (per the file's own header comment: "Direct contact info only, no card chrome — a teacher with a question wants the fastest way to reach a human, not a form"). Title copy:

| Key | Arabic | English |
|---|---|---|
| title | عندك سؤال؟ إحنا نسمعك | Have a question? We're listening |
| replyTime | الرد خلال يوم عمل | Reply within a working day |

Contact values (not copy, but included since they're the actual CTA targets): `SUPPORT_EMAIL = "hello@nefelha.com"`; `SUPPORT_PHONE = "+966 50 000 0000"` — flagged in-code as `// TODO: placeholder — swap for the real support line once one exists.`

### 7.6 No dedicated "demo" or "pilot enrollment" CTA string found

The task asked specifically for demo-request or pilot-enrollment copy. **NOT FOUND IN CODEBASE** as a distinct concept — the product's marketing pages route every such intent to either the generic "Get started" / signup flow, or to direct contact ("Let's talk about your school" / "Email us about your school"). No page or string contains the words "demo," "pilot," or "trial" (English) or their Arabic equivalents (تجربة مجانية, تجريبي) as user-facing CTA copy.

---

## Appendix: Notable discrepancies found during extraction

1. **Tailwind's `font-sans`/`font-display` reference Tajawal/Cairo, but neither font is loaded anywhere** — the actually-rendered body font is Almarai/Outfit, set directly in `src/index.css`'s `@layer base` block, bypassing the Tailwind font utilities entirely.
2. **`--gradient-cyan` is not cyan** — its value (`16 100% 60%` HSL) renders as `#FF5C1A`, a saturated orange.
3. **`logo-full.png` is dead code** — present in `src/assets/` at 1343×800 but imported by zero files in `src/`.
4. **Two different hero taglines exist for the same product**, in `src/lib/i18n.ts` ("Smart quiz platform for teachers") vs. `src/pages/Landing.tsx` ("nefelha isn't another LMS... isn't a quiz tool") — directly contradictory positioning, and it was not confirmed whether the `i18n.ts` tagline is rendered anywhere live.
5. **Mode display names differ from their internal/documentation names**: `crypto_rush` displays as "Cyber War" / "حرب الاختراقات" (not "Crypto Rush"), and `dodgeball` displays as "Speed Challenge" / "تحدي السرعة" (not "Dodgeball") — both differ from the terminology used in `CLAUDE.md` and the `settings.mode` slug.
6. **`.theme-dodgeball`'s CSS comment calls it the "Time Wizard theme"** — a third, different name for the same mode, found only in the comment directly above the class definition in `src/index.css:137`.
