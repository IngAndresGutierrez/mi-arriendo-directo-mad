/** Seis por página, y la paginación lleva a la siguiente. */
import { chromium } from "playwright";
import { BASE, config, ok, settled } from "./lib.mjs";

const { shotDir: SHOT_DIR } = config();
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 1400 } })).newPage();
await p.goto(BASE + "/inmuebles", { waitUntil: "domcontentloaded" });
await settled(p);
const cards = p.locator("ul li:has(a[href^='/inmuebles/'])");
const total = Number((await p.evaluate(() => document.body.innerText)).match(/(\d+) inmuebles? encontrados?/)?.[1] ?? "0");
const enPrimera = await cards.count();
if (enPrimera !== 6) throw new Error(`la primera página muestra ${enPrimera}`);
ok("seis en la primera página", `${total} en total`);
await p.screenshot({ path: `${SHOT_DIR}/catalogo-6.png`, fullPage: true });
/*
 * Acotado al `<nav aria-label="Paginación">`, no a todos los enlaces de la página: con
 * `/Siguiente|2/` sobre `.first()`, en cuanto el catálogo tuvo tarjetas cuyo nombre accesible
 * contenía un "2" el clic se iba a un inmueble y el `waitForURL(/page=2/)` no llegaba nunca.
 */
const pager = p.getByRole("navigation", { name: "Paginación" });
if (!(await pager.count())) throw new Error("no hay paginación");
const siguiente = pager.getByRole("link", { name: /Siguientes/ });
if (!(await siguiente.count())) throw new Error("el paginador no ofrece 'Siguientes'");
await siguiente.click();
await p.waitForURL(/page=2/, { timeout: 20000 });
await settled(p);
const enSegunda = await cards.count();
if (enSegunda < 1 || enSegunda > 6) throw new Error(`la segunda página muestra ${enSegunda}`);
ok("la segunda página trae las siguientes", `${enSegunda} tarjetas, ${new URL(p.url()).search}`);
const primeras = await p.locator("ul li a[href^='/inmuebles/']").first().getAttribute("href");
await p.goto(BASE + "/inmuebles", { waitUntil: "domcontentloaded" });
await settled(p);
const otra = await p.locator("ul li a[href^='/inmuebles/']").first().getAttribute("href");
if (primeras === otra) throw new Error("la segunda página repite la primera");
ok("y no repite lo de la primera");
await b.close();
