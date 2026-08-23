/**
 * Runs the browser drivers.
 *
 *   pnpm e2e                    every driver
 *   pnpm e2e loading catalog    just those
 *   pnpm e2e --since            only what the working tree touches (see manifest.mjs)
 *   pnpm e2e --since=HEAD~3     ...against another ref
 *   pnpm e2e --list             what would run, without running it
 *
 * Each driver is a separate process on purpose: they share no state, a crash takes one down
 * instead of the run, and the output stays attributable to a name.
 */
import { execFileSync, spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { COVERS, driversFor } from "./manifest.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const ALL = readdirSync(HERE)
  .filter((f) => f.endsWith(".mjs") && !["lib.mjs", "manifest.mjs", "run.mjs"].includes(f))
  .map((f) => f.replace(/\.mjs$/, ""))
  .sort();

// Un driver sin entrada en el manifiesto nunca lo elige `--since`, y eso no se nota:
// el driver existe, corre a mano y parece cubierto. Se avisa al arrancar, siempre.
const unmapped = ALL.filter((d) => !COVERS[d]);
if (unmapped.length) {
  console.log(
    `⚠ sin entrada en manifest.mjs, así que --since nunca los elige: ${unmapped.join(" ")}\n`,
  );
}

const args = process.argv.slice(2);
const list = args.includes("--list");
const sinceArg = args.find((a) => a === "--since" || a.startsWith("--since="));
const names = args.filter((a) => !a.startsWith("--"));

let selected;
let why;
if (sinceArg) {
  const ref = sinceArg.includes("=") ? sinceArg.split("=")[1] : "";
  const changed = execFileSync("git", ["diff", "--name-only", ...(ref ? [ref] : []), "--", "."], {
    cwd: ROOT,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
  // Untracked files count too: a brand-new screen is exactly what wants driving.
  const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], {
    cwd: ROOT,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
  const paths = [...new Set([...changed, ...untracked])];
  selected = driversFor(paths);
  why = `${paths.length} archivo(s) tocados${ref ? ` desde ${ref}` : ""}`;
  if (!selected.length) {
    console.log(`nada que manejar: ${why} no entra en ningún driver.`);
    console.log("si eso te sorprende, falta una entrada en tests/e2e/manifest.mjs.");
    process.exit(0);
  }
} else if (names.length) {
  const unknown = names.filter((n) => !ALL.includes(n));
  if (unknown.length) {
    console.error(`no existe: ${unknown.join(", ")}\ndisponibles: ${ALL.join(" ")}`);
    process.exit(2);
  }
  selected = names;
  why = "por nombre";
} else {
  selected = ALL;
  why = "todos";
}

console.log(`${selected.length}/${ALL.length} drivers (${why}): ${selected.join(" ")}\n`);
if (list) process.exit(0);

/*
 * The drivers publish listings, create accounts and upload files. Run against the real project
 * they do it *in production* — which is exactly what happened: 306 fake listings in the public
 * catalogue, 644 auth accounts, and a morning spent deleting them.
 *
 * So the target has to be a `demo-` project, and the check lives here rather than in a README:
 * the guard that has to be remembered is the guard that fails. `--against-real` is the escape
 * hatch, spelled out loud enough that nobody types it by accident.
 */
const REAL = process.argv.includes("--against-real");
const PROJECT = process.env.FIREBASE_PROJECT_ID;
if (!REAL && !PROJECT?.startsWith("demo-")) {
  console.error(
    `se niega a correr contra el proyecto "${PROJECT ?? "(sin definir)"}".\n\n` +
      "Los drivers escriben de verdad: publican inmuebles, crean cuentas y suben archivos.\n" +
      "Contra el proyecto real eso ensucia producción, y ya pasó una vez.\n\n" +
      "  pnpm emulators     # una terminal\n" +
      "  pnpm dev:e2e       # otra\n" +
      "  pnpm e2e:env       # y los drivers aquí\n\n" +
      "Si de verdad quieres el proyecto real: --against-real",
  );
  process.exit(2);
}

const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? process.env.E2E_API_KEY;
if (!API_KEY) {
  console.error(
    "falta NEXT_PUBLIC_FIREBASE_API_KEY. Los drivers crean sus cuentas contra Identity Toolkit.\n" +
      "  export $(grep NEXT_PUBLIC_FIREBASE_API_KEY .env.local | xargs)",
  );
  process.exit(2);
}

const STAMP = process.env.E2E_STAMP ?? String(process.hrtime.bigint()).slice(-9);
const SHOT_DIR = process.env.E2E_SHOT_DIR ?? join(ROOT, ".e2e-shots");

const run = (name) =>
  new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [join(HERE, `${name}.mjs`)], {
      cwd: ROOT,
      encoding: "utf8",
      // The contract is env, not positional: the drivers had grown five different
      // argv shapes between them and nothing checked which one a driver expected.
      env: {
        ...process.env,
        E2E_API_KEY: API_KEY,
        // `lib.mjs` refuses a non-demo project on its own; this is how `--against-real` reaches it.
        ...(REAL ? { E2E_AGAINST_REAL: "1" } : {}),
        E2E_STAMP: `${name}-${STAMP}`,
        E2E_SHOT_DIR: SHOT_DIR,
      },
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) =>
      resolve({ name, code, out, seconds: Math.round((Date.now() - started) / 1000) }),
    );
  });

const results = [];
for (const name of selected) {
  const r = await run(name);
  const passed = (r.out.match(/^ {2}OK {4}/gm) ?? []).length;
  // Un driver que pasa sin imprimir una sola aserción se lee como un test que no hizo nada.
  // Puede estar asertando con `throw` sin llamar a `ok()`, y eso hay que decirlo, no taparlo.
  const mute = r.code === 0 && passed === 0 ? "  ⚠ pasó sin imprimir ninguna aserción" : "";
  console.log(`── ${r.name}: ${passed} OK ${r.code === 0 ? "" : "FALLÓ"} (${r.seconds}s)${mute}`);
  if (r.code !== 0) console.log(r.out.split("\n").filter((l) => !l.startsWith("  OK")).join("\n"));
  results.push({ ...r, passed });
}

const failed = results.filter((r) => r.code !== 0);
const asserts = results.reduce((n, r) => n + r.passed, 0);
console.log(
  `\n${results.length - failed.length}/${results.length} drivers, ${asserts} aserciones` +
    (failed.length ? `\nfallaron: ${failed.map((f) => f.name).join(", ")}` : ""),
);
process.exit(failed.length ? 1 : 0);
