import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useRef, type FormEvent } from "react";

import { AppShell } from "@/components/AppShell";
import {
  WaButton,
  WaCallout,
  WaCard,
  WaDetails,
  WaIcon,
  WaInput,
  WaProgressRing,
  WaSpinner,
  WaTag,
} from "@/design-system/font-awsome-web-awesome-171158";
import { auditUrl } from "@/lib/audit.functions";
import {
  IMPACT_VARIANT,
  PRINCIPLE_LABELS,
  type AuditResult,
  type Finding,
  type Principle,
} from "@/lib/audit-types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WCAGify — Free WCAG accessibility checker" },
      {
        name: "description",
        content:
          "Paste any public web address and get a structured WCAG 2.2 accessibility report: violations by severity, the success criteria they break, and how to fix each one.",
      },
      { property: "og:title", content: "WCAGify — Free WCAG accessibility checker" },
      {
        property: "og:description",
        content:
          "Audit any public page against WCAG 2.2 level A and AA, grouped by the four accessibility principles.",
      },
    ],
  }),
  component: HomePage,
});

const PRINCIPLE_ORDER: readonly Principle[] = [
  "perceivable",
  "operable",
  "understandable",
  "robust",
];

function scoreVariant(score: number): "success" | "warning" | "danger" {
  if (score >= 90) return "success";
  if (score >= 70) return "warning";
  return "danger";
}

function FindingCard({ finding }: { finding: Finding }) {
  const isViolation = finding.status === "violation";
  return (
    <WaDetails summary={finding.title} appearance="outlined">
      <div className="wa-stack wa-gap-s">
        <div className="wa-cluster wa-gap-2xs">
          <WaTag variant={isViolation ? IMPACT_VARIANT[finding.impact] : "neutral"} size="s">
            {isViolation ? finding.impact : finding.status === "incomplete" ? "needs review" : "passed"}
          </WaTag>
          <WaTag variant="neutral" appearance="outlined" size="s">
            {`WCAG ${finding.criterion} ${finding.criterionName} (Level ${finding.level})`}
          </WaTag>
        </div>
        <p>{finding.description}</p>
        {finding.detail ? <p className="wa-body-s">{finding.detail}</p> : null}
        {isViolation || finding.status === "incomplete" ? (
          <p>
            <strong>How to fix: </strong>
            {finding.howToFix}
          </p>
        ) : null}
        {finding.elements.length > 0 ? (
          <div className="finding-elements">
            <strong>Affected elements</strong>
            {finding.elements.map((element, index) => (
              <code key={`${finding.id}-${String(index)}`}>{element}</code>
            ))}
          </div>
        ) : null}
        <a href={finding.helpUrl} target="_blank" rel="noreferrer noopener">
          Understanding this success criterion
        </a>
      </div>
    </WaDetails>
  );
}

function Report({ result }: { result: AuditResult }) {
  const { counts } = result;
  const shown = result.findings.filter(
    (finding) => finding.status === "violation" || finding.status === "incomplete",
  );
  const passed = result.findings.filter((finding) => finding.status === "pass");

  return (
    <div className="wa-stack wa-gap-l">
      <WaCard appearance="outlined">
        <div className="audit-summary">
          <WaProgressRing
            value={result.score}
            label={`Accessibility score ${String(result.score)} out of 100`}
          >
            {`${String(result.score)}%`}
          </WaProgressRing>
          <div className="wa-stack wa-gap-2xs">
            <strong>{result.pageTitle || result.url}</strong>
            <span className="wa-body-s">{result.url}</span>
            <div className="wa-cluster wa-gap-2xs">
              <WaTag variant={counts.violations > 0 ? "danger" : "success"} size="s">
                {`${String(counts.violations)} failing checks`}
              </WaTag>
              <WaTag variant="success" appearance="outlined" size="s">
                {`${String(counts.passes)} passing`}
              </WaTag>
              <WaTag variant="warning" appearance="outlined" size="s">
                {`${String(counts.incomplete)} needs review`}
              </WaTag>
            </div>
            <div className="wa-cluster wa-gap-2xs">
              <WaTag variant="danger" size="s">{`${String(counts.critical)} critical`}</WaTag>
              <WaTag variant="danger" appearance="outlined" size="s">
                {`${String(counts.serious)} serious`}
              </WaTag>
              <WaTag variant="warning" appearance="outlined" size="s">
                {`${String(counts.moderate)} moderate`}
              </WaTag>
              <WaTag variant="neutral" appearance="outlined" size="s">
                {`${String(counts.minor)} minor`}
              </WaTag>
            </div>
          </div>
        </div>
      </WaCard>

      {PRINCIPLE_ORDER.map((principle) => {
        const items = shown.filter((finding) => finding.principle === principle);
        if (items.length === 0) return null;
        return (
          <section key={principle} className="wa-stack wa-gap-s">
            <h2>{PRINCIPLE_LABELS[principle]}</h2>
            {items.map((finding) => (
              <FindingCard key={finding.id} finding={finding} />
            ))}
          </section>
        );
      })}

      {shown.length === 0 ? (
        <WaCallout variant="success">
          <WaIcon slot="icon" name="circle-check" />
          No failing checks found in the page markup.
        </WaCallout>
      ) : null}

      {passed.length > 0 ? (
        <WaDetails summary={`Passed checks (${String(passed.length)})`} appearance="plain">
          <div className="wa-stack wa-gap-s">
            {passed.map((finding) => (
              <FindingCard key={finding.id} finding={finding} />
            ))}
          </div>
        </WaDetails>
      ) : null}
    </div>
  );
}

function HomePage() {
  // Web Awesome form controls emit their own DOM events, so the field is read
  // from the element on submit rather than mirrored into React state.
  const inputRef = useRef<HTMLElement & { value?: string }>(null);
  const runAudit = useServerFn(auditUrl);

  const mutation = useMutation({
    mutationFn: (target: string) => runAudit({ data: { url: target } }),
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const value = (inputRef.current?.value ?? "").trim();
    if (value.length === 0) return;
    mutation.mutate(value);
  };


  return (
    <AppShell>
      <div className="page-container wa-stack wa-gap-xl">
        <header className="wa-stack wa-gap-s">
          <h1>WCAGify</h1>
          <p>
            Paste a public web address and get a WCAG 2.2 level A and AA report: what fails, which
            success criterion it breaks, and how to fix it. Nothing is stored.
          </p>
        </header>

        <form className="audit-form" onSubmit={handleSubmit}>
          <WaInput
            ref={inputRef}
            label="Website address"
            hint="For example: example.com/pricing"
            type="url"
            placeholder="https://example.com"
            name="url"
            required
          />

          <WaButton type="submit" variant="brand" size="l" disabled={mutation.isPending}>
            <WaIcon slot="start" name="universal-access" />
            {mutation.isPending ? "Auditing…" : "Run audit"}
          </WaButton>
        </form>

        {mutation.isPending ? (
          <div className="wa-cluster wa-gap-s wa-align-items-center">
            <WaSpinner />
            <span>Fetching and checking the page. This usually takes a few seconds.</span>
          </div>
        ) : null}

        {mutation.isError ? (
          <WaCallout variant="danger">
            <WaIcon slot="icon" name="triangle-exclamation" />
            {mutation.error instanceof Error
              ? mutation.error.message
              : "Something went wrong running the audit."}
          </WaCallout>
        ) : null}

        {mutation.isSuccess ? <Report result={mutation.data} /> : null}

        <WaCallout variant="neutral">
          <WaIcon slot="icon" name="circle-info" />
          Automated checks cover what is decidable from the page markup. Colour contrast, focus
          visibility, and keyboard flows still need a human review.
        </WaCallout>
      </div>
    </AppShell>
  );
}
