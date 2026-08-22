# Ox Alpha Campaign — automancer.uk

**For the morning check-in.** Detail and incident notes follow below; this is the
part worth reading first.

## What shipped, and what it means for the site

Everything below is on `main`, released, and verified against the live site —
not against CI, and not against a lane's report. Production tracks `main` within
about 40 seconds, so every merge tonight was treated as a deploy.

| What | Why it matters |
|---|---|
| **A test suite, from zero to 62 assertions** | The repo had no tests at all. These run against the real built site, so they assert what a visitor or a crawler actually receives. |
| **Nine real defects fixed** | Found by those tests, fixed at source rather than by relaxing the test. Every page skipped from `h2` to `h4` (a genuine accessibility fault), the 404 page had no heading, and four pages had search descriptions too long to display in full. |
| **The agent-readiness work you asked for** | 19 Markdown versions of pages, six JSON endpoints, RSS and JSON feeds, a full-site text document, an agent manifest, and a `robots.txt` that names 19 AI crawlers and blocks none of them. |
| **Astro 7.1.6 → 7.2.4 and the upstream backlog** | The local checkout was five commits behind and nobody had noticed. Integrated, reinstalled, re-verified against the real dependency set. |
| **Production is now checked after every deploy** | A new mandatory job fetches the live site and fails the run if it is wrong. The same checks run every 30 minutes. Previously nothing would have told us the site was down. |
| **14 dead files removed** | Superseded images and an unused stylesheet, each proven unreferenced, with a test that fails if one reappears. |

## What is still in progress

- **`/.well-known/agent.json` returns 404 in production.** GitHub Pages does not
  serve any path beginning with a dot — the files build correctly and are simply
  never served. Our own `llms.txt` advertises that URL, so agents following it
  get a 404. A fix is mid-flight: the same documents served from `/agent.json`
  and `/security.txt`, which Pages does serve.
- **A visual and accessibility pass** is running against the existing design.

## If something looks wrong

`docs/DEPLOYMENT.md` has the rollback. In short: almost always a one-commit
revert, because only one commit changes what a visitor sees. Redeploy is
automatic on push and takes about 40 seconds.

---

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

## Production verified from artifacts, and a correction to my own claim

After shipping v2026.08.21.1 I checked the live site rather than the workflow's
green tick. Both runs (CI and Deploy to GitHub Pages) succeeded, and production
genuinely serves the changes: the footer headings are `h3`, the 404 page has an
`h1`, the new upstream field note is live, and `/`, `/404.html`, `/field-notes/`,
`/llms.txt` and `/sitemap-index.xml` all return 200. An unknown path correctly
returns a real **404**, not a soft 200.

**Correction.** Earlier I recorded, from reading `astro.config.mjs`, that the five
legacy redirects "return 200, not 301". Checking what is actually served, that is
not the whole truth:

```
/services.html      -> HTTP 301  (server: GitHub.com)
/services.html/     -> HTTP 200  meta-refresh page
                    -> /services
```

There *is* a 301, but it only adds the trailing slash. The hop that actually
reaches the destination is a 200 page. So the defect is real but narrower than I
stated, and the fix is smaller than I briefed.

The emitted redirect page already contains everything I had briefed a lane to add:

```html
<meta http-equiv="refresh" content="0;url=/services">
<meta name="robots" content="noindex">
<link rel="canonical" href="https://automancer.uk/services">
<body><a href="/services">Redirecting from /services.html/ to /services</a></body>
```

Astro emits a canonical link, a noindex directive and a real anchor a no-JS agent
can follow. Item 13 of the agent-readiness brief is therefore largely already
satisfied, and the lane must not reimplement it.

I also briefly misread `server: nginx` from the body of the 301 page and thought
something sat in front of Pages. The actual `Server:` header says `GitHub.com`.
The nginx string was page content, not a header — which is the same trap in
miniature: read the artifact, and read the right part of it.

## Rollback path (recorded late — see note)

**Deployed tonight:** `v2026.08.21.1` (`23e45c0`) to production via GitHub Pages.

**Rollback, fastest first:**

1. `git revert --no-commit d412e77 && git commit -m "revert: site fixes" && git push`
   — reverts only the accessibility/SEO fixes, leaving the test suite and the
   upstream integration in place. This is the likely rollback: it is the only
   commit that changed anything a visitor sees.
2. `git revert 6312caa` — removes the test suite and CI. Only if CI itself is the
   problem; it changes nothing user-facing.
3. Full restore to the pre-campaign production state:
   `git reset --hard ox-campaign-truebaseline-2026-08-21 && git push --force-with-lease`
   — last resort, and it needs a human decision because it discards the night's
   work. `ox-campaign-truebaseline-2026-08-21` (`e9721b3`) is the exact tree
   production served before tonight.

Redeploy is automatic on push to `main`; a revert reaches production the same way
the change did, in about 40 seconds.

**Honest note:** I deployed *before* writing this down, and verified production
afterwards. The verification was real and production is green, but recording the
rollback first is the correct order and I did it out of order.

**Monitoring gap — follow-up work, not a shrug.** This site has no uptime check
and no error alerting that I can find. Sentry's browser SDK is loaded, but it
captures client-side JS errors only: it would not notice the site serving a 404,
a broken deploy, or an expired certificate. So nothing would tell us if the site
went down — I found tonight's state by fetching pages by hand. Adding an uptime
check is genuine follow-up work.

## Attribution correction (mtime technique)

Using `find -newermt` to attribute files to lanes caught two things:

1. **My rebase reset every file's mtime**, so the whole tree looked like it had
   been written between 22:20 and 22:43. Attributing that bucket to the pi lane
   would have been wrong — it was my own git operation. mtime needs to be read
   alongside what you know you did to the tree, not on its own.
2. **I under-reported the pi lane's output.** My WIP commit message lists the six
   JSON endpoints, `jsonld.ts` and `site-content.ts`. It also wrote
   `src/data/feeds.ts` (75 lines), which I missed when I inventoried it by eye.
   The commit contains it; the message does not mention it.

Also confirmed from a lane's own build analysis: `public/assets/css/styles.css` is
unreferenced in `dist/` as well as in `src/` — genuinely dead, and safe for the
cleanup slice to remove. The legacy redirect stub pages emit no `h1`, which is
correct for a redirect page and is why the test suite excludes them explicitly.

## A "should not", recorded with reasons

I can deploy this repo freely: push to `main` is the deploy, it is verified
working tonight, and rollback is a one-commit revert. So the question is not
whether I *can* ship the agent-readiness branch, it is whether I *should* ship
all of it unattended.

**Decision: split it. Ship the additive surface; hold the JSON-LD replacement
until it is checked by eye.**

The branch contains two very different kinds of change:

- **Additive and low-risk** — the JSON endpoints, RSS and JSON feeds, Markdown
  twins, `llms-full.txt`, `.well-known/` files. Nothing existing depends on any
  of it. If one is wrong, the blast radius is a URL nobody was fetching
  yesterday, and the tests cover their shape.
- **A replacement, and not low-risk** — the JSON-LD rewrite. Structured data is
  already being consumed by search engines today. Getting it wrong does not throw
  an error or turn CI red; it quietly degrades or removes rich results, takes
  weeks to show up, and takes weeks more to recover. It is the one change on the
  branch that can do lasting harm silently.

So the additive work ships once green. The JSON-LD change gets compared against
what the live pages currently emit before it goes anywhere near production — if
it is not clearly at least as good, it waits for daylight and a human. Shipping
it unattended at midnight buys nothing: no visitor is waiting for it, and the
downside is slow and invisible.

This is a judgement, not a blocker. The capability is there and verified.

## Does a merge to main reach users? YES.

**`automancer-site` auto-deploys from `main`.** Push → GitHub Actions → Pages,
live in roughly 40 seconds. Production tracks `main`; it is never behind it.

So **merging is deploying** in this repo, and every merge tonight has been held
to the full deploy conditions rather than the lower bar a merge usually gets:
green before push, verified from the live site afterwards, rollback recorded in
`docs/DEPLOYMENT.md` beforehand, and watched after landing.

Two structural consequences worth writing down, because they are properties of
the mechanism rather than of anyone's discipline:

- The build happens **on GitHub from a committed SHA**, on a machine that has
  never seen this working tree. A lane's half-written file therefore cannot
  reach production, even mid-write.
- Nothing on this box executes from the working tree — no systemd unit, no cron,
  no watcher references this repo. Checked, not assumed.

### What path does this repo's code take to reach something that runs it?

One path, and only one:

```
commit -> push to main -> GitHub Actions -> actions/checkout of that SHA
       -> astro build (on GitHub) -> upload-pages-artifact -> deploy-pages
       -> automancer.uk, ~40s later
```

Nothing else runs this code. Verified with a negative control, because a
"nothing found" result is worthless if the check could not have found anything:
`systemctl --user list-units` shows 49 services and 20 timers, so user-level
scheduling IS visible here — and none of it references this repo. Nor does any
system unit, cron entry, or anything in the shared `ops/scripts` /
`auto/scripts` trees.

(Caution for anyone repeating this: grepping for `site` matches
`al-lm1-offsite-pull`. Match the repo path, not a fragment of its name.)

**The one shared path this repo depends on** is
`/opt/automancer/auto/scripts/release-notes.mjs`, invoked by absolute path
every time a release is cut here — five times tonight. An edit to that file is
live for the next caller instantly, with no deploy step. No lane has ever been
pointed at it from this repo, and none will be.

Two consequences follow from the mechanism rather than from anyone's care:

- **The working tree is never production.** The build runs on GitHub from a
  committed SHA, on a machine that has never seen this checkout. A lane
  mid-write cannot reach users, so "a lane is editing a file" is not
  "I am deploying" here.
- **But merging IS deploying**, because production tracks `main` within about
  40 seconds. Full deploy conditions apply to every merge.

The one thing that *does* reach the outside world as a side effect is
`release-notes.mjs`, which can push to the client portal — but only for repos
registered under a client `repoRoots`. This repo is not, confirmed from the
gate condition and from the run output, so cutting a release here publishes a
GitHub release and nothing further.
