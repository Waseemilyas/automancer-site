# Deploying automancer.uk

Every fact here was verified against the live site on 2026-08-21, not taken from
configuration. Where the config and reality disagree, reality is recorded.

## The short version

**Push to `main`. That is the deploy.** There is no operator procedure, no
database, and no migration step. `.github/workflows/deploy.yml` builds the site
and publishes it to GitHub Pages; a push reaches production in roughly 40 seconds.

## The gate nobody documented

A `pre-push` hook blocks any push to `main` that carries **user-facing commits
with no release notes**. It is managed by `/opt/automancer/auto/scripts/release-notes.mjs`.
If your push is refused with `BLOCKED — HEAD is N user-facing commit(s) ahead`,
the fix is to write the notes, not to bypass the hook:

```bash
node /opt/automancer/auto/scripts/release-notes.mjs preview --repo "$PWD"   # read it first
node /opt/automancer/auto/scripts/release-notes.mjs release --repo "$PWD" --yes
git push && git push --tags
node /opt/automancer/auto/scripts/release-notes.mjs publish --repo "$PWD" --version vYYYY.MM.DD.N
```

The tag must be on `origin` before `publish` will run. Docs-only commits pass the
gate untouched — the tool classifies them as not user-facing.

`RELEASE_NOTES_SKIP=1` exists. It is for a genuine emergency and using it means
production ships changes nobody has written up.

## Before you push

1. `git fetch && git rev-list --left-right --count origin/main...main` — if the
   left number is not 0 you are behind, and anything you verified locally was
   verified against the wrong tree.
2. `pnpm install` — if the lockfile moved, a green run on the old dependencies
   proves nothing.
3. `pnpm run verify` — one command, identical to what CI runs and in CI's
   order: the typecheck (`astro check`) first, then the suite. The suite
   builds the site and asserts against `dist/`, so it catches what a visitor
   or a crawler would actually get — but it does NOT validate types, so do
   not stop at `pnpm run test`.

CI (`ci.yml`) runs `check` and `test` on every push and PR independently —
i.e. exactly what `pnpm run verify` composes locally.

## Rollback

Redeploy is automatic on push, so a revert reaches production the same way the
change did.

- **A bad user-facing change** — revert that one commit and push. This is almost
  always the right rollback, because typically only one commit changes what a
  visitor sees.
- **Full restore to the pre-campaign tree** —
  `git reset --hard ox-campaign-truebaseline-2026-08-21 && git push --force-with-lease`.
  Last resort; discards work, so it needs a human decision.

## Verify from production, never from the green tick

The workflow reporting success does not mean the site is correct. Check what is
actually served:

```bash
for u in / /404.html /field-notes/ /llms.txt /sitemap-index.xml; do
  printf '%-22s %s\n' "$u" "$(curl -s -o /dev/null -w '%{http_code}' https://automancer.uk$u)"
done
curl -s -o /dev/null -w '%{http_code}\n' https://automancer.uk/definitely-not-a-page   # must be 404
```

## Things that look wrong and are not

- **`/services.html` returns 301, then a 200 page.** The 301 only adds a trailing
  slash; the hop that reaches `/services` is a `<meta http-equiv="refresh">` page
  that Astro emits with a canonical link, `noindex`, and a real anchor. It is not
  a redirect loop and it is not broken.
- **The 301 body mentions nginx.** That string is page content in GitHub's error
  template. The actual `Server:` header is `GitHub.com`. Read the header, not the
  body.
- **Legacy `*.html` stub pages have no `<h1>`.** Correct for a redirect page; the
  test suite excludes them deliberately.

## Known gap

**There is no uptime check and no error alerting.** Sentry's browser SDK captures
client-side JavaScript errors only — it would not notice the site serving a 404, a
failed deploy, or an expired certificate. Nothing would tell us the site was down.
Adding an external uptime check is outstanding work.
