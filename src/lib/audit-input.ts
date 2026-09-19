import { z } from "zod";

/** Client-safe request shape for the audit endpoint. */
export const auditInputSchema = z.object({
  url: z.string().trim().min(1, "Enter a URL").max(2048),
});

export type AuditInput = z.infer<typeof auditInputSchema>;
