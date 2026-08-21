// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

/**
 * /.well-known/ endpoints.
 *
 * Astro's page scanner ignores dotted directories, so these two routes are
 * injected explicitly. The handlers live in src/data/ next to the modules
 * they are generated from (business facts, build provenance).
 */
const wellKnownRoutes = {
  name: 'well-known-routes',
  hooks: {
    'astro:config:setup': ({ injectRoute }) => {
      injectRoute({
        pattern: '/.well-known/agent.json',
        entrypoint: './src/data/wellknown-agent.ts',
        prerender: true,
      });
      injectRoute({
        pattern: '/.well-known/security.txt',
        entrypoint: './src/data/wellknown-security.ts',
        prerender: true,
      });
    },
  },
};

// https://astro.build/config
export default defineConfig({
  site: 'https://automancer.uk',
  output: 'static',
  // Legacy URLs from the pre-2026 hand-written site; emitted as meta-refresh
  // pages so old inbound links and search entries keep resolving.
  redirects: {
    '/services.html': '/services',
    '/about.html': '/about',
    '/book.html': '/contact',
    '/privacy.html': '/privacy',
    '/terms.html': '/terms',
  },
  // Draft case studies / field notes (draft: true) are excluded from the
  // production build at page-generation time (see getStaticPaths in
  // work/[slug].astro + field-notes/[slug].astro and both index pages), so a
  // draft is never emitted as a page and therefore never enters the sitemap.
  integrations: [sitemap(), wellKnownRoutes],
});
