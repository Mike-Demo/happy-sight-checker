import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { AuditResult } from "./audit-types";

const inputSchema = z.object({
  url: z.string().trim().min(1, "Enter a URL").max(2048),
});

const BLOCKED_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "metadata.google.internal"]);

const PRIVATE_HOST_PATTERN =
  /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|fe80:|fc00:|fd)/i;

function normaliseUrl(raw: string): string {
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error("That does not look like a valid web address.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https addresses can be audited.");
  }
  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host) || PRIVATE_HOST_PATTERN.test(host) || !host.includes(".")) {
    throw new Error("Only public websites can be audited.");
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

const MAX_HTML_BYTES = 4_000_000;

/**
 * Fetch a page through the Firecrawl connector and run the WCAG audit on it.
 * Firecrawl renders JavaScript before returning markup, so single-page apps
 * are audited as users actually receive them.
 */
export const auditUrl = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<AuditResult> => {
    const url = normaliseUrl(data.url);

    const lovableApiKey = process.env["LOVABLE_API_KEY"];
    const firecrawlKey = process.env["FIRECRAWL_API_KEY"];
    if (!lovableApiKey || !firecrawlKey) {
      throw new Error("Page fetching is not configured yet. Connect Firecrawl and try again.");
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
      throw new Error("Could not reach the page-fetching service. Try again in a moment.");
    }

    const bodyText = await response.text();
    if (!response.ok) {
      console.error(`Firecrawl scrape failed [${response.status}]: ${bodyText}`);
      if (response.status === 402) {
        throw new Error("The page-fetching service is out of credits for this workspace.");
      }
      if (response.status === 403 && bodyText.includes("Credit limit reached")) {
        throw new Error("A workspace credit limit stopped this request.");
      }
      throw new Error(`The page could not be fetched (status ${response.status}).`);
    }

    let payload: FirecrawlScrapeResponse;
    try {
      payload = JSON.parse(bodyText) as FirecrawlScrapeResponse;
    } catch {
      throw new Error("The page-fetching service returned an unreadable response.");
    }

    if (payload.success === false) {
      console.error(`Firecrawl reported failure: ${payload.error ?? "unknown"}`);
      throw new Error(payload.error ?? "The page could not be fetched.");
    }

    const document = payload.data ?? payload;
    const html = document.rawHtml ?? document.html;
    if (!html || html.trim().length === 0) {
      throw new Error("That page returned no HTML to audit.");
    }
    if (html.length > MAX_HTML_BYTES) {
      throw new Error("That page is too large to audit.");
    }

    const { auditHtml } = await import("./audit.server");
    return auditHtml(url, html);
  });
