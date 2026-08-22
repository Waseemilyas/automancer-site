/**
 * CLI: print the per-page weight table for the current dist/ build.
 *
 *   node tests/support/perf-cli.ts            markdown table (for PERFORMANCE.md)
 *   node tests/support/perf-cli.ts --csv      machine-readable rows
 *
 * Run `pnpm run build` first — this reads dist/ as-is and never builds.
 */
import { measureAllPages, DIST } from './perf.ts';

const pages = measureAllPages();
const csv = process.argv.includes('--csv');

if (csv) {
  console.log('route,html,css,js,fonts,images,total');
  for (const p of pages) {
    console.log(
      [p.route, p.htmlBytes, p.cssBytes, p.jsBytes, p.fontBytes, p.imageBytes, p.totalBytes].join(',')
    );
  }
} else {
  const kb = (n: number): string => (n / 1024).toFixed(1);
  const width = Math.max(...pages.map((p) => p.route.length)) + 2;
  console.log(
    '| ' + 'page'.padEnd(width) +
    '| html | css | js | fonts | images | total |'
  );
  console.log('|' + '-'.repeat(width) + '|-----:|----:|---:|------:|-------:|------:|');
  for (const p of pages) {
    console.log(
      '| ' + p.route.padEnd(width) +
      `| ${kb(p.htmlBytes).padStart(4)} | ${kb(p.cssBytes).padStart(3)} | ${kb(p.jsBytes).padStart(2)} | ${kb(p.fontBytes).padStart(5)} | ${kb(p.imageBytes).padStart(6)} | ${kb(p.totalBytes).padStart(5)} |`
    );
  }
}

const totals = pages.reduce(
  (acc, p) => ({
    html: acc.html + p.htmlBytes,
    css: acc.css + p.cssBytes,
    js: acc.js + p.jsBytes,
    fonts: acc.fonts + p.fontBytes,
    images: acc.images + p.imageBytes,
    total: acc.total + p.totalBytes,
  }),
  { html: 0, css: 0, js: 0, fonts: 0, images: 0, total: 0 },
);
console.error(`pages: ${pages.length}  sum(total): ${(totals.total / 1024).toFixed(1)} KiB  dist: ${DIST}`);
