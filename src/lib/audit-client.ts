import type { AuditResult } from "./audit-types";

/**
 * Browser-side access to the audit endpoint. On the statically hosted site the
 * endpoint lives on another origin, supplied at build time; inside the Lovable
 * app the relative path resolves to the app's own server route.
 */
const API_BASE = (import.meta.env.VITE_AUDIT_API_BASE ?? "").replace(/\/+$/, "");

export const AUDIT_ENDPOINT = `${API_BASE}/api/public/audit`;

export async function requestAudit(url: string): Promise<AuditResult> {
  let response: Response;
  try {
    response = await fetch(AUDIT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
  } catch {
    throw new Error("Could not reach the audit service. Check your connection and try again.");
  }

  const payload = (await response.json().catch(() => null)) as
    | (AuditResult & { error?: string })
    | null;

  if (!response.ok || !payload) {
    throw new Error(payload?.error ?? "The audit could not be completed. Try again.");
  }

  return payload;
}
