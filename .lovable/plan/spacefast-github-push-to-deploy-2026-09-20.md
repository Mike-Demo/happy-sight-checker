# Spacefast GitHub push-to-deploy

## Goal

Make the existing Lovable → GitHub sync trigger Spacefast builds automatically: pushes to `main` on `Mike-Demo/happy-sight-checker` should build this project and publish the static site to the Spacefast space `a11y` (`a11y.view.fast`).

## Changes

1. Add a root `sf.jsonc` so Spacefast knows which space and build settings to use:
   - Space: `a11y`
   - Install command: `bun install`
   - Build command: `STATIC_EXPORT=1 vite build && node scripts/copy-static-output.mjs`
   - Output directory: `dist/client`
   - Static fallback: `index.html` with status `200`
   - Site metadata for the A11Y checker

2. Update `SPACEFAST.md` with the GitHub push flow:
   - Lovable syncs edits to `Mike-Demo/happy-sight-checker`.
   - Spacefast's GitHub app watches `main` and runs the build from `sf.jsonc`.
   - No GitHub Actions workflow is needed.
   - No Spacefast API key is stored in GitHub.

3. Document the two one-time setup commands you run after connecting Spacefast and GitHub:

```bash
sf env set VITE_AUDIT_API_BASE "https://happy-sight-checker.lovable.app" --no-secret
sf git connect --space a11y --provider github --repository Mike-Demo/happy-sight-checker --production-branch main --sync
```

The first command keeps the audit form working by pointing the static site at the Lovable-hosted audit endpoint. The second connects the GitHub repository to Spacefast and starts the initial sync.

4. Leave the current prerender setup, static build script, sitemap, robots file, and redirect fallback unchanged.

## Verification

- Validate that `sf.jsonc` parses correctly.
- Run the TypeScript check.
- Run the static build and confirm `dist/client/index.html`, `dist/client/licenses/index.html`, `sitemap.xml`, `robots.txt`, and `_redirects` are produced.
- Confirm the documentation contains the exact one-time Spacefast connection steps.

## Outside this project

I will not perform the Spacefast login, GitHub app installation, or repository authorization. Those require your account approval. Until those are completed and a push reaches `main`, I can verify the local static build but cannot verify Spacefast's webhook build end to end.
