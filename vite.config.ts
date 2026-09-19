import path from "path";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { componentTagger } from "lovable-tagger";
import { mockupPreviewPlugin } from "./mockupPreviewPlugin";

export default defineConfig(({ command, mode }) => {
  // STATIC_EXPORT=1 builds the prerendered site for static hosting. The
  // Cloudflare Workers output and the prerender pass are mutually exclusive:
  // prerendering renders the routes through a Node preview server, which the
  // worker build does not emit.
  const staticExport = process.env["STATIC_EXPORT"] === "1";

  // Cloudflare Workers plugin only on build (produces the worker output);
  // the workerd runtime isn't available for the dev server.
  const useCloudflare = command === "build" && !staticExport;

  return {
    server: {
      host: "::",
      port: 8080,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    plugins: [
      mockupPreviewPlugin(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      ...(useCloudflare ? [cloudflare({ viteEnvironment: { name: "ssr" } })] : []),
      tanstackStart({
        // Every public page is identical for all visitors, so both are
        // prerendered to HTML. Discovery is off so the editor preview routes
        // and the audit API route are never prerendered.
        pages: [{ path: "/" }, { path: "/licenses" }],
        prerender: { enabled: staticExport, autoStaticPathsDiscovery: false },
      }),
      viteReact(),
      ...(mode === "development" ? [componentTagger()] : []),
    ],
  };
});
