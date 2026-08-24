import { chromium } from "playwright";
import {
  acceptLegalConsents,
  BASE,
  config,
  createAccount,
  fillBirthdate,
  fixtures,
  hydrated,
  MONTHS,
  ok,
  settled,
} from "./lib.mjs";
const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();
const { photo1: PHOTO_1 } = fixtures();


/** La fecha de nacimiento son tres campos: día, mes y año. */
const email = `sesion-${STAMP}@miarriendodirecto.test`;
await createAccount(API_KEY, email);

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
const p = await ctx.newPage();
const problems = [];
p.on("pageerror", (e) => problems.push("pageerror: " + e.message));

await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await settled(p);
await p.waitForFunction(() => { const f = document.querySelector("form"); return f && Object.keys(f).some((k) => k.startsWith("__react")); }, null, { timeout: 20000 });
await p.getByLabel("Correo electrónico").fill(email);
await p.getByLabel("Contraseña").fill("ClaveDePrueba1");
await p.getByRole("button", { name: /Ingresar|Iniciar/i }).click();
await p.waitForURL(/completar-perfil/, { timeout: 25000 });
await settled(p);
await p.getByLabel("Nombre completo").fill("Ana Propietaria Pérez");
await p.getByLabel("Teléfono").fill("3001234567");
await fillBirthdate(p, "10", MONTHS[Number("05") - 1], "1990");
await p.getByLabel("Dirección", { exact: true }).fill("Calle 1 # 2-3");
for (const [l, o] of [["Género", /Femenino/i], ["Departamento", /Caldas/], ["Ciudad", /^Manizales$/]]) { await p.getByLabel(l).click(); await p.getByRole("option", { name: o }).first().click(); }
await acceptLegalConsents(p);
await p.getByRole("button", { name: /Guardar|Continuar/i }).click();
await p.waitForURL(/\/inicio/, { timeout: 30000 });
await settled(p);

// ---------- la cookie dura una semana ----------
const cookie = (await ctx.cookies()).find((c) => c.name === "session");
if (!cookie) throw new Error("no hay cookie de sesión");
const days = (cookie.expires * 1000 - Date.now()) / 86_400_000;
if (days < 6.9 || days > 7.1) throw new Error(`la cookie dura ${days.toFixed(2)} días`);
if (!cookie.httpOnly) throw new Error("la cookie no es httpOnly");
ok("la sesión dura 7 días", `${days.toFixed(2)} días, httpOnly, sameSite=${cookie.sameSite}`);

// ---------- el caso reportado: el SDK pierde su sesión, la cookie sigue ----------
await p.goto(BASE + "/inmuebles/publicar", { waitUntil: "domcontentloaded" });
await settled(p);
const before = await p.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
if (!before.includes("firebaseLocalStorageDb")) throw new Error("no encontré la sesión del SDK: " + JSON.stringify(before));
await p.evaluate(() => new Promise((resolve) => {
  const request = indexedDB.deleteDatabase("firebaseLocalStorageDb");
  request.onsuccess = request.onerror = request.onblocked = () => resolve(true);
}));
await p.reload({ waitUntil: "domcontentloaded" });
await settled(p);
/*
 * Y hay que esperar la hidratación antes de tocar el input. `setInputFiles` deja el archivo y
 * dispara `change`, pero si React todavía no ha enganchado su handler no lo atiende nadie: no
 * hay subida, no hay error y la espera se agota — que es exactamente cómo este driver "reportaba"
 * un fallo de producto que no existía. La subida tras recuperar la sesión funciona.
 */
await hydrated(p);
const stillHasCookie = (await ctx.cookies()).some((c) => c.name === "session");
const sdkUser = await p.evaluate(async () => (await indexedDB.databases()).some((d) => d.name === "firebaseLocalStorageDb"));
if (!stillHasCookie) throw new Error("se perdió también la cookie: la prueba no reproduce el caso");
ok("reproducido: el navegador perdió la sesión del SDK y conserva la del servidor", `sdk=${sdkUser ? "algo" : "vacío"}`);

// ---------- y aun así la subida funciona ----------
await p.setInputFiles('input[type="file"]', [PHOTO_1]);
const expired = p.locator("text=Tu sesión expiró");
const uploaded = p.locator('img[alt="Foto de portada"]');
await Promise.race([
  uploaded.waitFor({ state: "visible", timeout: 40000 }),
  expired.waitFor({ state: "visible", timeout: 40000 }),
]);
if (await expired.count() > 0) throw new Error("sigue diciendo que la sesión expiró");
if (await uploaded.count() === 0) throw new Error("no subió la foto");
ok("la foto sube igual: la sesión del navegador se reconstruye sola desde la del servidor");
await p.screenshot({ path: `${SHOT_DIR}/subida-tras-perder-sdk.png`, clip: { x: 0, y: 0, width: 900, height: 700 } });

// ---------- sin cookie tampoco hay milagro ----------
const token = await p.evaluate(async () => (await fetch("/api/session/token", { method: "POST" })).status);
if (token !== 200) throw new Error("con cookie válida el token debería salir: " + token);
await ctx.clearCookies();
const denied = await p.evaluate(async () => (await fetch("/api/session/token", { method: "POST" })).status);
if (denied !== 401) throw new Error("¡sin cookie entrega un token! " + denied);
ok("el token solo sale con una cookie válida", `con cookie ${token}, sin cookie ${denied}`);

// Y si no hay ninguna de las dos, el mensaje honesto vuelve a aparecer.
await p.evaluate(() => new Promise((resolve) => {
  const request = indexedDB.deleteDatabase("firebaseLocalStorageDb");
  request.onsuccess = request.onerror = request.onblocked = () => resolve(true);
}));
await p.goto(BASE + "/inmuebles/publicar", { waitUntil: "domcontentloaded" });
await settled(p);
if (!/\/\?next=|\/$/.test(new URL(p.url()).pathname + new URL(p.url()).search)) {
  // Sin cookie la página es privada: debe mandar al login en vez de mostrar el formulario.
  throw new Error("sin sesión la página de publicar siguió abierta: " + p.url());
}
ok("sin ninguna de las dos, publicar manda al login en vez de fingir");

console.log(problems.length ? "  PROBLEMAS:\n   " + problems.join("\n   ") : "  OK    consola sin errores");
await b.close();
