# Fix Spacefast build failure: "cloudflare-pages: Cloudflare Worker entrypoints are not converted"

## Diagnosis (confirmed)

Spacefast's build pack scans the repository and aborts when it finds a
Cloudflare Worker setup. The trigger is `wrangler.jsonc` at the project
root, which declares `"main": "@tanstack/react-start/server-entry"` — a
Worker entrypoint. That file is required for the normal Lovable build
(the Cloudflare Workers deploy), so it cannot simply be deleted.

## Fix: move the Wrangler config out of the root

1. Move `wrangler.jsonc` from the project root to `deploy/wrangler.jsonc`.
   Spacefast's detection looks at the conventional root location; a
   config living in a subfolder is no longer picked up as a Worker
   entrypoint.
2. Update `vite.config.ts`: pass `configPath: "deploy/wrangler.jsonc"`
   to the `cloudflare()` plugin so the Lovable (SSR/worker) build still
   finds its Wrangler config. The static build path (`STATIC_EXPORT=1`)
   already skips the Cloudflare plugin entirely and is untouched.
3. Update `SPACEFAST.md` to document the moved config and why.

## Verification

1. Typecheck (`bunx tsgo --noEmit`).
2. Static build (`bun run build:static`) — confirm `dist/client` still
   gets both prerendered pages plus sitemap, robots, `_redirects`.
3. Normal Lovable build (`vite build` without `STATIC_EXPORT`) — confirm
   the worker build still succeeds with the relocated config.
4. Confirm no remaining root-level Cloudflare marker files
   (`wrangler.*`, `_worker.js`, `functions/`) that Spacefast could flag.

## Fallback if Spacefast still complains

If the build pack also keys off the `@cloudflare/vite-plugin` dependency
in `package.json`, the next step is Spacefast-side: re-run with their
`--allow-unsupported-platform-features` flag (or the equivalent setting
in the Spacefast dashboard), since the dependency is only used for the
Lovable build and ships nothing to the static output.
