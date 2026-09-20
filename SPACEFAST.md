# Spacefast build spec

The public site is fully static. Every page is prerendered to HTML at build time.

| Setting                 | Value                                                               |
| ----------------------- | ------------------------------------------------------------------- |
| Install command         | `bun install`                                                       |
| Build command           | `STATIC_EXPORT=1 vite build && node scripts/copy-static-output.mjs` |
| Static output directory | `dist/client`                                                       |
| Spacefast space         | `a11y` (`a11y.view.fast`)                                           |
| Production branch       | `main`                                                              |

These settings are also recorded in `sf.jsonc`, which Spacefast reads when it
builds from the connected GitHub repository.

`STATIC_EXPORT=1` is what turns the prerender pass on. Without it the build
produces the Cloudflare Worker bundle Lovable publishes (the two are mutually
exclusive — prerendering renders pages through a Node preview server the worker
build does not emit). `bun run build:static` runs the same command.

This project emits the prerendered files straight into `dist/client`; the
post-build script copies `.output/public` into `dist/client` if a future
toolchain version writes there instead, and otherwise reports there is nothing
to copy.

Node 20+ or Bun 1.1+ is required. `npm ci` works in place of `bun install`.

## GitHub push-to-deploy

The intended flow is:

1. Edit and preview in Lovable.
2. Lovable syncs the project to `Mike-Demo/happy-sight-checker` on GitHub.
3. Spacefast's GitHub app sees pushes to `main`.
4. Spacefast runs the install and build commands from `sf.jsonc`.
5. Spacefast publishes `dist/client` to the `a11y` space.

No GitHub Actions workflow is needed, and no Spacefast API key is stored in
GitHub.

### One-time connection setup

After signing in to Spacefast locally, run these commands from the repository
root:

```bash
sf env set VITE_AUDIT_API_BASE "https://happy-sight-checker.lovable.app" --no-secret
sf git connect --space a11y --provider github --repository Mike-Demo/happy-sight-checker --production-branch main --sync
```

The first command makes the public build-time audit endpoint available to the
static site. The second connects the GitHub repository to Spacefast, selects
`main` as the live branch, and starts the initial sync. The GitHub app
installation and repository authorization must be completed by the Spacefast
account owner.

## Prerendered routes

- `/` → `dist/client/index.html`
- `/licenses` → `dist/client/licenses/index.html`

Also shipped: `sitemap.xml`, `robots.txt`, `_redirects` (`/*  /index.html  200`,
so deep links resolve on generic static hosts). Spacefast also receives the
same fallback natively from `sf.jsonc`.

## Required build-time environment variable

| Variable               | Value                                     |
| ---------------------- | ----------------------------------------- |
| `VITE_AUDIT_API_BASE`  | `https://happy-sight-checker.lovable.app` |

The accessibility audit itself cannot be static: it fetches and analyses the
submitted page on a server using a private Firecrawl key. That one request runs
on the Lovable-hosted app, and the static site calls it at
`$VITE_AUDIT_API_BASE/api/public/audit`. The endpoint sends permissive CORS
headers, so any origin may call it.

If `VITE_AUDIT_API_BASE` is unset, the site calls `/api/public/audit` on its own
origin — correct inside Lovable, but on Spacefast audits would fail because no
server runs there.
