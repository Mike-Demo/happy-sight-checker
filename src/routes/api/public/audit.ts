import { createFileRoute } from "@tanstack/react-router";

import { auditInputSchema } from "@/lib/audit-input";

/**
 * Public audit endpoint. The statically hosted site calls this cross-origin,
 * so every response carries permissive CORS headers. No user data is read or
 * stored; the only input is a public web address.
 */
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS_HEADERS },
  });
}

export const Route = createFileRoute("/api/public/audit")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return json({ error: "Send a JSON body with a url field." }, 400);
        }

        const parsed = auditInputSchema.safeParse(raw);
        if (!parsed.success) {
          return json({ error: "Enter a web address to audit." }, 400);
        }

        const { fetchAndAudit, AuditRequestError } = await import("@/lib/audit-fetch.server");
        try {
          return json(await fetchAndAudit(parsed.data.url), 200);
        } catch (cause) {
          if (cause instanceof AuditRequestError) {
            return json({ error: cause.message }, cause.status);
          }
          console.error("Audit failed unexpectedly", cause);
          return json({ error: "The audit could not be completed. Try again." }, 500);
        }
      },
    },
  },
});
