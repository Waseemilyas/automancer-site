/**
 * SEO-length clamps for pages whose <title>/meta description come verbatim
 * from content-collection frontmatter.
 *
 * Why this exists: search engines truncate titles past ~60 characters
 * (including the " | Automancer" suffix BaseLayout appends) and
 * descriptions past ~160. Several frontmatter titles/descriptions exceed
 * those budgets, but the Markdown files are editorial copy and stay
 * untouched — so the slug layouts pass their values through here. Visible
 * headings (<h1>, card text) keep using the original frontmatter strings;
 * only the SERP-facing metadata is fitted to budget.
 *
 * Deterministic by design: same input, same output, no editorialising.
 */

const TITLE_SUFFIX = ' | Automancer';
/** Hard ceiling for the composed <title>; SERPs truncate around 60. */
const TITLE_MAX = 59;
const DESCRIPTION_MAX = 160;

/** Cut at the last word boundary that fits, then trim dangling punctuation. */
function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const clipped = text.slice(0, max + 1);
  const spaceAt = clipped.lastIndexOf(' ');
  const base = spaceAt > Math.floor(max / 2) ? clipped.slice(0, spaceAt) : text.slice(0, max);
  return base.replace(/[\s,;:.!?–—-]+$/u, '');
}

/**
 * A title which, with the brand suffix appended, stays under 60 characters.
 * Returns the original string unchanged whenever it already fits.
 */
export function fitTitle(title: string): string {
  if ((title + TITLE_SUFFIX).length <= TITLE_MAX) return title;
  return truncateAtWord(title, TITLE_MAX - TITLE_SUFFIX.length);
}

/**
 * A meta description within [50, 160]. Only over-long values are touched —
 * a too-short description is an editorial problem and must be fixed at the
 * source, not padded by a machine.
 */
export function fitDescription(description: string): string {
  return truncateAtWord(description, DESCRIPTION_MAX);
}
