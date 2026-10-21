import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { isTrustedPreviewMessageOrigin } from "./preview-message-origin";

const appOrigin = "http://localhost:8080";

describe("preview origin policy", () => {
  test("allows the same app and exact HTTPS editor origins", () => {
    for (const origin of [appOrigin, "https://lovable.dev", "https://www.lovable.dev"]) {
      expect(isTrustedPreviewMessageOrigin(origin, appOrigin)).toBe(true);
    }
  });

  test("rejects hostile embeddings, hosted apps, spoofed domains and opaque origins", () => {
    for (const origin of ["https://attacker.example", "https://evil.lovable.app", "https://evil.lovable.dev", "https://lovable.dev.attacker.example", "http://lovable.dev", "https://lovable.dev:444", "https://lovable.dev/", "null", "", "file://", "javascript:alert(1)"]) {
      expect(isTrustedPreviewMessageOrigin(origin, appOrigin)).toBe(false);
    }
  });
});

const route = readFileSync(new URL("../routes/[__component].preview.$.tsx", import.meta.url), "utf8");
const plugin = readFileSync(new URL("../../mockupPreviewPlugin.ts", import.meta.url), "utf8");
const routeHandler = /const onMessage = \(event: MessageEvent\) => \{([\s\S]*?)\n    \};/;
const htmlHandler = /window.addEventListener\("message", \(event\) => \{([\s\S]*?)\n    \}\);/;

for (const [name, source, pattern] of [
  ["committed route", route, routeHandler],
  ["generated route", plugin, routeHandler],
  ["generated HTML", plugin, htmlHandler],
] as const) {
  test(`${name} rejects untrusted origins and non-parent senders before rendering`, () => {
    const body = source.match(pattern)?.[1];
    if (!body) throw new Error(`Missing ${name} handler`);
    const parentWindow = {};
    const props = { label: "updated" };
    const renderCalls: string[] = [];
    const context = {
      parent: parentWindow,
      window: { location: { origin: appOrigin } },
      isTrustedPreviewMessageOrigin,
      entryRef: { current: { schemaProps: [] } },
      specimenRef: { current: {} },
      specimenProps: {},
      specimenPropsFromMessage: () => props,
      renderSpecimen: () => renderCalls.push("render"),
    };
    const javascriptBody = body.replace(" as { schemaProps?: SchemaProp[] } | null", "");
    const handle = (origin: string, sourceWindow: object) => runInNewContext(
      `(function(event) {${javascriptBody}})(event)`,
      { ...context, event: { origin, source: sourceWindow, data: { type: "DS_SPECIMEN_PROPS", payload: { props } } } },
    );
    handle("https://attacker.example", parentWindow);
    handle("null", parentWindow);
    handle("https://lovable.dev", {});
    expect(renderCalls).toHaveLength(0);
    handle("https://lovable.dev", parentWindow);
    handle(appOrigin, parentWindow);
    expect(renderCalls).toHaveLength(2);
  });
}