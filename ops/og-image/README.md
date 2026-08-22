# OG / social-share image

Source for `public/assets/images/og-image.png` (1200×630), referenced by
`src/components/SEO.astro` as `og:image` / `twitter:image`.

- `og-image.html` — fully self-contained: inline CSS, inlined logo SVG, and the
  three brand fonts (Syne, Space Grotesk, JetBrains Mono) embedded as base64
  woff2. No network needed to render.
- `render.js` — Playwright (playwright-core) headless-Chromium renderer.

## Regenerate

```bash
node render.js og-image.html ../../public/assets/images/og-image.png 1200 630
```

Renderer launches with an explicit Chromium `executablePath` + `chromiumSandbox:false`
and `deviceScaleFactor:1` so the output is exactly 1200×630. Edit the copy/layout in
`og-image.html`, re-render, eyeball it, then rebuild the site.

## Running it

`render.js` needs `playwright-core`, which is deliberately NOT a dependency of
the site — it is an occasional ops tool and the site build must not carry a
browser engine. Install it on demand:

```
pnpm add playwright-core     # in a scratch directory, or globally
node render.js og-image.html ../../public/assets/images/og-image.png 1200 630
```

The script resolves Chromium via `chromium.executablePath()`. Override with
`PLAYWRIGHT_CHROMIUM_PATH` if you have an unusual install. It validates every
argument before launching anything, and closes the browser on both the success
and failure paths.

Verified working 2026-08-22: renders a valid 1200x630 PNG and leaves no
Chromium process behind.
