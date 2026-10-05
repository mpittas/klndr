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
      { handle: "filesystem" },
      { src: "/api/(.*)", dest: "/api" },
      { src: "/(.*)", dest: "/index.html" },
    ],
  }),
);
