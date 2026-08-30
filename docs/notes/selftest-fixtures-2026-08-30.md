# Self-test fixtures: one fixture, one rule — 2026-08-30

Queue item: `q-auto-8159`.

Authority read from `git show origin/main:VISION.md`; `VISION.md` remains read-only.

## Counts

**9 checks / 23 independently-failable assertions found / 22 isolated / 22 mutation-proved.**

The one gap is the TLS trust-chain assertion. A local self-signed certificate can prove the red direction but can never provide the system-trusted green direction. Building and trusting an ephemeral local certificate authority would change machine trust state solely for this test. I left that production assertion unchanged and prove its green direction with the final live production run. TLS expiry-date parsing and the strict 21-day boundary are both isolated and mutation-proved locally.

Shared `probe_status` and `fetch_body` branches count once per implementation branch, not once per caller. `check_route` remains one parameterised check because all eight routes use the same function and expectation.

## Baseline inventory: what the original nine fail fixtures actually violated

The original fail fixtures covered 9 checks and violated 11 rules in total:

| Check | Original fail fixture violations | Count |
|---|---|---:|
| `check_route` | final status is 404, not 200 | 1 |
| `check_not_found` | final status is 200, not a real 404 | 1 |
| `check_llms_txt` | body is empty | 1 |
| `check_sitemap` | body is not well-formed XML | 1 |
| `check_agent_manifest` | body is not valid JSON | 1 |
| `check_security_txt` | `Expires` is not in the future; `Preferred-Languages` is missing; `Canonical` is missing | 3 |
| `check_homepage_anchor` | structural anchor is absent | 1 |
| `check_sentry_live` | bundle has no Sentry ingest DSN | 1 |
| `check_tls` | expiry does not clear the 21-day policy threshold | 1 |

The security fixture therefore hid two dead assertions whenever the expired timestamp still failed first. The other original fail fixtures each violated one rule, but the suite did not yet exercise every independently-failable branch inside the checks.

### Exact baseline reproduction

Temporary mutation (restored from a backup, not with Git):

```diff
- missing = [k for k in ("Contact", "Expires", "Preferred-Languages", "Canonical") if k not in fields]
+ missing = []
```

Mutated run, exit 0:

```
SELFTEST PASS  /security.txt answers 200 and satisfies RFC 9116 — fails as it must: GET http://127.0.0.1:34717/security.txt returned HTTP 200 but VIOLATES RFC 9116: Expires "2020-01-01T00:00:00Z" is NOT in the future — the document is invalid (RFC 9116 §3.3)
SELF-TEST RESULT: all 9 checks can fail AND can pass.
```

Restored run, exit 0:

```
SELFTEST PASS  /security.txt answers 200 and satisfies RFC 9116 — fails as it must: GET http://127.0.0.1:59005/security.txt returned HTTP 200 but VIOLATES RFC 9116: missing required field(s): Preferred-Languages, Canonical
SELF-TEST RESULT: all 9 checks can fail AND can pass.
```

Both fixture ports were checked with `ss -tlnp`; neither had a listener after its run.

## Final assertion inventory

| ID | Assertion | Isolated failing fixture |
|---|---|---|
| H1 | status probe transfer completes | deliberately truncated response |
| H2 | status probe enforces supplied final status | complete HTTP 418 when 200 is expected |
| H3 | page check supplies expected status 200 | page returns 404 |
| H4 | unknown-path check supplies expected status 404 | unknown path returns 200 |
| H5 | body transfer completes | deliberately truncated body |
| H6 | body fetch enforces final status 200 | complete 404 response |
| L1 | `llms.txt` is non-empty | zero-byte 200 body |
| X1 | sitemap is well-formed XML | malformed XML only |
| J1 | agent manifest is valid JSON | malformed JSON only |
| R1 | `Contact` is present | only `Contact` omitted |
| R2 | `Expires` is present | only `Expires` omitted |
| R3 | `Preferred-Languages` is present | only `Preferred-Languages` omitted |
| R4 | `Canonical` is present | only `Canonical` omitted |
| R5 | `Expires` is parseable | only `Expires` malformed |
| R6 | `Expires` is in the future | only `Expires` expired |
| R7 | `Canonical` is an absolute HTTP(S) URL | relative canonical on preview-host policy |
| R8 | canonical-host `Canonical` exactly matches served URL | different absolute URL only |
| A1 | homepage structural anchor is present | anchor omitted |
| S1 | homepage exposes an Astro JavaScript bundle | bundle exists but homepage reference omitted |
| S2 | bundle contains a Sentry ingest DSN | referenced bundle has no DSN |
| T1 | TLS expiry date is parseable | malformed `notAfter` value |
| T2 | expiry is strictly more than 21 days away | fixed epoch exactly on the boundary |
| T3 | TLS handshake succeeds and chain verifies against system roots | **live-only gap**, explained above |

The RFC 9116 validator still enforces and reports all missing fields together in production. Its dependent parse/future/canonical checks now skip absent prerequisites only after the required-field assertion has already failed; that makes each assertion independently mutation-testable without relaxing valid production behavior.

## Mutation method

Each mutation used a fresh byte-for-byte backup, changed one assertion, ran the matching `--self-test` fixture, copied the backup back, and reran green. `SELFTEST_ONLY` was a temporary run selector used only to keep 44 proof runs bounded; it was removed after the evidence was captured, so the committed `--self-test` always runs all 22 local assertions.

## Per-assertion mutation runs

Each green run used a byte-for-byte backup made immediately before its mutation. The backup was copied back; no Git restore command was used.

### H1 — HTTP status probe completes its transfer

Changed:
```diff
-   if (( rc != 0 )); then
+   if (( 0 )); then
```

Red run (`SELFTEST_ONLY='HTTP status probe completes its transfer' ops/verify-production.sh --self-test`, exit 1):
```
SELFTEST FAIL  HTTP status probe completes its transfer — expected to FAIL but PASSED: GET http://127.0.0.1:47227/ -> 200
SELF-TEST RESULT: 1 direction(s) FAILED:
  - HTTP status probe completes its transfer (fail direction)
```

Restored green run (`SELFTEST_ONLY='HTTP status probe completes its transfer' ops/verify-production.sh --self-test`, exit 0):
```
SELF-TEST RESULT: targeted assertion can fail AND can pass: HTTP status probe completes its transfer
```

### H2 — HTTP status probe enforces the expected final status

Changed:
```diff
-   if [[ "$code" != "$expected" ]]; then
+   if false; then
```

Red run (`SELFTEST_ONLY='HTTP status probe enforces the expected final status' ops/verify-production.sh --self-test`, exit 1):
```
SELFTEST FAIL  HTTP status probe enforces the expected final status — expected to FAIL but PASSED: GET http://127.0.0.1:50745/ -> 418
SELF-TEST RESULT: 1 direction(s) FAILED:
  - HTTP status probe enforces the expected final status (fail direction)
```

Restored green run (`SELFTEST_ONLY='HTTP status probe enforces the expected final status' ops/verify-production.sh --self-test`, exit 0):
```
SELF-TEST RESULT: targeted assertion can fail AND can pass: HTTP status probe enforces the expected final status
```

### H3 — page check requires HTTP 200

Changed:
```diff
-   probe_status "${BASE_URL}$1" 200
+   probe_status "${BASE_URL}$1" 404
```

Red run (`SELFTEST_ONLY='page check requires HTTP 200' ops/verify-production.sh --self-test`, exit 1):
```
SELFTEST FAIL  page check requires HTTP 200 — expected to FAIL but PASSED: GET http://127.0.0.1:34637/ -> 404
SELFTEST FAIL  page check requires HTTP 200 — expected to PASS but FAILED: GET http://127.0.0.1:34637/ returned HTTP 200 where a REAL 404 is required — soft 404: search engines and AI agents will index a page that does not exist
SELF-TEST RESULT: 2 direction(s) FAILED:
  - page check requires HTTP 200 (fail direction)
  - page check requires HTTP 200 (pass direction)
```

Restored green run (`SELFTEST_ONLY='page check requires HTTP 200' ops/verify-production.sh --self-test`, exit 0):
```
SELF-TEST RESULT: targeted assertion can fail AND can pass: page check requires HTTP 200
```

### H4 — unknown-path check requires a real HTTP 404

Changed:
```diff
-   probe_status "$url" 404
+   probe_status "$url" 200
```

Red run (`SELFTEST_ONLY='unknown-path check requires a real HTTP 404' ops/verify-production.sh --self-test`, exit 1):
```
SELFTEST FAIL  unknown-path check requires a real HTTP 404 — expected to FAIL but PASSED: GET http://127.0.0.1:57229/this-route-must-not-exist-2779241-27853 -> 200
SELFTEST FAIL  unknown-path check requires a real HTTP 404 — expected to PASS but FAILED: GET http://127.0.0.1:57229/this-route-must-not-exist-2779241-451 returned HTTP 404, expected HTTP 200 (followed 0 redirect(s), finally landed on http://127.0.0.1:57229/this-route-must-not-exist-2779241-451)
SELF-TEST RESULT: 2 direction(s) FAILED:
  - unknown-path check requires a real HTTP 404 (fail direction)
  - unknown-path check requires a real HTTP 404 (pass direction)
```

Restored green run (`SELFTEST_ONLY='unknown-path check requires a real HTTP 404' ops/verify-production.sh --self-test`, exit 0):
```
SELF-TEST RESULT: targeted assertion can fail AND can pass: unknown-path check requires a real HTTP 404
```

### H5 — body fetch completes its transfer

Changed:
```diff
-   if (( rc != 0 )); then
+   if (( 0 )); then
```

Red run (`SELFTEST_ONLY='body fetch completes its transfer' ops/verify-production.sh --self-test`, exit 1):
```
SELFTEST FAIL  body fetch completes its transfer — expected to FAIL but PASSED: (no output)
SELF-TEST RESULT: 1 direction(s) FAILED:
  - body fetch completes its transfer (fail direction)
```

Restored green run (`SELFTEST_ONLY='body fetch completes its transfer' ops/verify-production.sh --self-test`, exit 0):
```
SELF-TEST RESULT: targeted assertion can fail AND can pass: body fetch completes its transfer
```

### H6 — body fetch requires HTTP 200

Changed:
```diff
-   if [[ "$code" != "200" ]]; then
+   if false; then
```

Red run (`SELFTEST_ONLY='body fetch requires HTTP 200' ops/verify-production.sh --self-test`, exit 1):
```
SELFTEST FAIL  body fetch requires HTTP 200 — expected to FAIL but PASSED: (no output)
SELF-TEST RESULT: 1 direction(s) FAILED:
  - body fetch requires HTTP 200 (fail direction)
```

Restored green run (`SELFTEST_ONLY='body fetch requires HTTP 200' ops/verify-production.sh --self-test`, exit 0):
```
SELF-TEST RESULT: targeted assertion can fail AND can pass: body fetch requires HTTP 200
```

### L1 — llms.txt body is non-empty

Changed:
```diff
-   if (( bytes == 0 )); then
+   if (( 0 )); then
```

Red run (`SELFTEST_ONLY='llms.txt body is non-empty' ops/verify-production.sh --self-test`, exit 1):
```
SELFTEST FAIL  llms.txt body is non-empty — expected to FAIL but PASSED: GET http://127.0.0.1:55345/llms.txt -> 200, 0 bytes
SELF-TEST RESULT: 1 direction(s) FAILED:
  - llms.txt body is non-empty (fail direction)
```

Restored green run (`SELFTEST_ONLY='llms.txt body is non-empty' ops/verify-production.sh --self-test`, exit 0):
```
SELF-TEST RESULT: targeted assertion can fail AND can pass: llms.txt body is non-empty
```

### X1 — sitemap is well-formed XML

Changed:
```diff
-   if ! xml_parses "$BODY_FILE"; then
+   if false; then
```

Red run (`SELFTEST_ONLY='sitemap is well-formed XML' ops/verify-production.sh --self-test`, exit 1):
```
SELFTEST FAIL  sitemap is well-formed XML — expected to FAIL but PASSED: GET http://127.0.0.1:51787/sitemap-index.xml -> 200 and parses as XML
SELF-TEST RESULT: 1 direction(s) FAILED:
  - sitemap is well-formed XML (fail direction)
```

Restored green run (`SELFTEST_ONLY='sitemap is well-formed XML' ops/verify-production.sh --self-test`, exit 0):
```
SELF-TEST RESULT: targeted assertion can fail AND can pass: sitemap is well-formed XML
```

### J1 — agent manifest is valid JSON

Changed:
```diff
-   if ! json_parses "$BODY_FILE"; then
+   if false; then
```

Red run (`SELFTEST_ONLY='agent manifest is valid JSON' ops/verify-production.sh --self-test`, exit 1):
```
SELFTEST FAIL  agent manifest is valid JSON — expected to FAIL but PASSED: GET http://127.0.0.1:43335/agent.json -> 200 and parses as JSON
SELF-TEST RESULT: 1 direction(s) FAILED:
  - agent manifest is valid JSON (fail direction)
```

Restored green run (`SELFTEST_ONLY='agent manifest is valid JSON' ops/verify-production.sh --self-test`, exit 0):
```
SELF-TEST RESULT: targeted assertion can fail AND can pass: agent manifest is valid JSON
```

### R1 — security.txt requires Contact

Changed:
```diff
- missing_contact = "Contact" not in fields
+ missing_contact = False
```

Red run (`SELFTEST_ONLY='security.txt requires Contact' ops/verify-production.sh --self-test`, exit 1):
```
SELFTEST FAIL  security.txt requires Contact — expected to FAIL but PASSED: GET http://127.0.0.1:46295/security.txt -> 200 and satisfies RFC 9116 (Contact, future Expires, Canonical resolves)
SELF-TEST RESULT: 1 direction(s) FAILED:
  - security.txt requires Contact (fail direction)
```

Restored green run (`SELFTEST_ONLY='security.txt requires Contact' ops/verify-production.sh --self-test`, exit 0):
```
SELF-TEST RESULT: targeted assertion can fail AND can pass: security.txt requires Contact
```

### R2 — security.txt requires Expires

Changed:
```diff
- missing_expires = "Expires" not in fields
+ missing_expires = False
```

Red run (`SELFTEST_ONLY='security.txt requires Expires' ops/verify-production.sh --self-test`, exit 1):
```
SELFTEST FAIL  security.txt requires Expires — expected to FAIL but PASSED: GET http://127.0.0.1:52103/security.txt -> 200 and satisfies RFC 9116 (Contact, future Expires, Canonical resolves)
SELF-TEST RESULT: 1 direction(s) FAILED:
  - security.txt requires Expires (fail direction)
```

Restored green run (`SELFTEST_ONLY='security.txt requires Expires' ops/verify-production.sh --self-test`, exit 0):
```
SELF-TEST RESULT: targeted assertion can fail AND can pass: security.txt requires Expires
```

### R3 — security.txt requires Preferred-Languages

Changed:
```diff
- missing_languages = "Preferred-Languages" not in fields
+ missing_languages = False
```

Red run (`SELFTEST_ONLY='security.txt requires Preferred-Languages' ops/verify-production.sh --self-test`, exit 1):
```
SELFTEST FAIL  security.txt requires Preferred-Languages — expected to FAIL but PASSED: GET http://127.0.0.1:39039/security.txt -> 200 and satisfies RFC 9116 (Contact, future Expires, Canonical resolves)
SELF-TEST RESULT: 1 direction(s) FAILED:
  - security.txt requires Preferred-Languages (fail direction)
```

Restored green run (`SELFTEST_ONLY='security.txt requires Preferred-Languages' ops/verify-production.sh --self-test`, exit 0):
```
SELF-TEST RESULT: targeted assertion can fail AND can pass: security.txt requires Preferred-Languages
```

### R4 — security.txt requires Canonical

Changed:
```diff
- missing_canonical = "Canonical" not in fields
+ missing_canonical = False
```

Red run (`SELFTEST_ONLY='security.txt requires Canonical' ops/verify-production.sh --self-test`, exit 1):
```
SELFTEST FAIL  security.txt requires Canonical — expected to FAIL but PASSED: GET http://127.0.0.1:60319/security.txt -> 200 and satisfies RFC 9116 (Contact, future Expires, Canonical resolves)
SELF-TEST RESULT: 1 direction(s) FAILED:
  - security.txt requires Canonical (fail direction)
```

Restored green run (`SELFTEST_ONLY='security.txt requires Canonical' ops/verify-production.sh --self-test`, exit 0):
```
SELF-TEST RESULT: targeted assertion can fail AND can pass: security.txt requires Canonical
```

### R5 — security.txt Expires is parseable

Changed:
```diff
- if expires_value is not None and expires is None:
+ if False:
```

Red run (`SELFTEST_ONLY='security.txt Expires is parseable' ops/verify-production.sh --self-test`, exit 1):
```
SELFTEST FAIL  security.txt Expires is parseable — expected to FAIL but PASSED: GET http://127.0.0.1:33481/security.txt -> 200 and satisfies RFC 9116 (Contact, future Expires, Canonical resolves)
SELF-TEST RESULT: 1 direction(s) FAILED:
  - security.txt Expires is parseable (fail direction)
```

Restored green run (`SELFTEST_ONLY='security.txt Expires is parseable' ops/verify-production.sh --self-test`, exit 0):
```
SELF-TEST RESULT: targeted assertion can fail AND can pass: security.txt Expires is parseable
```

### R6 — security.txt Expires is in the future

Changed:
```diff
- if expires is not None and expires <= datetime.datetime.now(datetime.timezone.utc):
+ if False:
```

Red run (`SELFTEST_ONLY='security.txt Expires is in the future' ops/verify-production.sh --self-test`, exit 1):
```
SELFTEST FAIL  security.txt Expires is in the future — expected to FAIL but PASSED: GET http://127.0.0.1:49485/security.txt -> 200 and satisfies RFC 9116 (Contact, future Expires, Canonical resolves)
SELF-TEST RESULT: 1 direction(s) FAILED:
  - security.txt Expires is in the future (fail direction)
```

Restored green run (`SELFTEST_ONLY='security.txt Expires is in the future' ops/verify-production.sh --self-test`, exit 0):
```
SELF-TEST RESULT: targeted assertion can fail AND can pass: security.txt Expires is in the future
```

### R7 — security.txt Canonical is an absolute HTTP(S) URL

Changed:
```diff
- if canonical is not None and not canonical.startswith(("http://", "https://")):
+ if False:
```

Red run (`SELFTEST_ONLY='security.txt Canonical is an absolute HTTP(S) URL' ops/verify-production.sh --self-test`, exit 1):
```
SELFTEST FAIL  security.txt Canonical is an absolute HTTP(S) URL — expected to FAIL but PASSED: GET http://127.0.0.1:54689/security.txt -> 200 and satisfies RFC 9116 (Contact, future Expires, Canonical resolves)
SELF-TEST RESULT: 1 direction(s) FAILED:
  - security.txt Canonical is an absolute HTTP(S) URL (fail direction)
```

Restored green run (`SELFTEST_ONLY='security.txt Canonical is an absolute HTTP(S) URL' ops/verify-production.sh --self-test`, exit 0):
```
SELF-TEST RESULT: targeted assertion can fail AND can pass: security.txt Canonical is an absolute HTTP(S) URL
```

### R8 — security.txt Canonical matches the served URL

Changed:
```diff
- if canonical is not None and expected_canonical and canonical != expected_canonical:
+ if False:
```

Red run (`SELFTEST_ONLY='security.txt Canonical matches the served URL' ops/verify-production.sh --self-test`, exit 1):
```
SELFTEST FAIL  security.txt Canonical matches the served URL — expected to FAIL but PASSED: GET http://127.0.0.1:44395/security.txt -> 200 and satisfies RFC 9116 (Contact, future Expires, Canonical resolves)
SELF-TEST RESULT: 1 direction(s) FAILED:
  - security.txt Canonical matches the served URL (fail direction)
```

Restored green run (`SELFTEST_ONLY='security.txt Canonical matches the served URL' ops/verify-production.sh --self-test`, exit 0):
```
SELF-TEST RESULT: targeted assertion can fail AND can pass: security.txt Canonical matches the served URL
```

### A1 — homepage contains its structural anchor

Changed:
```diff
-   if ! grep -qF -- "$HOMEPAGE_ANCHOR" "$BODY_FILE"; then
+   if false; then
```

Red run (`SELFTEST_ONLY='homepage contains its structural anchor' ops/verify-production.sh --self-test`, exit 1):
```
SELFTEST FAIL  homepage contains its structural anchor — expected to FAIL but PASSED: GET http://127.0.0.1:51909/ -> 200 and contains "Company No. 17060907"
SELF-TEST RESULT: 1 direction(s) FAILED:
  - homepage contains its structural anchor (fail direction)
```

Restored green run (`SELFTEST_ONLY='homepage contains its structural anchor' ops/verify-production.sh --self-test`, exit 0):
```
SELF-TEST RESULT: targeted assertion can fail AND can pass: homepage contains its structural anchor
```

### S1 — homepage exposes an Astro JavaScript bundle

Changed:
```diff
  if [[ -z $bundle ]]; then
-   printf 'could not find a /_astro/*.js bundle on %s — the page did not render as expected\n' "$url"
-   return 1
+   bundle='/_astro/app.js'
  fi
```

Red run (`SELFTEST_ONLY='homepage exposes an Astro JavaScript bundle' ops/verify-production.sh --self-test`, exit 1):
```
SELFTEST FAIL  homepage exposes an Astro JavaScript bundle — expected to FAIL but PASSED: bundle /_astro/app.js carries a Sentry ingest DSN — error monitoring is live
SELF-TEST RESULT: 1 direction(s) FAILED:
  - homepage exposes an Astro JavaScript bundle (fail direction)
```

Restored green run (`SELFTEST_ONLY='homepage exposes an Astro JavaScript bundle' ops/verify-production.sh --self-test`, exit 0):
```
SELF-TEST RESULT: targeted assertion can fail AND can pass: homepage exposes an Astro JavaScript bundle
```

### S2 — bundle contains a Sentry ingest DSN

Changed:
```diff
-   if ! grep -qE 'ingest\.(de\.)?sentry\.io|o[0-9]+\.ingest' "$BODY_FILE"; then
+   if false; then
```

Red run (`SELFTEST_ONLY='bundle contains a Sentry ingest DSN' ops/verify-production.sh --self-test`, exit 1):
```
SELFTEST FAIL  bundle contains a Sentry ingest DSN — expected to FAIL but PASSED: bundle /_astro/app.js carries a Sentry ingest DSN — error monitoring is live
SELF-TEST RESULT: 1 direction(s) FAILED:
  - bundle contains a Sentry ingest DSN (fail direction)
```

Restored green run (`SELFTEST_ONLY='bundle contains a Sentry ingest DSN' ops/verify-production.sh --self-test`, exit 0):
```
SELF-TEST RESULT: targeted assertion can fail AND can pass: bundle contains a Sentry ingest DSN
```

### T1 — TLS certificate expiry date is parseable

Changed:
```diff
-   date -d "${1#notAfter=}" +%s 2>/dev/null
+   printf '0\n'
```

Red run (`SELFTEST_ONLY='TLS certificate expiry date is parseable' ops/verify-production.sh --self-test`, exit 1):
```
SELFTEST FAIL  TLS certificate expiry date is parseable — expected to FAIL but PASSED: 0
SELF-TEST RESULT: 1 direction(s) FAILED:
  - TLS certificate expiry date is parseable (fail direction)
```

Restored green run (`SELFTEST_ONLY='TLS certificate expiry date is parseable' ops/verify-production.sh --self-test`, exit 0):
```
SELF-TEST RESULT: targeted assertion can fail AND can pass: TLS certificate expiry date is parseable
```

### T2 — TLS certificate expiry is strictly more than 21 days away

Changed:
```diff
-   (( expiry_epoch > now_epoch + min_days * 86400 ))
+   return 0
```

Red run (`SELFTEST_ONLY='TLS certificate expiry is strictly more than 21 days away' ops/verify-production.sh --self-test`, exit 1):
```
SELFTEST FAIL  TLS certificate expiry is strictly more than 21 days away — expected to FAIL but PASSED: (no output)
SELF-TEST RESULT: 1 direction(s) FAILED:
  - TLS certificate expiry is strictly more than 21 days away (fail direction)
```

Restored green run (`SELFTEST_ONLY='TLS certificate expiry is strictly more than 21 days away' ops/verify-production.sh --self-test`, exit 0):
```
SELF-TEST RESULT: targeted assertion can fail AND can pass: TLS certificate expiry is strictly more than 21 days away
```


## Final verification

### Full final self-test

`ops/verify-production.sh --self-test` exited 0:

```text
Self-test: driving 22 independently-failable assertions across 9 checks on http://127.0.0.1:46953
(fixtures use 127.0.0.1 only; the TLS trust-chain assertion remains live-only)

SELFTEST PASS  HTTP status probe completes its transfer — fails as it must: GET http://127.0.0.1:46953/ did not complete: curl: (18) end of response with 95 bytes missing (curl exited with code 18 (see curl man page))
SELFTEST PASS  HTTP status probe completes its transfer — passes as it must: GET http://127.0.0.1:46953/ -> 200
SELFTEST PASS  HTTP status probe enforces the expected final status — fails as it must: GET http://127.0.0.1:46953/ returned HTTP 418, expected HTTP 200 (followed 0 redirect(s), finally landed on http://127.0.0.1:46953/)
SELFTEST PASS  HTTP status probe enforces the expected final status — passes as it must: GET http://127.0.0.1:46953/ -> 200
SELFTEST PASS  page check requires HTTP 200 — fails as it must: GET http://127.0.0.1:46953/ returned HTTP 404, expected HTTP 200 (followed 0 redirect(s), finally landed on http://127.0.0.1:46953/)
SELFTEST PASS  page check requires HTTP 200 — passes as it must: GET http://127.0.0.1:46953/ -> 200
SELFTEST PASS  unknown-path check requires a real HTTP 404 — fails as it must: GET http://127.0.0.1:46953/this-route-must-not-exist-2829160-14159 returned HTTP 200 where a REAL 404 is required — soft 404: search engines and AI agents will index a page that does not exist
SELFTEST PASS  unknown-path check requires a real HTTP 404 — passes as it must: GET http://127.0.0.1:46953/this-route-must-not-exist-2829160-18036 -> 404
SELFTEST PASS  body fetch completes its transfer — fails as it must: GET http://127.0.0.1:46953/body did not complete: curl: (18) end of response with 95 bytes missing (curl exited with code 18 (see curl man page))
SELFTEST PASS  body fetch completes its transfer — passes as it must: (no output)
SELFTEST PASS  body fetch requires HTTP 200 — fails as it must: GET http://127.0.0.1:46953/body returned HTTP 404, expected HTTP 200 (body was 8 bytes)
SELFTEST PASS  body fetch requires HTTP 200 — passes as it must: (no output)
SELFTEST PASS  llms.txt body is non-empty — fails as it must: GET http://127.0.0.1:46953/llms.txt returned HTTP 200 but a ZERO-BYTE body — llms.txt generation broke
SELFTEST PASS  llms.txt body is non-empty — passes as it must: GET http://127.0.0.1:46953/llms.txt -> 200, 12 bytes
SELFTEST PASS  sitemap is well-formed XML — fails as it must: XML parse error: syntax error: line 1, column 0
SELFTEST PASS  sitemap is well-formed XML — passes as it must: GET http://127.0.0.1:46953/sitemap-index.xml -> 200 and parses as XML
SELFTEST PASS  agent manifest is valid JSON — fails as it must: JSON parse error: Expecting property name enclosed in double quotes: line 1 column 3 (char 2)
SELFTEST PASS  agent manifest is valid JSON — passes as it must: GET http://127.0.0.1:46953/agent.json -> 200 and parses as JSON
SELFTEST PASS  security.txt requires Contact — fails as it must: GET http://127.0.0.1:46953/security.txt returned HTTP 200 but VIOLATES RFC 9116: missing required field(s): Contact
SELFTEST PASS  security.txt requires Contact — passes as it must: GET http://127.0.0.1:46953/security.txt -> 200 and satisfies RFC 9116 (Contact, future Expires, Canonical resolves)
SELFTEST PASS  security.txt requires Expires — fails as it must: GET http://127.0.0.1:46953/security.txt returned HTTP 200 but VIOLATES RFC 9116: missing required field(s): Expires
SELFTEST PASS  security.txt requires Expires — passes as it must: GET http://127.0.0.1:46953/security.txt -> 200 and satisfies RFC 9116 (Contact, future Expires, Canonical resolves)
SELFTEST PASS  security.txt requires Preferred-Languages — fails as it must: GET http://127.0.0.1:46953/security.txt returned HTTP 200 but VIOLATES RFC 9116: missing required field(s): Preferred-Languages
SELFTEST PASS  security.txt requires Preferred-Languages — passes as it must: GET http://127.0.0.1:46953/security.txt -> 200 and satisfies RFC 9116 (Contact, future Expires, Canonical resolves)
SELFTEST PASS  security.txt requires Canonical — fails as it must: GET http://127.0.0.1:46953/security.txt returned HTTP 200 but VIOLATES RFC 9116: missing required field(s): Canonical
SELFTEST PASS  security.txt requires Canonical — passes as it must: GET http://127.0.0.1:46953/security.txt -> 200 and satisfies RFC 9116 (Contact, future Expires, Canonical resolves)
SELFTEST PASS  security.txt Expires is parseable — fails as it must: GET http://127.0.0.1:46953/security.txt returned HTTP 200 but VIOLATES RFC 9116: Expires "not-a-date" is not a parseable RFC 3339 timestamp
SELFTEST PASS  security.txt Expires is parseable — passes as it must: GET http://127.0.0.1:46953/security.txt -> 200 and satisfies RFC 9116 (Contact, future Expires, Canonical resolves)
SELFTEST PASS  security.txt Expires is in the future — fails as it must: GET http://127.0.0.1:46953/security.txt returned HTTP 200 but VIOLATES RFC 9116: Expires "2020-01-01T00:00:00Z" is NOT in the future — the document is invalid (RFC 9116 §3.3)
SELFTEST PASS  security.txt Expires is in the future — passes as it must: GET http://127.0.0.1:46953/security.txt -> 200 and satisfies RFC 9116 (Contact, future Expires, Canonical resolves)
SELFTEST PASS  security.txt Canonical is an absolute HTTP(S) URL — fails as it must: GET http://127.0.0.1:46953/security.txt returned HTTP 200 but VIOLATES RFC 9116: Canonical "/security.txt" is not an absolute http(s) URL
SELFTEST PASS  security.txt Canonical is an absolute HTTP(S) URL — passes as it must: GET http://127.0.0.1:46953/security.txt -> 200 and satisfies RFC 9116 (Contact, future Expires, Canonical resolves)
SELFTEST PASS  security.txt Canonical matches the served URL — fails as it must: GET http://127.0.0.1:46953/security.txt returned HTTP 200 but VIOLATES RFC 9116: Canonical "https://example.com/security.txt" does not match the served URL "http://127.0.0.1:46953/security.txt" - a Canonical that does not resolve makes the file non-conformant
SELFTEST PASS  security.txt Canonical matches the served URL — passes as it must: GET http://127.0.0.1:46953/security.txt -> 200 and satisfies RFC 9116 (Contact, future Expires, Canonical resolves)
SELFTEST PASS  homepage contains its structural anchor — fails as it must: homepage http://127.0.0.1:46953/ does NOT contain the expected structural string "Company No. 17060907" — the served page is not the current Automancer homepage (stale deploy, wrong site, or the footer/legal block changed)
SELFTEST PASS  homepage contains its structural anchor — passes as it must: GET http://127.0.0.1:46953/ -> 200 and contains "Company No. 17060907"
SELFTEST PASS  homepage exposes an Astro JavaScript bundle — fails as it must: could not find a /_astro/*.js bundle on http://127.0.0.1:46953/ — the page did not render as expected
SELFTEST PASS  homepage exposes an Astro JavaScript bundle — passes as it must: bundle /_astro/app.js carries a Sentry ingest DSN — error monitoring is live
SELFTEST PASS  bundle contains a Sentry ingest DSN — fails as it must: bundle /_astro/app.js contains NO Sentry ingest DSN — error monitoring is OFF in production. The PUBLIC_AUT_SENTRY_WEB_DSN repository variable is probably unset or renamed; the build and deploy both succeed without it
SELFTEST PASS  bundle contains a Sentry ingest DSN — passes as it must: bundle /_astro/app.js carries a Sentry ingest DSN — error monitoring is live
SELFTEST PASS  TLS certificate expiry date is parseable — fails as it must: (no output)
SELFTEST PASS  TLS certificate expiry date is parseable — passes as it must: 4070908800
SELFTEST PASS  TLS certificate expiry is strictly more than 21 days away — fails as it must: (no output)
SELFTEST PASS  TLS certificate expiry is strictly more than 21 days away — passes as it must: (no output)

Fixture server on 127.0.0.1:46953 (pid 2829215) stopped and gone.

SELF-TEST RESULT: all 22 locally isolatable assertions across 9 checks can fail AND can pass.
```

The fixture used port `46953`. After the run:

```text
$ ss -tlnp  # filtered to :46953
<none>
$ pgrep -af '[s]elftest-server.py'
<none>
```

### Live production

`ops/verify-production.sh https://automancer.uk` exited 0:

```text
Verifying https://automancer.uk (each check retries for up to 90s before failing)

PASS  page / answers 200
      GET https://automancer.uk/ -> 200
PASS  page /services answers 200
      GET https://automancer.uk/services -> 200 (via 1 redirect(s) to https://automancer.uk/services/)
PASS  page /work answers 200
      GET https://automancer.uk/work -> 200 (via 1 redirect(s) to https://automancer.uk/work/)
PASS  page /field-notes answers 200
      GET https://automancer.uk/field-notes -> 200 (via 1 redirect(s) to https://automancer.uk/field-notes/)
PASS  page /about answers 200
      GET https://automancer.uk/about -> 200 (via 1 redirect(s) to https://automancer.uk/about/)
PASS  page /contact answers 200
      GET https://automancer.uk/contact -> 200 (via 1 redirect(s) to https://automancer.uk/contact/)
PASS  page /privacy answers 200
      GET https://automancer.uk/privacy -> 200 (via 1 redirect(s) to https://automancer.uk/privacy/)
PASS  page /terms answers 200
      GET https://automancer.uk/terms -> 200 (via 1 redirect(s) to https://automancer.uk/terms/)
PASS  unknown path answers a REAL 404 (not a soft 404)
      GET https://automancer.uk/this-route-must-not-exist-2835875-32133 -> 404
PASS  /llms.txt answers 200 with a non-empty body
      GET https://automancer.uk/llms.txt -> 200, 5797 bytes
PASS  /sitemap-index.xml answers 200 and parses as XML
      GET https://automancer.uk/sitemap-index.xml -> 200 and parses as XML
PASS  /agent.json answers 200 and parses as JSON
      GET https://automancer.uk/agent.json -> 200 and parses as JSON
PASS  /security.txt answers 200 and satisfies RFC 9116
      GET https://automancer.uk/security.txt -> 200 and satisfies RFC 9116 (Contact, future Expires, Canonical resolves)
PASS  homepage contains structural anchor "Company No. 17060907"
      GET https://automancer.uk/ -> 200 and contains "Company No. 17060907"
PASS  error monitoring is live (Sentry DSN present in the bundle)
      bundle /_astro/BaseLayout.astro_astro_type_script_index_0_lang.CoCD74lr.js carries a Sentry ingest DSN — error monitoring is live
PASS  TLS certificate valid and expires >21 days out
      certificate for automancer.uk is trusted and expires Nov 25 12:49:50 2026 GMT (86 days out, threshold >21)

RESULT: all checks passed against https://automancer.uk
```

### Static checks

```text
bash -n ops/verify-production.sh  # PASS
shellcheck ops/verify-production.sh  # PASS
git diff --check  # PASS
```

### Commits and release-note classification

- `ba68c606a750f0c1f8f7bac0a7f6e9a97c0bd147` — `test(ops): isolate every production-check assertion (q-auto-8159)`
- The report commit SHA and push parity are reported in the final lane response because a commit cannot truthfully contain its own SHA.

This is internal test-harness work, not a visitor-facing change, so no release note was added or generated. The repository carries `.githooks/pre-push`, but this clone has no active `core.hooksPath` and no `.git/hooks/pre-push`; this known state was already recorded by the preceding self-test lane. `RELEASE_NOTES_SKIP=1` was not and will not be used.

## What I did not do and why

- I did not remove, relax, or merge any production assertion.
- I did not add a local trusted certificate authority; that would alter machine trust state for a test, so the TLS trust-chain assertion remains the named live-only gap.
- I did not change the production Sentry check. Its two temporary mutations were restored from backups; only its self-test fixtures changed.
- I did not touch `VISION.md`, any workflow `runs-on:`, `docs/DEPLOYMENT.md`'s rollback section, dependencies, release notes, or release configuration.
- I did not bind any fixture server outside `127.0.0.1`, use a forbidden Git cleanup command, force-push, or use `RELEASE_NOTES_SKIP=1`.
