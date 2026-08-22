/**
 * Fronteras entre modulos de miarriendodirecto.com.
 * Documentadas en .claude/skills/mad-architecture/SKILL.md (§2).
 * Lo que eslint no alcanza: ciclos y "quien importa a quien" en general.
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Un ciclo convierte 'borro este feature' en 'el build no compila'.",
      from: {},
      to: { circular: true },
    },
    {
      name: "shared-no-depende-de-features",
      severity: "error",
      comment: "shared/ es transversal: esa flecha es un ciclo entre capas.",
      from: { path: "^shared/" },
      to: { path: "^(features|app)/" },
    },
    {
      name: "features-no-depende-de-app",
      severity: "error",
      comment: "Un feature no conoce las rutas que lo usan.",
      from: { path: "^features/" },
      to: { path: "^app/" },
    },
    {
      name: "cruce-de-features-solo-por-el-index",
      severity: "error",
      comment: "Los internos de un feature son suyos; de fuera solo su index.ts.",
      from: { path: "^features/([^/]+)/" },
      to: {
        // `(?!index\\.ts)` matters: importing another feature's index IS the contract; what is
        // forbidden is reaching past it into its internals.
        path: "^features/[^/]+/(?!index\\.ts$)(?!client\\.ts$).+",
        pathNot: "^features/$1/",
      },
    },
    {
      name: "domain-es-puro",
      severity: "error",
      comment:
        "domain/ es lo unico que se prueba en milisegundos sin emulador: sin Firebase, sin React, sin next.",
      from: { path: "^features/[^/]+/domain/" },
      to: { path: "^(shared/firebase|node_modules/(firebase|firebase-admin|react|next))" },
    },
    {
      name: "ui-compartida-sin-datos",
      severity: "error",
      comment: "shared/ui son primitivas: sin datos y sin Firebase.",
      from: { path: "^shared/ui/" },
      to: { path: "^shared/firebase/" },
    },
    {
      name: "no-huerfanos",
      severity: "warn",
      comment: "Un archivo que nadie importa es codigo muerto o un import olvidado.",
      from: { orphan: true, pathNot: "\\.(css|d\\.ts)$" },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: { exportsFields: ["exports"], conditionNames: ["import", "require", "node", "default", "types"] },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
