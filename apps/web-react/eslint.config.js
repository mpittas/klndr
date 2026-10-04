import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

/**
 * Lint for the React app. `tsc` already covers types, so this config is about what the compiler cannot
 * see: the rules of hooks and the React Compiler's purity rules (refs written during render, state set
 * in effects, and so on).
 */
export default tseslint.config(
  { ignores: ["dist", "src/routeTree.gen.ts"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [tseslint.configs.base, reactHooks.configs.flat["recommended-latest"]],
  },
);
