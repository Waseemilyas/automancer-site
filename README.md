# Automancer Site

Public marketing site for automancer.uk. Astro static build ("Grimoire Terminal"
design: black/white with a spectral pink→purple accent), content collections for
case studies and field notes, self-hosted fonts, zero third-party cookies.

## How to run

```
pnpm install
pnpm run dev       # local dev server
pnpm run build     # production build
pnpm run preview   # preview the production build
pnpm run check     # astro check (types/content)
```

Deploys via GitHub Actions on push to `main` → GitHub Pages (CNAME preserved,
DNS on Cloudflare).

## Docs

- `src/content/` — case studies and field notes (content collections).
- `src/data/business.ts` — source data for `llms.txt`/JSON-LD/pricing.
- `ops/og-image/` — regenerable OG image.
- See `../automancer-bd/docs/BUILD-2026-07-04.md` for the wider system map this
  site is part of (lead pipeline, dashboard, etc).
