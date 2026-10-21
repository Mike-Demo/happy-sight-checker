# Security audit triage — 2026-10-21

## Prioritization

The audit reports **0 confirmed findings**, **4 needs-validation leads**, and **0 rejected candidates**. There are no confirmed findings to rank or create remediation issues for. The four leads remain unranked because their severity depends on the exact missing facts below; assigning severity before validation would overstate the audit results.

## Issue to file

**Title:** `[security][needs-validation] Audit leads to validate`

**Parent issue:** [Mike-Demo/happy-sight-checker#2](https://github.com/Mike-Demo/happy-sight-checker/issues/2)

**Body:**

Related to #2. This checklist tracks the audit leads that need deployment- or execution-dependent validation. These are not confirmed findings and have no assigned severity.

- [ ] **Component preview accepts rendering-driving postMessage props from any parent origin (no event.origin check)**
  - Fingerprint: `preview-postmessage-props-no-origin-check`
  - Claimed root cause: The message listener in `src/routes/[__component].preview.$.tsx` verifies `event.source === parent` but does not verify `event.origin` against trusted editor origins before accepting `DS_SPECIMEN_PROPS` props, and outbound preview messages use targetOrigin `*`.
  - Exact missing fact: Whether the deployed Lovable preview deployment (a hostname satisfying isLovablePreviewHost) sends framing headers (frame-ancestors / X-Frame-Options) or is otherwise framable by an arbitrary origin, and whether any component in the build-generated mockup-components set renders a specimen prop into a dangerous sink (href/src/HTML).

- [ ] **SSRF guard in normaliseUrl is bypassed by trailing-dot and *.localhost hostname forms**
  - Fingerprint: `ssrf-localhost-name-forms-bypass-normalise-url`
  - Claimed root cause: `normaliseUrl` in `src/lib/audit-fetch.server.ts` compares the raw parsed hostname against an exact-match blocklist and a private-IP pattern without canonicalising trailing-dot or `*.localhost` name forms first.
  - Exact missing fact: Whether Firecrawl's resolver/scrape service (api.firecrawl.dev/v2/scrape and the Lovable connector gateway) resolves 'localhost.', '*.localhost' and 'metadata.google.internal.' to loopback/metadata targets and fetches them, or instead blocks non-public destinations itself.

- [ ] **Public-only fetch control never resolves DNS or re-validates redirects, so a public name/redirect can reach private addresses**
  - Fingerprint: `ssrf-no-dns-or-redirect-revalidation`
  - Claimed root cause: The public-only control in `src/lib/audit-fetch.server.ts` is purely lexical: it checks the initially parsed hostname string with no DNS resolution, address pinning, or redirect/effective-URL re-validation before delegating the fetch to Firecrawl.
  - Exact missing fact: Firecrawl's behaviour for (a) a hostname whose A/AAAA answers are private/loopback/link-local (including short-TTL/rebinding records) and (b) an HTTP redirect from a public URL to a private/loopback/link-local URL - does it fetch, block, or re-validate?

- [ ] **Unauthenticated, unthrottled audit endpoint spends the operator's paid Firecrawl credits on every request**
  - Fingerprint: `unauthenticated-paid-firecrawl-quota-exhaustion`
  - Claimed root cause: Both endpoint copies call `fetchAndAudit` (and thus a paid Firecrawl scrape) for every unauthenticated request with no source-visible rate limiting, bot gating, caching, or concurrency cap in front of the paid call.
  - Exact missing fact: The deployed rate-limit/WAF/bot-gate configuration (if any) in front of `/api/public/audit` on the SpaceFast space 'a11y' and on the Lovable/Cloudflare Worker deployment, plus any Firecrawl account-level rate/quota cap that would throttle anonymous callers.
