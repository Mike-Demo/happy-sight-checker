// Bundles the Spacefast Functions sources (functions-src/) into self-contained
// modules under dist/client/functions/, where Spacefast's file router finds
// them at publish time. Each file's path is its route.
import { build } from "esbuild";
import { readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const sourceDir = path.join(root, "functions-src");
const outDir = path.join(root, "dist", "client", "functions");

async function listModules(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return listModules(full);
      return /\.(ts|js)$/.test(entry.name) && !entry.name.startsWith("_") ? [full] : [];
    }),
  );
  return files.flat();
}

const entryPoints = await listModules(sourceDir);
await build({
  entryPoints,
  outbase: sourceDir,
  outdir: outDir,
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  mainFields: ["module", "main"],
  outExtension: { ".js": ".mjs" },
  logLevel: "info",
});
console.log(`Bundled ${entryPoints.length} Spacefast function(s) into dist/client/functions.`);
