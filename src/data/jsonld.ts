/**
 * schema.org JSON-LD node builders — one @graph per page.
 *
 * Rules enforced here (docs/AGENT-READINESS.md, section D):
 *   - Every @id is an absolute URL derived from business.url / the page URL,
 *     so nodes cross-reference with @id instead of duplicating facts.
 *   - Nothing is asserted that src/data/business.ts and real content do not
 *     support: no aggregateRating, no review, no invented sameAs, no
 *     priceValidUntil. Omit rather than guess.
 */
import { business } from './business';

const ORG_ID = `${business.url}/#organization`;
const SITE_ID = `${business.url}/#website`;

/** The canonical ProfessionalService node, shared by every page's @graph. */
export function organizationNode() {
  return {
    '@type': 'ProfessionalService',
    '@id': ORG_ID,
    name: business.tradingName,
    legalName: business.legalName,
    url: business.url,
    description: business.description,
    email: business.email,
    telephone: business.phoneTel,
    image: `${business.url}/assets/images/logo.svg`,
    logo: {
      '@type': 'ImageObject',
      url: `${business.url}/assets/images/logo.svg`,
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: business.address.streetAddress,
      addressLocality: business.address.addressLocality,
      postalCode: business.address.postalCode,
      addressCountry: business.address.addressCountry,
    },
    areaServed: business.areasServed,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: business.email,
      telephone: business.phoneTel,
      availableLanguage: ['en-GB'],
    },
    // VAT number, social profiles etc. are not published anywhere verified,
    // so no sameAs / taxID here. Add only when a real profile exists.
    founder: {
      '@type': 'Person',
      '@id': `${business.url}/about/#waseem-ilyas`,
      name: 'Waseem Ilyas',
    },
  };
}

export function websiteNode() {
  return {
    '@type': 'WebSite',
    '@id': SITE_ID,
    url: business.url,
    name: business.tradingName,
    description: business.description,
    publisher: { '@id': ORG_ID },
    inLanguage: 'en-GB',
    // No potentialAction SearchAction: the site has no search feature.
  };
}

export function webPageNode(opts: { path: string; title: string; description: string; type?: string; datePublished?: string; dateModified?: string }) {
  const url = new URL(opts.path, business.url).toString();
  return {
    '@type': opts.type ?? 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: opts.title,
    description: opts.description,
    isPartOf: { '@id': SITE_ID },
    about: { '@id': ORG_ID },
    inLanguage: 'en-GB',
    ...(opts.datePublished ? { datePublished: opts.datePublished } : {}),
    ...(opts.dateModified ? { dateModified: opts.dateModified } : {}),
  };
}

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbNode(crumbs: Crumb[]) {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${new URL(crumbs[crumbs.length - 1].path, business.url).toString()}#breadcrumb`,
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: new URL(c.path, business.url).toString(),
    })),
  };
}

export interface Faq {
  q: string;
  a: string;
}

export function faqNode(pagePath: string, faqs: Faq[]) {
  return {
    '@type': 'FAQPage',
    '@id': `${new URL(pagePath, business.url).toString()}#faq`,
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}
