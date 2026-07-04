// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

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
  integrations: [sitemap()],
});
