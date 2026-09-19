# Accessibility Tester (WCAGify-inspired)

## Context

WCAGify (focusring/WCAGify) is a Nuxt layer that renders WCAG checklist
markdown as navigable report pages — it does not actually scan or test a
website. Since this project is TanStack Start (not Nuxt), a literal fork
cannot be installed here. Instead we build the same idea natively: a page
where you paste a URL, the app fetches and audits that page's HTML against
WCAG rules, and shows a structured, WCAGify-style report. No database.

## What you'll get

- A home page with a URL input and "Run audit" button.
- A server-side audit that fetches the page's HTML through the Firecrawl
  connector and runs accessibility checks (powered by axe-core, the
  industry-standard WCAG engine, run against the fetched HTML with jsdom).
- A results report grouped by WCAG principle (Perceivable, Operable,
  Understandable, Robust) with:
  - Score summary (passes / violations / incomplete, by impact: critical,
    serious, moderate, minor)
  - Each violation: rule, WCAG criterion reference, impact, affected
    elements, and how to fix
  - Passes list, collapsible
- Loading and error states (invalid URL, unreachable site, blocked fetch).
- Results live in page state only — nothing is stored.

## Technical details

- Page fetching: Firecrawl connector (Firebase has no page-fetching service;
  its only connector here sends push notifications). Firecrawl is purpose-built
  for this — it renders JavaScript-heavy pages and returns full HTML, which a
  plain fetch cannot do. You'll get a connect card to link it.
- New server function `src/lib/audit.functions.ts`: validates the URL
  (http/https only), requests the rendered HTML from Firecrawl, runs
  `axe-core` inside `jsdom` on the server, and returns a trimmed JSON result
  (rule id, impact, WCAG tags, help URL, failing node snippets). Capped
  response size; private/internal hosts rejected.
- Rewrite `src/routes/index.tsx`: audit form + report UI using the attached
  Web Awesome design system (`WaInput`, `WaButton`, `WaCard`, `WaTag`,
  `WaAccordion`, `WaProgressBar`), with `WebAwesomeLoader` mounted on the
  route.
- Per-route `head()` metadata for the index page (title/description/og).
- Dependencies: `axe-core`, `jsdom` (both server-side only, imported inside
  the function handler so nothing heavy ships to the browser).

## Verification

- Typecheck/build passes.
- Run a real audit against a public site (e.g. example.com and a page with
  known issues) and confirm violations render correctly in the report.
