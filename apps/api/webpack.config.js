const nodeExternals = require('webpack-node-externals');

/**
 * Custom webpack config for NestJS build.
 *
 * @symph-crm/database is a TypeScript-only workspace package with no compiled
 * output. By default, webpack-node-externals marks all node_modules (including
 * pnpm workspace symlinks) as external — meaning they'd need to be present as
 * compiled JS at runtime. We allowlist the database package so webpack bundles
 * its TypeScript source directly into dist/main.js, eliminating the runtime
 * dependency on its compiled form.
 */
// Only override externals — NestJS CLI already configures ts-loader internally.
// Adding a duplicate ts-loader rule causes double-processing and incorrect output.
module.exports = (options) => ({
  ...options,
  externals: [
    nodeExternals({
      allowlist: [/^@symph-crm\//],
    }),
  ],
});
