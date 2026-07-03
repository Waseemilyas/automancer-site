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
  lines.push(`Web: ${business.url}`);
  lines.push(`Contact form: ${business.url}/contact`);
  lines.push('');

  lines.push('## Company');
  lines.push(`${business.legalName}, company no. ${business.companyNumber}.`);
  lines.push(
    `${business.address.streetAddress}, ${business.address.addressLocality}, ${business.address.postalCode}, United Kingdom.`
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
