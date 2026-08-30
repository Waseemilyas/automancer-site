# Site self-test — the production checker can fail — 2026-08-30

Queue item: `q-auto-c35f`.

Authority: `git show origin/main:VISION.md` (read-only, unchanged). No `SPEC.md`
exists on `origin/main`; `VISION.md` is the standard.

## The defect (reproduced before any change)

`ops/verify-production.sh` (567 lines) is the only thing between a broken deploy
and nobody noticing. Two callers run it — `deploy.yml` (post-deploy verify) and
`uptime.yml` (every 30 min) — so a check that can no longer fail mutes both at
once and still reports green.

Measured at 14:50 UTC 2026-08-30, with a positive control:

- `/usr/bin/grep -in 'self-test\|selftest\|self_test' ops/verify-production.sh` → exit 1, no output.
- `/usr/bin/grep -c -i 'sentry' ops/verify-production.sh` → 6 (the instrument works; the zero is a real absence).

`docs/ox-alpha-campaign.md` (≈lines 784, 816) records that both halves of the
script's own proof — *can every check fail when it should*, and *can every check
pass when it should* — were done once by hand and never wired in.

## Checks found (read from the script, not from the brief)

Nine distinct check functions, each invoked by `poll_check` with a label in
`main()`:

1. `check_route` — "page <route> answers 200" (one function, parameterised over 8 routes)
2. `check_not_found` — "unknown path answers a REAL 404 (not a soft 404)"
3. `check_llms_txt` — "/llms.txt answers 200 with a non-empty body"
4. `check_sitemap` — "/sitemap-index.xml answers 200 and parses as XML"
5. `check_agent_manifest` — "/agent.json answers 200 and parses as JSON"
6. `check_security_txt` — "/security.txt answers 200 and satisfies RFC 9116"
7. `check_homepage_anchor` — "homepage contains structural anchor"
8. `check_sentry_live` — "error monitoring is live (Sentry DSN present in the bundle)"
9. `check_tls` — "TLS certificate valid and expires >21 days out"

`main()` runs 16 `poll_check` invocations: `check_route` once per route (8) plus
the other 8 checks. `check_route`'s logic is identical across routes, so one
fail + one pass self-test covers the function.

## Plan

- Add `--self-test` to `ops/verify-production.sh`. It starts a local HTTP
  fixture server bound to `127.0.0.1` only (never `0.0.0.0` — this box is
  shared), then drives each of the 9 checks against a fixture where it MUST fail
  and a fixture where it MUST pass, asserting the result each way.
- The TLS check's network half (`openssl s_client` against system roots) cannot
  be faked by a local server — a self-signed fixture is correctly untrusted. Its
  policy (expiry must clear `TLS_MIN_DAYS`) is extracted into a pure
  `tls_expiry_ok` and driven both ways directly; the handshake half is exercised
  live by `deploy.yml`, `uptime.yml` and the P6 production run.
- Wire `--self-test` into `ci.yml` so a check that stops being able to fail is
  caught without a human. Keep the workflow's `timeout-minutes`, `concurrency`
  group with `cancel-in-progress`, and `push:` filter. Leave `runs-on:` exactly
  as found (runner choice is a separate open question).

## Out of scope (deliberate)

- `docs/DEPLOYMENT.md` rollback section — tracked as `q-auto-f2e3`.
- The Sentry check — tracked as `q-auto-09e4`.
- `VISION.md` (read-only).
- The `runs-on:` choice for this repo's CI (separate open question).

## Verification (filled in as work proceeds)

- Self-test: `ops/verify-production.sh --self-test` → exit 0. **9 checks
  found / 9 fail-direction covered / 9 pass-direction covered.** The three
  numbers are equal; no uncovered check.
- P4 neuter proof: neutered `check_llms_txt` (`if (( bytes == 0 ))` →
  `if (( 0 ))`), ran `--self-test`, and it went red naming
  `/llms.txt answers 200 with a non-empty body (fail direction)`, exit 1.
  Restored, re-ran green, exit 0. See "Run evidence" below.
- P6 production run: `ops/verify-production.sh https://automancer.uk` → exit 0,
  all checks pass (TLS "86 days out, threshold >21").
- Bad arguments: trailing slash / no args / `--self-test extra` / http scheme
  all → exit 64.
- `shellcheck ops/verify-production.sh` → exit 0, no findings (repo does not
  wire shellcheck into CI; run manually).

### Run evidence

`ops/verify-production.sh --self-test` (green):

```
SELF-TEST RESULT: all 9 checks can fail AND can pass.
```

P4 neuter (red), with the neuter applied:

```
SELFTEST FAIL  /llms.txt answers 200 with a non-empty body — expected to FAIL but PASSED: GET http://127.0.0.1:…/llms.txt -> 200, 0 bytes
...
SELF-TEST RESULT: 1 direction(s) FAILED:
  - /llms.txt answers 200 with a non-empty body (fail direction)
```

(Fixture port is chosen per run and printed; the server is stopped by pid and
the process is verified gone.)

## Commit SHAs

- `cba5bb9` — `test(ops): add --self-test to the production checker`
- `ab2f768` — `ci: run verify-production.sh --self-test`
- `b2e0096` — `docs: record the site-selftest lane`

Pushed to `origin/main` (parity 0/0 after push).

### Release-notes guard, and what I did NOT do

The `--self-test` change is internal tooling, not user-facing, so it carries no
release notes (all three commits classify internal: `test(ops)`, `ci`, `docs`).
The release-notes pre-push guard is **not wired in this clone** — `hook-status`
reports "active pre-push: none, release guard: ABSENT" (`.git/hooks` has no
`pre-push` and `core.hooksPath` is unset), so the push was not blocked.

`origin/main` carries **two pre-existing user-facing commits ahead of the last
release tag** (`64e13d1`, `9d28717` — the a11y lane's 404/service-label work,
already deployed). Those are not mine and I did not cut their release: that tag
and CHANGELOG entry belong to the a11y lane / the release process, and running
`release` would publish to GitHub Releases and the client portal. `RELEASE_NOTES_SKIP=1`
was not used.
