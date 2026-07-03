// Content collection schemas.
//
// Two collections back the site's long-form content:
//   - case-studies  -> rendered at /work/[slug]
//   - field-notes   -> rendered at /field-notes/[slug]
//
// Both are plain Markdown files with typed frontmatter, loaded from
// src/content/<collection>/*.md via the glob() loader (Content Layer API).

import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const sharedFrontmatter = {
  title: z.string(),
  description: z.string(),
  date: z.coerce.date(),
  sector: z.string(),
  tags: z.array(z.string()).default([]),
  // DRAFT entries are excluded from index pages and sitemap in production
  // builds, but remain reachable directly for internal review.
  draft: z.boolean().default(false),
};

const caseStudies = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/case-studies' }),
  schema: z.object({
    ...sharedFrontmatter,
    client: z.string().optional(),
    // Short home/index teaser line, separate from the SEO `description`.
    summary: z.string().optional(),
  }),
});

const fieldNotes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/field-notes' }),
  schema: z.object({
    ...sharedFrontmatter,
    author: z.string().default('Waseem Ilyas'),
  }),
});

export const collections = {
  'case-studies': caseStudies,
  'field-notes': fieldNotes,
};
