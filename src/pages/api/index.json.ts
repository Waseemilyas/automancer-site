// Discovery document for the machine-readable API surface.
// Lists every JSON endpoint so an agent can find everything from one fetch.
// The endpoint list is derived from src/data/api.ts — the same registry the
// OpenAPI spec (/openapi.json) and the /developers page render from — so the
// three can never disagree about what exists.
import type { APIRoute } from 'astro';
import { business } from '../../data/business';
import { build } from '../../data/build';
import { API_ENDPOINTS } from '../../data/api';

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      {
        schemaVersion: '1.0',
        name: business.tradingName,
        description: business.description,
        url: business.url,
        generatedAt: build.time.toISOString(),
        endpoints: API_ENDPOINTS.map(({ path, description }) => ({ path, description })),
        related: [
          {
            path: '/openapi.json',
            description: 'OpenAPI 3.1 specification of every endpoint above.',
          },
          { path: '/developers', description: 'Human-readable developer & agent documentation.' },
          { path: '/llms.txt', description: 'Plain-text guide to the site for LLMs and agents.' },
          { path: '/llms-full.txt', description: 'The complete site content in one plain-text file.' },
          { path: '/agent.json', description: 'Agent-facing capability manifest.' },
          { path: '/security.txt', description: 'RFC 9116 security.txt.' },
          { path: '/sitemap-index.xml', description: 'XML sitemap of all pages.' },
        ],
      },
      null,
      2
    ) + '\n',
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
  );
