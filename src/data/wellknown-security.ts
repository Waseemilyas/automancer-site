// /.well-known/security.txt — RFC 9116.
//
// Injected as a route (see astro.config.mjs) because Astro's page scanner
// ignores dotted directories. Expires is REQUIRED by RFC 9116 and is
// generated at build time (~1 year out), so it never goes stale silently.
import type { APIRoute } from 'astro';
import { business } from './business';
import { build } from './build';

export const GET: APIRoute = () => {
  const expires = new Date(build.time);
  expires.setUTCFullYear(expires.getUTCFullYear() + 1);

  const lines = [
    `Contact: mailto:${business.email}`,
    `Expires: ${expires.toISOString()}`,
    'Preferred-Languages: en',
    `Canonical: ${new URL('/.well-known/security.txt', business.url).toString()}`,
  ];

  return new Response(lines.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
