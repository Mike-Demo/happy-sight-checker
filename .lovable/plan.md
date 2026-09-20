# Fix: Spacefast builds but the site doesn't load

## What's happening

The Spacefast file listing shows only `assets/`, `favicon.png`, `robots.txt`,
`sitemap.xml` — there is no `index.html`, so there is nothing for the browser
to load.

Cause, confirmed from the build log and the local output folder:

- The build log reports `install=auto, build=auto, output=auto`, meaning
  Spacefast did not use the build command in `sf.jsonc` — it auto-detected one
  and ran the project's default build script.
- That default script builds the server/worker version of the app, which
  produces no prerendered HTML pages. The copy step then finds no prerendered
  output and leaves the folder as-is — exactly the four items visible in the
  screenshot.

Only the static build (the one that pre-renders the pages to HTML) produces
`index.html` and `licenses/index.html`.

## The fix

1. Make the project's default build produce the static, pre-rendered site, so
   whatever command Spacefast auto-detects generates real HTML pages. The
   server/worker build used for previewing and publishing inside Lovable stays
   available as its own separate command, so nothing about editing or
   previewing here changes.
2. Have the copy step fail loudly if no pre-rendered pages exist, so a future
   misconfigured build fails instead of quietly publishing a folder with no
   `index.html`.
3. Re-verify locally: run the build and confirm `dist/client` contains
   `index.html`, `licenses/index.html`, plus `robots.txt`, `sitemap.xml`,
   `_redirects` and the assets folder.
4. Update `SPACEFAST.md`: note that Spacefast currently ignores the build
   settings in `sf.jsonc` for repository builds, and that if it ever detects a
   different command, the Build settings in the Spacefast dashboard should be
   set to:
   - Install: `bun install`
   - Build: `bun run build`
   - Output directory: `dist/client`
   - Environment variable: `VITE_AUDIT_API_BASE=https://happy-sight-checker.lovable.app`

## Technical detail

- `package.json`: `build` becomes `STATIC_EXPORT=1 vite build && node
  scripts/copy-static-output.mjs`; the worker build moves to a `build:server`
  script (`vite build`). `vite.config.ts` already keys prerendering and the
  Cloudflare plugin off `STATIC_EXPORT`, so no config change is needed.
- `scripts/copy-static-output.mjs`: after copying, assert `dist/client/index.html`
  exists and exit non-zero otherwise.
- `sf.jsonc` stays as-is (harmless, and correct if Spacefast starts honoring it).

## Note

The audit itself still runs at request time through the Lovable-hosted endpoint,
so this project must stay published for audits on the Spacefast site to work.
That is unchanged by this fix.

### Which domain goes where

One name can only point at one host, so the two sites need two names:

- **Public site (Spacefast):** this is the one people visit. Use the name you
  want as the brand address — either the Spacefast address `a11y.view.fast`, or
  point your own name (e.g. `scan.mikedemo.one`) at Spacefast instead of Lovable.
- **Audit service (Lovable):** stays reachable at its Lovable address
  `happy-sight-checker.lovable.app`, which is what the public site calls for
  each audit. If you'd rather it had a friendly name, give it a different
  subdomain such as `audit.mikedemo.one` and keep that one on Lovable.

Recommended: move `scan.mikedemo.one` to Spacefast for the public site, and
leave the audit on the Lovable address (no extra DNS work). Either way, the
audit address the site calls is set once via the `VITE_AUDIT_API_BASE` value in
Spacefast's settings — so switching it later is a one-line change.

You'll keep editing and previewing here in Lovable exactly as now; the Lovable
preview always keeps its own address regardless of the domain choice.
