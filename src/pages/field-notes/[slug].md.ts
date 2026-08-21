// /field-notes/<slug>.md — Markdown twin of one field note.
//
// The body is derived from the collection entry itself (noteMarkdown in
// site-content.ts) — never retyped — so it cannot drift from the HTML page.
import type { APIRoute } from 'astro';
import { noteMarkdown, getNotes, mdResponse } from '../../data/site-content';

export async function getStaticPaths() {
  // Same draft filtering as field-notes/[slug].astro: drafts never ship to production.
  const notes = await getNotes();
  return notes.map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
}

export const GET: APIRoute = ({ props }) => mdResponse(noteMarkdown(props.entry));
