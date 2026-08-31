# q-auto-874c — homepage / services / contact contrast, measured

Lane: `q-auto-874c` (p3, review). Branch: `review/q-auto-874c-contrast-measured`.
Repo: `/opt/automancer/projects/automancer/automancer-site`. Cut from `origin/main`.
Measured: 2026-08-31, against the **live** site (`https://automancer.uk/`, `/contact`, `/services`).

## Property

Every piece of visible text on the live homepage, services and contact pages has a
known contrast ratio against the backdrop it actually sits on — a number, not a
verdict — and each is either shown to pass WCAG AA or recorded as a named, reasoned
exception. This file is that record.

## What axe could and could not say

axe-core 4.12.1 returns `color-contrast` as **incomplete — needs manual review**
wherever text sits over a gradient, an image or a pseudo-element. The count of
incomplete nodes depends on page state: scroll-triggered `.reveal` sections are
excluded while `opacity:0`, and the sticky nav's background changes with scroll. At
fresh load `agent-browser a11y` reports 10 incomplete nodes per page; with the page
fully revealed (the state a reader actually experiences) in-page axe 4.12.1 reports
**52 on `/`, 29 on `/contact`, 59 on `/services`** — 140 nodes, the universe measured
here. (The queue brief's 45/26/21 sits between those states; same rule, same engine,
different reveal state.) The brief's reproduction command was run and confirmed:
`agent-browser open https://automancer.uk/` then `agent-browser a11y` → incomplete,
"background color could not be determined".

Everything axe **could** compute, it passed: 43 + 55 + 79 = 177 further text nodes
have axe-computed ratios with **0 violations on `/` and `/contact`**. `/services`
has **2 axe-computed violations** (solid background, no pixel work needed):

- `#offer-1 .offer__step` ("STEP 01") — `#7b7b86` on `#ffffff` = **4.18:1**, needs 4.5
- `#offer-3 .offer__step` ("STEP 03") — `#7b7b86` on `#ffffff` = **4.18:1**, needs 4.5

## Method (repeatable)

Toolchain: `agent-browser` 0.34.0 (one named session, headless Chrome, viewport
1280x633, DPR 1) + Python/PIL analysis. Scripts are throwaway lane tooling; the
method is what matters:

1. Enumerate: inject axe-core 4.12.1 in-page (CDN `<script>` is CSP-blocked, so the
   source is eval'd in via CDP in 60 kB chunks), scroll the page fully first so every
   `.reveal` is visible, `axe.run({runOnly:['color-contrast']})`, collect every
   incomplete node target.
2. For each target node, capture two screenshots of the node's box:
   - **A** — as rendered.
   - **B** — with the node's text made invisible via a temporary class:
     `color:transparent; -webkit-text-fill-color:transparent;
     -webkit-text-stroke-color:transparent; text-shadow:none; transition:none;
     animation:none` (`!important`, element + descendants). `background-image` is
     stripped **only** on nodes with `background-clip:text` (there it is glyph
     paint, not backdrop). Gradients, pseudo-elements, ancestor backgrounds and
     adjacent decorations all remain, so **every pixel of B is pure backdrop**.
   - Element-selector screenshots come back black for some composited/below-fold
     nodes in headless software rendering; those are captured instead as a viewport
     screenshot cropped to `getBoundingClientRect()` (same page state).
3. Analysis (PIL):
   - glyph mask = pixels where A and B differ by >12 in any channel.
   - For solid-colour text the mask is refined by a blend test: a true glyph pixel
     must be explainable as `B + a·(fg−B)`, `a∈[0,1]` (residual ≤30). This rejects
     animated decorations that differ between frames on their own (the pulsing
     "live" dot next to eyebrows), which otherwise poison the worst case.
   - Backdrop luminance = B's luminance **at the glyph-mask pixels** — the exact
     backdrop under the glyphs. Worst case uses the 2.5/97.5 percentiles of that
     distribution (backdrop is smooth; percentiles reject isolated contaminants),
     never an average.
   - Foreground: computed CSS `color` for solid text; for `background-clip:text`
     gradient text, the 5th–95th percentile luminance range of strongly-covered
     glyph pixels (A/B diff >60); for outline-only ghost numerals (transparent
     fill + 1px `-webkit-text-stroke`), the stroke colour.
   - Ratio = WCAG contrast of fg against the backdrop extreme that **minimises**
     it. Thresholds: 3:1 for large text (≥24px, or ≥18.66px with weight ≥700),
     else 4.5:1. Weight <700 counts as normal (conservative).
4. Special cases: the proof-strip marquee is `animation-play-state:paused` before
   measuring one representative `·` separator per page (all 14 separators are the
   same component: `rgb(74,74,85)` 11.52px on `rgb(13,13,16)`). Five tiny `→` arrow
   glyphs were analysed with the identical pipeline at a lower mask floor (diff >8,
   min 4 glyph px) because the whole glyph is ~20 pixels.

## Positive control (instrument proof)

Two synthetic pages (data: URLs) through the **identical** capture+analysis path:

| control | construction | expected | measured | verdict |
|---|---|---|---|---|
| control-fail | `color:#8c8c8c` on `linear-gradient(135deg,#787878,#989898)` | ≈1.2:1 | **1.19:1** | FAIL (instrument fires) |
| control-pass | `#ffffff` on `linear-gradient(135deg,#000,#222)` | ≥15:1 | **19.56:1** | PASS |

The instrument also produced the known-answer pair on a real element: the offer-1
ghost numeral's measured 1.73 matches the analytic value of `#c4c4cc` on `#ffffff`
(1.74) to within rounding.

## Counts

- **140 text nodes** measured across the three pages (52 + 29 + 59): **121 PASS,
  19 FAIL, 0 unmeasurable**. Per page: `/` 46/6, `/contact` 24/5, `/services` 51/8.
- Plus **2 axe-computed violations** on `/services` (`.offer__step`, above) →
  **21 failing text nodes in total**.
- 177 further text nodes pass with axe-computed ratios (no gradient/image involved).

The 19 pixel-measured failures are three components, not nineteen problems:

- **EX-1 — proof-strip separators (14 nodes, all three pages), 2.22:1 vs 4.5.**
  Decorative `·` glyphs in the scrolling proof marquee. *Named exception, accepted:*
  they are pure decoration between list items (WCAG 1.4.3 exempts decoration), the
  marquee duplicates content already present in the page, and no meaning is carried
  by the glyph. Recommendation (not applied): `aria-hidden="true"` on the strip, or
  lighten the separator token; do not ship as-is if the strip is ever made
  semantic.
- **EX-2 — ghost offer numerals (2 nodes, /services), 1.73:1 ("01") and 1.64:1
  ("04") vs 3.0.** 1px-stroke outline numerals with transparent fill,
  `aria-hidden="true"`; the adjacent `STEP 0n` label and offer heading carry the
  information. *Named exception, accepted* on the same decorative basis — but note
  the token pairing looks inverted: "01" uses light stroke `#c4c4cc` on white paper,
  "04" uses dark stroke `#34323d` on the near-black section, while "02" (light on
  dark) passes at 11.62. Recommendation: swap to the surface-appropriate stroke
  token; that is a design call, not made here.
- **Footer spectral tagline (3 nodes, all pages), 1.47–1.62:1 vs 4.5.** "very good
  engineering" rendered as `background-clip:text` gradient at 13.76px over a black
  footer; the darkest gradient stop (sampled glyph luminance as low as 0.024) is
  what fails. This is real, readable sentence text — **no exception claimed**.
  Recommendation: raise the dark stop of the footer spectral gradient or give the
  tagline a solid `--muted`-class colour. Grimoire palette decision, left to the
  site owner.

## Per-element table

Worst-case measured ratio; backdrop stated as the measured luminance range under
the glyphs. Thresholds: 4.5:1 normal text, 3:1 large text (≥24px or ≥18.66px bold).
Full selectors are truncated with `…` where long; every row corresponds to one axe
incomplete node from the fully-revealed enumeration.

| page | element (selector) | text | text colour | backdrop behind glyphs | worst-case ratio | AA threshold | verdict |
|---|---|---|---|---|---|---|---|
| / | `.nav__wordmark` | 'Automancer' | rgb(255, 255, 255) | rendered backdrop lum 0.000..0.002 | **20.05** | 4.5:1 normal | PASS |
| / | `.btn--sm > span` | 'CONTACT' | rgb(0, 0, 0) | rendered backdrop lum 1.000..1.000 | **21.0** | 4.5:1 normal | PASS |
| / | `.eyebrow--live` | 'AI & AUTOMATION CONSULTANCY · BRAD' | rgb(169, 169, 180) | rendered backdrop lum 0.000..0.008 | **7.8** | 4.5:1 normal | PASS |
| / | `h1` | 'Your admin, automated into oblivio' | rgb(244, 244, 246) | rendered backdrop lum 0.000..0.015 | **14.71** | 3.0:1 large | PASS |
| / | `h1 > .spectral-text` | 'oblivion' | gradient text, sampled lum 0.149..0.331 | rendered backdrop lum 0.001..0.013 | **3.15** | 3.0:1 large | PASS |
| / | `.hero__reveal` | 'We make small businesses run like ' | rgb(214, 214, 220) | rendered backdrop lum 0.000..0.006 | **12.87** | 3.0:1 large | PASS |
| / | `.hero__body` | 'Automancer builds the software and' | rgb(169, 169, 180) | rendered backdrop lum 0.000..0.004 | **8.4** | 4.5:1 normal | PASS |
| / | `span[data-typed=""]` | '' | rgb(214, 214, 220) | rendered backdrop lum 0.000..0.002 | **13.92** | 4.5:1 normal | PASS |
| / | `.hero__ctas > .btn[href$="contact"] > span` | 'BOOK AN AUTOMATION AUDIT — FROM £4' | rgb(0, 0, 0) | rendered backdrop lum 1.000..1.000 | **21.0** | 4.5:1 normal | PASS |
| / | `.btn--ghost.btn[href$="work"] > span:nth-child(1)` | 'SEE THE WORK' | rgb(244, 244, 246) | rendered backdrop lum 0.000..0.002 | **18.34** | 4.5:1 normal | PASS |
| / | `.nav__link[href$="services"]` | 'SERVICES' | rgb(180, 180, 190) | rendered backdrop lum 0.000..0.002 | **9.8** | 4.5:1 normal | PASS |
| / | `.btn--ghost.btn[href$="work"] > .btn__arrow` | '→' | rgb(244, 244, 246) | rendered backdrop lum 0.000..0.002 | **18.34** | 4.5:1 normal | PASS |
| / | `.nav__link[href$="work"]` | 'WORK' | rgb(180, 180, 190) | rendered backdrop lum 0.000..0.002 | **9.8** | 4.5:1 normal | PASS |
| / | `…> .wrap > p > .arrow-link[href$="services"] > .btn__arrow` | '→' |  | rendered backdrop lum 0.004 (uniform) | **19.78** | - | PASS |
| / | `…) > .wrap > .section-head > .section-head__top > .eyebrow` | 'SENSIBLE PRICES, PUBLISHED' | rgb(169, 169, 180) | rendered backdrop lum 0.000..0.002 | **8.65** | 4.5:1 normal | PASS |
| / | `…> .section-head > .section-head__top > .section-head__log` | '// no_funnel = true' | rgb(123, 123, 134) | rendered backdrop lum 0.000..0.002 | **4.82** | 4.5:1 normal | PASS |
| / | `…k.hatch.section:nth-child(4) > .wrap > .section-head > h2` | 'Not "let\'s get you on a call".' | rgb(244, 244, 246) | rendered backdrop lum 0.000..0.002 | **18.34** | 3.0:1 large | PASS |
| / | `…rk.hatch.section:nth-child(4) > .wrap > .section-head > p` | 'Enterprise automation firms quote ' | rgb(169, 169, 180) | rendered backdrop lum 0.000..0.002 | **8.65** | 4.5:1 normal | PASS |
| / | `…:nth-child(4) > .wrap > p > .arrow-link[href$="services"]` | "See what's included\n→" | rgb(244, 244, 246) | rendered backdrop lum 0.000..0.002 | **18.34** | 4.5:1 normal | PASS |
| / | `…> .wrap > p > .arrow-link[href$="services"] > .btn__arrow` | '→' |  | rendered backdrop lum 0.004 (uniform) | **19.12** | - | PASS |
| / | `.case-card--feature > .case-card__tag` | 'SOCIAL CARE / SUPPORTED LIVING · L' | rgb(123, 123, 134) | rendered backdrop lum 0.002..0.004 | **4.64** | 4.5:1 normal | PASS |
| / | `.case-card--feature > .case-card__title` | 'Automating a ~600-person care prov' | rgb(244, 244, 246) | rendered backdrop lum 0.003..0.007 | **16.89** | 3.0:1 large | PASS |
| / | `.case-card--feature > .case-card__blurb` | 'Rebuilding the digital spine of a ' | rgb(169, 169, 180) | rendered backdrop lum 0.003..0.008 | **7.84** | 4.5:1 normal | PASS |
| / | `.case-card--feature > .case-card__foot > .arrow-link` | 'Read the case study\n→' | rgb(244, 244, 246) | rendered backdrop lum 0.004..0.004 | **17.67** | 4.5:1 normal | PASS |
| / | `…d--feature > .case-card__foot > .arrow-link > .btn__arrow` | '→' |  | rendered backdrop lum 0.004 (uniform) | **17.67** | - | PASS |
| / | `a[href$="debiaser-ai-product"] > .case-card__tag` | 'PROFESSIONAL SERVICES / DEI CONSUL' | rgb(123, 123, 134) | rendered backdrop lum 0.002..0.003 | **4.7** | 4.5:1 normal | PASS |
| / | `a[href$="debiaser-ai-product"] > .case-card__title` | 'A £300–400 consultant job, done fo' | rgb(244, 244, 246) | rendered backdrop lum 0.004..0.006 | **17.02** | 3.0:1 large | PASS |
| / | `a[href$="debiaser-ai-product"] > .case-card__blurb` | 'We turned an expensive, human-bott' | rgb(169, 169, 180) | rendered backdrop lum 0.004..0.008 | **7.84** | 4.5:1 normal | PASS |
| / | `…$="debiaser-ai-product"] > .case-card__foot > .arrow-link` | 'Read\n→' | rgb(244, 244, 246) | rendered backdrop lum 0.004..0.004 | **17.55** | 4.5:1 normal | PASS |
| / | `…-product"] > .case-card__foot > .arrow-link > .btn__arrow` | '→' | rgb(244, 244, 246) | rendered backdrop lum 0.004..0.004 | **17.55** | 4.5:1 normal | PASS |
| / | `.case-card[data-spot=""]:nth-child(3) > .case-card__tag` | 'MANUFACTURING / BUILDING-PRODUCTS ' | rgb(123, 123, 134) | rendered backdrop lum 0.002..0.003 | **4.7** | 4.5:1 normal | PASS |
| / | `.case-card[data-spot=""]:nth-child(3) > .case-card__title` | 'Order-to-dispatch for a UK plastic' | rgb(244, 244, 246) | rendered backdrop lum 0.003..0.006 | **17.02** | 3.0:1 large | PASS |
| / | `.case-card[data-spot=""]:nth-child(3) > .case-card__blurb` | 'We replaced phone-and-memory order' | rgb(169, 169, 180) | rendered backdrop lum 0.004..0.008 | **7.84** | 4.5:1 normal | PASS |
| / | `…ta-spot=""]:nth-child(3) > .case-card__foot > .arrow-link` | 'Read\n→' | rgb(244, 244, 246) | rendered backdrop lum 0.004..0.004 | **17.55** | 4.5:1 normal | PASS |
| / | `…h-child(3) > .case-card__foot > .arrow-link > .btn__arrow` | '→' | rgb(244, 244, 246) | rendered backdrop lum 0.004..0.004 | **17.55** | 4.5:1 normal | PASS |
| / | `.arrow-link[href$="work"] > .btn__arrow` | '→' |  | rendered backdrop lum 0.004 (uniform) | **18.22** | - | PASS |
| / | `a[href$="developers"] > span` | 'DEVELOPER & AGENT DOCUMENTATION' | rgb(0, 0, 0) | rendered backdrop lum 1.000..1.000 | **21.0** | 4.5:1 normal | PASS |
| / | `.btn--ghost.btn[href$="llms.txt"] > span:nth-child(1)` | 'READ LLMS.TXT' | rgb(244, 244, 246) | rendered backdrop lum 0.002..0.002 | **18.22** | 4.5:1 normal | PASS |
| / | `.btn--ghost.btn[href$="llms.txt"] > .btn__arrow` | '→' | rgb(244, 244, 246) | rendered backdrop lum 0.002..0.002 | **18.22** | 4.5:1 normal | PASS |
| / | `.cta__head` | "Tell us what's eating your week." | rgb(244, 244, 246) | rendered backdrop lum 0.002..0.005 | **17.32** | 3.0:1 large | PASS |
| / | `.cta__body` | 'Fill in a short form. No calendar ' | rgb(169, 169, 180) | rendered backdrop lum 0.001..0.005 | **8.23** | 4.5:1 normal | PASS |
| / | `.cta__ctas > .btn[href$="contact"]:nth-child(1) > span` | 'START WITH AN AUDIT — FROM £450' | rgb(0, 0, 0) | rendered backdrop lum 1.000..1.000 | **21.0** | 4.5:1 normal | PASS |
| / | `.btn--ghost.btn[href$="contact"] > span:nth-child(1)` | 'JUST ASK A QUESTION' | rgb(244, 244, 246) | rendered backdrop lum 0.000..0.003 | **18.13** | 4.5:1 normal | PASS |
| / | `.btn--ghost.btn[href$="contact"] > .btn__arrow` | '→' | rgb(244, 244, 246) | rendered backdrop lum 0.000..0.000 | **19.0** | 4.5:1 normal | PASS |
| / | `.cta__reassure` | 'Based in Bradford. Working with bu' | rgb(123, 123, 134) | rendered backdrop lum 0.000..0.002 | **4.82** | 4.5:1 normal | PASS |
| / | `…_item-group:nth-child(1) > .proof-strip__sep:nth-child(7)` | '·' | rgb(74, 74, 85) | rendered backdrop lum 0.004 (uniform) | **2.22** | 4.5:1 normal | FAIL |
| / | `…_item-group:nth-child(1) > .proof-strip__sep:nth-child(9)` | '·' | rgb(74, 74, 85) | rendered backdrop lum 0.004 (uniform) | **2.22** | 4.5:1 normal | FAIL |
| / | `…item-group:nth-child(1) > .proof-strip__sep:nth-child(11)` | '·' | rgb(74, 74, 85) | rendered backdrop lum 0.004 (uniform) | **2.22** | 4.5:1 normal | FAIL |
| / | `…_item-group:nth-child(2) > .proof-strip__sep:nth-child(3)` | '·' | rgb(74, 74, 85) | rendered backdrop lum 0.004 (uniform) | **2.22** | 4.5:1 normal | FAIL |
| / | `…_item-group:nth-child(2) > .proof-strip__sep:nth-child(5)` | '·' | rgb(74, 74, 85) | rendered backdrop lum 0.004 (uniform) | **2.22** | 4.5:1 normal | FAIL |
| / | `.tlink` | 'waseem@automancer.uk' | rgb(169, 169, 180) | rendered backdrop lum 0.000..0.000 | **9.02** | 4.5:1 normal | PASS |
| / | `.footer__addr:nth-child(3) > .spectral-text` | 'very good engineering' | gradient text, sampled lum 0.024..0.401 | rendered backdrop lum 0.000..0.000 | **1.47** | 4.5:1 normal | FAIL |
| /contact | `.nav__link[href$="work"]` | 'WORK' | rgb(180, 180, 190) | rendered backdrop lum 0.000..0.002 | **9.74** | 4.5:1 normal | PASS |
| /contact | `.nav__link[href$="field-notes"]` | 'FIELD NOTES' | rgb(180, 180, 190) | rendered backdrop lum 0.001..0.004 | **9.46** | 4.5:1 normal | PASS |
| /contact | `.nav__link[href$="about"]` | 'ABOUT' | rgb(180, 180, 190) | rendered backdrop lum 0.002..0.004 | **9.41** | 4.5:1 normal | PASS |
| /contact | `.btn--sm > span` | 'CONTACT' | rgb(0, 0, 0) | rendered backdrop lum 1.000..1.000 | **21.0** | 4.5:1 normal | PASS |
| /contact | `.page-hero__inner > .eyebrow` | 'GET IN TOUCH' | rgb(169, 169, 180) | rendered backdrop lum 0.000..0.002 | **8.65** | 4.5:1 normal | PASS |
| /contact | `h1` | "Tell us what's eating your week." | rgb(244, 244, 246) | rendered backdrop lum 0.000..0.004 | **17.84** | 3.0:1 large | PASS |
| /contact | `.page-hero__sub` | 'No calendar gauntlet. No chatbot. ' | rgb(169, 169, 180) | rendered backdrop lum 0.000..0.002 | **8.65** | 4.5:1 normal | PASS |
| /contact | `.btn--full > span` | 'SEND IT TO WASEEM' | rgb(0, 0, 0) | rendered backdrop lum 1.000..1.000 | **21.0** | 4.5:1 normal | PASS |
| /contact | `.section-head > .eyebrow` | 'AFTER YOU HIT SEND' | rgb(169, 169, 180) | rendered backdrop lum 0.000..0.002 | **8.65** | 4.5:1 normal | PASS |
| /contact | `.wrap--text > .section-head > h2` | 'What happens next.' | rgb(244, 244, 246) | rendered backdrop lum 0.000..0.002 | **18.34** | 3.0:1 large | PASS |
| /contact | `.promise > .sys--spectral.sys` | 'THE ONE-WEEK PROMISE' | rgb(169, 169, 180) | rendered backdrop lum 0.002..0.003 | **8.55** | 4.5:1 normal | PASS |
| /contact | `.promise__big` | '1 week\nTO A MEETING, FROM FIRST CO' | rgb(169, 169, 180) | rendered backdrop lum 0.003..0.003 | **8.49** | 3.0:1 large | PASS |
| /contact | `.u` | 'TO A MEETING, FROM FIRST CONTACT' | rgb(169, 169, 180) | rendered backdrop lum 0.003..0.003 | **8.49** | 4.5:1 normal | PASS |
| /contact | `.promise > p:nth-child(3)` | 'Not a number in the diary three we' | rgb(169, 169, 180) | rendered backdrop lum 0.003..0.004 | **8.34** | 4.5:1 normal | PASS |
| /contact | `.step-num:nth-child(1) > div > h3` | 'Your message enters our pipeline' | rgb(244, 244, 246) | rendered backdrop lum 0.000..0.002 | **18.34** | 3.0:1 large | PASS |
| /contact | `.step-num:nth-child(1) > div > p` | 'It lands in the same project syste' | rgb(169, 169, 180) | rendered backdrop lum 0.000..0.002 | **8.65** | 4.5:1 normal | PASS |
| /contact | `.step-num:nth-child(2) > div > h3` | 'Waseem reads it. Personally.' | rgb(244, 244, 246) | rendered backdrop lum 0.000..0.002 | **18.34** | 3.0:1 large | PASS |
| /contact | `.step-num:nth-child(2) > div > p` | 'No auto-responder pretending to be' | rgb(169, 169, 180) | rendered backdrop lum 0.000..0.002 | **8.65** | 4.5:1 normal | PASS |
| /contact | `.step-num:nth-child(3) > div > h3` | 'You get a personal email back' | rgb(244, 244, 246) | rendered backdrop lum 0.000..0.002 | **18.34** | 3.0:1 large | PASS |
| /contact | `.step-num:nth-child(3) > div > p` | 'From Waseem, to arrange a proper c' | rgb(169, 169, 180) | rendered backdrop lum 0.000..0.002 | **8.65** | 4.5:1 normal | PASS |
| /contact | `.step-num:nth-child(4) > div > h3` | 'We take it from there' | rgb(244, 244, 246) | rendered backdrop lum 0.000..0.002 | **18.34** | 3.0:1 large | PASS |
| /contact | `.step-num:nth-child(4) > div > p` | 'Usually that means an Automation A' | rgb(169, 169, 180) | rendered backdrop lum 0.000..0.002 | **8.65** | 4.5:1 normal | PASS |
| /contact | `.wrap--text > .form__micro` | "That's it. No funnel, no pressure," | rgb(123, 123, 134) | rendered backdrop lum 0.000..0.002 | **4.82** | 4.5:1 normal | PASS |
| /contact | `…_item-group:nth-child(1) > .proof-strip__sep:nth-child(5)` | '·' | rgb(74, 74, 85) | rendered backdrop lum 0.004 (uniform) | **2.22** | 4.5:1 normal | FAIL |
| /contact | `…_item-group:nth-child(1) > .proof-strip__sep:nth-child(7)` | '·' | rgb(74, 74, 85) | rendered backdrop lum 0.004 (uniform) | **2.22** | 4.5:1 normal | FAIL |
| /contact | `…_item-group:nth-child(1) > .proof-strip__sep:nth-child(9)` | '·' | rgb(74, 74, 85) | rendered backdrop lum 0.004 (uniform) | **2.22** | 4.5:1 normal | FAIL |
| /contact | `…item-group:nth-child(1) > .proof-strip__sep:nth-child(11)` | '·' | rgb(74, 74, 85) | rendered backdrop lum 0.004 (uniform) | **2.22** | 4.5:1 normal | FAIL |
| /contact | `.tlink` | 'waseem@automancer.uk' | rgb(169, 169, 180) | rendered backdrop lum 0.000..0.000 | **9.02** | 4.5:1 normal | PASS |
| /contact | `.spectral-text` | 'very good engineering' | gradient text, sampled lum 0.031..0.387 | rendered backdrop lum 0.000..0.000 | **1.62** | 4.5:1 normal | FAIL |
| /services | `.nav__link[href$="work"]` | 'WORK' | rgb(180, 180, 190) | rendered backdrop lum 0.000..0.003 | **9.72** | 4.5:1 normal | PASS |
| /services | `.nav__link[href$="field-notes"]` | 'FIELD NOTES' | rgb(180, 180, 190) | rendered backdrop lum 0.001..0.005 | **9.35** | 4.5:1 normal | PASS |
| /services | `.nav__link[href$="about"]` | 'ABOUT' | rgb(180, 180, 190) | rendered backdrop lum 0.003..0.005 | **9.24** | 4.5:1 normal | PASS |
| /services | `.btn--sm > span` | 'CONTACT' | rgb(0, 0, 0) | rendered backdrop lum 1.000..1.000 | **21.0** | 4.5:1 normal | PASS |
| /services | `.page-hero__inner > .eyebrow` | 'SERVICES & PRICING' | rgb(169, 169, 180) | rendered backdrop lum 0.000..0.002 | **8.65** | 4.5:1 normal | PASS |
| /services | `h1` | 'Four ways in. All of them start wi' | rgb(244, 244, 246) | rendered backdrop lum 0.000..0.002 | **18.34** | 3.0:1 large | PASS |
| /services | `.page-hero__sub` | 'Most automation firms make you sit' | rgb(169, 169, 180) | rendered backdrop lum 0.000..0.002 | **8.65** | 4.5:1 normal | PASS |
| /services | `.form__micro` | 'Every price below is a from price ' | rgb(123, 123, 134) | rendered backdrop lum 0.000..0.002 | **4.82** | 4.5:1 normal | PASS |
| /services | `em` | 'from' | rgb(123, 123, 134) | rendered backdrop lum 0.000..0.002 | **4.82** | 4.5:1 normal | PASS |
| /services | `.cta__head` | 'Start where it makes sense for you' | rgb(244, 244, 246) | rendered backdrop lum 0.001..0.005 | **17.32** | 3.0:1 large | PASS |
| /services | `#offer-1 .offer__num` | '01' | text-stroke rgb(196, 196, 204) (transparent fill) | rendered backdrop lum 1.000..1.000 | **1.73** | 3.0:1 large | FAIL |
| /services | `#offer-1 .btn--primary > span:nth-child(1)` | 'BOOK AN AUDIT' | rgb(255, 255, 255) | rendered backdrop lum 0.003..0.003 | **19.78** | 4.5:1 normal | PASS |
| /services | `#offer-1 .btn--primary .btn__arrow` | '→' | rgb(255, 255, 255) | rendered backdrop lum 0.003..0.003 | **19.78** | 4.5:1 normal | PASS |
| /services | `#offer-2 .offer__num` | '02' | text-stroke rgb(196, 196, 204) (transparent fill) | rendered backdrop lum 0.000..0.002 | **11.62** | 3.0:1 large | PASS |
| /services | `…_lede.reveal.is-visible > .offer__stepline > .offer__step` | 'Rung 02 · act fast' | rgb(123, 123, 134) | rendered backdrop lum 0.000..0.002 | **4.82** | 4.5:1 normal | PASS |
| /services | `…rse.offer > .offer__lede.reveal.is-visible > .offer__name` | 'Workflow Sprint' | rgb(244, 244, 246) | rendered backdrop lum 0.000..0.002 | **18.34** | 3.0:1 large | PASS |
| /services | `…fer__lede.reveal.is-visible > .offer__price > .offer__amt` | '£1,950' | rgb(244, 244, 246) | rendered backdrop lum 0.000..0.002 | **18.34** | 3.0:1 large | PASS |
| /services | `… > .offer__lede.reveal.is-visible > .offer__price > .note` | 'from' | rgb(169, 169, 180) | rendered backdrop lum 0.000..0.002 | **8.65** | 4.5:1 normal | PASS |
| /services | `…erse.offer > .offer__lede.reveal.is-visible > .offer__one` | '1–3 automations, live and working,' | rgb(244, 244, 246) | rendered backdrop lum 0.000..0.002 | **18.34** | 4.5:1 normal | PASS |
| /services | `…erse.offer > .offer__lede.reveal.is-visible > .offer__who` | 'You already know what’s broken — t' | rgb(169, 169, 180) | rendered backdrop lum 0.000..0.002 | **8.65** | 4.5:1 normal | PASS |
| /services | `… > .btn--primary.btn[href$="contact"] > span:nth-child(1)` | 'START A SPRINT' | rgb(0, 0, 0) | rendered backdrop lum 1.000..1.000 | **21.0** | 4.5:1 normal | PASS |
| /services | `…ild(6) > .btn--primary.btn[href$="contact"] > .btn__arrow` | '→' |  | rendered backdrop lum 0.004 (uniform) | **21.0** | - | PASS |
| /services | `…--reverse.offer > .offer__includes.reveal.is-visible > h3` | "WHAT'S INCLUDED" | rgb(123, 123, 134) | rendered backdrop lum 0.000..0.002 | **4.82** | 4.5:1 normal | PASS |
| /services | `….offer__includes.reveal.is-visible > ul > li:nth-child(1)` | 'We take 1–3 specific, well-defined' | rgb(244, 244, 246) | rendered backdrop lum 0.000..0.002 | **18.34** | 4.5:1 normal | PASS |
| /services | `….offer__includes.reveal.is-visible > ul > li:nth-child(2)` | 'Built on tools you already use whe' | rgb(244, 244, 246) | rendered backdrop lum 0.000..0.002 | **18.34** | 4.5:1 normal | PASS |
| /services | `….offer__includes.reveal.is-visible > ul > li:nth-child(3)` | 'Live in production in around two w' | rgb(244, 244, 246) | rendered backdrop lum 0.000..0.002 | **18.34** | 4.5:1 normal | PASS |
| /services | `….offer__includes.reveal.is-visible > ul > li:nth-child(4)` | 'Handover so your team knows how it' | rgb(244, 244, 246) | rendered backdrop lum 0.000..0.002 | **18.34** | 4.5:1 normal | PASS |
| /services | `…ffer > .offer__includes.reveal.is-visible > .offer__catch` | 'Good examples: enquiry-to-quote ha' | rgb(169, 169, 180) | rendered backdrop lum 0.000..0.002 | **8.65** | 4.5:1 normal | PASS |
| /services | `…ible > .offer__stepline > .offer__num[aria-hidden="true"]` | '03' | rgba(0, 0, 0, 0) | rendered backdrop lum 1.000..1.000 | **21.0** | 3.0:1 large | PASS |
| /services | `… > .offer__lede.reveal.is-visible > .offer__price > .note` | 'from' | rgb(76, 76, 85) | rendered backdrop lum 1.000..1.000 | **8.49** | 4.5:1 normal | PASS |
| /services | `… > .btn--primary.btn[href$="contact"] > span:nth-child(1)` | 'SCOPE A BUILD' | rgb(255, 255, 255) | rendered backdrop lum 0.003..0.003 | **19.78** | 4.5:1 normal | PASS |
| /services | `…ild(6) > .btn--primary.btn[href$="contact"] > .btn__arrow` | '→' | rgb(255, 255, 255) | rendered backdrop lum 0.003..0.003 | **19.78** | 4.5:1 normal | PASS |
| /services | `…ible > .offer__stepline > .offer__num[aria-hidden="true"]` | '04' | text-stroke rgb(52, 52, 61) (transparent fill) | rendered backdrop lum 0.000..0.002 | **1.64** | 3.0:1 large | FAIL |
| /services | `…_lede.reveal.is-visible > .offer__stepline > .offer__step` | 'Rung 04 · stay live' | rgb(123, 123, 134) | rendered backdrop lum 0.000..0.002 | **4.82** | 4.5:1 normal | PASS |
| /services | `…rse.offer > .offer__lede.reveal.is-visible > .offer__name` | 'AI Ops Partner' | rgb(244, 244, 246) | rendered backdrop lum 0.000..0.002 | **18.34** | 3.0:1 large | PASS |
| /services | `…eal.is-visible > .offer__price > .offer__amt:nth-child(1)` | '£495' | rgb(244, 244, 246) | rendered backdrop lum 0.000..0.002 | **18.34** | 3.0:1 large | PASS |
| /services | `.offer__amt:nth-child(2)` | '/mo' | rgb(244, 244, 246) | rendered backdrop lum 0.000..0.002 | **18.34** | 3.0:1 large | PASS |
| /services | `… > .offer__lede.reveal.is-visible > .offer__price > .note` | 'from · cancel anytime' | rgb(169, 169, 180) | rendered backdrop lum 0.000..0.002 | **8.65** | 4.5:1 normal | PASS |
| /services | `…erse.offer > .offer__lede.reveal.is-visible > .offer__one` | 'We don’t build it and vanish. We s' | rgb(244, 244, 246) | rendered backdrop lum 0.000..0.002 | **18.34** | 4.5:1 normal | PASS |
| /services | `…erse.offer > .offer__lede.reveal.is-visible > .offer__who` | 'You’ve got automation live and you' | rgb(169, 169, 180) | rendered backdrop lum 0.000..0.002 | **8.65** | 4.5:1 normal | PASS |
| /services | `… > .btn--primary.btn[href$="contact"] > span:nth-child(1)` | 'BECOME A PARTNER' | rgb(0, 0, 0) | rendered backdrop lum 1.000..1.000 | **21.0** | 4.5:1 normal | PASS |
| /services | `…ild(6) > .btn--primary.btn[href$="contact"] > .btn__arrow` | '→' | rgb(0, 0, 0) | rendered backdrop lum 1.000..1.000 | **21.0** | 4.5:1 normal | PASS |
| /services | `…--reverse.offer > .offer__includes.reveal.is-visible > h3` | "WHAT'S INCLUDED" | rgb(123, 123, 134) | rendered backdrop lum 0.000..0.002 | **4.82** | 4.5:1 normal | PASS |
| /services | `….offer__includes.reveal.is-visible > ul > li:nth-child(1)` | 'We monitor and maintain everything' | rgb(244, 244, 246) | rendered backdrop lum 0.000..0.002 | **18.34** | 4.5:1 normal | PASS |
| /services | `….offer__includes.reveal.is-visible > ul > li:nth-child(2)` | 'A steady drip of new automation — ' | rgb(244, 244, 246) | rendered backdrop lum 0.000..0.002 | **18.34** | 4.5:1 normal | PASS |
| /services | `….offer__includes.reveal.is-visible > ul > li:nth-child(3)` | 'A human (Waseem) who knows your se' | rgb(244, 244, 246) | rendered backdrop lum 0.000..0.002 | **18.34** | 4.5:1 normal | PASS |
| /services | `….offer__includes.reveal.is-visible > ul > li:nth-child(4)` | 'Cancel anytime. No twelve-month lo' | rgb(244, 244, 246) | rendered backdrop lum 0.000..0.002 | **18.34** | 4.5:1 normal | PASS |
| /services | `…ffer > .offer__includes.reveal.is-visible > .offer__catch` | 'Why it’s priced like this: because' | rgb(169, 169, 180) | rendered backdrop lum 0.000..0.002 | **8.65** | 4.5:1 normal | PASS |
| /services | `.cta__body` | "Not sure which rung you're on? Sta" | rgb(169, 169, 180) | rendered backdrop lum 0.001..0.004 | **8.29** | 4.5:1 normal | PASS |
| /services | `.cta__ctas > .btn[href$="contact"]:nth-child(1) > span` | 'BOOK AN AUDIT — FROM £450' | rgb(0, 0, 0) | rendered backdrop lum 1.000..1.000 | **21.0** | 4.5:1 normal | PASS |
| /services | `.btn--ghost > span:nth-child(1)` | 'ASK US WHICH OFFER FITS' | rgb(244, 244, 246) | rendered backdrop lum 0.000..0.002 | **18.34** | 4.5:1 normal | PASS |
| /services | `.btn--ghost > .btn__arrow` | '→' | rgb(244, 244, 246) | rendered backdrop lum 0.000..0.000 | **19.12** | 4.5:1 normal | PASS |
| /services | `…_item-group:nth-child(1) > .proof-strip__sep:nth-child(3)` | '·' | rgb(74, 74, 85) | rendered backdrop lum 0.004 (uniform) | **2.22** | 4.5:1 normal | FAIL |
| /services | `…_item-group:nth-child(1) > .proof-strip__sep:nth-child(5)` | '·' | rgb(74, 74, 85) | rendered backdrop lum 0.004 (uniform) | **2.22** | 4.5:1 normal | FAIL |
| /services | `…_item-group:nth-child(1) > .proof-strip__sep:nth-child(7)` | '·' | rgb(74, 74, 85) | rendered backdrop lum 0.004 (uniform) | **2.22** | 4.5:1 normal | FAIL |
| /services | `…_item-group:nth-child(1) > .proof-strip__sep:nth-child(9)` | '·' | rgb(74, 74, 85) | rendered backdrop lum 0.004 (uniform) | **2.22** | 4.5:1 normal | FAIL |
| /services | `…item-group:nth-child(1) > .proof-strip__sep:nth-child(11)` | '·' | rgb(74, 74, 85) | rendered backdrop lum 0.004 (uniform) | **2.22** | 4.5:1 normal | FAIL |
| /services | `.tlink` | 'waseem@automancer.uk' | rgb(169, 169, 180) | rendered backdrop lum 0.000..0.000 | **9.02** | 4.5:1 normal | PASS |
| /services | `.spectral-text` | 'very good engineering' | gradient text, sampled lum 0.024..0.402 | rendered backdrop lum 0.000..0.000 | **1.48** | 4.5:1 normal | FAIL |
| /services | `#offer-1 .offer__step` | 'STEP 01' | #7b7b86 | solid #ffffff (axe-computed) | **4.18** | 4.5:1 normal | FAIL (axe) |
| /services | `#offer-3 .offer__step` | 'STEP 03' | #7b7b86 | solid #ffffff (axe-computed) | **4.18** | 4.5:1 normal | FAIL (axe) |

## What this lane did NOT do

- Did not restyle anything. All 21 failures are recorded above with
  recommendations; the Grimoire palette is a design decision. No colour was
  changed, because every fix touches a deliberate token or gradient.
- Did not edit `VISION.md` (read-only).
- Did not add axe-core to the committed test suite — `tests/README.md:76-83`
  documents the deliberate choice of hand-written structural assertions; axe was
  used only as an investigative tool, in-page, against the live site. Nothing in
  `tests/` changed.
- Did not measure mobile viewports, hover/focus states, or pages other than `/`,
  `/contact`, `/services` — out of the lane's scope.
- Did not leave a browser running: session `contrast-874c` closed by name, daemon
  and profile verified gone (see lane report).
