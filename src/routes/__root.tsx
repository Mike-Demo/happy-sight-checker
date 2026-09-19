import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import themeCss from "@/design-system/font-awsome-web-awesome-171158/webawesome/theme.css?url";
import appCss from "../styles.css?url";
import { WEB_AWESOME_HTML_CLASSES } from "@/design-system/font-awsome-web-awesome-171158/webawesome/setup";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "WCAGify — WCAG accessibility checker" },
      {
        name: "description",
        content: "Audit any public web page against WCAG 2.2 level A and AA accessibility criteria.",
      },
      { property: "og:title", content: "WCAGify — WCAG accessibility checker" },
      {
        property: "og:description",
        content: "Audit any public web page against WCAG 2.2 level A and AA accessibility criteria.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: "https://cdn.jsdelivr.net/npm/@awesome.me/webawesome@3.12.0/dist/styles/webawesome.css" },
      { rel: "stylesheet", href: "https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@7.3.1/css/all.min.css" },
      { rel: "stylesheet", href: "https://cdn.jsdelivr.net/npm/@awesome.me/webawesome@3.12.0/dist/styles/utilities/fouce.css" },
      { rel: "stylesheet", href: themeCss },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={WEB_AWESOME_HTML_CLASSES}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

// Keep this root providers-only: canvas preview routes (/__mockup,
// /__component) render inside it, so any chrome leaks into every frame.
function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
