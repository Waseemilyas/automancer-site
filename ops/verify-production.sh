#!/usr/bin/env bash
#
# ops/verify-production.sh — assert that the deployed site actually SERVES.
#
# A green actions/deploy-pages only proves GitHub accepted the artifact. This
# script checks production itself, the way a visitor / crawler / AI agent
# meets it: pages answer 200, unknown paths are a REAL 404 (not a soft 404),
# llms.txt and the sitemap exist, the legal footer anchor is on the homepage,
# and the TLS certificate is valid and not about to expire. Both
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
real 404s, llms.txt, sitemap XML, homepage footer anchor, TLS certificate.

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
# actual on failure. Return 0 only when the expectation held.
probe_status() {
  local url=$1 expected=$2
  local out err meta rc code rest hops effective
  out=$(mktemp) err=$(mktemp)
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
  out=$(mktemp) err=$(mktemp)
  BODY_FILE=$(mktemp)
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

main() {
  validate_base_url "$@"
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
