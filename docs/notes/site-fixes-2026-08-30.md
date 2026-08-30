# Site fixes — 2026-08-30

Queue items: `q-auto-d136` (p1), `q-auto-5473` (p1), `q-auto-2a42` (p2),
`q-auto-ae96` (p2), `q-auto-6d75` (p3).

Authority: `git show origin/main:VISION.md` (read-only). Colour work is
constrained by `docs/notes/site-a11y-2026-08-30.md`: do not touch global
`--faint` (`#7b7b86`, 5.020:1 on black). The light-surface token
`--faint-dark: #6d6d77` is already in the palette and already gated.

## Computed pairs (WCAG 2.x relative luminance)

| Pair | Foreground | Background | Ratio | AA normal (4.5) |
| --- | --- | --- | ---: | --- |
| `--muted` on paper | `#a9a9b4` | `#ffffff` | **2.328:1** | fail |
| `--muted-dark` on paper | `#4c4c55` | `#ffffff` | **8.494:1** | pass |
| `--muted` on near | `#a9a9b4` | `#08080a` | **8.596:1** | pass |
| `--muted` on black | `#a9a9b4` | `#000000` | **9.021:1** | pass |
| `--faint` on black | `#7b7b86` | `#000000` | **5.020:1** | pass (leave) |
| `--faint-dark` on paper | `#6d6d77` | `#ffffff` | **5.117:1** | pass (leave) |

`--muted` on paper is the dark-surface token used on a light surface — the
same class of mistake as the services-label defect, one section over.

## Plan

- **d136.** Replace inline `color: var(--muted)` on 404 paper descriptions
  with `class="muted"`. `.on-paper .muted { color: var(--muted-dark); }`
  already exists. Dark (`.on-near`) descriptions keep `--muted` via the
  same class. Do not change token values.
- **5473.** On client-side validation failure: `aria-invalid`,
  `aria-describedby="form-error"`, `focus()`, `scrollIntoView`. Never POST
  the live intake endpoint; drive the built script against a stub fetch.
- **2a42.** Put the human section list before `#agent-recovery`.
- **ae96 / 6d75.** Reproduce at 375 before deciding. Hamburger 42×34 is
  below the 44px HIG guideline and **not** a WCAG 2.2 AA violation
  (floor 24px). If the hit area is enlarged, say so.

## Verification

### Contrast (computed in Chrome, 1440)

| Surface | Before | After | Result |
| --- | --- | ---: | --- |
| 404 paper descriptions | `#a9a9b4` on `#fff`: **2.328:1** | `#4c4c55` (`--muted-dark`) on `#fff`: **8.494:1** | AA pass at 17.44px |
| 404 near descriptions | `#a9a9b4` on `#08080a`: **8.596:1** | unchanged **8.596:1** | still AA |
| Services light labels | `#6d6d77` on `#fff`: **5.117:1** | unchanged | still AA |
| Services dark labels | `#7b7b86` on `#000`: **5.020:1** | unchanged | still AA |
| `--faint` on black | **5.020:1** | untouched | left alone |

Vision described the paper dates as the old failing grey. Computed style is `rgb(76, 76, 85)` — source wins.

### Contact form at 375×812

Exercised only against `http://127.0.0.1:4397` with `network route https://api.automancer.uk/** --abort`. Empty submit never called fetch. After Send was in view (`#name` at top −561), submit showed "Please add your name.", focused `#name`, `aria-invalid=true`, `aria-describedby=form-error`. After smooth scroll (~800ms): `#name` in view at top 378, `scrollY` 1172. No POST to the intake endpoint.

### Hero / hamburger at 375

- 375×812: both CTAs in view (Audit 635–701, See the work 717–763). Hero `min-height: 0`, height 787px. Desktop 1440 still `min-height: 900px` (100svh) with both CTAs in view.
- 375×667 (iPhone SE height): second CTA still below the fold after spacing cuts. Not cut further — that would mean shrinking the headline or body copy. Stated as remaining at the shorter phone height.
- Hamburger measured **44×44**. Comfort bump to the HIG guideline; **not** a WCAG 2.2 AA fix (floor is 24px). Previously 42×34.

### Suites

- `campaign heavy --label site-fixes-tests -- pnpm test` — **131 passed / 0 failed / 0 skipped** (13 files). Baseline 122; +9 assertions.
- Mutations (one heavy slot): focus removed → contact-errors **2 failed / 8 passed**; `--muted` inlined on paper → contrast **2 failed / 6 passed**; `id="agent-recovery"` planted on the 404 hero → developer-surface order **1 failed / 22 passed**. Restored. `pnpm test` **131 passed / 0 failed / 0 skipped**. `tsc --noEmit` 0 errors.

## Out of scope

- Global `--faint` / `--muted` token values.
- Submitting the contact form to the production endpoint.
- `VISION.md`, `/opt/automancer/auto`, `RELEASE_NOTES_SKIP=1`.
- Fitting both hero CTAs into a 375×667 viewport (would require cutting copy or type).

