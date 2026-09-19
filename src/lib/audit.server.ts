/**
 * Static WCAG 2.2 A/AA audit engine.
 *
 * Runs against fetched HTML with a Worker-safe parser (no jsdom, no browser
 * layout), so it covers criteria that are decidable from markup alone.
 * Criteria that need rendering (colour contrast, focus visibility, reflow)
 * are reported as "incomplete" so they are never silently claimed as passing.
 */
import { parse, type HTMLElement } from "node-html-parser";

import {
  IMPACT_ORDER,
  type AuditCounts,
  type AuditResult,
  type Finding,
  type Impact,
  type RuleMeta,
} from "./audit-types";

const MAX_ELEMENTS_PER_RULE = 8;
const SNIPPET_LENGTH = 220;

function snippet(element: HTMLElement): string {
  const markup = element.outerHTML.replace(/\s+/g, " ").trim();
  return markup.length > SNIPPET_LENGTH ? `${markup.slice(0, SNIPPET_LENGTH)}…` : markup;
}

function attr(element: HTMLElement, name: string): string | undefined {
  const value = element.getAttribute(name);
  return value === undefined || value === null ? undefined : value;
}

function hasText(element: HTMLElement): boolean {
  return element.textContent.replace(/\s+/g, "").length > 0;
}

/** Accessible name from text content, aria-label, aria-labelledby, or a nested image alt. */
function hasAccessibleName(element: HTMLElement, root: HTMLElement): boolean {
  if (hasText(element)) return true;
  if ((attr(element, "aria-label") ?? "").trim().length > 0) return true;
  if ((attr(element, "title") ?? "").trim().length > 0) return true;

  const labelledBy = attr(element, "aria-labelledby");
  if (labelledBy) {
    const referenced = labelledBy
      .split(/\s+/)
      .filter(Boolean)
      .some((id) => root.querySelector(`[id="${id}"]`) !== null);
    if (referenced) return true;
  }

  const media = element.querySelectorAll("img, svg, wa-icon");
  return media.some(
    (node) =>
      (attr(node, "alt") ?? "").trim().length > 0 ||
      (attr(node, "aria-label") ?? "").trim().length > 0 ||
      (attr(node, "label") ?? "").trim().length > 0,
  );
}

function isHidden(element: HTMLElement): boolean {
  if (attr(element, "hidden") !== undefined) return true;
  if (attr(element, "aria-hidden") === "true") return true;
  const style = (attr(element, "style") ?? "").replace(/\s+/g, "").toLowerCase();
  return style.includes("display:none") || style.includes("visibility:hidden");
}

const RULES: readonly RuleMeta[] = [
  {
    id: "image-alt",
    title: "Images have alternative text",
    description: "Every <img> needs an alt attribute. Decorative images use alt=\"\".",
    howToFix: "Add alt text describing the image's purpose, or alt=\"\" if it is purely decorative.",
    impact: "critical",
    principle: "perceivable",
    criterion: "1.1.1",
    criterionName: "Non-text Content",
    level: "A",
    helpUrl: "https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html",
  },
  {
    id: "input-image-alt",
    title: "Image buttons have alternative text",
    description: "<input type=\"image\"> acts as a button and needs alt text.",
    howToFix: "Add an alt attribute describing the action the button performs.",
    impact: "critical",
    principle: "perceivable",
    criterion: "1.1.1",
    criterionName: "Non-text Content",
    level: "A",
    helpUrl: "https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html",
  },
  {
    id: "media-captions",
    title: "Video and audio provide captions",
    description: "Media elements need a captions track for deaf and hard-of-hearing users.",
    howToFix: "Add <track kind=\"captions\" srclang=\"…\" src=\"…\"> inside the media element.",
    impact: "serious",
    principle: "perceivable",
    criterion: "1.2.2",
    criterionName: "Captions (Prerecorded)",
    level: "A",
    helpUrl: "https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html",
  },
  {
    id: "heading-order",
    title: "Heading levels are not skipped",
    description: "Headings should descend one level at a time so structure stays predictable.",
    howToFix: "Replace the skipped heading with the next level down, or restructure the section.",
    impact: "moderate",
    principle: "perceivable",
    criterion: "1.3.1",
    criterionName: "Info and Relationships",
    level: "A",
    helpUrl: "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html",
  },
  {
    id: "page-has-h1",
    title: "Page has a level-one heading",
    description: "A single <h1> tells screen reader users what the page is about.",
    howToFix: "Add one <h1> containing the page's main title.",
    impact: "moderate",
    principle: "perceivable",
    criterion: "1.3.1",
    criterionName: "Info and Relationships",
    level: "A",
    helpUrl: "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html",
  },
  {
    id: "empty-heading",
    title: "Headings are not empty",
    description: "An empty heading announces nothing and breaks document outline navigation.",
    howToFix: "Add text to the heading, or remove it if it is used only for spacing.",
    impact: "minor",
    principle: "perceivable",
    criterion: "1.3.1",
    criterionName: "Info and Relationships",
    level: "A",
    helpUrl: "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html",
  },
  {
    id: "list-structure",
    title: "Lists contain only list items",
    description: "<ul> and <ol> must contain <li> elements (optionally wrapped in script/template).",
    howToFix: "Move non-<li> children inside an <li>, or use a different container element.",
    impact: "moderate",
    principle: "perceivable",
    criterion: "1.3.1",
    criterionName: "Info and Relationships",
    level: "A",
    helpUrl: "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html",
  },
  {
    id: "table-headers",
    title: "Data tables have header cells",
    description: "Tables presenting data need <th> cells so rows and columns can be announced.",
    howToFix: "Mark the header row or column with <th> and add scope=\"col\" or scope=\"row\".",
    impact: "moderate",
    principle: "perceivable",
    criterion: "1.3.1",
    criterionName: "Info and Relationships",
    level: "A",
    helpUrl: "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html",
  },
  {
    id: "label-for-valid",
    title: "Labels reference an existing field",
    description: "A <label for=\"…\"> pointing at a missing id labels nothing.",
    howToFix: "Match the for attribute to the id of its form control.",
    impact: "serious",
    principle: "perceivable",
    criterion: "1.3.1",
    criterionName: "Info and Relationships",
    level: "A",
    helpUrl: "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html",
  },
  {
    id: "meta-viewport-zoom",
    title: "Zooming is not disabled",
    description: "user-scalable=no or maximum-scale below 2 prevents users from enlarging text.",
    howToFix: "Remove user-scalable=no and allow maximum-scale of at least 5 in the viewport meta tag.",
    impact: "critical",
    principle: "perceivable",
    criterion: "1.4.4",
    criterionName: "Resize Text",
    level: "AA",
    helpUrl: "https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html",
  },
  {
    id: "colour-contrast",
    title: "Text colour contrast",
    description: "Contrast depends on rendered colours, which a markup-level audit cannot measure.",
    howToFix: "Check text against its background with a contrast tool: 4.5:1 for body text, 3:1 for large text.",
    impact: "serious",
    principle: "perceivable",
    criterion: "1.4.3",
    criterionName: "Contrast (Minimum)",
    level: "AA",
    helpUrl: "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html",
  },
  {
    id: "bypass-blocks",
    title: "Page offers a way to skip to content",
    description: "Landmark regions or a skip link let keyboard users bypass repeated navigation.",
    howToFix: "Add a <main> landmark and a skip link as the first focusable element.",
    impact: "serious",
    principle: "operable",
    criterion: "2.4.1",
    criterionName: "Bypass Blocks",
    level: "A",
    helpUrl: "https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html",
  },
  {
    id: "document-title",
    title: "Page has a descriptive title",
    description: "The <title> is the first thing a screen reader announces.",
    howToFix: "Add a non-empty <title> describing the page's topic or purpose.",
    impact: "serious",
    principle: "operable",
    criterion: "2.4.2",
    criterionName: "Page Titled",
    level: "A",
    helpUrl: "https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html",
  },
  {
    id: "tabindex-positive",
    title: "No positive tabindex values",
    description: "A positive tabindex forces an order that diverges from the visual reading order.",
    howToFix: "Use tabindex=\"0\" and order elements in the DOM the way they should be read.",
    impact: "moderate",
    principle: "operable",
    criterion: "2.4.3",
    criterionName: "Focus Order",
    level: "A",
    helpUrl: "https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html",
  },
  {
    id: "link-name",
    title: "Links have discernible text",
    description: "A link with no text, label, or image alt is announced only as \"link\".",
    howToFix: "Add link text, or an aria-label describing where the link goes.",
    impact: "serious",
    principle: "operable",
    criterion: "2.4.4",
    criterionName: "Link Purpose (In Context)",
    level: "A",
    helpUrl: "https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html",
  },
  {
    id: "frame-title",
    title: "Frames have a title",
    description: "Each <iframe> needs a title so users know what it embeds.",
    howToFix: "Add a title attribute describing the framed content.",
    impact: "serious",
    principle: "operable",
    criterion: "2.4.1",
    criterionName: "Bypass Blocks",
    level: "A",
    helpUrl: "https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html",
  },
  {
    id: "html-has-lang",
    title: "Page language is declared",
    description: "<html lang=\"…\"> tells screen readers which pronunciation rules to use.",
    howToFix: "Add a valid lang attribute to the <html> element, e.g. lang=\"en\".",
    impact: "serious",
    principle: "understandable",
    criterion: "3.1.1",
    criterionName: "Language of Page",
    level: "A",
    helpUrl: "https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html",
  },
  {
    id: "input-label",
    title: "Form fields have labels",
    description: "Every field needs a programmatic label, not just a visual placeholder.",
    howToFix: "Associate a <label for=\"…\">, or add aria-label / aria-labelledby to the field.",
    impact: "critical",
    principle: "understandable",
    criterion: "3.3.2",
    criterionName: "Labels or Instructions",
    level: "A",
    helpUrl: "https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html",
  },
  {
    id: "duplicate-id",
    title: "Element ids are unique",
    description: "Duplicate ids break label, aria-labelledby, and aria-describedby references.",
    howToFix: "Give each element a unique id.",
    impact: "minor",
    principle: "robust",
    criterion: "4.1.1",
    criterionName: "Parsing",
    level: "A",
    helpUrl: "https://www.w3.org/WAI/WCAG22/Understanding/parsing.html",
  },
  {
    id: "button-name",
    title: "Buttons have an accessible name",
    description: "Icon-only buttons with no label are announced only as \"button\".",
    howToFix: "Add button text, or an aria-label naming the action.",
    impact: "critical",
    principle: "robust",
    criterion: "4.1.2",
    criterionName: "Name, Role, Value",
    level: "A",
    helpUrl: "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html",
  },
  {
    id: "aria-hidden-focus",
    title: "Hidden regions contain no focusable elements",
    description: "aria-hidden=\"true\" around focusable content creates unannounced tab stops.",
    howToFix: "Remove aria-hidden, or make the content unfocusable with inert / tabindex=\"-1\".",
    impact: "serious",
    principle: "robust",
    criterion: "4.1.2",
    criterionName: "Name, Role, Value",
    level: "A",
    helpUrl: "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html",
  },
  {
    id: "aria-role-valid",
    title: "ARIA roles are valid",
    description: "An unrecognised role value is ignored, leaving the element with no role.",
    howToFix: "Use a role from the ARIA specification, or remove the attribute.",
    impact: "serious",
    principle: "robust",
    criterion: "4.1.2",
    criterionName: "Name, Role, Value",
    level: "A",
    helpUrl: "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html",
  },
];

const RULE_BY_ID = new Map(RULES.map((rule) => [rule.id, rule]));

const VALID_ROLES = new Set([
  "alert","alertdialog","application","article","banner","blockquote","button","caption","cell",
  "checkbox","code","columnheader","combobox","complementary","contentinfo","definition","deletion",
  "dialog","directory","document","emphasis","feed","figure","form","generic","grid","gridcell",
  "group","heading","img","insertion","link","list","listbox","listitem","log","main","marquee",
  "math","menu","menubar","menuitem","menuitemcheckbox","menuitemradio","meter","navigation","none",
  "note","option","paragraph","presentation","progressbar","radio","radiogroup","region","row",
  "rowgroup","rowheader","scrollbar","search","searchbox","separator","slider","spinbutton","status",
  "strong","subscript","superscript","switch","tab","table","tablist","tabpanel","term","textbox",
  "time","timer","toolbar","tooltip","tree","treegrid","treeitem",
]);

const FOCUSABLE_SELECTOR = "a[href], button, input, select, textarea, iframe, [tabindex]";

interface RuleOutcome {
  readonly ruleId: string;
  readonly status: Finding["status"];
  readonly elements?: readonly HTMLElement[];
  readonly detail?: string;
}

function verdict(
  ruleId: string,
  offenders: readonly HTMLElement[],
  applicable: boolean,
  detail?: string,
): RuleOutcome {
  if (!applicable) return { ruleId, status: "inapplicable", detail };
  return offenders.length > 0
    ? { ruleId, status: "violation", elements: offenders, detail }
    : { ruleId, status: "pass", detail };
}

function runRules(root: HTMLElement): RuleOutcome[] {
  const outcomes: RuleOutcome[] = [];

  // 1.1.1 images
  const images = root.querySelectorAll("img");
  outcomes.push(
    verdict(
      "image-alt",
      images.filter((img) => attr(img, "alt") === undefined && attr(img, "role") !== "presentation"),
      images.length > 0,
      `${images.length} image${images.length === 1 ? "" : "s"} checked`,
    ),
  );

  const imageInputs = root.querySelectorAll("input").filter((i) => attr(i, "type") === "image");
  outcomes.push(
    verdict(
      "input-image-alt",
      imageInputs.filter((i) => (attr(i, "alt") ?? "").trim().length === 0),
      imageInputs.length > 0,
    ),
  );

  // 1.2.2 media captions
  const media = [...root.querySelectorAll("video"), ...root.querySelectorAll("audio")];
  outcomes.push(
    verdict(
      "media-captions",
      media.filter(
        (node) =>
          !node
            .querySelectorAll("track")
            .some((track) => ["captions", "subtitles"].includes(attr(track, "kind") ?? "")),
      ),
      media.length > 0,
    ),
  );

  // 1.3.1 headings
  const headings = ["h1", "h2", "h3", "h4", "h5", "h6"].flatMap((tag) => root.querySelectorAll(tag));
  const orderedHeadings = headings.slice().sort((a, b) => a.range[0] - b.range[0]);
  const skipped: HTMLElement[] = [];
  let previousLevel = 0;
  for (const heading of orderedHeadings) {
    const level = Number(heading.tagName.slice(1));
    if (previousLevel > 0 && level > previousLevel + 1) skipped.push(heading);
    previousLevel = level;
  }
  outcomes.push(verdict("heading-order", skipped, orderedHeadings.length > 0));
  outcomes.push(
    verdict(
      "page-has-h1",
      root.querySelectorAll("h1").length === 0 ? [root] : [],
      orderedHeadings.length > 0,
      root.querySelectorAll("h1").length > 1 ? "More than one <h1> found" : undefined,
    ),
  );
  outcomes.push(
    verdict(
      "empty-heading",
      orderedHeadings.filter((h) => !hasText(h) && !hasAccessibleName(h, root)),
      orderedHeadings.length > 0,
    ),
  );

  // 1.3.1 lists
  const lists = [...root.querySelectorAll("ul"), ...root.querySelectorAll("ol")];
  const allowedListChildren = new Set(["LI", "SCRIPT", "TEMPLATE"]);
  outcomes.push(
    verdict(
      "list-structure",
      lists.filter((list) =>
        list.childNodes
          .filter((node): node is HTMLElement => node instanceof Object && "tagName" in node)
          .some((child) => child.tagName !== null && !allowedListChildren.has(child.tagName)),
      ),
      lists.length > 0,
    ),
  );

  // 1.3.1 tables
  const tables = root.querySelectorAll("table").filter((t) => attr(t, "role") !== "presentation");
  outcomes.push(
    verdict(
      "table-headers",
      tables.filter((table) => table.querySelectorAll("th").length === 0),
      tables.length > 0,
    ),
  );

  // 1.3.1 label/for
  const labels = root.querySelectorAll("label").filter((l) => attr(l, "for") !== undefined);
  outcomes.push(
    verdict(
      "label-for-valid",
      labels.filter((label) => root.querySelector(`[id="${attr(label, "for")}"]`) === null),
      labels.length > 0,
    ),
  );

  // 1.4.4 viewport zoom
  const viewport = root
    .querySelectorAll("meta")
    .find((meta) => (attr(meta, "name") ?? "").toLowerCase() === "viewport");
  const viewportContent = (attr(viewport ?? root, "content") ?? "").toLowerCase();
  const maxScaleMatch = /maximum-scale\s*=\s*([\d.]+)/.exec(viewportContent);
  const blocksZoom =
    viewport !== undefined &&
    (viewportContent.includes("user-scalable=no") ||
      viewportContent.includes("user-scalable=0") ||
      (maxScaleMatch !== null && Number(maxScaleMatch[1]) < 2));
  outcomes.push(verdict("meta-viewport-zoom", blocksZoom && viewport ? [viewport] : [], true));

  // 1.4.3 contrast — needs rendering
  outcomes.push({
    ruleId: "colour-contrast",
    status: "incomplete",
    detail: "Requires rendered colours; review manually or with a browser extension.",
  });

  // 2.4.1 bypass blocks
  const hasMain = root.querySelectorAll("main").length > 0 || root.querySelector("[role=\"main\"]") !== null;
  const hasSkipLink = root
    .querySelectorAll("a")
    .some((a) => (attr(a, "href") ?? "").startsWith("#") && /skip|jump/i.test(a.textContent));
  outcomes.push(verdict("bypass-blocks", hasMain || hasSkipLink ? [] : [root], true));

  // 2.4.2 title
  const title = root.querySelector("title");
  outcomes.push(verdict("document-title", title && hasText(title) ? [] : [root], true));

  // 2.4.3 focus order
  outcomes.push(
    verdict(
      "tabindex-positive",
      root.querySelectorAll("[tabindex]").filter((el) => Number(attr(el, "tabindex")) > 0),
      true,
    ),
  );

  // 2.4.4 link purpose
  const links = root.querySelectorAll("a").filter((a) => attr(a, "href") !== undefined && !isHidden(a));
  outcomes.push(
    verdict(
      "link-name",
      links.filter((a) => !hasAccessibleName(a, root)),
      links.length > 0,
      `${links.length} link${links.length === 1 ? "" : "s"} checked`,
    ),
  );

  // frames
  const frames = root.querySelectorAll("iframe");
  outcomes.push(
    verdict(
      "frame-title",
      frames.filter(
        (f) => (attr(f, "title") ?? "").trim().length === 0 && attr(f, "aria-hidden") !== "true",
      ),
      frames.length > 0,
    ),
  );

  // 3.1.1 language
  const html = root.querySelector("html");
  const lang = (attr(html ?? root, "lang") ?? "").trim();
  outcomes.push(verdict("html-has-lang", lang.length > 0 ? [] : [html ?? root], true));

  // 3.3.2 field labels
  const fields = [
    ...root.querySelectorAll("input").filter((i) => {
      const type = (attr(i, "type") ?? "text").toLowerCase();
      return !["hidden", "submit", "button", "reset", "image"].includes(type);
    }),
    ...root.querySelectorAll("select"),
    ...root.querySelectorAll("textarea"),
  ].filter((field) => !isHidden(field));
  const labelTargets = new Set(
    root
      .querySelectorAll("label")
      .map((l) => attr(l, "for"))
      .filter((v): v is string => typeof v === "string"),
  );
  outcomes.push(
    verdict(
      "input-label",
      fields.filter((field) => {
        const id = attr(field, "id");
        if (id !== undefined && labelTargets.has(id)) return false;
        if ((attr(field, "aria-label") ?? "").trim().length > 0) return false;
        if ((attr(field, "aria-labelledby") ?? "").trim().length > 0) return false;
        if ((attr(field, "title") ?? "").trim().length > 0) return false;
        return field.closest("label") === null;
      }),
      fields.length > 0,
      `${fields.length} field${fields.length === 1 ? "" : "s"} checked`,
    ),
  );

  // 4.1.1 duplicate ids
  const seen = new Map<string, HTMLElement[]>();
  for (const element of root.querySelectorAll("[id]")) {
    const id = attr(element, "id");
    if (!id) continue;
    const bucket = seen.get(id);
    if (bucket) bucket.push(element);
    else seen.set(id, [element]);
  }
  const duplicates = [...seen.values()].filter((bucket) => bucket.length > 1).map((bucket) => bucket[1]!);
  outcomes.push(verdict("duplicate-id", duplicates, seen.size > 0));

  // 4.1.2 buttons
  const buttons = [
    ...root.querySelectorAll("button"),
    ...root.querySelectorAll("[role=\"button\"]"),
  ].filter((b) => !isHidden(b));
  outcomes.push(
    verdict(
      "button-name",
      buttons.filter((button) => !hasAccessibleName(button, root)),
      buttons.length > 0,
    ),
  );

  // 4.1.2 aria-hidden focusable
  const hiddenRegions = root.querySelectorAll("[aria-hidden=\"true\"]");
  outcomes.push(
    verdict(
      "aria-hidden-focus",
      hiddenRegions.filter(
        (region) =>
          attr(region, "inert") === undefined &&
          region
            .querySelectorAll(FOCUSABLE_SELECTOR)
            .some((el) => Number(attr(el, "tabindex") ?? "0") >= 0),
      ),
      hiddenRegions.length > 0,
    ),
  );

  // 4.1.2 roles
  const roled = root.querySelectorAll("[role]");
  outcomes.push(
    verdict(
      "aria-role-valid",
      roled.filter((el) =>
        (attr(el, "role") ?? "")
          .split(/\s+/)
          .filter(Boolean)
          .every((role) => !VALID_ROLES.has(role.toLowerCase())),
      ),
      roled.length > 0,
    ),
  );

  return outcomes;
}

function toFindings(outcomes: readonly RuleOutcome[]): Finding[] {
  const findings: Finding[] = [];
  for (const outcome of outcomes) {
    const meta = RULE_BY_ID.get(outcome.ruleId);
    if (!meta) continue;
    findings.push({
      ...meta,
      status: outcome.status,
      elements: (outcome.elements ?? []).slice(0, MAX_ELEMENTS_PER_RULE).map(snippet),
      ...(outcome.detail === undefined ? {} : { detail: outcome.detail }),
    });
  }
  const impactRank = (impact: Impact): number => IMPACT_ORDER.indexOf(impact);
  const statusRank = (status: Finding["status"]): number =>
    ({ violation: 0, incomplete: 1, pass: 2, inapplicable: 3 })[status];
  return findings.sort(
    (a, b) => statusRank(a.status) - statusRank(b.status) || impactRank(a.impact) - impactRank(b.impact),
  );
}

const IMPACT_WEIGHT: Record<Impact, number> = {
  critical: 10,
  serious: 6,
  moderate: 3,
  minor: 1,
};

function summarise(findings: readonly Finding[]): AuditCounts {
  const counts = {
    violations: 0,
    passes: 0,
    incomplete: 0,
    inapplicable: 0,
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
  };
  for (const finding of findings) {
    if (finding.status === "violation") {
      counts.violations += 1;
      counts[finding.impact] += 1;
    } else if (finding.status === "pass") counts.passes += 1;
    else if (finding.status === "incomplete") counts.incomplete += 1;
    else counts.inapplicable += 1;
  }
  return counts;
}

function scoreOf(findings: readonly Finding[]): number {
  const applicable = findings.filter((f) => f.status === "violation" || f.status === "pass");
  if (applicable.length === 0) return 100;
  const total = applicable.reduce((sum, f) => sum + IMPACT_WEIGHT[f.impact], 0);
  const lost = applicable
    .filter((f) => f.status === "violation")
    .reduce((sum, f) => sum + IMPACT_WEIGHT[f.impact], 0);
  return Math.max(0, Math.round(((total - lost) / total) * 100));
}

/** Audit already-fetched HTML. Pure and Worker-safe. */
export function auditHtml(url: string, html: string): AuditResult {
  const root = parse(html, { comment: false, blockTextElements: { script: false, style: false } });
  const findings = toFindings(runRules(root));
  const titleEl = root.querySelector("title");
  return {
    url,
    pageTitle: titleEl ? titleEl.textContent.trim().slice(0, 200) : "",
    fetchedAt: new Date().toISOString(),
    score: scoreOf(findings),
    counts: summarise(findings),
    findings,
  };
}

/** Rule catalogue, for documenting what the audit covers. */
export const RULE_CATALOGUE = RULES;
