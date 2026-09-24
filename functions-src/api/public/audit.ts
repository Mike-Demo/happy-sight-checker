/**
 * Spacefast Functions version of the public audit endpoint.
 * Mirrors src/routes/api/public/audit.ts: same validation, errors and status
 * codes. Bundled by scripts/build-functions.mjs into dist/client/functions/.
 */
import { auditInputSchema } from "../../../src/lib/audit-input";
import { AuditRequestError, fetchAndAudit, type AuditEnv } from "../../../src/lib/audit-fetch.server";

interface FunctionContext {
  readonly env?: Record<string, string | undefined>;
}

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

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request, context: FunctionContext): Promise<Response> {
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

  const env: AuditEnv = { FIRECRAWL_API_KEY: context.env?.["FIRECRAWL_API_KEY"] };
  try {
    return json(await fetchAndAudit(parsed.data.url, env), 200);
  } catch (cause) {
    if (cause instanceof AuditRequestError) {
      return json({ error: cause.message }, cause.status);
    }
    console.error("Audit failed unexpectedly", cause);
    return json({ error: "The audit could not be completed. Try again." }, 500);
  }
}
