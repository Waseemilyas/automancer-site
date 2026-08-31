# q-auto-c56d — re-derive page-weight budgets in one pass

Lane: `q-auto-c56d` (p3, verdict `do`). Branch: `fix/q-auto-c56d-perf-budgets-rederive`.
Repo: `/opt/automancer/projects/automancer/automancer-site`. Cut from `origin/main`
at `c7bd901`. Orchestrator: `orch-auto`.

## Property

Every page-weight number in this repo is a measurement of the current build,
taken in one pass, with the date it was taken — and the gate trips on a real
regression rather than on shared-bundle drift.

## Build environment

Read `.github/workflows/deploy.yml`. The Build step (the `run: pnpm run build`
step, `env:` block immediately under it) is the only place the production build
sets a variable:

```
PUBLIC_AUT_SENTRY_WEB_DSN: ${{ vars.PUBLIC_AUT_SENTRY_WEB_DSN }}
```

That is the only env var on that step. `ci.yml`'s "Test production build" step
runs `pnpm run test` with no env block, so vitest `globalSetup` builds with
the variable unset.

This measurement set `PUBLIC_AUT_SENTRY_WEB_DSN=""` for `pnpm run build`,
matching:

1. The 2026-08-22 measurement recorded in `docs/PERFORMANCE.md` / the test
   header (`PUBLIC_AUT_SENTRY_WEB_DSN=""`).
2. What CI's test job actually builds (variable not injected).
3. Sentry tree-shaken out; `assets/js/main.js` the only external script.

A DSN-present measurement would ship Sentry and would not be comparable to
the gate that replaces it. Production Pages *does* inject the repository
variable (DEPLOYMENT.md verified a live ingest DSN on 2026-08-22); that is
a known local/CI vs production split, not closed by this lane.

Command:

```
campaign heavy --label q-auto-c56d-build -- env PUBLIC_AUT_SENTRY_WEB_DSN="" pnpm run build
```

Build completed 2026-08-31T11:55:35Z, `campaign heavy` held slot 1 after
waiting 729s. Then one `node tests/support/perf-cli.ts --csv` against that
`dist/` — it never builds.

## Raw `--csv` output (verbatim)

```
route,html,css,js,fonts,images,total
/,21440,52026,4751,120620,6960,205797
/404/,18339,52026,4751,120620,6960,202696
/about.html/,297,0,0,0,0,297
/about/,17365,52026,4751,120620,6960,201722
/book.html/,306,0,0,0,0,306
/contact/,25485,52026,4751,120620,6960,209842
/developers/,19947,52026,4751,120620,6960,204304
/field-notes/,18232,52026,4751,120620,6960,202589
/field-notes/automation-for-care-providers-where-to-start/,19845,52026,4751,120620,6960,204202
/field-notes/b2b-trade-portals-what-to-build-first/,20322,52026,4751,120620,6960,204679
/field-notes/cqc-compliance-evidence-stop-scrambling/,19621,52026,4751,120620,6960,203978
/field-notes/credit-hire-website-compliance-trust-checklist/,21822,52026,4751,120620,6960,206179
/field-notes/five-signs-spreadsheet-problem/,20885,52026,4751,120620,6960,205242
/field-notes/manufacturing-order-processing-phone-and-memory-pricing/,20608,52026,4751,120620,6960,204965
/field-notes/new-business-website-legal-compliance-checklist/,21172,52026,4751,120620,6960,205529
/field-notes/self-storage-software-what-to-check-before-you-sign/,20300,52026,4751,120620,6960,204657
/field-notes/small-business-website-cost-2026/,20325,52026,4751,120620,6960,204682
/field-notes/what-does-an-ai-agent-actually-cost/,19112,52026,4751,120620,6960,203469
/privacy.html/,309,0,0,0,0,309
/privacy/,21727,52026,4751,120620,6960,206084
/services.html/,315,0,0,0,0,315
/services/,23554,52026,4751,120620,6960,207911
/terms.html/,297,0,0,0,0,297
/terms/,12438,52026,4751,120620,6960,196795
/work/,15920,52026,4751,120620,6960,200277
/work/care-provider-transformation/,20334,52026,4751,120620,6960,204691
/work/debiaser-ai-product/,17942,52026,4751,120620,6960,202299
/work/fast-small-business-websites/,16061,52026,4751,120620,6960,200418
/work/manufacturer-trade-portal/,16876,52026,4751,120620,6960,201233
```

stderr from that same run: `pages: 29  sum(total): 4781.0 KiB  dist: /opt/automancer/projects/automancer/automancer-site/dist`

Copy also at `/opt/automancer/var/scratch/q-auto-c56d/perf-2026-08-31.csv`.

## Route counts

| set | before | after | added | removed |
|---|---:|---:|---|---|
| `MEASURED_TOTAL` (layout pages the gate covers) | 24 | 24 | none | none |
| `perf-cli` HTML pages (layout + redirect stubs) | 29 | 29 | none | none |
| `docs/PERFORMANCE.md` live table | 28 (27 After + 1 Later; `/developers/` was in the gate but missing from the docs tables) | 29 | `/developers/` added to the docs table only — it was already in `MEASURED_TOTAL` | After table and Later-additions patch list collapsed into this one table |

Named: no route added to the site, none removed. `/developers/` appears in the
docs table for the first time because the old After snapshot predated it and
the Later-additions list never picked it up. Redirect stubs (`/about.html/`,
`/book.html/`, `/privacy.html/`, `/services.html/`, `/terms.html/`) still
present, still under the 1024 B stub ceiling.

## Shared CSS

| when | css per layout page |
|---|---:|
| 2026-08-22 snapshot | 48,987 |
| 2026-08-24 later-additions note | 50,958 |
| 2026-08-31 this pass | **52,026** |

JS 4,751 / fonts 120,620 / images 6,960 — unchanged.

## Pages whose growth is not explained by shared CSS

Against the 2026-08-22 After table (css 48,987 → 52,026 = **+3,039 B**):

Typical layout page: HTML −807 B + CSS +3,039 B = total **+2,232 B**.

HTML that grew beyond that:

- `/404/` HTML **+501 B** (total +3,540 B). Markup, not a new asset.
- `/privacy/` HTML **+380 B** (total +3,419 B). Markup, not a new asset.
- `/contact/` HTML **+1,859 B** vs the After table. Already in the live gate at
  209,540 B after the `LEAD_ERROR_COPY` map; vs that later gate value, contact
  grew only +302 B total this pass (HTML shrank). Not new growth here.

No page grew a script, a font, or an image. Nothing is a payload-class
finding. The 404 and privacy HTML deltas are named because the brief requires
naming them; they are hundreds of bytes of copy/markup, not a reason to
stop the re-derive. **No budget was raised to make a test pass** — every
`MEASURED_TOTAL` entry is the CSV total for that route.

## Gate still bites

After the measurement commit was pushed, temporarily set
`MEASURED_TOTAL['/terms/']` from **196795** to **190000** (same trick the
2026-08-22 write-up used). Ran `PUBLIC_AUT_SENTRY_WEB_DSN="" pnpm run test`
inside the same `campaign heavy` slot as the green verify. The suite **failed**:

```
FAIL  tests/performance.test.ts > page-weight budgets > keeps every layout page within its measured total-weight budget
AssertionError: /terms/: total 196795 B > budget 193800 B (measured 190000 B on 2026-08-31 + 3800 B headroom). Something got heavier — see docs/PERFORMANCE.md for how to re-derive.: expected 196795 to be less than or equal to 193800
```

Counts for that run: **135 passed / 1 failed / 0 skipped out of 136 collected**
(Test Files: 1 failed | 12 passed (13)). Then `git checkout -- tests/performance.test.ts`.
Confirmed `/terms/` is 196795 again and `git diff` against HEAD is empty.

The live weight in the failure (196795) is the CSV total for `/terms/`. The
gate trips on a real page, not on a guess.

## Full gate counts

`ci.yml` test job: `pnpm run check` then `pnpm run test`. Local equivalent is
`pnpm run verify`. Ran after the bite revert, same empty DSN, against a
rebuild of the same source (`campaign heavy --label q-auto-c56d-gate`).

| suite | result |
|---|---|
| `pnpm run check` (`astro check`) | **0 errors / 0 warnings / 0 hints out of 81 files** |
| `pnpm run test` (`vitest run`, globalSetup rebuilds) | **136 passed / 0 failed / 0 skipped out of 136 collected** (13 files) |
| bite (same `pnpm run test`, lowered `/terms/`) | **135 passed / 1 failed / 0 skipped out of 136 collected** |
| `ops/verify-production.sh --self-test` (CI's other job; 127.0.0.1 fixture, not production) | **all 24 locally isolatable assertions across 10 checks can fail AND can pass.** EXIT 0 |

`pnpm run verify` is `check && test`. That is the full test-job gate. The
self-test job was run as well; it does not rebuild the site.

## What was edited

- `tests/performance.test.ts` — `MEASURED_TOTAL` / `MEASURED_JS` /
  `MEASURED_FONTS` dates and totals from the CSV. Budgets still
  `measured + max(1024, ceil(measured × 0.02))`. No assertion deleted or
  weakened.
- `docs/PERFORMANCE.md` — one Current table from that CSV; After + Later
  additions collapsed; method prose kept; "what moved" note added.
- this file.

No page content, CSS, fonts, or images were changed. `deploy.yml` was read,
not touched. No deploy.
