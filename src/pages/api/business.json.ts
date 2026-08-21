// Canonical business facts, verbatim from the single source of truth.
import type { APIRoute } from 'astro';
import { business } from '../../data/business';
import { build } from '../../data/build';

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      {
        schemaVersion: '1.0',
        generatedAt: build.time.toISOString(),
        ...business,
      },
      null,
      2
    ) + '\n',
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
  );
