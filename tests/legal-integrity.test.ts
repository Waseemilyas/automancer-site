/**
 * The published "last updated" date on /privacy and /terms is a CLAIM ABOUT
 * CONTENT THAT CAN CHANGE UNDERNEATH IT.
 *
 * The date lives in src/data/site-content.ts; the prose lives in the page. They
 * can be edited independently, so someone can revise the privacy notice and
 * leave the date untouched — and the site then publishes a false statement
 * about when its privacy notice last changed. To a visitor, and potentially to
 * a regulator.
 *
 * This does NOT try to derive the date automatically. It should record when the
 * SUBSTANCE changed, which is a human judgement — a typo fix is not a revision.
 * Instead it pins the current wording so a change to it cannot pass silently:
 * edit the prose and this test fails, telling you to decide whether the date
 * should move.
 *
 * It hashes the rendered TEXT, not the markup or the source file, so a design
 * change or a refactor (both happened on 2026-08-22) does not trip it. Only the
 * words a reader actually sees.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { allHtmlFiles } from './support/dist';

/** Text of the legal pages as published, hashed 2026-08-23. */
const PINNED: Record<string, { sha256: string; lastUpdated: string | null }> = {
  // Moved 2026-08-23 for a SUBSTANTIVE change (AUT-6414, adversarial review
  // AUT-6705 finding 2): the Sentry processor bullet claimed we "configured it
  // not to collect personal data" — an absolute claim sendDefaultPii:false does
  // not support, since error messages/URLs can still carry incidental personal
  // data. Reworded to match the narrower, accurate framing already used in the
  // "when you just browse" section above it.
  '/privacy/': {
    sha256: '8352fad99dca4d05da9f7a5d407b8195b4456ee09bfd0f07ad38e5baad1c891f',
    lastUpdated: '23 August 2026',
  },
  // CHARACTERISING, NOT ENDORSING: /terms/ publishes NO date and no version.
  // src/data/site-content.ts records no lastUpdated for it, unlike /privacy/.
  //
  // That means a visitor cannot tell which version of the Terms of Use binds
  // them, and we cannot evidence what the terms said on a given date except by
  // reading git. The privacy notice does not have this problem.
  //
  // NOT FIXED HERE ON PURPOSE. Publishing a date requires deciding WHICH date
  // is truthful — when the terms last changed in substance — and that is a
  // judgement about a legal document, not a code change to make at 02:35
  // unattended. Two options for whoever picks this up:
  //   (a) add lastUpdated to the /terms/ entry in src/data/site-content.ts and
  //       render it as /privacy/ does — simplest, and matches the sibling page;
  //   (b) decide the terms are undated by design, and record that reasoning
  //       here so the next person does not re-raise it.
  // This test pins the current wording either way, so the terms cannot change
  // silently while the question is open.
  '/terms/': {
    sha256: '8ce324e93907a3cd8605aeda412cbfa3c6bf2028bcf2d23ca03c238e76ad0f8f',
    lastUpdated: null,
  },
};

function legalText(html: string): string {
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html;
  return main
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('legal page integrity', () => {
  for (const [route, pin] of Object.entries(PINNED)) {
    it(`${route} wording has not changed without its date changing`, () => {
      const page = allHtmlFiles().find((p) => p.route === route);
      expect(page, `${route} was not emitted — the legal page is missing`).toBeTruthy();

      const text = legalText(page!.html);
      expect(
        text.length,
        `${route} rendered no text — the hash below would be meaningless`
      ).toBeGreaterThan(500);

      const actual = createHash('sha256').update(text).digest('hex');
      expect(
        actual,
        `${route} WORDING HAS CHANGED but its published "Last updated" still reads ` +
          `"${pin.lastUpdated}".\n\n` +
          `Decide which is true, then do ONE of:\n` +
          `  - substantive change: update lastUpdated in src/data/site-content.ts, ` +
          `then set sha256 below to ${actual}\n` +
          `  - typo or formatting only: leave the date, set sha256 below to ${actual}\n\n` +
          `This is deliberately a human decision. A wrong date on a privacy notice ` +
          `is a false statement to a visitor and to a regulator.`
      ).toBe(pin.sha256);

      if (pin.lastUpdated === null) {
        // Characterising the gap: this page publishes no date today. If someone
        // adds one, this fails and they must record the decision above.
        expect(
          /Last updated:/i.test(page!.html),
          `${route} now publishes a "Last updated" date. Good — but record the ` +
            'decision in the comment above and give this entry its date, so the ' +
            'open question is closed rather than silently answered.'
        ).toBe(false);
      } else {
        expect(
          page!.html,
          `${route} no longer displays its "Last updated" date at all`
        ).toContain(pin.lastUpdated);
      }
    });
  }
});
