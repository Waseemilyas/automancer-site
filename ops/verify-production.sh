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

log() { printf '%s\n' "$*"; }

usage() {
  cat >&2 <<'EOF'
Usage: ops/verify-production.sh <base-url>

Verify that a deployed Automancer site serves correctly: page statuses,
real 404s, llms.txt, sitemap XML, agent.json + security.txt at their
non-dot paths, homepage footer anchor, TLS certificate.

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

# probe_status <url> <expected-final-status>
# Follows redirects (bounded), asserts the FINAL status. Prints one line:
# a success summary on success, or a diagnosis naming URL, expected and
# Create a temp file, or ABORT THE WHOLE RUN with a clear cause.
#
# Why this is not just `mktemp`: if the temp filesystem is out of space or
# inodes, a bare mktemp returns empty, every redirection then fails, and curl
# is blamed for it. The script goes on to report "page / answers 200 — gave up
# after 90s" about a site that is perfectly healthy — a false production
# incident, arrived at by retrying a condition that retrying cannot fix.
# Verified against a real /tmp inode exhaustion on the build box, 2026-08-22.
need_tmp() {
  local f
  if ! f=$(mktemp 2>/dev/null) || [[ -z $f ]]; then
    printf '\nFATAL: cannot create a temporary file in %s.\n' "${TMPDIR:-/tmp}" >&2
    printf 'This is a problem with THIS MACHINE, not with %s — the site has not been checked.\n' "$BASE_URL" >&2
    printf 'Check free space and free inodes:  df -h %s ; df -i %s\n' "${TMPDIR:-/tmp}" "${TMPDIR:-/tmp}" >&2
    exit 3
  fi
  printf '%s' "$f"
}

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

check_tls() {
  # -verify_return_error makes s_client exit non-zero unless the presented
  # chain verifies against the system trust store (expiry, wrong host and
  # untrusted roots all land here).
  local endline expiry_iso expiry_epoch now_epoch min_epoch days_left
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
  min_epoch=$((now_epoch + TLS_MIN_DAYS * 86400))
  days_left=$(( (expiry_epoch - now_epoch) / 86400 ))
  if (( expiry_epoch <= min_epoch )); then
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
preflight() {
  local probe
  if ! probe=$(mktemp 2>/dev/null) || [[ -z $probe ]]; then
    printf 'FATAL: cannot create a temporary file in %s.\n' "${TMPDIR:-/tmp}" >&2
    printf 'This is a problem with THIS MACHINE, not with the site — nothing has been checked.\n' >&2
    printf 'Check free space AND free inodes (bytes can be plentiful while inodes are gone):\n' >&2
    printf '  df -h %s\n  df -i %s\n' "${TMPDIR:-/tmp}" "${TMPDIR:-/tmp}" >&2
    exit 3
  fi
  if ! printf 'probe\n' >"$probe" 2>/dev/null; then
    rm -f "$probe"
    printf 'FATAL: %s is not writable — nothing has been checked.\n' "${TMPDIR:-/tmp}" >&2
    exit 3
  fi
  rm -f "$probe"
}

main() {
  validate_base_url "$@"
  preflight
  log "Verifying ${BASE_URL} (each check retries for up to ${DEADLINE_SECS}s before failing)"
  log ""

  # A failed check must not abort the run under `set -e`: one red run should
  # report EVERYTHING that is wrong, not just the first thing. poll_check
  # records each failure in FAILED_CHECKS; the summary below decides the
  # exit status.
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
