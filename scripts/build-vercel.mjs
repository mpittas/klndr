/**
 * Builds the web app and the API into Vercel's Build Output format (`.vercel/output`), so one deployment
 * serves the static site and runs `/api/*` as a single function on the same origin.
 *
 * The API is bundled with esbuild because its sources import each other without file extensions, which
 * Node's ESM loader (and so Vercel's per-file TypeScript compile) cannot resolve.
 *
 *   node scripts/build-vercel.mjs
 */
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { build } from "esbuild";
import { securityHeaders } from "./security-headers.mjs";

/** The first path segment of every route the API serves (apps/api/src/app.ts); anything else under /api is a 404. */
const API_PATHS = ["health", "tasks", "templates", "categories", "emoji", "suggest-category", "checklist", "notes", "account"];
const REFUSAL_HEADERS = { "cache-control": "no-store", "content-type": "application/json" };

const output = ".vercel/output";
const fn = `${output}/functions/api.func`;

rmSync(output, { recursive: true, force: true });
mkdirSync(fn, { recursive: true });

// The web app (`tsc` then `vite build`) writes apps/web-react/dist.
execFileSync("npm", ["run", "build", "-w", "apps/web-react"], { stdio: "inherit", shell: true });
cpSync("apps/web-react/dist", `${output}/static`, { recursive: true });

await build({
  entryPoints: ["apps/api/src/vercel.ts"],
  outfile: `${fn}/index.mjs`,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  // Some bundled CommonJS packages call require(); ESM output has none, so provide one.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});

// Body for the refusals above; the status code comes from the route.
writeFileSync(`${output}/static/refused.json`, JSON.stringify({ error: "Refused" }));

writeFileSync(`${fn}/package.json`, JSON.stringify({ type: "module" }));
writeFileSync(
  `${fn}/.vc-config.json`,
  JSON.stringify({ runtime: "nodejs22.x", handler: "index.mjs", launcherType: "Nodejs", shouldAddHelpers: false }),
);
writeFileSync(
  `${output}/config.json`,
  JSON.stringify({
    version: 3,
    routes: [
      // Every page and file gets the security headers; the API sets its own (apps/api/src/protect.ts).
      {
        src: "^/(?!api(?:/|$)).*",
        headers: securityHeaders({ authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || undefined }),
        continue: true,
      },
      { handle: "filesystem" },
      // Scanners probe `/api/.env`, `/api/info.php` and the like all day. Each probe used to start the function
      // (and burn Active CPU) just to answer 404/401, so those are answered here, without running it:
      // paths the API doesn't have, and calls with no credentials at all (only `/api/health` is open).
      { src: `^/api(?!/(?:${API_PATHS.join("|")})(?:/|$))(?:/.*)?$`, status: 404, headers: REFUSAL_HEADERS, dest: "/refused.json" },
      { src: "^/api/health/?$", dest: "/api" },
      { src: "^/api/.*", has: [{ type: "header", key: "authorization", value: "^Bearer .+" }], dest: "/api" },
      { src: "^/api/.*", status: 401, headers: REFUSAL_HEADERS, dest: "/refused.json" },
      { src: "/(.*)", dest: "/index.html" },
    ],
  }),
);
