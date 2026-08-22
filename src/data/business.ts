/**
 * Canonical business facts.
 *
 * Single source of truth consumed by:
 *   - the JsonLd component (LocalBusiness/ProfessionalService schema)
 *   - the /llms.txt endpoint
 *   - the /services page pricing table
 *
 * Keep this in sync with reality; everything else derives from it.
 */

export interface ServiceOffering {
  name: string;
  description: string;
  /** GBP, numeric, no currency symbol. */
  priceFrom: number;
  /** e.g. "project" or "month" */
  priceUnit: 'project' | 'month';
}

export const business = {
  legalName: 'Automancer Ltd',
  tradingName: 'Automancer',
  companyNumber: '17060907',
  /** Part of the UK where the company is registered — a Companies Act trading disclosure. */
  placeOfRegistration: 'England and Wales',
  /** ICO (Information Commissioner's Office) data-protection registration. */
  icoRegistration: 'ZC180569',
  url: 'https://automancer.uk',
  email: 'waseem@automancer.uk',
  /** Voicemail line (Vonage) that feeds the intake pipeline. */
  phone: '+44 7451 261333',
  /** E.164, no spaces — for tel: links. */
  phoneTel: '+447451261333',
  address: {
    streetAddress: '62 Beckfield Road',
    addressLocality: 'Bingley',
    postalCode: 'BD16 1QS',
    addressCountry: 'GB',
  },
  areasServed: ['Bradford', 'Leeds', 'Manchester', 'UK-wide (remote)'],
  description:
    'Practical AI and workflow automation for UK small businesses. Cut admin, reduce errors, and improve operations with Automancer.',
} as const;

/** Display format for a published from-price: £450 · £1,950. */
export function formatGBP(n: number): string {
  return '£' + n.toLocaleString('en-GB', { maximumFractionDigits: 0 });
}

export const services: ServiceOffering[] = [
  {
    name: 'Automation Opportunity Audit',
    description:
      'A focused review of your workflows to identify where automation will have the biggest impact.',
    priceFrom: 450,
    priceUnit: 'project',
  },
  {
    name: 'Workflow Implementation Sprint',
    description: 'Build and deploy automation for 1–3 selected workflows.',
    priceFrom: 1950,
    priceUnit: 'project',
  },
  {
    name: 'System/Agent Build',
    description:
      'From task-specific assistants to full AI employees that draw on your organisational knowledge.',
    priceFrom: 4500,
    priceUnit: 'project',
  },
  {
    name: 'AI Ops Partner',
    description:
      'Ongoing optimisation and support as your automation footprint grows.',
    priceFrom: 495,
    priceUnit: 'month',
  },
];
