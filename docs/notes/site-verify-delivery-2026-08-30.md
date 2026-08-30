# Site verify delivery — 2026-08-30

Status: implementation and local verification complete; branch delivery follows this immutable record.

## Scope and authority

- Queue items: `q-auto-935b` and `q-auto-174c`.
- Authority read first: `VISION.md` (unchanged). No `SPEC.md` exists.
- Changed scope is limited to `ops/`, `.github/workflows/`, and this required notes file. I did not read or change `src/`; the brief supplied the published proof-strip format.
- Delivery path: a push to `main` starts `.github/workflows/deploy.yml`, which builds, publishes to GitHub Pages, then runs the production verifier. This lane will push only its named branch, whose push does not trigger deploy because every repository push trigger is filtered to `main`.

## Part 1 — implementation record

The deploy verifier now accepts `--expected-revision <sha>`. It validates an exact seven- or forty-character hexadecimal SHA, normalises it to the seven characters the site publishes, fetches the homepage, and requires the proof strip's served revision to match. Only `deploy.yml` supplies the expected revision (`GITHUB_SHA`); `uptime.yml` does not, because a scheduled monitor has no newly deployed SHA to assert.

Retry bound: **90 seconds**, polling every 5 seconds. The repository's measured Pages deployments completed in **36–47 seconds** (`ops/verify-production.sh` and `docs/ox-alpha-campaign.md`), so 90 seconds is roughly twice the observed worst case. The revision assertion uses the verifier's existing `poll_check` deadline: it tolerates a normal rollout but must eventually fail instead of waiting forever.

Self-test coverage was extended from 22 locally isolatable assertions across 9 checks to 24 assertions across 10 checks. The new fixtures separately prove that a missing revision fails, a mismatched served revision fails, and the expected revision passes. The fixture server remains bound to `127.0.0.1` and is stopped and checked gone by the existing harness.

## Part 2 — evidence record

**Verdict: GitHub failed-Uptime mail does not exist.** There are zero failed `Uptime` runs, so GitHub has never had a real failure notification to deliver for this workflow. The workflow must not rely on an untested optional GitHub email.

Mailbox evidence used only count-only searches; no message body was opened and no unrelated mail was read or recorded:

- Positive control, identical command and flags with only the Gmail query changed: `/home/ubuntu/.local/bin/gog gmail search 'from:notifications@github.com subject:"Run failed:"' --max=100 --json --results-only --select=id --readonly --gmail-no-send | /usr/bin/jq 'length'` → `100`; `gog` exit 0, `jq` exit 0. This proves the authenticated search path returns known GitHub workflow-failure notifications.
- Target: `/home/ubuntu/.local/bin/gog gmail search 'from:notifications@github.com subject:"[Waseemilyas/automancer-site] Run failed: Uptime"' --max=100 --json --results-only --select=id --readonly --gmail-no-send | /usr/bin/jq 'length'` → `0`; `gog` exit 0, `jq` exit 0.
- Independent GitHub Actions control through Executor: `actions.listWorkflowRuns` for `Waseemilyas/automancer-site`, `workflow_id=uptime.yml`, `status=failure` → `total_count: 0`; Executor exit 0, JSON read exit 0.

The delivery route to retain is the estate's existing `ci-alert-check.timer` → `ci-alert-check.sh` → `alert-email.sh` → next daily digest. Current live evidence:

- The monitor's discovery cache contains the exact row `Waseemilyas/automancer-site` (`/usr/bin/grep -Fx`, exit 0).
- Loaded `ci-alert-check.timer` is active; its 22:00 UTC poll completed successfully and its next poll was 22:30 UTC. The loaded service invokes `/opt/automancer/auto/automancer-detectors/ops/scripts/ci-alert-check.sh`, and that file is byte-identical to the reviewed `/opt/automancer/ops/scripts/ci-alert-check.sh` (`cmp`, exit 0).
- The live coverage surface was `status=healthy`, 53 repos total, 37 evaluated, 16 dormant, 0 skipped, 0 partial workflows. The live alert digest timer was active; its next delivery was 06:31 UTC / 07:31 London.
- No-send controls: `bash /opt/automancer/ops/tests/ci-alert-check-red-episode-cadence.test.sh` proved a red non-production repository is handed to a stub alert binary with the digest route (exit 0). `/opt/automancer/ops/tests/ci-alert-check-dormant-and-pending-coverage.test.sh` proved scheduled workflows are evaluated by the monitor and stale cadence is loud (exit 0). Both tests replace the mailer with a local file stub; they sent nothing.

I recorded this established delivery contract in `uptime.yml`. I did not add a sender inside GitHub Actions: proving a new sender through to a human would require the forbidden outbound test. The central monitor is already live, covers this exact repository and workflow class, and uses the estate's established human-delivery path.

## Final required report

### 1. Part 1 — retry bound and RED/GREEN proof

The retry bound is **90 seconds**, polled every **5 seconds**. It is based on this repository's measured **36–47 second** GitHub Pages rollout time, so it is about twice the observed worst case. The bound is finite: a slow legitimate rollout gets room to finish, while a stale deploy still fails after 90 seconds.

RED proof used the real local fixture with `def5678` served and `abc1234` expected. I temporarily changed only that fixture's harness expectation from `fail` to `pass`, ran the whole self-test, then restored the line with `apply_patch` (no Git restore). Command:

```bash
set -o pipefail
ops/verify-production.sh --self-test | /usr/bin/grep -E 'served build revision matches|SELF-TEST RESULT|Fixture server'
```

Output and pipeline exits:

```text
SELFTEST FAIL  served build revision matches the expected deploy — expected to PASS but FAILED: homepage http://127.0.0.1:54723/ serves build revision def5678, expected deployed revision abc1234 — the previous deploy may still be live
SELF-TEST RESULT: 1 direction(s) FAILED:
self_test_exit=1 grep_exit=0
```

GREEN proof after restoring the harness:

```text
SELFTEST PASS  served build revision matches the expected deploy — fails as it must: homepage http://127.0.0.1:59723/ serves build revision def5678, expected deployed revision abc1234 — the previous deploy may still be live
SELFTEST PASS  served build revision matches the expected deploy — passes as it must: GET http://127.0.0.1:59723/ -> 200 and serves expected build revision abc1234
SELF-TEST RESULT: all 24 locally isolatable assertions across 10 checks can fail AND can pass.
self_test_exit=0 grep_exit=0
```

The final live control used the current `origin/main` revision:

```bash
expected=$(/usr/bin/git rev-parse --short=7 origin/main)
ops/verify-production.sh --expected-revision "$expected" https://automancer.uk
```

It ran **17 production checks**: all **16 existing checks** unchanged plus **1 revision check**. All 17 passed; production served `16ab826`; exit 0.

### 2. Part 2 — notification search and verdict

**GitHub failed-Uptime mail does not exist.** The count-only target search returned 0, after the identical command returned 100 known GitHub workflow-failure messages as its positive control. Both `gog` and `/usr/bin/jq` exited 0. Executor independently returned 0 historical failed `uptime.yml` runs, exit 0. Therefore GitHub has never had a real `Uptime` failure notice to deliver, and optional GitHub mail is not an established delivery contract.

The replacement is the already-live estate path: `ci-alert-check.timer` discovers `Waseemilyas/automancer-site`, evaluates scheduled workflows, and routes a sustained red for this non-client repository through `alert-email.sh` into Waseem's next daily digest. I documented that contract in `uptime.yml`. Its scheduled-workflow and red-to-digest branches both passed with local stub mailers (2 tests, 2 passes, both exit 0). I did not add an Actions sender because proving a new sender end to end would require the forbidden outbound test.

### 3. Every gate, counts, exits, and reading

- RED discriminator: 1 intentionally inverted self-test direction, 1 expected failure, verifier exit **1**. Read as RED because the mismatch check itself rejected `def5678` vs `abc1234` and made the whole command non-zero.
- Restored verifier self-test: **24 assertions / 10 checks**, all failing and passing directions green, exit **0**. The local fixture server was reported stopped and gone; final process scan found **0** matching fixture/dev/browser processes (search exit 1 means no matches).
- Post-rebase full gate, one `/home/ubuntu/bin/campaign heavy -- ...` invocation: Astro diagnostics **81 files / 0 errors / 0 warnings / 0 hints**; Vitest **13 files / 133 tests passed**; production build **24 pages**; verifier **24 assertions / 10 checks**; ShellCheck and `bash -n` reached and passed. The `&&` chain and campaign command exited **0**, so every named pass exited 0.
- Live production verifier: **17/17 checks passed**, including the 16 existing checks and the new revision assertion; exit **0**.
- Argument guards: **4/4 rejected** (`no args`, invalid revision, missing revision, extra self-test arg); each exited **64** with its expected `ERROR:` line.
- Workflow structure: **3 workflow files / 6 jobs / 6 `timeout-minutes`**, **3 concurrency blocks**, **2 main-only push filters**. The third workflow is the pre-existing schedule-only uptime monitor; no workflow was added. Count commands all exited **0**. `git diff --check` exited **0**.
- Scope count: **4 changed files / 0 files under `src/`**, exit **0**. After fetching and rebasing, `origin/main...HEAD` was **0 behind / 1 ahead**.
- Mail evidence: positive-control count **100**, target count **0**, both `gog` and `jq` exits **0**; GitHub failed-run count **0**, Executor and JSON exits **0**.
- Alert-route evidence: scheduled-workflow control **1/1 passed**, red-to-digest control **1/1 passed**, exits **0**. The first direct attempt at the non-executable red-to-digest test correctly failed with exit **126**; explicit `bash test-file` then executed it and passed with exit 0.
- Live estate monitor: discovery exact-match count **1**, `grep` exit **0**; reviewed/live script parity `cmp` exit **0**; coverage read **53 total / 37 evaluated / 16 dormant / 0 skipped / 0 partial**.

### 4. What I did NOT do, and why

- I did **not** read or change `src/`; the other lane owned it. After its three commits reached `origin/main`, I rebased cleanly and reran the full gate on that exact base.
- I did **not** weaken or remove any of the existing sixteen production checks. Uptime still runs all sixteen; deploy runs all sixteen plus the revision assertion.
- I did **not** deliberately fail the live uptime workflow or push a broken check. RED proof stayed on a `127.0.0.1` fixture.
- I did **not** send mail, messages, issues, or test alerts. Mail access was read-only/no-send and count-only; alert tests used local stub files.
- I did **not** read, quote, or record unrelated mail. Only GitHub workflow-failure notification IDs were counted; no body was opened.
- I did **not** deploy or push `main`. The named branch does not trigger any workflow's main-only push event.
- I did **not** print credentials, tokens, or token-bearing links.
- I did **not** add a workflow, remove an existing check, start a persistent server, or leave a fixture process behind.
