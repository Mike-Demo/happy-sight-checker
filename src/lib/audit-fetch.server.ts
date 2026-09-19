/**
 * Server-only page fetching + audit orchestration.
 *
 * Kept separate from the HTTP layer so both the public API route and any
 * future server caller share one implementation.
 */
import type { AuditResult } from "./audit-types";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
]);

const PRIVATE_HOST_PATTERN =
  /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|fe80:|fc00:|fd)/i;

const MAX_HTML_BYTES = 4_000_000;

/** Thrown for problems that are safe to show the visitor verbatim. */
export class AuditRequestError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AuditRequestError";
    this.status = status;
  }
}

export function normaliseUrl(raw: string): string {
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new AuditRequestError("That does not look like a valid web address.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AuditRequestError("Only http and https addresses can be audited.");
  }
  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host) || PRIVATE_HOST_PATTERN.test(host) || !host.includes(".")) {
    throw new AuditRequestError("Only public websites can be audited.");
  }
  return parsed.toString();
}

interface FirecrawlDocument {
  readonly rawHtml?: string;
  readonly html?: string;
  readonly metadata?: { readonly statusCode?: number; readonly title?: string };
}

interface FirecrawlScrapeResponse extends FirecrawlDocument {
  readonly success?: boolean;
  readonly error?: string;
  readonly data?: FirecrawlDocument;
}

/**
 * Fetch a page through the Firecrawl connector and run the WCAG audit on it.
 * Firecrawl renders JavaScript before returning markup, so single-page apps
 * are audited as users actually receive them.
 */
export async function fetchAndAudit(rawUrl: string): Promise<AuditResult> {
  const url = normaliseUrl(rawUrl);

  const lovableApiKey = process.env["LOVABLE_API_KEY"];
  const firecrawlKey = process.env["FIRECRAWL_API_KEY"];
  if (!lovableApiKey || !firecrawlKey) {
    throw new AuditRequestError(
      "Page fetching is not configured yet. Connect Firecrawl and try again.",
      503,
    );
  }

  let response: Response;
  try {
    response = await fetch("https://connector-gateway.lovable.dev/firecrawl/v2/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
        "X-Connection-Api-Key": firecrawlKey,
      },
      body: JSON.stringify({
        url,
        formats: ["rawHtml"],
        onlyMainContent: false,
        waitFor: 1500,
        timeout: 45000,
        blockAds: false,
        removeBase64Images: true,
      }),
    });
  } catch (cause) {
    console.error("Firecrawl request failed to send", cause);
    throw new AuditRequestError(
      "Could not reach the page-fetching service. Try again in a moment.",
      502,
    );
  }

  const bodyText = await response.text();
  if (!response.ok) {
    console.error(`Firecrawl scrape failed [${response.status}]: ${bodyText}`);
    if (response.status === 402) {
      throw new AuditRequestError(
        "The page-fetching service is out of credits for this workspace.",
        502,
      );
    }
    if (response.status === 403 && bodyText.includes("Credit limit reached")) {
      throw new AuditRequestError("A workspace credit limit stopped this request.", 502);
    }
    throw new AuditRequestError(`The page could not be fetched (status ${response.status}).`, 502);
  }

  let payload: FirecrawlScrapeResponse;
  try {
    payload = JSON.parse(bodyText) as FirecrawlScrapeResponse;
  } catch {
    throw new AuditRequestError(
      "The page-fetching service returned an unreadable response.",
      502,
    );
  }

  if (payload.success === false) {
    console.error(`Firecrawl reported failure: ${payload.error ?? "unknown"}`);
    throw new AuditRequestError(payload.error ?? "The page could not be fetched.", 502);
  }

  const document = payload.data ?? payload;
  const html = document.rawHtml ?? document.html;
  if (!html || html.trim().length === 0) {
    throw new AuditRequestError("That page returned no HTML to audit.");
  }
  if (html.length > MAX_HTML_BYTES) {
    throw new AuditRequestError("That page is too large to audit.");
  }

  const { auditHtml } = await import("./audit.server");
  return auditHtml(url, html);
}
