# Day 09 — Heliae

A landing page for Heliae, a fictional contemporary fashion label that makes everything to measure and sells it as a yearly membership. The page follows the section structure, layout and proportions of a membership-site reference, retold for a label: one fitting, a fit profile, a seasonal edit made by designers, and an atelier team on call.

Heliae, its people, member stories, handles, publications and figures are invented. Photography is Pexels stock (see [assets/PHOTOS.md](assets/PHOTOS.md)). Nothing on the page sends data: the sign-up form validates and clears in the browser, and every account, booking or social link opens a short explanation dialog.

## Run

Requires Node.js 18 or newer. There is no build step and no runtime dependency.

```sh
cd Day-09
npm start          # http://127.0.0.1:4409
```

## Page sections

| # | Section | What it does |
| --- | --- | --- |
| 1 | Announcement bar | Knitwear capsule teaser with a waitlist link. |
| 2 | Hero | Full-height inset panel. A model in profile against an orange halo, darkened at the edges with layered gradients so the copy stays readable. Nav, headline, two CTAs, three proof points. |
| 3 | Mill towns | Three faces, a one-line claim, and an infinite marquee of the mill towns the cloth comes from. |
| 4 | How it works | Four numbered cards: a photo with a booking card, a fit-profile phone, a photo with a "top 3 pieces" panel, and a shop phone. The phones are built in HTML and CSS. On phones the cards become a swipe rail. |
| 5 | Feature panels | Four full-height panels that stack as you scroll (`position: sticky`). Each has a headline, copy, an index that links between panels, and two or three FAQ accordions. Panels 2 and 3 use photos of blank phones, with live HTML screens fitted to them. |
| 6 | Value table | "What could cost $10,000 is now $199" with a zebra table of everything included. |
| 7 | Design leads | Horizontal rail of three people with a text mark, role, bio and link. |
| 8 | Member stories | Auto-advancing carousel. The active slide is full strength; neighbors peek in, dimmed. The progress bar fills over each slide's duration and pauses on hover, focus, when off screen or when the tab is hidden. |
| 9 | Worn by | Scrollable rail of tall portrait cards, captions, handles and a quote card, with arrow buttons on desktop. |
| 10 | Membership | Image gallery (the first slide is a phone showing the fit score) beside the plan list, price, CTA and trust badges. |
| 11 | Closing CTA and footer | Full-bleed photo with a headline and two CTAs. The white footer card overlaps the photo: newsletter, swatch and founder cards, contact icons, four link columns and a base row. |

A compact white bar slides in once the hero leaves the viewport. The grid button in either bar opens a full-screen menu.

## Design tokens

Defined on `:root` in [styles.css](styles.css).

- **Type:** Geist variable, self-hosted (OFL, see `assets/fonts/LICENSE.txt`). Headings use weight 400 with negative tracking. No italic type anywhere.
- **Fluid scale:** display `clamp(2.5rem, 3.75vw, 4.5rem)`, section heading `clamp(2.125rem, 2.92vw, 3.5rem)`, panel heading `clamp(2rem, 2.5vw, 3rem)`, card title `clamp(1.375rem, 1.46vw, 1.75rem)`. All are measured from the 1920px reference: 72, 56, 48 and 28px. The hero headline also has an `svh` term so it fits short laptop screens.
- **Color:** white page, `#111` ink, `#6a6a6a` muted text, `#f7f7f7` soft surfaces, `#120c08` night for dark surfaces, `#e2691f` ember accent.
- **Shape:** 10px radius on panels and cards, 6px on chips, pill buttons. There is one primary button (solid) and one secondary (light or glass).
- **Layout:** content width `min(1616px, 100vw − 2 × gutter)`, gutter `clamp(20px, 5.5vw, 152px)`. The hero and panels are inset 10px from the viewport.
- **Motion:** expo-out easing (`cubic-bezier(.16, 1, .3, 1)` in CSS, `expo.out` in GSAP), linear for the marquee and progress fills. Only `transform` and `opacity` are animated, plus the accordion's row height.

## Motion

The page uses the same motion system as the Healora build: GSAP 3.12.5 and ScrollTrigger 3.12.5, with Lenis smooth scroll. All three are self-hosted in `assets/vendor/`.

- **Hero intro:** a timeline scales the photo down from 1.08 over 2.2s, then drops in the nav and staggers in the eyebrow, headline, subline, buttons and each proof point. An inline script in `<head>` hides only the hero copy and nav until the intro starts, and never for longer than 2.5s, so a failed script can't leave the hero blank.
- **Hero parallax:** the photo drifts 7% as the hero scrolls away, and the copy rises and fades to 40%. The photo is sized 116% tall so no edge is ever exposed.
- **Section reveals:** one-shot rises (32px with a 0.09s stagger) trigger at 82% of the viewport for headings, step cards, table rows, people, stories, rail cards, the plan, the closing CTA and the footer columns. Photos scale in from 1.12, the mill faces pop in, and the rating star pops with `back.out`. The phone mockups and floating cards in the step cards rise in just after their cards.
- **Feature panels:** each panel's photo scales in, then its copy, index, phone screen or floating card, and FAQs stagger in. While the next sticky panel slides over, the one underneath eases back to 94% scale, scrubbed to the scroll. Sticky panels report their stuck position, so these triggers use each panel's position in the document flow. Stacked layouts (phones and portrait tablets) get simple per-panel reveals instead, through `gsap.matchMedia`.
- **Closing photo:** scales in, then parallaxes from −5% to 5% across the section.
- **Smooth scroll:** Lenis loads when the browser is idle and runs on GSAP's ticker, so smooth scroll and ScrollTrigger share one clock. Touch scrolling stays native. The menu holds the page with `lenis.stop()`, or by pinning the body if Lenis hasn't loaded yet.
- **Reduced motion:** GSAP and Lenis are skipped entirely and every section renders static. Switching to reduced motion while the page is open reverts every tween.
- **Guard:** while a tween runs on an element that has a CSS transition on `transform` (such as buttons), the element gets `.is-tweening` to pause the transition. When the tween finishes, its inline styles are cleared.

## Breakpoints

| Width | Changes |
| --- | --- |
| ≤ 1280px | Smaller floating cards on the panels. |
| ≤ 1100px | Nav links collapse into the menu, how-it-works becomes a 2×2 grid, the panel index hides, and the membership section stacks. |
| ≤ 1100px in portrait, ≤ 799px, or under 700px tall | Feature panels stop stacking: photo on top, copy and FAQs below. Elsewhere they stick 78px from the top, just below the compact bar, and one FAQ opens at a time so a fixed-height panel never pushes its copy out. |
| ≤ 799px | Phone hero (bottom-aligned copy, full-width buttons), swipe rails, two-column footer. |

## Accessibility and motion

- Semantic landmarks, one `h1`, and headings in order. All icons are Lucide (ISC; `assets/icons/LICENSE`), with inline geometry unchanged.
- Every interactive target is at least 44 × 44px and all visible text is at least 12px. Phone mockups are `aria-hidden`.
- The menu is a dialog with a focus trap. Escape closes it and focus returns to the opener. Scroll is held by `lenis.stop()`, or by pinning the body when Lenis is off.
- Reduced motion disables GSAP, Lenis, autoplay and the marquee (it shows one static set instead), and every section still renders.

## Verify

Keep `npm start` running, then:

```sh
npm install        # once: Playwright + axe-core (or reuse Day 06's install)
npm run verify
```

[scripts/verify.mjs](scripts/verify.mjs) checks for horizontal overflow every 20px from 320 to 1920. It checks that the hero fits one screen at 390×844, 414×896, 360×740, 1280×720, 1366×768, 1440×900, 1600×900 and 1920×1080, and that every section renders under reduced motion. It enforces 12px text and 44px targets, flags broken images and runs axe WCAG 2.1 AA at 390 and 1440. With motion on, at 1440 and 390, it checks that the hero intro finishes, that Lenis loads, and that every revealed element ends fully visible after scrolling the whole page. It also tests the menu at a non-zero scroll offset (lock and restore), the accordions, panel index navigation, the carousel, the dialog, newsletter validation and the marquee's half-width rule. Results go to `test-results/report.json`.

`npm run icons` regenerates the favicon set, `favicon.ico` and the 1200×630 share image from the running page.

## Deploy

The page is static: upload the folder as-is (without `node_modules/`, `test-results/` or `scripts/` if you like). No path starts with `_`, so GitHub Pages needs no `.nojekyll`.

Live at <https://heliae.vercel.app/>. The four absolute URLs at the top of [index.html](index.html) (canonical, `og:url`, `og:image` and `twitter:image`) point there; update them if the site moves, because share previews need absolute public URLs.

## Files

- `index.html`, `styles.css`, `script.js`: the page.
- `assets/photos/`: 35 WebP photos, about 2.0 MB in total, lazy-loaded below the hero.
- `assets/fonts/`, `assets/icons/`: Geist and the favicon set, each with its license.
- `assets/vendor/`: GSAP and ScrollTrigger 3.12.5 (GreenSock standard license, terms in each file's header) and Lenis 1.3.4 (MIT, `LICENSE`).
- `site.webmanifest`, `favicon.ico`, `assets/og-image.jpg`: install and share metadata.
- `scripts/`: local server, icon generator and verification.
