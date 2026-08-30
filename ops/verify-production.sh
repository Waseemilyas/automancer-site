#!/usr/bin/env bash
#
# ops/verify-production.sh — assert that the deployed site actually SERVES.
#
# A green actions/deploy-pages only proves GitHub accepted the artifact. This
# script checks production itself, the way a visitor / crawler / AI agent
# meets it: pages answer 200, unknown paths are a REAL 404 (not a soft 404),
# llms.txt and the sitemap exist, the agent manifest and security.txt answer
# at their non-dot paths (GitHub Pages does not serve dot-prefixed paths —
# measured 2026-08-22, when /.well-known/* 404'd live while every dist/-only
# check stayed green), the legal footer anchor is on the homepage, and the
# TLS certificate is valid and not about to expire. Both
# .github/workflows/deploy.yml (post-deploy verify job) and
# .github/workflows/uptime.yml (cron monitor) call THIS script — the checks
# exist once so the two callers can never drift apart.
#
# Every check retries transiently: Pages can lag a few seconds behind a fresh
# deploy, and a monitor that cries wolf gets muted. Each check polls for up
# to DEADLINE_SECS before failing — bounded, never unlimited.
#
# Exit codes: 0 all checks passed; 1 at least one check failed;
# 64 bad arguments (nothing was probed).
#
set -euo pipefail

# --- the contract under test -------------------------------------------
readonly ROUTES=("/" "/services" "/work" "/field-notes" "/about" "/contact" "/privacy" "/terms")
readonly LLMS_PATH="/llms.txt"
readonly SITEMAP_PATH="/sitemap-index.xml"
# The agent manifest and RFC 9116 security.txt are served at NON-DOT paths:
# GitHub Pages does not serve dot-prefixed paths, so the /.well-known/
# locations build fine and 404 live. These checks exist because exactly that
# shipped: green CI, green deploy, dead URLs that llms.txt advertised.
readonly AGENT_MANIFEST_PATH="/agent.json"
readonly SECURITY_TXT_PATH="/security.txt"
# Structural, not marketing copy: the company registration line from the
# site footer (src/components/Footer.astro ← src/data/business.ts). Marketing
# wording changes; the registered company number does not.
readonly HOMEPAGE_ANCHOR="Company No. 17060907"
# MEASURED 2026-08-22, not estimated. The live certificate is Let's Encrypt,
# 89-day lifetime, and LE renews at ~1/3 life remaining (~29 days out). So the
# threshold must sit BELOW 29 or it fires on every renewal cycle. 21 does, and
# it surfaces a FAILED renewal within about a week instead of sitting silent
# for a fortnight, which a 14-day threshold would have done.
readonly TLS_MIN_DAYS=21

# MEASURED: Pages deploys tonight completed in 36-47s end to end. This is a
# BACKSTOP against a hung request, not the check itself — the check is the
# assertion, and it retries until it passes or this budget runs out. Sized at
# roughly 2x the observed worst case.
readonly DEADLINE_SECS=90          # per-check retry budget before declaring failure
readonly POLL_INTERVAL_SECS=5
readonly HTTP_TIMEOUT_SECS=15      # per-request curl timeout
readonly MAX_REDIRECTS=5           # e.g. /services -> /services/ (GitHub Pages trailing slash)

BASE_URL=''
HOST=''       # hostname only (for TLS SNI)
HOST_PORT=''  # hostname[:port]

FAILED_CHECKS=()

# --self-test state (see self_test below); empty when not self-testing.
SELF_TEST_FAILURES=()
SELFTEST_SERVER_PID=''   # PID of the local fixture server, killed by cleanup
SELFTEST_SCENARIO=''     # scenario file the fixture server reloads per request

# --- scratch-file lifecycle ----------------------------------------------
# ALL scratch files live in ONE directory, created up front and removed as a
# unit by the trap below on EVERY exit path: clean exit, check failures,
# SIGINT, SIGTERM. Being killed by a signal is a NORMAL death for this
# script — CI wraps it in `timeout` and workflow timeout-minutes — so
# "clean up on the way out" cannot live in individual functions: most temp
# files are created inside COMMAND SUBSTITUTIONS (out=$(need_tmp)), where
# an `exit` kills only the subshell and the run carries on regardless. The
# parent owns the one directory name, and the trap reaches it from anywhere.
# When a signal arrives mid-request, bash runs the trap once the in-flight
# command returns — bounded by HTTP_TIMEOUT_SECS/POLL_INTERVAL_SECS.
RUN_TMP_DIR=''
cleanup() {
  local rc=$?
  trap - EXIT INT TERM
  [[ -z $SELFTEST_SERVER_PID ]] || kill "$SELFTEST_SERVER_PID" 2>/dev/null
  [[ -z $RUN_TMP_DIR ]] || rm -rf -- "$RUN_TMP_DIR"
  return "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if ! RUN_TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/verify-production.XXXXXXXXXX" 2>/dev/null) || [[ -z $RUN_TMP_DIR ]]; then
  printf '\nFATAL: cannot create a temporary directory in %s.\n' "${TMPDIR:-/tmp}" >&2
  printf 'This is a problem with THIS MACHINE, not with any site — nothing has been checked.\n' >&2
  printf 'Check free space AND free inodes (bytes can be plentiful while inodes are gone):\n' >&2
  printf '  df -h %s\n  df -i %s\n' "${TMPDIR:-/tmp}" "${TMPDIR:-/tmp}" >&2
  exit 3
fi

log() { printf '%s\n' "$*"; }

usage() {
  cat >&2 <<'EOF'
Usage: ops/verify-production.sh <base-url>
       ops/verify-production.sh --self-test

Verify that a deployed Automancer site serves correctly: page statuses,
real 404s, llms.txt, sitemap XML, agent.json + security.txt at their
non-dot paths, homepage footer anchor, TLS certificate.

--self-test proves the checker itself can still fail AND pass: it drives
every check against a local fixture on 127.0.0.1 (never production) and
asserts each check goes red under a failing condition and green under a
passing condition.

<base-url> must be a BARE https origin:
  - https scheme is required (the check suite includes TLS certificate
    validation, which is impossible over http);
  - no trailing slash — route paths are appended directly, so a trailing
    slash would produce broken URLs like https://example.com//services;
  - no path, query string, fragment, userinfo or whitespace;
  - hostname of the form example.com, optionally with :port.

Examples:
  ops/verify-production.sh https://automancer.uk         # production
  ops/verify-production.sh https://preview.example.org   # a preview deploy
  ops/verify-production.sh --self-test                   # the checker checks itself
EOF
}

arg_error() {
  printf '\nERROR: %s\n\n' "$*" >&2
  usage >&2
  exit 64
}

validate_base_url() {
  if [[ $# -ne 1 ]]; then
    arg_error "expected exactly 1 argument (the base URL), got $#"
  fi
  BASE_URL=$1
  [[ -n "$BASE_URL" ]] || arg_error "base URL is empty"
  case "$BASE_URL" in
    https://*) : ;;
    *) arg_error "base URL must start with https:// (got \"$BASE_URL\") — http would silently skip the certificate checks" ;;
  esac
  case "$BASE_URL" in
    */) arg_error "base URL must not end with \"/\" (got \"$BASE_URL\") — routes are appended directly and a trailing slash yields double slashes" ;;
  esac
  HOST_PORT=${BASE_URL#https://}
  case "$HOST_PORT" in
    '') arg_error "base URL has an empty hostname" ;;
    */*) arg_error "base URL must be a bare origin — no path after the hostname (got \"$BASE_URL\")" ;;
    *'?'*) arg_error "base URL must not contain a query string (got \"$BASE_URL\")" ;;
    *'#'*) arg_error "base URL must not contain a fragment (got \"$BASE_URL\")" ;;
    *@*) arg_error "base URL must not contain userinfo (got \"$BASE_URL\")" ;;
    *[[:space:]]*) arg_error "base URL must not contain whitespace (got \"$BASE_URL\")" ;;
  esac
  if [[ ! "$HOST_PORT" =~ ^[A-Za-z0-9._-]+(:[0-9]{1,5})?$ ]]; then
    arg_error "hostname looks malformed: \"$HOST_PORT\" (expected e.g. automancer.uk or staging.automancer.uk:8443)"
  fi
  HOST=${HOST_PORT%%:*}
  [[ -n "$HOST" ]] || arg_error "base URL has an empty hostname"
}

curl_exit_hint() {
  case $1 in
    6)  echo "DNS lookup failed for the hostname" ;;
    7)  echo "connection refused" ;;
    22) echo "server returned an unrepresentable HTTP error" ;;
    28) echo "request timed out after ${HTTP_TIMEOUT_SECS}s" ;;
    35) echo "TLS handshake failed" ;;
    47) echo "redirect chain exceeded ${MAX_REDIRECTS} hops (possible redirect loop)" ;;
    56) echo "connection dropped mid-response" ;;
    60) echo "TLS certificate verification failed (expired, self-signed or wrong host)" ;;
    *)  echo "curl exited with code $1 (see curl man page)" ;;
  esac
}

# need_tmp — print the path of a fresh scratch file INSIDE $RUN_TMP_DIR, or
# abort the whole run with a clear cause.
#
# Why files go inside the run directory rather than straight into /tmp:
# they are created inside command substitutions (out=$(need_tmp)), so no
# function can be trusted to clean up after itself — an `exit` there kills
# only the subshell. Cleanup belongs to the parent's EXIT/INT/TERM trap,
# which removes $RUN_TMP_DIR as a unit (see the lifecycle block above).
#
# Why this is not just `mktemp`: if the temp filesystem is out of space or
# inodes, a bare mktemp returns empty, every redirection then fails, and curl
# is blamed for it. The script goes on to report "page / answers 200 — gave up
# after 90s" about a site that is perfectly healthy — a false production
# incident, arrived at by retrying a condition that retrying cannot fix.
# Verified against a real /tmp inode exhaustion on the build box, 2026-08-22.
need_tmp() {
  local f
  if ! f=$(mktemp "${RUN_TMP_DIR}/tmp.XXXXXXXX" 2>/dev/null) || [[ -z $f ]]; then
    printf '\nFATAL: cannot create a temporary file in %s.\n' "$RUN_TMP_DIR" >&2
    printf 'This is a problem with THIS MACHINE, not with %s — the site has not been checked.\n' "$BASE_URL" >&2
    printf 'Check free space and free inodes:  df -h %s ; df -i %s\n' "${TMPDIR:-/tmp}" "${TMPDIR:-/tmp}" >&2
    exit 3
  fi
  printf '%s' "$f"
}

# probe_status <url> <expected-final-status>
# Follows redirects (bounded), asserts the FINAL status. Prints one line:
# a success summary on success, or a diagnosis naming URL, expected and
# actual on failure. Return 0 only when the expectation held.
probe_status() {
  local url=$1 expected=$2
  local out err meta rc code rest hops effective
  out=$(need_tmp) err=$(need_tmp)
  rc=0
  curl -sS -L --max-redirs "$MAX_REDIRECTS" --max-time "$HTTP_TIMEOUT_SECS" \
    -o /dev/null -w '%{http_code}|%{num_redirects}|%{url_effective}' \
    "$url" >"$out" 2>"$err" || rc=$?
  if (( rc != 0 )); then
    printf 'GET %s did not complete: %s (%s)\n' \
      "$url" "$(tr -d '\n' <"$err")" "$(curl_exit_hint "$rc")"
    rm -f "$out" "$err"
    return 1
  fi
  meta=$(cat "$out")
  rm -f "$out" "$err"
  code=${meta%%|*}; rest=${meta#*|}; hops=${rest%%|*}; effective=${rest#*|}
  if [[ "$code" != "$expected" ]]; then
    if [[ "$expected" == "404" && "$code" == "200" ]]; then
      printf 'GET %s returned HTTP 200 where a REAL 404 is required — soft 404: search engines and AI agents will index a page that does not exist\n' "$url"
    else
      printf 'GET %s returned HTTP %s, expected HTTP %s (followed %s redirect(s), finally landed on %s)\n' \
        "$url" "$code" "$expected" "$hops" "$effective"
    fi
    return 1
  fi
  if (( hops > 0 )); then
    printf 'GET %s -> %s (via %s redirect(s) to %s)\n' "$url" "$code" "$hops" "$effective"
  else
    printf 'GET %s -> %s\n' "$url" "$code"
  fi
}

# fetch_body <url> — writes the response body to BODY_FILE on success,
# asserts final status 200. Prints a diagnosis on failure.
BODY_FILE=''
fetch_body() {
  local url=$1
  local out err meta rc code
  out=$(need_tmp) err=$(need_tmp)
  BODY_FILE=$(need_tmp)
  rc=0
  curl -sS -L --max-redirs "$MAX_REDIRECTS" --max-time "$HTTP_TIMEOUT_SECS" \
    -o "$BODY_FILE" -w '%{http_code}' \
    "$url" >"$out" 2>"$err" || rc=$?
  if (( rc != 0 )); then
    printf 'GET %s did not complete: %s (%s)\n' \
      "$url" "$(tr -d '\n' <"$err")" "$(curl_exit_hint "$rc")"
    rm -f "$out" "$err" "$BODY_FILE"
    return 1
  fi
  meta=$(cat "$out")
  rm -f "$out" "$err"
  code=$meta
  if [[ "$code" != "200" ]]; then
    printf 'GET %s returned HTTP %s, expected HTTP 200 (body was %s bytes)\n' \
      "$url" "$code" "$(wc -c <"$BODY_FILE")"
    rm -f "$BODY_FILE"
    return 1
  fi
}

# poll_check <label> <function> [args...] — retry one check until it passes
# or DEADLINE_SECS elapse. Every WAIT line carries the current diagnosis so
# "still deploying" never looks like a hard failure, and the final FAIL line
# repeats the last observed state verbatim.
poll_check() {
  local label=$1 fn=$2
  shift 2
  local detail='' deadline=$((SECONDS + DEADLINE_SECS))
  while true; do
    if detail=$("$fn" "$@"); then
      log "PASS  $label"
      log "      $detail"
      return 0
    fi
    if (( SECONDS >= deadline )); then
      log "FAIL  $label — gave up after ${DEADLINE_SECS}s of retries. Last observed state:"
      log "      $detail"
      FAILED_CHECKS+=("$label")
      return 1
    fi
    log "WAIT  $label — retrying (budget ${DEADLINE_SECS}s): $detail"
    sleep "$POLL_INTERVAL_SECS"
  done
}

check_route() {
  probe_status "${BASE_URL}$1" 200
}

check_not_found() {
  # Unique per run so a CDN/Pages cache can never serve a stale hit.
  local url="${BASE_URL}/this-route-must-not-exist-$$-${RANDOM}"
  probe_status "$url" 404
}

check_llms_txt() {
  local url="${BASE_URL}${LLMS_PATH}" bytes
  fetch_body "$url" || return 1
  bytes=$(wc -c <"$BODY_FILE")
  if (( bytes == 0 )); then
    printf 'GET %s returned HTTP 200 but a ZERO-BYTE body — llms.txt generation broke\n' "$url"
    rm -f "$BODY_FILE"
    return 1
  fi
  printf 'GET %s -> 200, %s bytes\n' "$url" "$bytes"
  rm -f "$BODY_FILE"
}

json_parses() {
  # Real JSON parse, not a substring sniff. python3 ships on GitHub's Ubuntu
  # runners and every machine this repo is developed on.
  python3 - "$1" <<'PY' || return 1
import sys, json
try:
    with open(sys.argv[1], encoding="utf-8") as fh:
        json.load(fh)
except Exception as exc:
    print(f"JSON parse error: {exc}", file=sys.stderr)
    sys.exit(1)
PY
}

# rfc9116_conformant <file> <expected-canonical-url-or-empty> — validate the
# fields RFC 9116 requires: Contact and Expires MUST be present, Expires MUST
# be a parseable timestamp IN THE FUTURE, Preferred-Languages must be
# present, and Canonical must be an absolute URL. When an expected canonical
# URL is supplied (canonical origins only — see below), Canonical must match
# it EXACTLY. That assertion is not pedantry: a Canonical pointing at a path
# that 404s makes the document non-conformant AND re-advertises a dead URL —
# the exact failure mode that put these checks here.
#
# The exact match is applied only when HOST is automancer.uk / www (the
# origin the file is generated to name). On any other host — the preview
# deploys this script also verifies — the served bytes legitimately still
# carry production's Canonical, so only structure is asserted there.
rfc9116_conformant() {
  python3 - "$1" "$2" <<'PY' || return 1
import sys, datetime

path, expected_canonical = sys.argv[1], sys.argv[2]
fields = {}
with open(path, encoding="utf-8") as fh:
    for line in fh:
        key, sep, value = line.partition(":")
        if sep and key.strip() and key.strip() not in fields:
            fields[key.strip()] = value.strip()

missing = [k for k in ("Contact", "Expires", "Preferred-Languages", "Canonical") if k not in fields]
if missing:
    print(f"missing required field(s): {', '.join(missing)}", file=sys.stderr)
    sys.exit(1)

try:
    expires = datetime.datetime.fromisoformat(fields["Expires"].replace("Z", "+00:00"))
except ValueError:
    print(f"Expires \"{fields['Expires']}\" is not a parseable RFC 3339 timestamp", file=sys.stderr)
    sys.exit(1)
if expires <= datetime.datetime.now(datetime.timezone.utc):
    print(
        f"Expires \"{fields['Expires']}\" is NOT in the future — the document is invalid (RFC 9116 §3.3)",
        file=sys.stderr,
    )
    sys.exit(1)

if not fields["Canonical"].startswith(("http://", "https://")):
    print(f"Canonical \"{fields['Canonical']}\" is not an absolute http(s) URL", file=sys.stderr)
    sys.exit(1)

if expected_canonical and fields["Canonical"] != expected_canonical:
    print(
        f"Canonical \"{fields['Canonical']}\" does not match the served URL \"{expected_canonical}\" "
        "- a Canonical that does not resolve makes the file non-conformant",
        file=sys.stderr,
    )
    sys.exit(1)
PY
}

check_agent_manifest() {
  local url="${BASE_URL}${AGENT_MANIFEST_PATH}"
  fetch_body "$url" || return 1
  if ! json_parses "$BODY_FILE"; then
    printf 'GET %s returned HTTP 200 but the body is NOT valid JSON (first bytes: %s)\n' \
      "$url" "$(head -c 120 "$BODY_FILE" | tr -d '\n')"
    rm -f "$BODY_FILE"
    return 1
  fi
  printf 'GET %s -> 200 and parses as JSON\n' "$url"
  rm -f "$BODY_FILE"
}

check_security_txt() {
  local url="${BASE_URL}${SECURITY_TXT_PATH}" verdict expected_canonical=''
  fetch_body "$url" || return 1
  # Exact Canonical match only on the origin the file is generated to name;
  # preview origins get structural validation (see rfc9116_conformant).
  case "$HOST" in
    automancer.uk | www.automancer.uk) expected_canonical="${BASE_URL}${SECURITY_TXT_PATH}" ;;
  esac
  if ! verdict=$(rfc9116_conformant "$BODY_FILE" "$expected_canonical" 2>&1); then
    printf 'GET %s returned HTTP 200 but VIOLATES RFC 9116: %s\n' "$url" "$(printf '%s' "$verdict" | tr -d '\n')"
    rm -f "$BODY_FILE"
    return 1
  fi
  printf 'GET %s -> 200 and satisfies RFC 9116 (Contact, future Expires, Canonical resolves)\n' "$url"
  rm -f "$BODY_FILE"
}

xml_parses() {
  # Real XML parse, not a substring sniff. python3 ships on GitHub's Ubuntu
  # runners and every machine this repo is developed on.
  python3 - "$1" <<'PY' || return 1
import sys, xml.etree.ElementTree as ET
try:
    ET.parse(sys.argv[1])
except Exception as exc:
    print(f"XML parse error: {exc}", file=sys.stderr)
    sys.exit(1)
PY
}

check_sitemap() {
  local url="${BASE_URL}${SITEMAP_PATH}"
  fetch_body "$url" || return 1
  if ! xml_parses "$BODY_FILE"; then
    printf 'GET %s returned HTTP 200 but the body is NOT well-formed XML (first bytes: %s)\n' \
      "$url" "$(head -c 120 "$BODY_FILE" | tr -d '\n')"
    rm -f "$BODY_FILE"
    return 1
  fi
  printf 'GET %s -> 200 and parses as XML\n' "$url"
  rm -f "$BODY_FILE"
}

check_homepage_anchor() {
  local url="${BASE_URL}/"
  fetch_body "$url" || return 1
  if ! grep -qF -- "$HOMEPAGE_ANCHOR" "$BODY_FILE"; then
    printf 'homepage %s does NOT contain the expected structural string \"%s\" — the served page is not the current Automancer homepage (stale deploy, wrong site, or the footer/legal block changed)\n' \
      "$url" "$HOMEPAGE_ANCHOR"
    rm -f "$BODY_FILE"
    return 1
  fi
  printf 'GET %s -> 200 and contains \"%s\"\n' "$url" "$HOMEPAGE_ANCHOR"
  rm -f "$BODY_FILE"
}

# Error monitoring is a SETUP condition, and setup conditions must be loud.
#
# src/scripts/sentry.ts initialises only when `PROD && dsn`. The DSN comes from
# a CI repository variable. If that variable is ever unset, renamed, or lost in
# a workflow edit, the site builds green, deploys green, and error monitoring is
# simply OFF — with nothing anywhere reporting it. A missing DSN is a condition
# of OUR SETUP, not of the world, and it is the only kind a human can fix.
#
# Checked here rather than in the test suite because the suite builds WITHOUT a
# DSN (correctly — dev, preview and test must not consume the production error
# budget), so only production can answer this.
check_sentry_live() {
  local url="${BASE_URL}/"
  fetch_body "$url" || return 1
  local bundle
  bundle=$(grep -oE '/_astro/[^"]+\.js' "$BODY_FILE" | head -1)
  rm -f "$BODY_FILE"
  if [[ -z $bundle ]]; then
    printf 'could not find a /_astro/*.js bundle on %s — the page did not render as expected\n' "$url"
    return 1
  fi
  fetch_body "${BASE_URL}${bundle}" || return 1
  if ! grep -qE 'ingest\.(de\.)?sentry\.io|o[0-9]+\.ingest' "$BODY_FILE"; then
    printf 'bundle %s contains NO Sentry ingest DSN — error monitoring is OFF in production. The PUBLIC_AUT_SENTRY_WEB_DSN repository variable is probably unset or renamed; the build and deploy both succeed without it\n' "$bundle"
    rm -f "$BODY_FILE"
    return 1
  fi
  printf 'bundle %s carries a Sentry ingest DSN — error monitoring is live\n' "$bundle"
  rm -f "$BODY_FILE"
}

# tls_expiry_ok <expiry-epoch> <min-days> [now-epoch]
# The TLS expiry POLICY in isolation: is the certificate still valid MORE THAN
# min_days out from now? Extracted from check_tls so --self-test can drive both
# directions without a network — the handshake half of check_tls needs a real
# trust store, which a local fixture cannot provide. Returns 0 when the expiry
# clears the threshold, 1 when it does not.
tls_expiry_ok() {
  local expiry_epoch=$1 min_days=$2 now_epoch=${3:-$(date +%s)}
  (( expiry_epoch > now_epoch + min_days * 86400 ))
}

check_tls() {
  # -verify_return_error makes s_client exit non-zero unless the presented
  # chain verifies against the system trust store (expiry, wrong host and
  # untrusted roots all land here).
  local endline expiry_iso expiry_epoch now_epoch days_left
  local tls_target="$HOST_PORT"
  case "$tls_target" in
    *:*) : ;;                 # explicit port already present
    *)  tls_target="${tls_target}:443" ;;
  esac
  if ! endline=$(printf '' | openssl s_client -servername "$HOST" -connect "$tls_target" -verify_return_error 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null); then
    printf 'TLS handshake with %s failed or the certificate chain could not be verified against system roots — expired, misnamed or untrusted certificate\n' "$tls_target"
    return 1
  fi
  expiry_iso=${endline#notAfter=}
  expiry_epoch=$(date -d "$expiry_iso" +%s) || {
    printf 'could not parse certificate expiry date \"%s\" for %s\n' "$expiry_iso" "$HOST"
    return 1
  }
  now_epoch=$(date +%s)
  days_left=$(( (expiry_epoch - now_epoch) / 86400 ))
  if ! tls_expiry_ok "$expiry_epoch" "$TLS_MIN_DAYS" "$now_epoch"; then
    printf 'certificate for %s expires %s — only %s day(s) out, renewal threshold is MORE THAN %s days\n' \
      "$HOST" "$expiry_iso" "$days_left" "$TLS_MIN_DAYS"
    return 1
  fi
  printf 'certificate for %s is trusted and expires %s (%s days out, threshold >%s)\n' \
    "$HOST" "$expiry_iso" "$days_left" "$TLS_MIN_DAYS"
}

# Confirm THIS MACHINE can do the job before asserting anything about the site.
#
# Every probe needs temp files. If the temp filesystem is out of space or
# inodes, mktemp returns empty, redirections fail, and curl gets blamed — the
# run then reports "page / answers 200 — gave up after 90s" about a perfectly
# healthy site. A false production incident, reached by retrying a condition
# that retrying cannot fix.
#
# It has to be checked HERE rather than at each call site: the probes run
# inside command substitutions, so an `exit` in one of them kills the subshell
# and the run carries on regardless. Verified against a real /tmp inode
# exhaustion on the build box, 2026-08-22.
#
# The directory itself is created (and its failure handled) up front, before
# main; this preflight additionally proves files can be WRITTEN there.
preflight() {
  local probe
  probe=$(need_tmp)
  if ! printf 'probe\n' >"$probe" 2>/dev/null; then
    rm -f "$probe"
    printf 'FATAL: %s is not writable — nothing has been checked.\n' "${TMPDIR:-/tmp}" >&2
    exit 3
  fi
  rm -f "$probe"
}

# --- self-test ------------------------------------------------------------
#
# `--self-test` proves the checker itself can still fail AND can still pass.
# A check that can no longer fail is worse than no check: deploy.yml and
# uptime.yml both call THIS script, so a silently-green check mutes the deploy
# gate and the uptime monitor at once (measured defect, 2026-08-30). A check
# that can never succeed is as broken, and a dead-address self-test cannot see
# it — a red check against a dead address looks identical to a correct one.
#
# For every check in main(), this mode drives the check twice against a local
# fixture server bound to 127.0.0.1 only (never 0.0.0.0 — this box is shared):
#   * FAIL direction — a fixture under which the check MUST fail; assert it
#     does. A permanently-green check fails this direction.
#   * PASS direction — a fixture under which the check MUST pass; assert it
#     does. A permanently-red check fails this direction.
#
# The TLS check's network half (openssl s_client against system roots) cannot
# be faked locally — a self-signed fixture is, correctly, untrusted. Its policy
# (expiry must clear TLS_MIN_DAYS) is extracted into tls_expiry_ok and driven
# both ways directly; the handshake half is exercised live by deploy.yml,
# uptime.yml and any ordinary run.

find_free_port() {
  python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()'
}

# start_fixture_server <port> — write and launch the local fixture server.
start_fixture_server() {
  local server_file=$RUN_TMP_DIR/selftest-server.py
  cat >"$server_file" <<'PY'
import http.server, json, os, sys
SCENARIO = os.environ["SELFTEST_SCENARIO"]
def load():
    with open(SCENARIO, encoding="utf-8") as fh:
        return json.load(fh)
class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        sc = load()
        entry = sc.get("routes", {}).get(self.path, sc.get("default", {"status": 404, "body": ""}))
        body = entry.get("body", "").encode("utf-8")
        self.send_response(int(entry.get("status", 200)))
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def log_message(self, *args):
        pass
http.server.HTTPServer(("127.0.0.1", int(sys.argv[1])), Handler).serve_forever()
PY
  SELFTEST_SCENARIO=$RUN_TMP_DIR/selftest-scenario.json
  export SELFTEST_SCENARIO
  printf '{"routes":{},"default":{"status":404,"body":""}}\n' >"$SELFTEST_SCENARIO"
  python3 "$server_file" "$1" &
  SELFTEST_SERVER_PID=$!
}

# self_test_scenario <json> — replace the fixture server's response map. The
# server re-reads this file on every request, so one server serves all 18
# fixtures in turn without a restart.
self_test_scenario() {
  printf '%s\n' "$1" >"$SELFTEST_SCENARIO"
}

# self_test_expect <expected> <label> <fn> [args...]
# Run one check directly (no poll_check retry budget) and assert its result is
# the expected direction. Records a failure in SELF_TEST_FAILURES and always
# returns 0 so a red direction never aborts the whole self-test under set -e.
self_test_expect() {
  local expected=$1 label=$2 fn=$3
  shift 3
  local detail rc=0 first
  if detail=$("$fn" "$@" 2>&1); then rc=0; else rc=$?; fi
  first=$(printf '%s\n' "$detail" | head -1)
  [[ -n $first ]] || first='(no output)'
  if [[ $expected == fail ]]; then
    if (( rc == 0 )); then
      log "SELFTEST FAIL  ${label} — expected to FAIL but PASSED: ${first}"
      SELF_TEST_FAILURES+=("${label} (fail direction)")
    else
      log "SELFTEST PASS  ${label} — fails as it must: ${first}"
    fi
  else
    if (( rc != 0 )); then
      log "SELFTEST FAIL  ${label} — expected to PASS but FAILED: ${first}"
      SELF_TEST_FAILURES+=("${label} (pass direction)")
    else
      log "SELFTEST PASS  ${label} — passes as it must: ${first}"
    fi
  fi
}

self_test() {
  local port server_ready i pid
  port=$(find_free_port) || { printf 'SELF-TEST FATAL: cannot find a free local port\n' >&2; exit 3; }
  start_fixture_server "$port"

  server_ready=0
  for i in $(seq 1 50); do
    if curl -sS -o /dev/null --max-time 2 "http://127.0.0.1:${port}/" 2>/dev/null; then
      server_ready=1
      break
    fi
    sleep 0.1
  done
  if (( server_ready == 0 )); then
    printf 'SELF-TEST FATAL: fixture server on 127.0.0.1:%s did not come up\n' "$port" >&2
    exit 3
  fi

  BASE_URL="http://127.0.0.1:${port}"
  HOST='127.0.0.1'
  HOST_PORT="127.0.0.1:${port}"

  log "Self-test: driving 9 checks against a local fixture server on ${BASE_URL}"
  log "(both directions use fixtures only; the FAIL direction never touches production)"
  log ""
  # 1. check_route — one function parameterised over 8 routes in main().
  self_test_scenario '{"routes":{"/":{"status":404,"body":"missing"}},"default":{"status":404,"body":""}}'
  self_test_expect fail "page / answers 200" check_route "/"
  self_test_scenario '{"routes":{"/":{"status":200,"body":"ok"}},"default":{"status":404,"body":""}}'
  self_test_expect pass "page / answers 200" check_route "/"

  # 2. check_not_found — unknown path must be a REAL 404.
  self_test_scenario '{"routes":{},"default":{"status":200,"body":"soft 404 page"}}'
  self_test_expect fail "unknown path answers a REAL 404 (not a soft 404)" check_not_found
  self_test_scenario '{"routes":{},"default":{"status":404,"body":""}}'
  self_test_expect pass "unknown path answers a REAL 404 (not a soft 404)" check_not_found

  # 3. check_llms_txt — 200 with a non-empty body.
  self_test_scenario '{"routes":{"/llms.txt":{"status":200,"body":""}},"default":{"status":404,"body":""}}'
  self_test_expect fail "/llms.txt answers 200 with a non-empty body" check_llms_txt
  self_test_scenario '{"routes":{"/llms.txt":{"status":200,"body":"# automancer"}},"default":{"status":404,"body":""}}'
  self_test_expect pass "/llms.txt answers 200 with a non-empty body" check_llms_txt

  # 4. check_sitemap — 200 and well-formed XML.
  self_test_scenario '{"routes":{"/sitemap-index.xml":{"status":200,"body":"this is not xml"}},"default":{"status":404,"body":""}}'
  self_test_expect fail "/sitemap-index.xml answers 200 and parses as XML" check_sitemap
  self_test_scenario '{"routes":{"/sitemap-index.xml":{"status":200,"body":"<sitemapindex><sitemap><loc>https://automancer.uk/sitemap-0.xml</loc></sitemap></sitemapindex>"}},"default":{"status":404,"body":""}}'
  self_test_expect pass "/sitemap-index.xml answers 200 and parses as XML" check_sitemap

  # 5. check_agent_manifest — 200 and valid JSON.
  self_test_scenario '{"routes":{"/agent.json":{"status":200,"body":"{ not json"}},"default":{"status":404,"body":""}}'
  self_test_expect fail "/agent.json answers 200 and parses as JSON" check_agent_manifest
  self_test_scenario '{"routes":{"/agent.json":{"status":200,"body":"{}"}},"default":{"status":404,"body":""}}'
  self_test_expect pass "/agent.json answers 200 and parses as JSON" check_agent_manifest

  # 6. check_security_txt — 200 and RFC 9116 conformant.
  self_test_scenario '{"routes":{"/security.txt":{"status":200,"body":"Contact: mailto:security@automancer.uk\nExpires: 2020-01-01T00:00:00Z\n"}},"default":{"status":404,"body":""}}'
  self_test_expect fail "/security.txt answers 200 and satisfies RFC 9116" check_security_txt
  self_test_scenario '{"routes":{"/security.txt":{"status":200,"body":"Contact: mailto:security@automancer.uk\nExpires: 2099-01-01T00:00:00Z\nPreferred-Languages: en\nCanonical: https://automancer.uk/security.txt\n"}},"default":{"status":404,"body":""}}'
  self_test_expect pass "/security.txt answers 200 and satisfies RFC 9116" check_security_txt

  # 7. check_homepage_anchor — the structural string is present.
  self_test_scenario '{"routes":{"/":{"status":200,"body":"<html><body>nothing to see</body></html>"}},"default":{"status":404,"body":""}}'
  self_test_expect fail "homepage contains structural anchor" check_homepage_anchor
  self_test_scenario '{"routes":{"/":{"status":200,"body":"<html><body>Company No. 17060907</body></html>"}},"default":{"status":404,"body":""}}'
  self_test_expect pass "homepage contains structural anchor" check_homepage_anchor

  # 8. check_sentry_live — bundle carries an ingest DSN.
  self_test_scenario '{"routes":{"/":{"status":200,"body":"<script src=/_astro/app.js></script>"},"/_astro/app.js":{"status":200,"body":"no sentry ingest here"}},"default":{"status":404,"body":""}}'
  self_test_expect fail "error monitoring is live (Sentry DSN present in the bundle)" check_sentry_live
  self_test_scenario '{"routes":{"/":{"status":200,"body":"<script src=/_astro/app.js></script>"},"/_astro/app.js":{"status":200,"body":"const dsn=o123456.ingest.sentry.io/4500000000000000"}},"default":{"status":404,"body":""}}'
  self_test_expect pass "error monitoring is live (Sentry DSN present in the bundle)" check_sentry_live

  # 9. check_tls — the expiry policy (network half is live-only, see above).
  self_test_expect fail "TLS certificate expires >${TLS_MIN_DAYS} days out (policy)" \
    tls_expiry_ok "$(date -d '+10 days' +%s)" "$TLS_MIN_DAYS"
  self_test_expect pass "TLS certificate expires >${TLS_MIN_DAYS} days out (policy)" \
    tls_expiry_ok "$(date -d '+100 days' +%s)" "$TLS_MIN_DAYS"

  # Tear the fixture server down by pid and prove it is gone.
  pid=$SELFTEST_SERVER_PID
  kill "$pid" 2>/dev/null
  SELFTEST_SERVER_PID=''
  for i in $(seq 1 50); do
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.1
  done
  if kill -0 "$pid" 2>/dev/null; then
    printf 'SELF-TEST FATAL: fixture server (pid %s) refused to stop\n' "$pid" >&2
    exit 3
  fi
  log ""
  log "Fixture server on 127.0.0.1:${port} (pid ${pid}) stopped and gone."

  log ""
  if (( ${#SELF_TEST_FAILURES[@]} > 0 )); then
    log "SELF-TEST RESULT: ${#SELF_TEST_FAILURES[@]} direction(s) FAILED:"
    for i in "${SELF_TEST_FAILURES[@]}"; do log "  - $i"; done
    exit 1
  fi
  log "SELF-TEST RESULT: all 9 checks can fail AND can pass."
}

main() {
  if [[ ${1:-} == '--self-test' ]]; then
    [[ $# -eq 1 ]] || arg_error "--self-test takes no arguments (got $#)"
    preflight
    self_test
    return
  fi
  validate_base_url "$@"
  preflight
  log "Verifying ${BASE_URL} (each check retries for up to ${DEADLINE_SECS}s before failing)"
  log ""

  # A failed check must not abort the run under `set -e`: one red run should
  # report EVERYTHING that is wrong, not just the first thing. poll_check
  # records each failure in FAILED_CHECKS; the summary below decides the
  # exit status.
  #
  # Every check below has a matching fail+pass fixture in self_test(). Add a
  # check here and you must add it there too, or the self-test will keep
  # claiming "all N checks" while silently not covering the new one.
  local route
  for route in "${ROUTES[@]}"; do
    if ! poll_check "page ${route} answers 200" check_route "$route"; then :; fi
  done
  if ! poll_check "unknown path answers a REAL 404 (not a soft 404)" check_not_found; then :; fi
  if ! poll_check "${LLMS_PATH} answers 200 with a non-empty body" check_llms_txt; then :; fi
  if ! poll_check "${SITEMAP_PATH} answers 200 and parses as XML" check_sitemap; then :; fi
  if ! poll_check "${AGENT_MANIFEST_PATH} answers 200 and parses as JSON" check_agent_manifest; then :; fi
  if ! poll_check "${SECURITY_TXT_PATH} answers 200 and satisfies RFC 9116" check_security_txt; then :; fi
  if ! poll_check "homepage contains structural anchor \"${HOMEPAGE_ANCHOR}\"" check_homepage_anchor; then :; fi
  if ! poll_check "error monitoring is live (Sentry DSN present in the bundle)" check_sentry_live; then :; fi
  if ! poll_check "TLS certificate valid and expires >${TLS_MIN_DAYS} days out" check_tls; then :; fi

  log ""
  if (( ${#FAILED_CHECKS[@]} > 0 )); then
    log "RESULT: ${#FAILED_CHECKS[@]} check(s) FAILED against ${BASE_URL}:"
    local c
    for c in "${FAILED_CHECKS[@]}"; do
      log "  - $c"
    done
    exit 1
  fi
  log "RESULT: all checks passed against ${BASE_URL}"
}

main "$@"
