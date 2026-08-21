// /.well-known/agent.json — agent-facing capability manifest.
//
// Injected as a route (see astro.config.mjs) because Astro's page scanner
// ignores dotted directories. Generated from the same single sources as the
// HTML site: business facts, the API surface and the build timestamp, so it
// cannot drift from what is actually served.
import type { APIRoute } from 'astro';
import { business } from './business';
import { build } from './build';
import { abs } from './urls';

const api = (path: string, description: string) => ({
  path,
  url: `${business.url}${path}`,
  description,
});

export const GET: APIRoute = () => {
  const manifest = {
    schemaVersion: '1.0',
    lastUpdated: build.time.toISOString(),
    name: business.tradingName,
    legalName: business.legalName,
    description: business.description,
    url: business.url,
    contact: {
      email: business.email,
      phone: business.phone,
      phoneNote: 'Voicemail line — messages reach a human (Waseem), not a bot menu.',
      webForm: abs('/contact'),
      formNote:
        'The form requires JavaScript and a browser security check; agents should prefer email.',
      responseTime: 'A human replies personally; we aim for first response within one working week.',
    },
    // Everything an agent can fetch without JavaScript or credentials.
    machineReadable: {
      discoveryDocument: { url: `${business.url}/api/index.json`, description: 'Lists every JSON endpoint below with descriptions.' },
      endpoints: [
        api('/api/business.json', 'Canonical business facts: names, registration, address, contact, areas served.'),
        api('/api/services.json', 'Service offerings with published from-prices (GBP) and stable ids.'),
        api('/api/case-studies.json', 'Every case study: metadata plus full body text.'),
        api('/api/field-notes.json', 'Every field note article: metadata plus full body text.'),
        api('/api/pages.json', 'Every page on the site: URL, title, description, Markdown twin, type, last-modified.'),
      ],
      markdownTwins: {
        convention:
          'Every content page is also available as clean Markdown with YAML front matter at the same path plus ".md" (for example /about/ -> /about.md).',
        indexPage: `${business.url}/index.md`,
      },
      fullText: [
        { path: '/llms.txt', url: `${business.url}/llms.txt`, description: 'Plain-text guide to the site for LLMs and agents.' },
        { path: '/llms-full.txt', url: `${business.url}/llms-full.txt`, description: 'The complete site content in one plain-text file.' },
      ],
      feeds: [
        { title: 'Field notes (RSS 2.0)', path: '/field-notes/rss.xml' },
        { title: 'Field notes (JSON Feed 1.1)', path: '/field-notes/feed.json' },
        { title: 'Case studies (RSS 2.0)', path: '/work/rss.xml' },
        { title: 'Case studies (JSON Feed 1.1)', path: '/work/feed.json' },
      ].map((f) => ({ ...f, url: `${business.url}${f.path}` })),
      sitemap: `${business.url}/sitemap-index.xml`,
      structuredData: 'Every HTML page embeds one schema.org JSON-LD @graph with absolute @ids.',
      legalPagesPolicy:
        'The bodies of /privacy/ and /terms/ are deliberately NOT mirrored in any machine-readable format (transcription drifts silently). Fetch those canonical HTML URLs for their current full text.',
    },
    policy: {
      crawling: 'Allowed and encouraged. robots.txt explicitly permits all well-behaved crawlers including AI crawlers; there are no Disallow rules for content.',
      rateLimits: 'No formal rate limit. This is a static site on GitHub Pages; keep requests modest and cache responses — payloads change only at deploy time.',
      authentication: 'None. Every endpoint listed here is public, static and key-free.',
      cost: 'Free to read. No paid API tier exists.',
      stability: 'Endpoints are generated at build time from the same sources as the HTML pages; additive changes only within a schemaVersion.',
    },
    permissions: {
      statement:
        'You may read, index, summarise and quote this content with attribution to Automancer Ltd. Wholesale republication of site content as your own is not permitted without written permission — consistent with our website terms at /terms/.',
      allowed: ['read', 'index', 'summarise', 'quote-with-attribution'],
      requiresPermission: ['wholesale-republication'],
      prohibited: [
        'representing this business or its content as your own',
        'using contact details for unsolicited marketing to us',
      ],
    },
  };

  return new Response(JSON.stringify(manifest, null, 2) + '\n', {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
