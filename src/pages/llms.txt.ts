// /llms.txt — structured plain-text summary of the business for LLM
// crawlers/agents. Generated from src/data/business.ts so it can never
// drift from the JSON-LD structured data or the services page.
import type { APIRoute } from 'astro';
import { business, services } from '../data/business';

const formatPrice = (n: number) =>
  n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });

export const GET: APIRoute = () => {
  const lines: string[] = [];

  lines.push(`# ${business.tradingName}`);
  lines.push('');
  lines.push(business.description);
  lines.push('');

  lines.push('## What Automancer does');
  lines.push(
    'Automancer designs and builds practical AI and workflow automation for small and mid-sized businesses: process audits, workflow implementation, custom AI agents/systems, and ongoing operational support.'
  );
  lines.push('');

  lines.push('## Services and pricing (from-price, GBP)');
  for (const service of services) {
    const unit = service.priceUnit === 'month' ? '/month' : ' (project)';
    lines.push(`- ${service.name}: from ${formatPrice(service.priceFrom)}${unit} — ${service.description}`);
  }
  lines.push('');

  lines.push('## Location');
  lines.push(`Based in ${business.address.addressLocality}. Serves ${business.areasServed.join(', ')}.`);
  lines.push('');

  lines.push('## Contact');
  lines.push(`Email: ${business.email}`);
  lines.push(`Phone: ${business.phone} (voicemail line — reaches Waseem, same as the form)`);
  lines.push(`Web: ${business.url}`);
  lines.push(`Contact form: ${business.url}/contact`);
  lines.push('');

  lines.push('## Company');
  lines.push(`${business.legalName}, company no. ${business.companyNumber}.`);
  lines.push(`Registered with the ICO (Information Commissioner's Office), registration no. ${business.icoRegistration}.`);
  lines.push(
    `${business.address.streetAddress}, ${business.address.addressLocality}, ${business.address.postalCode}, United Kingdom.`
  );
  lines.push('');

  lines.push('## Machine-readable surfaces for agents');
  lines.push(
    'Everything below is public, static, key-free and generated at build time from the same sources as the HTML pages.'
  );
  lines.push('');
  lines.push(`- Full site text: ${business.url}/llms-full.txt — every page's text in one file, each section headed with its URL.`);
  lines.push(
    `- Markdown twins: any content page plus ".md" (e.g. ${business.url}/about.md, ${business.url}/services.md, ${business.url}/work/<slug>.md, ${business.url}/field-notes/<slug>.md) — clean Markdown with YAML front matter, Content-Type text/markdown; charset=utf-8.`
  );
  lines.push(`- JSON API discovery: ${business.url}/api/index.json — lists every endpoint.`);
  lines.push(`- Business facts: ${business.url}/api/business.json`);
  lines.push(`- Services & pricing: ${business.url}/api/services.json`);
  lines.push(`- Case studies (full text): ${business.url}/api/case-studies.json`);
  lines.push(`- Field notes (full text): ${business.url}/api/field-notes.json`);
  lines.push(`- Page inventory: ${business.url}/api/pages.json — every page with title, description, Markdown-twin URL and last-modified.`);
  lines.push(
    `- Agent capability manifest: ${business.url}/agent.json (canonical copy; also emitted at ${business.url}/.well-known/agent.json for hosts that serve dot-paths)`
  );
  lines.push('- Feeds: /field-notes/rss.xml · /field-notes/feed.json · /work/rss.xml · /work/feed.json (full content, not excerpts).');
  lines.push(`- Sitemap: ${business.url}/sitemap-index.xml`);
  lines.push(
    '- Note: the bodies of /privacy/ and /terms/ are deliberately NOT mirrored in any machine-readable format (transcription drifts). Fetch those canonical HTML URLs for their current text.'
  );
  lines.push('');

  lines.push('## Site map');
  lines.push(`- ${business.url}/ — Home`);
  lines.push(`- ${business.url}/services — Services & pricing`);
  lines.push(`- ${business.url}/work — Case studies`);
  lines.push(`- ${business.url}/field-notes — Articles`);
  lines.push(`- ${business.url}/about — About`);
  lines.push(`- ${business.url}/contact — Contact`);

  return new Response(lines.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
