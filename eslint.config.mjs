import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Fronteras entre modulos — la skill mad-architecture las documenta.
// Dentro de un feature se importa con rutas relativas; "@/features/..." se
// reserva para cruzar de modulo, asi que un import profundo ES una violacion.
const CROSS_FEATURE = {
  group: ["@/features/*/*", "@/features/*/**"],
  message:
    "Importa la API publica del modulo (@/features/<dominio>), no sus internos.",
};
const NO_ADMIN = {
  group: ["@/shared/firebase/admin"],
  message:
    "El Admin SDK solo se usa en data/, actions/, app/api/ y shared/auth/.",
};
const NO_UPWARD = {
  group: ["@/features/**", "@/app/**"],
  message:
    "shared/ es transversal: no puede depender de un feature ni de una ruta.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // `no-restricted-imports` es UNA regla: en flat config el ultimo objeto que
  // hace match la reemplaza entera, no la suma. Por eso cada override repite
  // la lista completa que si aplica.
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
    files: ["**/data/**", "**/actions/**", "app/api/**", "shared/auth/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [CROSS_FEATURE] }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
