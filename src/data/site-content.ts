/**
 * Aggregated site content for machine-readable outputs.
 *
 * Every JSON endpoint, Markdown twin, feed and llms-full.txt reads through
 * this module so they can never disagree with the HTML pages or each other.
 * Drafts are always excluded here — the mirrors are production surfaces.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { business } from './business';

export type CaseStudy = CollectionEntry<'case-studies'>;
export type FieldNote = CollectionEntry<'field-notes'>;

/** Non-draft case studies, index order (matches /work). */
export async function getStudies(): Promise<CaseStudy[]> {
  const all = await getCollection('case-studies');
  return all
    .filter((e) => !e.data.draft)
    .sort((a, b) => (a.data.order ?? 99) - (b.data.order ?? 99));
}

/** Non-draft field notes, newest first (matches /field-notes). */
export async function getNotes(): Promise<FieldNote[]> {
  const all = await getCollection('field-notes');
  return all.filter((e) => !e.data.draft).sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export const abs = (path: string) => new URL(path, business.url).toString();

/** Stable id for a service: lowercased kebab-case of its name. */
export function serviceId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const iso = (d: Date) => d.toISOString();

function frontMatter(fields: Record<string, string | undefined>): string {
  const lines = ['---'];
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) lines.push(`${k}: ${JSON.stringify(v)}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

/** A text/markdown response with explicit charset. */
export function mdResponse(markdown: string): Response {
  return new Response(markdown, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}

/** Markdown twin of one case study: front matter + hero facts + full body. */
export function studyMarkdown(entry: CaseStudy): string {
  const d = entry.data;
  const url = abs(`/work/${entry.id}`);
  const parts = [
    frontMatter({
      title: d.headline ?? d.title,
      description: d.description,
      url,
      canonical: url,
      type: 'CaseStudy',
      datePublished: iso(d.date),
    }),
  ];
  if (d.subhead) parts.push(d.subhead, '');
  if (d.stats.length > 0) {
    parts.push(...d.stats.map((s) => `- **${s.v}** — ${s.l}`), '');
  }
  parts.push(entry.body ?? '');
  return parts.join('\n');
}

/** Markdown twin of one field note: front matter + full body. */
export function noteMarkdown(entry: FieldNote): string {
  const d = entry.data;
  const url = abs(`/field-notes/${entry.id}`);
  return (
    frontMatter({
      title: d.title,
      description: d.description,
      url,
      canonical: url,
      type: 'BlogPosting',
      author: d.author,
      datePublished: iso(d.date),
    }) + (entry.body ?? '')
  );
}

/** Registry of every hand-authored page — used by /api/pages.json and llms-full.txt. */
export interface PageMeta {
  path: string;
  title: string;
  description: string;
  type: string;
}

// Descriptions mirror the exact <meta name="description"> each page emits
// (the BaseLayout props in the corresponding .astro file).
export const staticPages: PageMeta[] = [
  { path: '/', title: 'AI & automation for UK small businesses', description: "We make small businesses run like magic. It's not magic. It's very good engineering. AI and workflow automation from Automancer — audits from £450.", type: 'WebPage' },
  { path: '/services/', title: 'Services & pricing', description: 'Four ways to work with us, with real from-prices. Audit from £450, Workflow Sprint from £1,950, System Build from £4,500, AI Ops Partner from £495/mo.', type: 'CollectionPage' },
  { path: '/work/', title: 'Work', description: 'Real systems, live in production. Case studies from a care provider, a manufacturer, a diversity & inclusion consultancy and small firms — every fact taken from the actual work.', type: 'CollectionPage' },
  { path: '/field-notes/', title: 'Field Notes', description: "Dispatches from an AI-run business. Written by the agents, decided by the human. Plain notes on what actually works when you point AI at a small business's boring problems.", type: 'CollectionPage' },
  { path: '/about/', title: 'About', description: "An AI-run consultancy with a human at the helm. Automancer's finance, project tracking and website run on agents — every decision and every call run by Waseem Ilyas, in Bradford.", type: 'AboutPage' },
  { path: '/contact/', title: 'Contact', description: "Tell us what's eating your week. No calendar gauntlet, no chatbot. Waseem reads it himself, and we promise a meeting within one week of first contact.", type: 'ContactPage' },
  { path: '/privacy/', title: 'Privacy Policy', description: 'How Automancer Ltd handles your data — in plain English. What we collect, why, where it lives, who touches it, and the rights you have over it.', type: 'PrivacyPolicy' },
  { path: '/terms/', title: 'Website Terms', description: 'Website terms of use for Automancer Ltd.', type: 'WebPage' },
];
