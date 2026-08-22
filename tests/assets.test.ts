/**
 * Rot-guard for public/assets/images.
 *
 * This directory has collected dead weight before: five numbered og-image
 * iterations in two formats, three generations of white logo exports and a
 * superseded stylesheet were all shipped to production unreferenced (cleaned
 * out 2026-08; see git history). Nothing here guards against that happening
 * again by accident, so: every file that sits in public/assets/images must be
 * referenced somewhere in the production build output. A file added to the
 * directory but never wired into a page, an SEO tag or a manifest fails this
 * test — either reference it deliberately or don't ship it.
 *
 * Method mirrors the 2026-08 cleanup audit: search every text-emitted dist
 * file for the asset's filename, excluding the file's own verbatim copy
 * under dist/ (Astro copies public/** into dist/** unchanged, so every
 * shipped file trivially "matches" itself).
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { DIST, ROOT } from './support/dist';

/** Extensions worth scanning as text; binaries (woff2/png) can't reference anything. */
const SCANNABLE_EXTENSIONS = new Set(['.html', '.css', '.js', '.mjs', '.xml', '.txt', '.svg', '.json', '.webmanifest']);

function walkFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(full) : [full];
  });
}

/** Every text-emitted file in dist/, read once per process. */
let cachedDistText: string[] | null = null;
function distTextFiles(): string[] {
  if (!cachedDistText) {
    cachedDistText = walkFiles(DIST).filter((f) => SCANNABLE_EXTENSIONS.has(extname(f)));
  }
  return cachedDistText;
}

describe('every file in public/assets/images is referenced by the build', () => {
  const imageDir = join(ROOT, 'public', 'assets', 'images');
  const images = walkFiles(imageDir).sort();

  it('has images to guard', () => {
    expect(images.length, 'public/assets/images is empty — is the directory still in place?').toBeGreaterThan(0);
  });

  it('is referenced somewhere in dist/ besides its own copied bytes', () => {
    const distFiles = distTextFiles();
    const unreferenced: string[] = [];

    for (const image of images) {
      const name = image.slice(imageDir.length + 1);
      // The file's own copy lands at dist/<same relative path>; exclude it,
      // otherwise every asset trivially "references" itself.
      const selfCopy = join(DIST, 'assets', 'images', name);
      const referencing = distFiles.filter(
        (f) => f !== selfCopy && readFileSync(f, 'utf8').includes(name)
      );

      if (referencing.length === 0) {
        unreferenced.push(name);
      }
    }

    expect(
      unreferenced,
      'these files ship to production but nothing in the build references them — wire them up or delete them:\n  ' +
        unreferenced.join('\n  ')
    ).toEqual([]);
  });
});
