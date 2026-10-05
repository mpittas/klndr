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
// Every dependency resolves from those two directories only, so a copy can never come from
// somewhere unexpected.
config.resolver.disableHierarchicalLookup = true;

/**
 * `withUniwindConfig` compiles the stylesheet and generates the class name types; it has to wrap the
 * config above, so the resolver knows about the workspace first.
 */
module.exports = withUniwindConfig(config, {
  cssEntryFile: "./src/global.css",
  dtsFile: "./src/uniwind-types.d.ts",
});
