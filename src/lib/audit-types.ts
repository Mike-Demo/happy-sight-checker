/**
 * Shared, client-safe types for the accessibility audit. No parser or
 * server-only imports here — the UI imports this module directly.
 */

export type Impact = "critical" | "serious" | "moderate" | "minor";

export type Principle = "perceivable" | "operable" | "understandable" | "robust";

export const PRINCIPLE_LABELS: Record<Principle, string> = {
  perceivable: "Perceivable",
  operable: "Operable",
  understandable: "Understandable",
  robust: "Robust",
};

/** Static description of a single WCAG check. */
export interface RuleMeta {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly howToFix: string;
  readonly impact: Impact;
  readonly principle: Principle;
  /** WCAG success criterion number, e.g. "1.1.1". */
  readonly criterion: string;
  readonly criterionName: string;
  readonly level: "A" | "AA";
  readonly helpUrl: string;
}

/** A rule outcome for the audited page. */
export interface Finding extends RuleMeta {
  readonly status: "violation" | "pass" | "incomplete" | "inapplicable";
  /** Truncated markup of each offending element. */
  readonly elements: readonly string[];
  /** Extra context, e.g. "3 of 12 images" or why a check needs review. */
  readonly detail?: string;
}

export interface AuditCounts {
  readonly violations: number;
  readonly passes: number;
  readonly incomplete: number;
  readonly inapplicable: number;
  readonly critical: number;
  readonly serious: number;
  readonly moderate: number;
  readonly minor: number;
}

export interface AuditResult {
  readonly url: string;
  readonly pageTitle: string;
  readonly fetchedAt: string;
  readonly score: number;
  readonly counts: AuditCounts;
  readonly findings: readonly Finding[];
}

export const IMPACT_ORDER: readonly Impact[] = ["critical", "serious", "moderate", "minor"];

export const IMPACT_VARIANT: Record<Impact, "danger" | "warning" | "neutral"> = {
  critical: "danger",
  serious: "danger",
  moderate: "warning",
  minor: "neutral",
};
