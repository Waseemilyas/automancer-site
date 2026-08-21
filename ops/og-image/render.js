// Renders an HTML file to a PNG with headless Chromium.
//
// Three rules this script exists to respect, all learned the hard way:
//
//  1. VALIDATE EVERY ARGUMENT BEFORE THE FIRST IRREVERSIBLE OR EXPENSIVE
//     ACTION. The irreversible action here is overwriting the output image —
//     normally a live OG image that every social share depends on. So every
//     check runs before Chromium is launched, and before playwright-core is
//     even imported: a typo'd path fails with a usage message rather than
//     after a browser is running, and it still fails usefully on a machine
//     where Playwright was never installed.
//
//  2. ALWAYS REAP THE BROWSER. close() lives in a `finally`, so a failed
//     goto, fonts that never settle, or a screenshot error cannot leak a
//     Chromium process. A leaked headless Chromium on a shared box is
//     expensive: with no GPU present it renders through SwiftShader — in
//     software, on the CPU.
//
//  3. This file is ESM. The repo sets "type": "module", so the previous
//     CommonJS version could not run at all under `node render.js`.
import path from 'node:path';
import fs from 'node:fs';

function usage(message) {
  console.error(`error: ${message}
usage: node render.js <input.html> <output.png> [width] [height]
example: node render.js og-image.html ../../public/assets/images/og-image.png 1200 630`);
  process.exit(1);
}

// ---- validation: all of this runs before any import or launch ----
const [, , inp, out, widthArg = '1200', heightArg = '630'] = process.argv;

if (!inp) usage('no input HTML given');
if (!out) usage('no output PNG given');

const inputPath = path.resolve(inp);
if (!fs.existsSync(inputPath)) usage(`input file does not exist: ${inputPath}`);
if (!fs.statSync(inputPath).isFile()) usage(`input is not a file: ${inputPath}`);

const outputPath = path.resolve(out);
if (!outputPath.toLowerCase().endsWith('.png')) usage(`output must be a .png: ${outputPath}`);
if (!fs.existsSync(path.dirname(outputPath))) {
  usage(`output directory does not exist: ${path.dirname(outputPath)}`);
}

const W = Number.parseInt(widthArg, 10);
const H = Number.parseInt(heightArg, 10);
if (!Number.isInteger(W) || W <= 0) usage(`width must be a positive integer, got: ${widthArg}`);
if (!Number.isInteger(H) || H <= 0) usage(`height must be a positive integer, got: ${heightArg}`);

// ---- only now is anything expensive imported or launched ----
let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  usage("playwright-core is not installed. This script is an occasional ops tool, not part of the site build — install it on demand with 'pnpm dlx playwright-core' or run it from a checkout that has it.");
}

// Resolve Chromium from playwright rather than hardcoding a version directory:
// a pinned path like chromium-1229 breaks silently on every upgrade.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || chromium.executablePath();
if (executablePath && !fs.existsSync(executablePath)) {
  usage(`Chromium not found at ${executablePath} — run 'npx playwright install chromium' or set PLAYWRIGHT_CHROMIUM_PATH`);
}

const browser = await chromium.launch({
  executablePath,
  chromiumSandbox: false,
  // No GPU on the build box: without this, Chromium emulates one through
  // SwiftShader and burns CPU cores doing it.
  args: ['--force-color-profile=srgb', '--disable-gpu'],
});
try {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.goto('file://' + inputPath, { timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: outputPath, clip: { x: 0, y: 0, width: W, height: H } });
  console.log('rendered', outputPath, W + 'x' + H);
} catch (err) {
  console.error('render failed:', err?.message ?? err);
  process.exitCode = 1;
} finally {
  // Runs on the success path and on every failure path.
  await browser.close();
}
