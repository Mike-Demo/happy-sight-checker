// One build that satisfies both hosts:
//
//  1. Static pass (STATIC_EXPORT=1) prerenders every public page to HTML.
//  2. Worker pass (the normal Lovable build) emits the Cloudflare Worker that
//     serves the request-time audit endpoint.
//
// The two passes are mutually exclusive inside Vite, so we run them in order
// and merge their client output: the prerendered HTML from pass 1 plus the
// hashed assets from both passes. That way a static host finds
// dist/client/index.html, and the Lovable-published worker still has its
// server bundle and assets.
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const clientDir = path.join(root, "dist", "client");

function run(command, args, env) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
    shell: false,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");

// Pass 1 — prerendered static site.
run(process.execPath, [viteBin, "build"], { STATIC_EXPORT: "1" });

if (!(await exists(path.join(clientDir, "index.html")))) {
  console.error(
    "Static pass finished but dist/client/index.html is missing — prerendering did not run.",
  );
  process.exit(1);
}

const stash = await mkdtemp(path.join(tmpdir(), "static-site-"));
await cp(clientDir, stash, { recursive: true });

// Pass 2 — Cloudflare Worker build (serves /api/public/audit).
run(process.execPath, [viteBin, "build"], { STATIC_EXPORT: "" });

// Merge the prerendered HTML and its assets back in, without removing the
// worker build's own client output.
await mkdir(clientDir, { recursive: true });
await cp(stash, clientDir, { recursive: true, force: true });
await rm(stash, { recursive: true, force: true });

if (!(await exists(path.join(clientDir, "index.html")))) {
  console.error("Merge failed: dist/client/index.html is missing.");
  process.exit(1);
}

console.log("Build complete: prerendered pages + worker output in dist/.");
