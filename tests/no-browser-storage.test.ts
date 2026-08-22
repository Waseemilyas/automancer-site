/**
 * /privacy makes a FALSIFIABLE FACTUAL CLAIM about this site's behaviour:
 *
 *   "loading the site sets no cookies and stores nothing in your browser"
 *
 * That is not marketing copy — it is the stated reason there is no cookie
 * banner. If any code starts writing to the browser, the notice becomes a
 * false statement to visitors and to a regulator, and the missing banner
 * stops being defensible.
 *
 * It has already gone wrong once. A UTM-capture snippet wrote `aut-utm` to
 * sessionStorage on any URL carrying utm_* params, which contradicted the
 * claim for months before the 2026-08-22 audit (AUT-6414) found it. It was
 * found by loading the live site, not by reading code — nothing in the repo
 * connected the snippet to the sentence it falsified. This test is that
 * connection, so the next one fails in CI instead of shipping.
 *
 * Scope and honesty about it:
 *   - This greps the BUILT OUTPUT — inline scripts and every emitted JS
 *     asset, so third-party bundles (Sentry) are covered too, not just our
 *     own source.
 *   - A static scan proves the storage APIs are never REFERENCED, which is
 *     stronger than proving they are never called and is the property we
 *     actually want. It cannot see storage written by a cross-origin iframe
 *     (Cloudflare Turnstile). That was checked by observation in the same
 *     audit and is disclosed in the notice as a strictly-necessary security
 *     cookie; it is out of scope here by necessity, not by oversight.
 *   - Comments count as references. That is deliberate: a server-side
 *     comment costs nothing, and an HTML comment explaining why we do not
 *     use sessionStorage would otherwise sit in the shipped output where it
 *     defeats exactly this kind of grep audit — which is what happened to
 *     the first draft of the removal.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DIST, allHtmlFiles } from './support/dist';

/**
 * Browser-storage APIs that would each falsify the notice. Word-boundary
 * matched so unrelated identifiers do not trip them.
 */
const STORAGE_APIS = [
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'openDatabase',
  'document.cookie',
  'navigator.storage',
  'caches.open',
];

// Deliberately NOT global: this regex is shared across every line of every
// file and `.test()` on a /g regex advances lastIndex between calls, which
// silently returns false on alternating matches. A storage-detection test
// that misses every other hit is worse than no test.
const PATTERN = new RegExp(STORAGE_APIS.map((api) => api.replace(/\./g, '\\.')).join('|'));

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** Every emitted JavaScript asset, dist-relative. */
function allJsFiles(): { file: string; source: string }[] {
  return walk(DIST)
    .filter((f) => f.endsWith('.js'))
    .map((f) => ({
      file: f.slice(DIST.length + 1).split(/[\\/]/).join('/'),
      source: readFileSync(f, 'utf8'),
    }));
}

/** Context around each hit, so a failure names the offending line. */
function hits(source: string): string[] {
  return source
    .split('\n')
    .flatMap((line, i) =>
      PATTERN.test(line) ? [`line ${i + 1}: ${line.trim().slice(0, 200)}`] : []
    );
}

const REMEDY =
  '\n\nIf this write is genuinely necessary, it must be either strictly ' +
  'necessary under PECR or placed behind consent — AND /privacy must be ' +
  'updated, because it currently tells visitors we store nothing. Do not ' +
  'silence this test to make a build pass: the test is downstream of a ' +
  'published legal claim, not a style rule.';

describe('the site writes nothing to the browser', () => {
  it('no emitted JS asset touches browser storage', () => {
    const js = allJsFiles();

    // Without this, a build emitting no JS would pass vacuously.
    expect(
      js.length,
      `No .js assets found in ${DIST}. This test would pass without examining ` +
        'anything. Run `pnpm run build` and check it succeeded.'
    ).toBeGreaterThan(0);

    const offenders = js
      .map(({ file, source }) => ({ file, found: hits(source) }))
      .filter((o) => o.found.length > 0);

    expect(
      offenders.map((o) => `${o.file}\n  ${o.found.join('\n  ')}`).join('\n\n'),
      'A JS asset references browser storage, which falsifies the claim on ' +
        `/privacy that this site stores nothing in your browser.${REMEDY}`
    ).toBe('');
  });

  it('no inline script in any page touches browser storage', () => {
    const offenders = allHtmlFiles()
      .map((page) => {
        const inline = page.html.match(/<script[\s\S]*?<\/script>/gi) ?? [];
        return { route: page.route, found: inline.flatMap(hits) };
      })
      .filter((o) => o.found.length > 0);

    expect(
      offenders.map((o) => `${o.route}\n  ${o.found.join('\n  ')}`).join('\n\n'),
      'An inline script references browser storage, which falsifies the ' +
        `claim on /privacy that this site stores nothing in your browser.${REMEDY}`
    ).toBe('');
  });

  it('the removed UTM capture has not returned anywhere in the output', () => {
    // Named separately from the API scan because this one has history: it is
    // the specific regression this suite exists to catch, and naming it makes
    // a reintroduction obvious in the test report rather than generic.
    const offenders = [
      ...allJsFiles().map((j) => ({ where: j.file, source: j.source })),
      ...allHtmlFiles().map((p) => ({ where: p.route, source: p.html })),
    ].filter((o) => o.source.includes('aut-utm'));

    expect(
      offenders.map((o) => o.where).join(', '),
      'The `aut-utm` UTM capture was removed on 2026-08-22 (AUT-6414) by the ' +
        "data controller's decision, to keep /privacy's \"stores nothing in " +
        'your browser" claim literally true. It is back in the build output.' +
        REMEDY
    ).toBe('');
  });
});
