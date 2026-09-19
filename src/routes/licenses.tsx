import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { LicensesPage } from "@/design-system/font-awsome-web-awesome-171158";
import { baseCredits } from "@/design-system/font-awsome-web-awesome-171158/webawesome/patterns";

export const Route = createFileRoute("/licenses")({
  head: () => ({
    meta: [
      { title: "Open source & credits — WCAGify" },
      {
        name: "description",
        content:
          "Licenses and credits for the open source libraries, standards, and services behind the WCAGify accessibility checker.",
      },
      { property: "og:title", content: "Open source & credits — WCAGify" },
      {
        property: "og:description",
        content: "The open source libraries and services that power WCAGify.",
      },
    ],
  }),
  component: Licenses,
});

function Licenses() {
  return (
    <AppShell>
      <div className="page-container">
        <LicensesPage
          lede="WCAGify is built on open source work and public standards. Everything it relies on is credited here."
          groups={[
            { title: "Open source libraries", entries: baseCredits },
            {
              title: "Audit engine",
              entries: [
                {
                  name: "node-html-parser",
                  author: "taoqf and contributors",
                  license: "MIT",
                  url: "https://github.com/taoqf/node-html-parser/blob/main/LICENSE",
                  note: "Parses fetched pages so the WCAG rules can inspect their markup.",
                },
                {
                  name: "TanStack Query",
                  author: "Tanner Linsley and contributors",
                  license: "MIT",
                  url: "https://github.com/TanStack/query/blob/main/LICENSE",
                  note: "Manages the audit request state in the browser.",
                },
                {
                  name: "Zod",
                  author: "Colin McDonnell and contributors",
                  license: "MIT",
                  url: "https://github.com/colinhacks/zod/blob/main/LICENSE",
                  note: "Validates the submitted web address before any page is fetched.",
                },
              ],
            },
            {
              title: "Standards & services",
              entries: [
                {
                  name: "WCAG 2.2",
                  author: "W3C Web Accessibility Initiative",
                  license: "W3C Document License",
                  url: "https://www.w3.org/TR/WCAG22/",
                  note: "The success criteria every rule in the report maps to.",
                },
                {
                  name: "Firecrawl",
                  author: "Firecrawl (Sideguide Technologies, Inc.)",
                  license: "Proprietary service (Firecrawl Terms of Service)",
                  url: "https://www.firecrawl.dev/terms-of-service",
                  note: "Fetches and renders the audited page so its final markup can be checked.",
                },
              ],
            },
          ]}
        />
      </div>
    </AppShell>
  );
}
