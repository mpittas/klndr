const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");
const path = require("node:path");

/**
 * Metro, told about the workspace and about Uniwind.
 *
 * `@klndr/core` and `@klndr/tokens` ship TypeScript source (no build step), so Metro has to watch
 * the workspace root and compile them with the app's Babel preset — the same way Vite compiles them
 * for the web app. Without this, Metro would only look inside apps/mobile and find neither.
 */
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

/**
 * Hierarchical lookup stays on (Expo's default): packages keep their own nested dependencies, such as
 * `pretty-format`'s `ansi-styles@5`, and Metro must be able to find them. The one thing that must not
 * come from the nearest copy is `react`: the web app needs 19.3 (hoisted to the root) while React Native
 * 0.86 pins 19.2.3 (installed in this app), and two copies in one bundle break every hook. So `react`
 * and its subpaths always resolve as if imported from this app.
 */
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest;
  if (moduleName === "react" || moduleName.startsWith("react/")) {
    return resolve({ ...context, originModulePath: path.join(projectRoot, "package.json") }, moduleName, platform);
  }
  return resolve(context, moduleName, platform);
};

/**
 * `withUniwindConfig` compiles the stylesheet and generates the class name types; it has to wrap the
 * config above, so the resolver knows about the workspace first.
 */
module.exports = withUniwindConfig(config, {
  cssEntryFile: "./src/global.css",
  dtsFile: "./src/uniwind-types.d.ts",
});
