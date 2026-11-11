import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { securityHeaders } from "../../scripts/security-headers.mjs";

/**
 * The React web app. `@klndr/core`, `@klndr/data` and `@klndr/tokens` ship TypeScript source, and this
 * app is their only Vite consumer, so there is nothing to transpile from `node_modules`: Vite resolves
 * the workspace symlinks and compiles them as if they were app code.
 *
 * The API is served on its own origin during development (`npm run dev:api`, port 3001), so `/api` is
 * proxied here: the app always calls its own origin, which is also what production does once the API is
 * deployed behind it (R.6).
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const apiTarget = env.VITE_API_PROXY_TARGET || "http://localhost:3001";

  return {
    plugins: [
      // Must come before the React plugin: it turns `src/routes/**` into `src/routeTree.gen.ts` first.
      tanstackRouter({ target: "react", autoCodeSplitting: true }),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": { target: apiTarget, changeOrigin: true },
      },
    },
    // `vite preview` serves the production build with the live site's security headers, so CSP problems show up locally.
    // The dev server does not: its hot reload injects inline scripts the policy would block.
    preview: {
      headers: securityHeaders({ authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || undefined }),
    },
    build: {
      target: "es2022",
      sourcemap: true,
    },
  };
});
