/**
 * Accessibility structure checks for every emitted content page.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ NOTE: axe-core is NOT used here.                                    │
 * │ We tried: axe-core requires a real DOM environment (a browser or    │
 * │ jsdom) exposing window/document/getComputedStyle. This suite parses │
 * │ the built HTML with node-html-parser — a lightweight tree with no   │
 * │ DOM environment — and running axe against it fails immediately      │
 * │ ("Required \"window\" or \"document\" globals not defined").        │
 * │ Rather than fake a pass, these are hand-written structural         │
 * │ assertions covering the highest-value equivalents: landmark         │
 * │ uniqueness, skip links, labelled form controls, named buttons and   │
 * │ discernible link text. Image alt policy lives in pages.test.ts.     │
 * └─────────────────────────────────────────────────────────────────────┘
 */
import { describe, expect, it } from 'vitest';
import { contentPages } from './support/dist';

const pages = contentPages();

/** Visible text of an element (entity-decoded by the parser). */
function textOf(el: { text: string }): string {
  return el.text.replace(/\s+/g, ' ').trim();
}

describe('landmarks', () => {
  it('has exactly one <main> per page, carrying id="main"', () => {
    for (const page of pages) {
      const mains = page.doc.querySelectorAll('main');
      expect(mains, `${page.route}: expected exactly one <main>`).toHaveLength(1);
      expect(mains[0].getAttribute('id'), `${page.route}: <main> lost its id`).toBe('main');
    }
  });

  it('every <nav> announces itself with a distinct accessible name', () => {
    // The layout legitimately uses two navs (primary + footer); what a11y
    // requires is that each is labelled so screen readers can tell them apart.
    for (const page of pages) {
      const labels = page.doc
        .querySelectorAll('nav')
        .map((n) => n.getAttribute('aria-label')?.trim() ?? '');
      expect(labels.length, `${page.route}: no <nav> found`).toBeGreaterThan(0);
      for (const label of labels) {
        expect(label, `${page.route}: a <nav> has no aria-label`).toBeTruthy();
      }
      expect(new Set(labels).size, `${page.route}: duplicate nav aria-labels`).toBe(labels.length);
    }
  });

  it('has exactly one banner and one contentinfo landmark per page', () => {
    // Articles legitimately carry their own scoped <header>/<footer>
    // elements; what must stay unique page-wide are the banner (site nav)
    // and contentinfo (site footer) landmarks.
    for (const page of pages) {
      expect(
        page.doc.querySelectorAll('[role="banner"]').length,
        `${page.route}: expected exactly one banner landmark`
      ).toBe(1);
      expect(
        page.doc.querySelectorAll('footer[role="contentinfo"], [role="contentinfo"]').length,
        `${page.route}: expected exactly one contentinfo landmark`
      ).toBe(1);
      // …and the footer element itself is the contentinfo landmark.
      expect(page.doc.querySelectorAll('footer').length, `${page.route}: footers`).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('skip link', () => {
  it('targets a real id on the main landmark', () => {
    for (const page of pages) {
      const skip = page.doc.querySelector('a.skip-link[href^="#"]');
      expect(skip, `${page.route}: no skip link`).toBeTruthy();
      const targetId = skip!.getAttribute('href')!.slice(1);
      expect(
        page.doc.querySelector(`[id="${targetId}"]`),
        `${page.route}: skip link targets missing id="${targetId}"`
      ).toBeTruthy();
    }
  });
});

describe('form controls', () => {
  it('every visible control is associated with a label', () => {
    for (const page of pages) {
      for (const control of page.doc.querySelectorAll('input, select, textarea')) {
        if (control.getAttribute('type') === 'hidden') continue;
        const id = control.getAttribute('id');
        const name = control.getAttribute('name') ?? '(unnamed)';
        const described =
          (id && page.doc.querySelector(`label[for="${id}"]`) !== null) ||
          control.getAttribute('aria-label')?.trim() ||
          control.getAttribute('aria-labelledby');
        expect(
          described,
          `${page.route}: <input name="${name}"> has no associated label`
        ).toBeTruthy();
      }
    }
  });

  it('no label points at a missing control (orphan label check)', () => {
    for (const page of pages) {
      for (const label of page.doc.querySelectorAll('label[for]')) {
        const targetId = label.getAttribute('for')!;
        expect(
          page.doc.querySelector(`[id="${targetId}"]`),
          `${page.route}: label[for="${targetId}"] targets nothing`
        ).toBeTruthy();
      }
    }
  });
});

describe('interactive elements', () => {
  it('every button has an accessible name', () => {
    for (const page of pages) {
      for (const button of page.doc.querySelectorAll('button')) {
        const name =
          textOf(button) || button.getAttribute('aria-label')?.trim() || button.getAttribute('title');
        expect(
          name,
          `${page.route}: <button> "${button.getAttribute('class') ?? ''}" has no accessible name`
        ).toBeTruthy();
      }
    }
  });

  it('hides the hamburger strokes from assistive technology', () => {
    for (const page of pages) {
      for (const stroke of page.doc.querySelectorAll('.hamburger span')) {
        expect(stroke.getAttribute('aria-hidden'), `${page.route}: decorative menu stroke`).toBe('true');
      }
    }
  });

  it('every link has discernible text', () => {
    for (const page of pages) {
      for (const link of page.doc.querySelectorAll('a[href]')) {
        const href = link.getAttribute('href') ?? '';
        if (/^(mailto|tel):/.test(href)) continue;
        const name =
          textOf(link) ||
          link.getAttribute('aria-label')?.trim() ||
          link.getAttribute('aria-labelledby') ||
          // An image inside counts when it carries its own alt.
          (link.querySelectorAll('img[alt]:not([alt=""])').length > 0 ? '(image alt)' : '');
        expect(
          name,
          `${page.route}: link to ${href} has no discernible text`
        ).toBeTruthy();
      }
    }
  });

  it('does not put aria-label on a paragraph', () => {
    // ARIA prohibits aria-label on <p>; assistive tech ignores it and
    // axe-core flags aria-prohibited-attr. The homepage tagline must carry
    // its accessible text as real content (see .hero__typed .sr-only).
    for (const page of pages) {
      for (const p of page.doc.querySelectorAll('p[aria-label]')) {
        expect(
          p.getAttribute('aria-label'),
          `${page.route}: aria-label is prohibited on <p class="${p.getAttribute('class') ?? ''}">`
        ).toBeNull();
      }
    }
  });

  it('lazy-loads the below-the-fold footer mark', () => {
    for (const page of pages) {
      const mark = page.doc.querySelector('footer img.footer__mark');
      expect(mark, `${page.route}: footer mark missing`).toBeTruthy();
      expect(
        mark!.getAttribute('loading'),
        `${page.route}: footer logo is below the fold and must load lazily`
      ).toBe('lazy');
    }
  });
});
