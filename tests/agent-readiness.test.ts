/**
 * The machine-readable surface added by feat/agent-readiness
 * (docs/AGENT-READINESS.md): Markdown twins, llms.txt/llms-full.txt, the
 * /api/*.json endpoints, .well-known manifests, feeds and robots.txt.
 *
 * These files are consumed by agents and crawlers without a human in the
 * loop, so the failures they hide are silent by nature: a twin that drifted
 * from its page, a manifest advertising a 404, a security.txt that quietly
 * expired, a feed missing the newest post. Everything here audits the bytes
 * actually emitted into dist/, never the source templates.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DIST, SITE_URL, contentPages, readDistFile, resolveInDist } from './support/dist';
import { contentEntries } from './support/content';
import { business, services } from '../src/data/business';
import { fitDescription, fitTitle } from '../src/lib/meta';

/** Every file emitted into dist/, as dist-relative POSIX paths. */
function allDistFiles(): string[] {
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full, out);
      else out.push(full.slice(DIST.length + 1).split(/[\\/]/).join('/'));
    }
    return out;
  };
  return walk(DIST);
}

/** Parse the YAML front matter our generators emit (`key: "json-string"`). */
function frontMatterOf(text: string, label: string): Record<string, string> {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  expect(match, `${label}: does not begin with YAML front matter`).toBeTruthy();
  const fm: Record<string, string> = {};
  for (const line of match![1].split(/\r?\n/)) {
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    try {
      fm[kv[1]] = JSON.parse(kv[2]) as string;
    } catch {
      fm[kv[1]] = kv[2];
    }
  }
  return fm;
}

/**
 * Well-formedness gate for the generated RSS: comments, processing
 * instructions and CDATA bodies are stripped, then every remaining tag must
 * nest correctly. This is what catches a truncated or hand-mangled feed —
 * the realistic failure mode for build-time XML.
 */
function assertWellFormedXml(xml: string, label: string): void {
  const stripped = xml
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA[\s\S]*?\]\]>/g, '');
  const tagRe = /<(\/?)([A-Za-z][\w.:-]*)([^>]*?)(\/?)>/g;
  const stack: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(stripped)) !== null) {
    expect(
      stripped.slice(last, m.index).includes('<'),
      `${label}: stray "<" outside any tag — malformed markup`
    ).toBe(false);
    last = tagRe.lastIndex;
    const [, closing, name, , selfClosing] = m;
    if (selfClosing) continue;
    if (closing) {
      expect(
        stack.pop(),
        `${label}: closing </${name}> has no matching open tag`
      ).toBe(name);
    } else {
      stack.push(name);
    }
  }
  expect(
    stripped.slice(last).includes('<'),
    `${label}: stray "<" outside any tag — malformed markup`
  ).toBe(false);
  expect(stack, `${label}: unclosed element(s): ${stack.join(', ')}`).toEqual([]);
}

/**
 * Shape gates for JSON parsed off disk (`parsed.get(endpoint)` hands back
 * `unknown`, and a runtime expect() cannot teach the compiler anything).
 * Each gate does both jobs at once: it fails with a message naming the
 * file, what was expected and what was actually found, then its `asserts`
 * signature narrows the value so TypeScript sees the shape the runtime
 * just verified — no `!` and no casts, which would trade a clear failure
 * message for a confusing crash.
 */
function describeFound(value: unknown): string {
  return value === null ? 'null' : Array.isArray(value) ? 'an array' : `type '${typeof value}'`;
}

function assertJsonObject(value: unknown, file: string): asserts value is Record<string, unknown> {
  expect(
    typeof value === 'object' && value !== null && !Array.isArray(value),
    `dist/${file}: expected a top-level JSON object — got ${describeFound(value)}`
  ).toBe(true);
}

function assertJsonArray<T>(value: unknown, file: string, expected: string): asserts value is T[] {
  expect(
    Array.isArray(value),
    `dist/${file}: expected ${expected} to be present as an array — got ${describeFound(value)}`
  ).toBe(true);
}

// ─── shared expectations ─────────────────────────────────────────────────────

const nonDraftEntries = contentEntries().filter((e) => !e.draft);

/** Route → dist-relative twin path, mirroring markdownTwinPath()'s rule. */
function twinPathFor(route: string): string {
  return route === '/' ? 'index.md' : route.replace(/^\//, '').replace(/\/$/, '') + '.md';
}

const STATIC_TWIN_ROUTES = ['/', '/services/', '/work/', '/field-notes/', '/about/', '/contact/'];
const expectedTwins = new Map<string, string>();
for (const route of STATIC_TWIN_ROUTES) expectedTwins.set(twinPathFor(route), route);
for (const entry of nonDraftEntries) {
  const dir = entry.collection === 'case-studies' ? 'work' : 'field-notes';
  expectedTwins.set(`${dir}/${entry.slug}.md`, `/${dir}/${entry.slug}/`);
}

const nonDraftSlugs = (collection: 'case-studies' | 'field-notes'): string[] =>
  nonDraftEntries.filter((e) => e.collection === collection).map((e) => e.slug).sort();

describe('markdown twins — every content page also speaks Markdown', () => {
  const actualTwins = allDistFiles().filter((f) => f.endsWith('.md'));

  it('emits exactly one twin per content page — none missing, none extra', () => {
    const missing = [...expectedTwins.keys()].filter((t) => !actualTwins.includes(t));
    const extra = actualTwins.filter((t) => !expectedTwins.has(t));
    expect(missing, 'content pages shipped without their .md twin').toEqual([]);
    expect(extra, '.md files in dist/ that are no content page’s twin').toEqual([]);
    expect(actualTwins.length).toBe(expectedTwins.size);
  });

  it('every twin is non-empty and begins with YAML front matter carrying title + description', () => {
    for (const [twinPath] of expectedTwins) {
      const raw = readDistFile(twinPath);
      expect(raw, `dist/${twinPath} missing`).toBeTruthy();
      expect(raw!.trim().length, `dist/${twinPath} is empty`).toBeGreaterThan(0);
      const fm = frontMatterOf(raw!, `dist/${twinPath}`);
      expect(fm.title?.trim(), `dist/${twinPath}: front matter has no title`).toBeTruthy();
      expect(
        fm.description?.trim(),
        `dist/${twinPath}: front matter has no description`
      ).toBeTruthy();
    }
  });

  it("every twin's title/description still match its HTML page's <title>/meta description", () => {
    const byRoute = new Map(contentPages().map((p) => [p.route, p]));
    for (const [twinPath, route] of expectedTwins) {
      const page = byRoute.get(route);
      expect(page, `twin ${twinPath} points at route ${route}, which was not emitted`).toBeTruthy();

      const fm = frontMatterOf(readDistFile(twinPath)!, `dist/${twinPath}`);
      const htmlTitle = page!.doc.querySelector('title')?.text.trim() ?? '';
      const metaDesc =
        page!.doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ?? '';

      // <title> is fitted to SERP budget (src/lib/meta.ts) before the brand
        // suffix is appended; the twin carries the unfitted copy. Recomputing
        // the same fit keeps this strict against wording drift while allowing
        // only the deterministic length clamp.
      expect(
        htmlTitle,
        `dist/${twinPath}: front-matter title "${fm.title}" has drifted from the page <title>`
      ).toBe(`${fitTitle(fm.title)} | Automancer`);
      expect(
        metaDesc,
        `dist/${twinPath}: front-matter description has drifted from the page meta description`
      ).toBe(fitDescription(fm.description));
    }
  });
});

describe('/llms.txt and /llms-full.txt', () => {
  const llms = readDistFile('llms.txt');
  const llmsFull = readDistFile('llms-full.txt');

  it('both exist and are non-empty', () => {
    expect(llms, 'dist/llms.txt missing').toBeTruthy();
    expect(llms!.trim().length).toBeGreaterThan(0);
    expect(llmsFull, 'dist/llms-full.txt missing').toBeTruthy();
    expect(llmsFull!.trim().length).toBeGreaterThan(0);
  });

  it('llms.txt advertises llms-full.txt and the agent manifest by absolute URL', () => {
    expect(llms, 'llms.txt should point agents at the full-text file').toContain(
      `${SITE_URL}/llms-full.txt`
    );
    expect(llms, 'llms.txt should point agents at /.well-known/agent.json').toContain(
      `${SITE_URL}/.well-known/agent.json`
    );
  });
});

describe('/api/*.json endpoints', () => {
  const ENDPOINTS = [
    'api/index.json',
    'api/business.json',
    'api/services.json',
    'api/case-studies.json',
    'api/field-notes.json',
    'api/pages.json',
  ];

  const parsed = new Map<string, unknown>();
  for (const endpoint of ENDPOINTS) {
    const raw = readDistFile(endpoint);
    it(`${endpoint} exists and parses as JSON`, () => {
      expect(raw, `dist/${endpoint} missing`).toBeTruthy();
      let json: unknown;
      expect(() => {
        json = JSON.parse(raw!);
      }, `dist/${endpoint} is not valid JSON`).not.toThrow();
      parsed.set(endpoint, json);
    });
  }

  it('services.json states exactly the services in src/data/business.ts (name, price, unit)', () => {
    const payload = parsed.get('api/services.json') as { services?: unknown[] };
    expect(payload?.services, 'services.json has no services array').toBeTruthy();
    const emitted = payload.services as Array<{
      name: string;
      priceFrom: number;
      priceUnit: string;
    }>;
    expect(emitted, 'service count disagrees with business.ts').toHaveLength(services.length);
    emitted.forEach((s, i) => {
      expect(
        [s.name, s.priceFrom, s.priceUnit],
        `services.json[${i}] has drifted from business.ts`
      ).toEqual([services[i].name, services[i].priceFrom, services[i].priceUnit]);
    });
  });

  it('case-studies.json contains exactly the non-draft case studies — no others', () => {
    const payload = parsed.get('api/case-studies.json');
    assertJsonObject(payload, 'api/case-studies.json');
    assertJsonArray<{ slug: string }>(
      payload['caseStudies'],
      'api/case-studies.json',
      '"caseStudies" (a list of {slug} entries)'
    );
    const caseStudies = payload['caseStudies'];
    const slugs = caseStudies.map((s) => s.slug).sort();
    expect(slugs, 'case-studies.json slug set disagrees with the collection').toEqual(
      nonDraftSlugs('case-studies')
    );
    expect(payload['count'], 'case-studies.json count field disagrees with its own array').toBe(
      caseStudies.length
    );
  });

  it('field-notes.json contains exactly the non-draft field notes — no others', () => {
    const payload = parsed.get('api/field-notes.json');
    assertJsonObject(payload, 'api/field-notes.json');
    assertJsonArray<{ slug: string }>(
      payload['fieldNotes'],
      'api/field-notes.json',
      '"fieldNotes" (a list of {slug} entries)'
    );
    const fieldNotes = payload['fieldNotes'];
    const slugs = fieldNotes.map((n) => n.slug).sort();
    expect(slugs, 'field-notes.json slug set disagrees with the collection').toEqual(
      nonDraftSlugs('field-notes')
    );
    expect(payload['count'], 'field-notes.json count field disagrees with its own array').toBe(
      fieldNotes.length
    );
  });
});

describe('/.well-known/security.txt — RFC 9116', () => {
  const raw = readDistFile('.well-known/security.txt');

  const fields = new Map<string, string>();
  for (const line of (raw ?? '').split('\n')) {
    const kv = /^([A-Za-z-]+):\s*(.+)$/.exec(line.trim());
    if (kv && !fields.has(kv[1])) fields.set(kv[1], kv[2].trim());
  }

  it('carries the fields RFC 9116 requires of us: Contact, Expires, Preferred-Languages, Canonical', () => {
    expect(raw, 'dist/.well-known/security.txt missing').toBeTruthy();
    for (const field of ['Contact', 'Expires', 'Preferred-Languages', 'Canonical']) {
      expect(fields.get(field), `security.txt is missing ${field}`).toBeTruthy();
    }
  });

  it('Contact points at the published mailbox and Canonical at this exact file', () => {
    expect(fields.get('Contact')).toBe(`mailto:${business.email}`);
    expect(fields.get('Canonical')).toBe(`${SITE_URL}/.well-known/security.txt`);
  });

  it('Expires parses as a date IN THE FUTURE — an expired security.txt is invalid', () => {
    const expires = fields.get('Expires')!;
    const parsed_ = Date.parse(expires);
    expect(
      Number.isNaN(parsed_),
      `security.txt Expires "${expires}" is not a parseable date`
    ).toBe(false);
    expect(
      parsed_,
      `security.txt EXPIRED on ${expires} — regenerate it (the generator derives it from the build date)`
    ).toBeGreaterThan(Date.now());
  });
});

describe('/.well-known/agent.json — capability manifest', () => {
  const raw = readDistFile('.well-known/agent.json');
  let agent: unknown;

  it('parses as JSON', () => {
    expect(raw, 'dist/.well-known/agent.json missing').toBeTruthy();
    expect(() => {
      agent = JSON.parse(raw!);
    }, 'dist/.well-known/agent.json is not valid JSON').not.toThrow();
  });

  it('every URL it advertises is absolute https, and every site path resolves to an emitted file', () => {
    const urls: string[] = [];
    const paths: string[] = [];
    const collect = (node: unknown): void => {
      if (typeof node === 'string') {
        if (/^https?:\/\//i.test(node)) urls.push(node);
        else if (/^\//.test(node)) paths.push(node);
        return;
      }
      if (Array.isArray(node)) node.forEach(collect);
      else if (node && typeof node === 'object') Object.values(node).forEach(collect);
    };
    collect(agent);

    expect(urls.length + paths.length, 'agent.json advertises no URLs at all').toBeGreaterThan(5);

    const ownHost = new URL(SITE_URL).host;
    for (const url of urls) {
      expect(url.startsWith('https://'), `agent.json URL is not absolute https: ${url}`).toBe(true);
      if (new URL(url).host === ownHost) {
        expect(
          resolveInDist('index.html', new URL(url).pathname),
          `agent.json advertises ${url} but nothing was emitted at that path — a manifest advertising a 404 is worse than no manifest`
        ).toBeTruthy();
      }
    }
    for (const path of paths) {
      expect(
        resolveInDist('index.html', path),
        `agent.json advertises path ${path} but nothing was emitted there`
      ).toBeTruthy();
    }
  });
});

describe('feeds — /work and /field-notes, RSS 2.0 + JSON Feed 1.1', () => {
  /** Slug list from a feed's <guid>s (CDATA stripped first). */
  const rssSlugs = (xml: string): string[] =>
    [...xml.matchAll(/<guid>(.*?)<\/guid>/g)].map(
      (m) => new URL(m[1]).pathname.split('/').filter(Boolean).pop()!
    );

  for (const [collection, dir] of [
    ['case-studies', 'work'],
    ['field-notes', 'field-notes'],
  ] as const) {
    const expected = nonDraftSlugs(collection);

    it(`${dir}/rss.xml is well-formed XML with exactly the non-draft ${collection}`, () => {
      const xml = readDistFile(`${dir}/rss.xml`);
      expect(xml, `dist/${dir}/rss.xml missing`).toBeTruthy();
      assertWellFormedXml(xml!, `dist/${dir}/rss.xml`);
      expect(
        xml!.replace(/^\s*<\?xml[^>]*\?>/, '').trimStart().startsWith('<rss'),
        `dist/${dir}/rss.xml does not start with an <rss> root element`
      ).toBe(true);
      const slugs = rssSlugs(xml!).sort();
      expect(slugs, `${dir}/rss.xml item set disagrees with the collection`).toEqual(expected);
      expect(slugs, `${dir}/rss.xml item count disagrees with the collection`).toHaveLength(
        expected.length
      );
    });

    it(`${dir}/feed.json is valid JSON Feed with exactly the non-draft ${collection}`, () => {
      const raw = readDistFile(`${dir}/feed.json`);
      expect(raw, `dist/${dir}/feed.json missing`).toBeTruthy();
      let feed: { version?: string; items?: Array<{ id?: string; url?: string; content_text?: string }> };
      expect(() => {
        feed = JSON.parse(raw!);
      }, `dist/${dir}/feed.json is not valid JSON`).not.toThrow();
      expect(feed!.version, 'not a JSON Feed document').toMatch(
        /^https:\/\/jsonfeed\.org\/version\/1\.\d$/
      );
      const items = feed!.items;
      expect(Array.isArray(items), 'JSON Feed has no items array').toBe(true);
      for (const item of items!) {
        expect(item.id && item.url, `JSON Feed item without id/url in ${dir}/feed.json`).toBeTruthy();
        expect(
          typeof item.content_text === 'string' && item.content_text.trim().length > 0,
          `JSON Feed item ${item.id} has no full content_text — feeds must carry full content, not excerpts`
        ).toBe(true);
      }
      const slugs = items!.map((i) => new URL(i.url!).pathname.split('/').filter(Boolean).pop()!).sort();
      expect(slugs, `${dir}/feed.json item set disagrees with the collection`).toEqual(expected);
      expect(slugs, `${dir}/feed.json item count disagrees with the collection`).toHaveLength(
        expected.length
      );
    });
  }
});

describe('/robots.txt', () => {
  const robots = readDistFile('robots.txt');

  it('is emitted and references the sitemap', () => {
    expect(robots, 'dist/robots.txt missing').toBeTruthy();
    expect(robots!.trim()).toContain(`Sitemap: ${SITE_URL}/sitemap-index.xml`);
  });

  it('contains no Disallow: rule — all site content stays crawlable', () => {
    const disallows = robots!.split('\n').filter((l) => /^\s*Disallow:/i.test(l));
    expect(
      disallows,
      'robots.txt grew Disallow rules — policy is that no site content may be disallowed'
    ).toEqual([]);
  });
});

describe('legal pages (/privacy/, /terms/) are never mirrored', () => {
  // Phrases lifted verbatim from each page's rendered BODY and verified
  // unique across dist/ (they appear ONLY in the canonical HTML). The
  // presence self-check below fails loudly if the pages are rewritten, so
  // the absence assertions can never rot into vacuous passes.
  const LEGAL_PAGES = [
    {
      name: '/privacy/',
      canonicalFile: 'privacy/index.html',
      phrases: [
        'no Formspree, no Typeform, no Google Forms',
        "It isn't used to profile or track you",
      ],
    },
    {
      name: '/terms/',
      canonicalFile: 'terms/index.html',
      phrases: [
        'Service descriptions are indicative. Specific scope, timelines and fees are agreed in writing.',
      ],
    },
  ];

  it('no machine-readable surface carries a legal-page body sentence', () => {
    const distFiles = allDistFiles();
    for (const { name, canonicalFile, phrases } of LEGAL_PAGES) {
      const canonical = readDistFile(canonicalFile)!;
      for (const phrase of phrases) {
        expect(
          canonical.includes(phrase),
          `"${phrase.slice(0, 50)}…" no longer appears in dist/${canonicalFile} — pick fresh distinctive phrases for this test`
        ).toBe(true);

        for (const file of distFiles) {
          if (file === canonicalFile) continue;
          const data = readFileSync(join(DIST, file), 'utf8');
          expect(
            data.includes(phrase),
            `LEGAL LEAK: a body sentence of ${name} appears in dist/${file} — legal-page text must exist only as canonical HTML`
          ).toBe(false);
        }
      }
    }
  });

  it('no .md twin exists for either legal page', () => {
    for (const twin of allDistFiles().filter((f) => f.endsWith('.md'))) {
      expect(
        /^privacy\b|^terms\b|\/privacy\/|\/terms\//.test(twin),
        `dist/${twin} mirrors a legal page — privacy/terms bodies are deliberately never transcribed`
      ).toBe(false);
    }
  });
});
