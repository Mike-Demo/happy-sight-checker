# Move WCAGify fully onto Spacefast (site + audit function)

## What this app actually needs (audited)

- Pages: `/` and `/licenses`, already prerendered to `dist/client` and served by Spacefast.
- Server logic: one endpoint, `POST /api/public/audit`. It checks the address, fetches the page through Firecrawl, runs the WCAG checks, and returns the report.
- Database, logins, file uploads, cron jobs: none. Results only live in the page. The "Database & data migration" and "File storage" parts of the brief don't apply, and no data needs copying.
- Secrets: Firecrawl access. Today it goes through Lovable's managed connector (`LOVABLE_API_KEY` + `FIRECRAWL_API_KEY`), which only works on Lovable. On Spacefast you'll need your **own Firecrawl API key**.

After the move, Spacefast serves everything and the Lovable app no longer has to stay published for audits to work.

## Unconfirmed (checked first)

I haven't confirmed Spacefast Functions' exact file layout, runtime (Web `Request`/`Response` vs Node), size and time limits, or how secrets are set. Phase 1 checks this against the Spacefast docs before any code is ported. If Functions can't make outbound requests or run for about 30 seconds, we stop and keep the current setup.

## Phases

**Phase 1: Check the platform**
- Read the Spacefast Functions docs. Deploy a one-line test function on a preview branch and confirm it can reach `api.firecrawl.dev`.

**Phase 2: Move the audit into a function**
- Move the audit engine (`audit.server.ts`, `audit-types.ts`, `audit-input.ts`) into a shared folder the function can import, with no framework imports. It already uses plain JavaScript (`node-html-parser`), so it needs no rewriting.
- Add a direct Firecrawl client that calls `https://api.firecrawl.dev/v2/scrape` with `FIRECRAWL_API_KEY`, next to the current Lovable gateway client. An environment switch picks which one runs, so Lovable preview keeps working.
- Create the Spacefast function (e.g. `functions/api/audit.ts`) that reuses the same validation, private-address blocking, error messages and status codes as the current route.
- Set the secret with `sf env set FIRECRAWL_API_KEY ... --secret`.

**Phase 3: Check the new function matches the old endpoint**
- Run a script that audits the same five addresses (example.com, a heavy site, an invalid address, a private IP, a 404) against both endpoints and compares the scores and rule counts.

**Phase 4: Point the site at the new function**
- Build the Spacefast site with the audit address unset (a same-site `/api/audit` path) so the page calls its own function. Keep the `VITE_AUDIT_API_BASE` override.
- Simplify the build to the static pass only (`build:static`) for Spacefast. The Lovable worker pass stays available as `build:server`.
- Update `SPACEFAST.md` and `sf.jsonc`.

## Cutover and rollback

- DNS doesn't change: `scan.mikedemo.one` and `a11y.view.fast` already point at Spacefast.
- Cutover = deploy Phase 4 to `main`. Smoke test: both pages load, an audit completes, invalid and private addresses show clear errors, and there are no console errors.
- Rollback: set `VITE_AUDIT_API_BASE=https://happy-sight-checker.lovable.app` in Spacefast and redeploy. Keep the Lovable app published for about two weeks as this fallback.

## What I need from you

- Your own Firecrawl API key (from firecrawl.dev → API Keys). You'll enter it in Spacefast yourself; it never goes in the code.
