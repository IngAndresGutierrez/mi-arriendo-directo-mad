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
  /**
   * **`next/link` is not imported directly anywhere except the one component that wraps it.**
   *
   * The routes in this product are Spanish words and Spanish is the unprefixed locale, so a plain
   * `<Link href={PROPERTIES_ROUTE}>` pressed on `/en/inmuebles` navigates to `/inmuebles` — the
   * *Spanish* catalogue. Nothing throws and nothing looks broken: the reader simply ends up back in
   * Spanish having pressed a link that belonged to the page they were reading. No type checker, no
   * driver and no screenshot can see that, which is why it is a lint rule and not a convention.
   *
   * `LocaleLink` is a drop-in — the migration was the import line and nothing else — and it is
   * idempotent, so wrapping something already localised is safe. The two files allowed to reach for
   * the real thing are the wrapper itself and `shared/ui/nav-item.tsx`, which needs `useLinkStatus`
   * (a hook, not the component) for its in-flight spinner.
   *
   * **It sits *before* the `data/`/`actions/` block on purpose, and that ordering is load-bearing.**
   * Flat config does not merge two configs that set the same rule — the last matching one wins
   * outright — so with this block placed after it, every file under `data/`, `actions/`, `app/api/`
   * and `shared/auth/` silently lost the cross-feature import guard. `pnpm lint` stayed green, which
   * is exactly what makes it worth writing down: it was found by planting a violating import and
   * watching nothing happen. Those files render no JSX, so losing the `next/link` rule there costs
   * nothing; losing the architectural one costs the boundary the whole project is built on.
   */
  {
    files: ["app/**/*.{ts,tsx}", "features/**/*.{ts,tsx}", "shared/**/*.{ts,tsx}"],
    ignores: ["shared/i18n/locale-link.tsx", "shared/ui/nav-item.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/link",
              message:
                "Import { LocaleLink as Link } from '@/shared/i18n/locale-link' instead: a plain <Link> to a Spanish route drops an English reader back into Spanish.",
            },
          ],
        },
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
    /*
     * Y la del `pnpm build` que se lanza con el servidor e2e arriba (`NEXT_DIST_DIR=.next-build`,
     * documentado en `CLAUDE.md`). Faltaba, así que un `.next-build/` dejado por una sesión anterior
     * hacía que `pnpm verify` reportara 1.141 errores de dentro de los chunks empaquetados — la
     * compuerta en rojo por un directorio de salida, que es exactamente el fallo que la línea de
     * arriba ya había costado una vez.
     */
    ".next-build/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
