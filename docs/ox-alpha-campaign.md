# Ox Alpha Campaign — automancer-site

**Repo:** `automancer/automancer-site` (public marketing site, automancer.uk)
**Orchestrator:** Claude (herdr pane w2), delegated authority via campaign lead.
**Started:** 2026-08-21 evening (UK).
**Baseline tag (undo point):** `ox-campaign-baseline-2026-08-21` at `fc50855`.
**Deploy rights:** full — non-client repo, Pages-via-workflow on push to `main`.

## Goal

Make automancer.uk materially better in one night of unmetered ox-alpha lanes.
Priority handed down: **IDEAS.md item 2 — is-agentic.com agent-readiness.**
automancer.uk should score highly. Public website copy is not gated.

## Starting state (surveyed 2026-08-21)

- Astro 7 static site, 37 files in `src/`, deployed to GitHub Pages.
- **Zero tests.** No test runner, no CI check beyond the deploy workflow.
- No `VISION.md`, no `docs/` directory before this file.
- Agent-readiness already present: `/llms.txt` (generated from `src/data/business.ts`),
  `robots.txt` with sitemap, `@astrojs/sitemap`, a `JsonLd` component.
- Working tree was **clean** at campaign start — no pre-existing uncommitted work
  to absorb or rescue.

## Staged programme

| # | Slice | Status |
|---|-------|--------|
| 0 | Baseline tag + plan file | done |
| 1 | Survey — honest architecture/risk/debt report | running (`survey2`) |
| 2 | Safety net — vitest harness over the built output + CI | running (`testnet2`) |
| 3 | Agent-readiness (is-agentic.com) — the flagship slice | briefed, queued |
| 4 | Frontend / a11y / performance pass | briefed, queued |
| 5 | Drift + dead-asset cleanup | briefed, queued |
| 6 | Further slices decided from the survey | pending |

## Lanes

| Lane | Brief | Outcome |
|------|-------|---------|
| `survey` | Read whole repo, report architecture/risks/debt | **dead — landed nothing** (omp no-op) |
| `testnet` | Build vitest harness from zero | **dead — landed nothing** (omp no-op) |
| `survey2` | Same brief, absolute path, opencode path | running |
| `testnet2` | Same brief, absolute path, opencode path | running |

## Decisions taken without Waseem

- (logged to the campaign `DECISIONS.md` as they happen; mirrored here)

## Findings

- (filled in as lanes land)

## What is-agentic.com actually measures (researched 2026-08-21)

Scoring is three pools:

- **Essential — 80 points.** Server-rendered content available without running
  JavaScript; correct HTTP behaviour and status codes; clear document structure;
  error recovery; usable interactive controls.
- **Recommended — 20 points, conditional.** Only activates where the site shows
  evidence it offers that capability: API endpoints, OAuth, GraphQL, an MCP
  server, a developer portal, e-commerce. Checks that do not apply are excluded
  rather than failed, so a brochure site is not punished for lacking a checkout.
- **Bonus — capped at 5 points.** Emerging formats (llms.txt and similar). Bonus
  can only add, never subtract.

There is also a non-scoring "observed agent journey" — a real agent is driven
around the site and its path is reported as evidence.

**What that means for us.** Being a static Astro site already wins most of the
Essential pool: everything is server-rendered and there is no JS gate. The two
real Essential exposures are (a) HTTP status correctness — our legacy redirects
in `astro.config.mjs` are emitted as meta-refresh pages, which return **200, not
301**, and (b) error recovery and interactive controls, which nobody has audited.
The Recommended pool is the interesting one: it is conditional, so the way to
earn it is to genuinely *offer* machine-readable capabilities and advertise them.

## Throttle (campaign lead, 2026-08-21 ~22:15 UTC)

Box overloaded — load 61 on 20 cores, swap exhausted. Adopted immediately:
max **2** concurrent lanes, never a build or full test run while two lanes are
up, PID-targeted kills only, and temp-file-then-`mv` for any shared file.

Also noted: pass `oxlane` an **absolute** repo path. Passing `.` names the log
file `.-<lane>-<stamp>.log`, which is hidden and easy to miss when verifying.

## Lane failure and re-dispatch (2026-08-21 ~22:15 UTC)

The first two lanes (`survey`, `testnet`) both produced **nothing**. Verified from
disk and git, not from their logs: no `tests/` directory, no change to
`package.json`, no survey document, clean working tree — while one had exited
with status 0 and a plausible-looking log.

Root cause was found campaign-wide by three other orchestrators: the `omp`
harness silently no-ops on any tool-using task with this model. It prints
"Working...", exits 0, and does no work. The model itself was fine throughout —
a prompt with no tools answers instantly. The campaign lead has repointed the
`oxlane` helper at `opencode run`, which is verified end to end doing real file
edits.

Three separate silent failure modes were in play in the first twenty minutes:
a truncated helper script (exit 127), a stdin-EOF patch (exit 0, no work), and
`omp`'s tool loop (exit 0, no work). All three look like success from outside.

**Standing rule adopted for the rest of this campaign: a lane is not done until
its work has been seen on disk.** An exit code and a plausible log prove nothing.

Both lanes re-dispatched on the working path as `survey2` and `testnet2`, this
time with absolute repo paths. Both confirmed producing real output.

## Partial-write audit (2026-08-21 ~22:25 UTC)

The campaign lead corrected an earlier instruction: the dangerous failure mode is
not a clean no-op but a **partial write** — early tool calls land, then the loop
dies, leaving a plausible half-state that only fails on first use. Another repo
had a lane whose entire visible output was "Working..." which had nonetheless
edited `package.json`, written 270 lines of lockfile, and added a script pointing
at a config file it never created.

Audited this repo against the baseline tag for exactly that. **Clean.**

- Only delta since baseline: three `docs/ox-alpha-campaign.md` commits.
- `git status --porcelain` empty — no untracked files either.
- `package.json` and `pnpm-lock.yaml` byte-identical to baseline.
- Gitignored paths checked too, since git would never have shown them: there is
  no `node_modules` directory at all, so the dead lane never reached
  `pnpm install`. No `dist/`.
- Filesystem sweep: the only file in the repo modified since 22:00 is the plan
  file.
- Reflog clean — no stray checkout or reset.

Both dead lanes here died *before* their first write. Nothing to keep or revert,
so the replacement lanes started from a genuinely clean tree.

Incidental find, deferred to the cleanup slice: `.impeccable/` directories are
gitignored but present, including one nested at
`src/content/case-studies/.impeccable/`. Leftovers from an earlier design run.
