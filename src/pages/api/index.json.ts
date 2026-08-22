// Discovery document for the machine-readable API surface.
// Lists every JSON endpoint so an agent can find everything from one fetch.
import type { APIRoute } from 'astro';
import { business } from '../../data/business';
import { build } from '../../data/build';

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      {
        schemaVersion: '1.0',
        name: business.tradingName,
        description: business.description,
        url: business.url,
        generatedAt: build.time.toISOString(),
        endpoints: [
          {
            path: '/api/index.json',
            description: 'This discovery document.',
          },
          {
            path: '/api/business.json',
            description: 'Canonical business facts: legal name, contact details, address, areas served.',
          },
          {
            path: '/api/services.json',
            description: 'Service offerings with published from-prices (GBP), units and stable ids.',
          },
          {
            path: '/api/case-studies.json',
            description: 'Every case study: title, description, tags, dates and full body text.',
          },
          {
            path: '/api/field-notes.json',
            description: 'Every field note article: title, description, author, date and full body text.',
          },
          {
            path: '/api/pages.json',
            description: 'Every page emitted by this site, with title, description, Markdown twin URL and last-modified.',
          },
        ],
        related: [
          { path: '/llms.txt', description: 'Plain-text guide to the site for LLMs and agents.' },
          { path: '/llms-full.txt', description: 'The complete site content in one plain-text file.' },
          { path: '/.well-known/agent.json', description: 'Agent-facing capability manifest.' },
          { path: '/sitemap-index.xml', description: 'XML sitemap of all pages.' },
        ],
      },
      null,
      2
    ) + '\n',
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
  );
