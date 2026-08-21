// Every page this site emits — static pages plus content-collection pages.
import type { APIRoute } from 'astro';
import { staticPages, getStudies, getNotes, abs } from '../../data/site-content';
import { build } from '../../data/build';

export const GET: APIRoute = async () => {
  const [studies, notes] = await Promise.all([getStudies(), getNotes()]);

  const pages = [
    ...staticPages.map((p) => ({
      url: abs(p.path),
      title: p.title,
      description: p.description,
      // Markdown twins exist for the main content pages (legal pages are
      // HTML-only); null where no twin is emitted.
      markdownUrl: ['/', '/about/', '/services/', '/work/', '/field-notes/', '/contact/'].includes(p.path)
        ? p.path === '/'
          ? abs('/index.md')
          : abs(`${p.path.replace(/\/$/, '')}.md`)
        : null,
      type: p.type,
      lastModified: build.time.toISOString(),
    })),
    ...studies.map((e) => ({
      url: abs(`/work/${e.id}`),
      title: e.data.headline ?? e.data.title,
      description: e.data.description,
      markdownUrl: abs(`/work/${e.id}.md`),
      type: 'CaseStudy',
      lastModified: e.data.date.toISOString(),
    })),
    ...notes.map((e) => ({
      url: abs(`/field-notes/${e.id}`),
      title: e.data.title,
      description: e.data.description,
      markdownUrl: abs(`/field-notes/${e.id}.md`),
      type: 'BlogPosting',
      lastModified: e.data.date.toISOString(),
    })),
  ];

  const payload = {
    schemaVersion: '1.0',
    generatedAt: build.time.toISOString(),
    count: pages.length,
    pages,
  };
  return new Response(JSON.stringify(payload, null, 2) + '\n', {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
