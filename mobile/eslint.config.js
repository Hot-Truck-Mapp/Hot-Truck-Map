// ESLint config for the Expo app.
//
// The repo root holds a Next.js ESLint config, and ESLint walks upward to find
// the nearest config — so without this file the React Native source was linted
// with Next.js rules (which flag ordinary Metro/Babel `require()` calls as
// errors) and, once the root config started ignoring `mobile/`, not linted at
// all. This keeps the app on Expo's own rules.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/*',
      '.expo/*',
      'node_modules/*',
      // Build/release helper scripts — plain Node, not app source.
      'generate-*.js',
      'plugins/*',
    ],
  },
]);
