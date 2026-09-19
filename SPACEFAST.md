# Spacefast build spec

The public site is fully static. Every page is prerendered to HTML at build time.

| Setting                 | Value                                                              |
| ----------------------- | ------------------------------------------------------------------ |
| Install command         | `bun install`                                                      |
| Build command           | `STATIC_EXPORT=1 vite build && node scripts/copy-static-output.mjs` |
| Static output directory | `dist/client`                                                      |

`STATIC_EXPORT=1` is what turns the prerender pass on. Without it the build
produces the Cloudflare Worker bundle Lovable publishes (the two are mutually
exclusive — prerendering renders pages through a Node preview server the worker
build does not emit). `bun run build:static` runs the same command.

This project emits the prerendered files straight into `dist/client`; the
post-build script copies `.output/public` into `dist/client` if a future
toolchain version writes there instead, and otherwise reports there is nothing
to copy.

Node 20+ or Bun 1.1+ is required. `npm ci` works in place of `bun install`.

## Prerendered routes

- `/` → `dist/client/index.html`
- `/licenses` → `dist/client/licenses/index.html`

Also shipped: `sitemap.xml`, `robots.txt`, `_redirects` (`/*  /index.html  200`,
so deep links resolve).

## Required build-time environment variable

| Variable               | Value                                   |
| ---------------------- | --------------------------------------- |
| `VITE_AUDIT_API_BASE`  | `https://happy-sight-checker.lovable.app` |

The accessibility audit itself cannot be static: it fetches and analyses the
submitted page on a server using a private Firecrawl key. That one request runs
on the Lovable-hosted app, and the static site calls it at
`$VITE_AUDIT_API_BASE/api/public/audit`. The endpoint sends permissive CORS
headers, so any origin may call it.

If `VITE_AUDIT_API_BASE` is unset, the site calls `/api/public/audit` on its own
origin — correct inside Lovable, but on Spacefast audits would fail because no
server runs there.
