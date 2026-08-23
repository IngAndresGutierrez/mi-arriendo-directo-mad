import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Module boundaries — the mad-architecture skill documents them.
// Inside a feature, import with relative paths; "@/features/..." is reserved for crossing
// from one module to another, so a deep import IS a violation.
const CROSS_FEATURE = {
  // Gitignore-style: the negation is how `client.ts` stays reachable. It is a public entry
  // too — the half of a module a Client Component may import, because the index also
  // re-exports server-only code and a client bundle that touched it would fail to build.
  group: ["@/features/*/*", "@/features/*/**", "!@/features/*/client"],
  message:
    "Import the module's public API (@/features/<domain> or /client), not its internals.",
};
const NO_ADMIN = {
  group: ["@/shared/firebase/admin"],
  message:
    "The Admin SDK is only used in data/, actions/, app/api/ and shared/auth/.",
};
const NO_UPWARD = {
  group: ["@/features/**", "@/app/**"],
  message:
    "shared/ es transversal: no puede depender de un feature ni de una ruta.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // `no-restricted-imports` is ONE rule: in flat config the last matching object replaces it
  // whole rather than adding to it, which is why every override repeats the full list.
  {
    rules: {
      "no-restricted-imports": ["error", { patterns: [CROSS_FEATURE, NO_ADMIN] }],
    },
  },
  {
    files: ["shared/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [CROSS_FEATURE, NO_ADMIN, NO_UPWARD] },
      ],
    },
  },
  {
    // A bare `actions.ts` counts too: it is Next's convention for a route's Server Actions,
    // and that file IS the mutation layer.
    files: [
      "**/data/**",
      "**/data.ts",
      "**/actions/**",
      "**/actions.ts",
      "app/api/**",
      "shared/auth/**",
    ],
    rules: {
      "no-restricted-imports": ["error", { patterns: [CROSS_FEATURE] }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    /*
     * The e2e dev server's output, which is a *separate* directory precisely so it can run beside an
     * ordinary `pnpm dev` (see `distDir` in `next.config.ts`). This line is not optional: listing
     * only `.next/**` left eslint walking a second copy of every bundled dependency, and `pnpm
     * verify` started reporting `/* eslint-env *\/` warnings from inside `node_modules` chunks.
     */
    ".next-e2e/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
