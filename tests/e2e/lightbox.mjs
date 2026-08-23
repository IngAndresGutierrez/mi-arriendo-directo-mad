import { chromium } from "playwright";
import { BASE, config, ok, settled } from "./lib.mjs";

const { shotDir: SHOT_DIR } = config();
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const problems = [];
p.on("pageerror", (e) => problems.push("pageerror: " + e.message));
p.on("console", (m) => { if (m.type() === "error") problems.push("console: " + m.text().slice(0, 120)); });

// El driver se abastece solo: entra al catálogo y abre el primer inmueble. Antes recibía la
// URL por argumento, así que fuera de la sesión que la calculó no se podía correr.
await p.goto(BASE + "/inmuebles", { waitUntil: "domcontentloaded" });
await settled(p);
const first = p.locator('a[href^="/inmuebles/"]').first();
if (!(await first.count())) throw new Error("el catálogo no ofrece ningún inmueble que abrir");
await first.click();
await p.waitForURL(/\/inmuebles\/[^/]+$/, { timeout: 25000 });
await settled(p);
ok("abre el detalle del primer inmueble del catálogo", new URL(p.url()).pathname);
const dialog = p.getByRole("dialog");

// 1. clic en la portada abre el slider
await p.getByRole("button", { name: /Ver las \d+ fotos/ }).click();
await dialog.waitFor({ state: "visible", timeout: 8000 });
ok("clic en la portada abre el slider", (await p.locator("[aria-live='polite']").textContent())?.trim());
await p.screenshot({ path: `${SHOT_DIR}/lightbox-abierto.png` });

// 2. las flechas navegan
await p.getByRole("button", { name: "Foto siguiente" }).click();
let counter = (await p.locator("[aria-live='polite']").textContent())?.trim();
if (!counter?.startsWith("2 de")) throw new Error(`el contador dice ${counter}`);
ok("la flecha avanza", counter);

// 3. el teclado también
await p.keyboard.press("ArrowLeft");
counter = (await p.locator("[aria-live='polite']").textContent())?.trim();
if (!counter?.startsWith("1 de")) throw new Error(`tras ArrowLeft: ${counter}`);
ok("las flechas del teclado navegan", counter);

// 4. da la vuelta en el extremo
await p.keyboard.press("ArrowLeft");
counter = (await p.locator("[aria-live='polite']").textContent())?.trim();
ok("desde la primera vuelve a la última", counter);

// 5. Escape cierra y el foco regresa
await p.keyboard.press("Escape");
await dialog.waitFor({ state: "hidden", timeout: 5000 });
await p.waitForTimeout(400);   // Radix devuelve el foco de forma asíncrona
const focused = await p.evaluate(() => document.activeElement?.getAttribute("aria-label"));
if (!focused?.startsWith("Ver las")) throw new Error();
ok("Escape cierra y devuelve el foco", `foco en "${focused}"`);

// 6. una miniatura abre el slider en esa foto
await p.getByRole("button", { name: /^Ver la foto 2 de \d+$/ }).click();
await dialog.waitFor({ state: "visible", timeout: 8000 });
counter = (await p.locator("[aria-live='polite']").textContent())?.trim();
if (!counter?.startsWith("2 de")) throw new Error(`abrió en ${counter}`);
ok("una miniatura abre el slider en su foto", counter);

// 7. en móvil
await p.keyboard.press("Escape");
await p.setViewportSize({ width: 390, height: 844 });
await p.getByRole("button", { name: /Ver las \d+ fotos/ }).click();
await dialog.waitFor({ state: "visible", timeout: 8000 });
const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
await p.screenshot({ path: `${SHOT_DIR}/lightbox-movil.png` });
if (overflow) throw new Error("scroll horizontal en móvil");
ok("a 390px sin scroll horizontal");

console.log(problems.length ? "  PROBLEMAS:\n   " + problems.join("\n   ") : "  OK    consola sin errores");
await b.close();
