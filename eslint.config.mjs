import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Nested build output (e.g. inside scratch worktrees) — minified chunks
    // are not source and produced ~3.7k bogus warnings when linted.
    "**/.next/**",
    ".claude/**",
    // The Expo app has its own toolchain and rules; lint it with
    // `npm run lint` inside mobile/, not with the Next.js config.
    "mobile/**",
  ]),
]);

export default eslintConfig;
