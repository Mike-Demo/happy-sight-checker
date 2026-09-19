# Static site for Spacefast + hosted audit endpoint

## Static check result

The site is **almost** fully static. Two public pages (home and licenses) render
identical HTML for every visitor — no database, no login, no per-user pages, no
cron, no webhooks.

The one exception is the accessibility audit itself. When someone types a web
address, the page must be fetched and analysed on a server, using a private
Firecrawl key that cannot be shipped to the browser. That cannot be prerendered.

Per your choice: the public site becomes fully static and is served from
Spacefast, while the audit call keeps running on the current Lovable URL. The
static page calls that endpoint when a visitor runs an audit.

## What you'll get

- Home and licenses pages baked into real HTML files, served from `dist/client`.
- `sitemap.xml`, `robots.txt`, and `_redirects` shipped as static files.
- The audit form still works on the static site, calling the Lovable-hosted
  audit endpoint over the network.
- A `SPACEFAST.md` file with the exact install command, build command, and
  output directory.

## Trade-off to know about

The static site depends on the Lovable-hosted app staying published — that is
where the audit runs. If it is unpublished, the pages still load but running an
audit will fail with a clear message. The audit endpoint is open to anyone who
finds its address, same as it is today on your Lovable URL.

## Technical plan

**Audit endpoint (new)**
- Add `src/routes/api/public/audit.ts` — a POST server route that validates the
  URL with the existing zod schema, runs the existing Firecrawl fetch + audit
  engine, and returns the `AuditResult` as JSON. It sends permissive CORS
  headers (`Access-Control-Allow-Origin: *`, plus an `OPTIONS` preflight
  handler) so the Spacefast origin can call it. Logic is reused from
  `src/lib/audit.functions.ts`/`audit.server.ts`; no business-rule changes.
- Refactor the Firecrawl + normalisation code out of `audit.functions.ts` into
  `src/lib/audit-fetch.server.ts` so the route and the existing server function
  share one implementation.
- Home page: replace `useServerFn(auditUrl)` with a `fetch` to a base URL from
  `import.meta.env.VITE_AUDIT_API_BASE`, falling back to a relative
  `/api/public/audit` when unset (so the Lovable preview keeps working
  unchanged). The published Lovable origin goes in `.env` as
  `VITE_AUDIT_API_BASE`.

**Prerender**
- `vite.config.ts`: add `pages: [{ path: "/" }, { path: "/licenses" }]` and
  `prerender: { enabled: true, autoStaticPathsDiscovery: false }` to
  `tanstackStart()`. Note: `@lovable.dev/vite-tanstack-config` is not used by
  this project — it configures `tanstackStart()` from
  `@tanstack/react-start/plugin/vite` (1.168.26) directly, which takes the same
  options. Discovery is turned off so the internal `__mockup`/`__component`
  editor preview routes and the API route are never prerendered.
- Confirm `.output/public/index.html` and `.output/public/licenses/index.html`
  exist after the build; if the build writes the files and then hangs, chase the
  open timer (TanStack Query `gcTime`, module-scope timers) and fix with
  `.unref()` or a `process.env.TSS_PRERENDERING` guard.
- No `nitro: { preset: "static" }`.

**Build output**
- `scripts/copy-static-output.mjs`: idempotent copy of `.output/public` →
  `dist/client`, cleaning the target first, no-op if the output is already
  there.
- `package.json`: `"build": "vite build && node scripts/copy-static-output.mjs"`.

**Static files**
- `public/sitemap.xml` listing `https://scan.mikedemo.one/` and
  `https://scan.mikedemo.one/licenses`.
- `public/robots.txt` gains `Sitemap: https://scan.mikedemo.one/sitemap.xml`.
- `public/_redirects` with `/*  /index.html  200`.
- No server-generated sitemap route exists, so nothing to delete. Both routes
  already define `head()` metadata; the licenses route's head will be checked
  and completed (title, description, og tags) so it is baked into the HTML.

**Docs**
- `SPACEFAST.md`: install `bun install`, build
  `vite build && node scripts/copy-static-output.mjs`, output `dist/client`
  (raw Nitro output `.output/public`), plus a note that
  `VITE_AUDIT_API_BASE` must be set at build time to the hosted audit origin.

**Verification**
- Typecheck, full build, list `dist/client` and confirm an `index.html` per
  route plus sitemap/robots/`_redirects`.
- Serve `dist/client` locally and open both routes in a browser: confirm they
  render, the footer and icons load, and hydration restores state. Run one real
  audit against the hosted endpoint and report anything that only works before
  the build.
