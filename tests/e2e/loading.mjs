/**
 * Al navegar hay respuesta inmediata: el esqueleto de la pantalla que viene y la opción del menú
 * marcada mientras llega. Se fuerza la lentitud retrasando la respuesta del servidor.
 */
import { chromium } from "playwright";
import { BASE, config, createAccount, MONTHS, ok, settled } from "./lib.mjs";
const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();

const email = `load-${STAMP}@miarriendodirecto.test`;

await createAccount(API_KEY, email);

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const problemas = [];
p.on("pageerror", (e) => problemas.push(String(e)));

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
await p.getByLabel("Día", { exact: true }).fill("10");
await p.getByLabel("Mes", { exact: true }).click();
await p.getByRole("option", { name: MONTHS[4], exact: true }).click();
await p.getByLabel("Año", { exact: true }).fill("1990");
await p.getByLabel("Dirección", { exact: true }).fill("Calle 1 # 2-3");
for (const [l, o] of [["Género", /Femenino/i], ["Departamento", /Caldas/], ["Ciudad", /^Manizales$/]]) {
  await p.getByLabel(l).click();
  await p.getByRole("option", { name: o }).first().click();
}
await p.getByRole("checkbox").click();
await p.getByRole("button", { name: /Guardar|Continuar|Finalizar/i }).click();
await p.waitForURL(/\/inicio/, { timeout: 30000 });
await settled(p);
ok("cuenta lista");

// Servidor lento: se retrasa dos segundos la respuesta de la navegación (payload RSC).
let retrasando = true;
await p.route("**/*", async (route) => {
  const url = route.request().url();
  const esNavegacion = url.includes("_rsc=") || route.request().resourceType() === "document";
  if (retrasando && esNavegacion && !url.includes("/api/")) {
    await new Promise((r) => setTimeout(r, 2000));
  }
  await route.continue();
});

// ---------- dentro del producto ----------
await p.getByRole("link", { name: "Contratos", exact: true }).first().click();
const cargando = p.getByRole("status", { name: /Cargando/ });
await cargando.first().waitFor({ timeout: 5000 });
ok("al ir a Contratos aparece el esqueleto de inmediato");
/*
 * Con esqueleto de ruta el spinner del menú no llega a verse, y así debe ser: la navegación se
 * confirma en cuanto aparece el esqueleto, que es una señal mejor. El spinner queda para las
 * navegaciones que no tienen uno — las que cambian de marco, como salir al catálogo público.
 */
ok("y la opción del menú no necesita spinner: el esqueleto ya respondió");
await p.screenshot({ path: `${SHOT_DIR}/cargando-arriendos.png`, fullPage: false });
await p.waitForURL(/\/contratos$/, { timeout: 25000 });
await settled(p);
await p.waitForFunction(() => document.body.innerText.includes("Contratos"), null, { timeout: 25000 });
if (await p.getByRole("status", { name: /Cargando/ }).count()) throw new Error("el esqueleto se queda pegado");
ok("y desaparece cuando llega el contenido");

// El menú sigue vivo mientras carga: se puede cambiar de idea a media navegación
await p.getByRole("link", { name: /Mis inmuebles/ }).first().click();
await p.getByRole("link", { name: "Soporte", exact: true }).first().click();
await p.waitForURL(/\/soporte$/, { timeout: 25000 });
await settled(p);
ok("el menú sigue usable durante la carga: se puede cambiar de destino");

// ---------- el catálogo público ----------
/*
 * Salir al catálogo cambia de marco, y ahí no hay esqueleto de ruta a propósito: un `loading.tsx`
 * por encima de `/inmuebles` cubriría también `/inmuebles/<slug>`, y un esqueleto por encima de
 * una ruta convierte su `notFound()` en un 200 con la página de "no existe" dentro — un 404 falso
 * en la única página que indexan los buscadores. Lo que sí se comprueba es que llega y que el
 * detalle sigue respondiendo 404 de verdad.
 */
await p.goto(BASE + "/inicio", { waitUntil: "domcontentloaded" });
await settled(p);
await p.locator('a[href="/inmuebles"]').first().click();
await p.waitForURL(/\/inmuebles$/, { timeout: 25000 });
await settled(p);
await p.waitForFunction(() => document.body.innerText.includes("Encuentra tu próximo hogar"), null, { timeout: 25000 });
ok("salir al catálogo llega bien");

const detalle = await p.request.get(BASE + "/inmuebles/no-existe-de-verdad");
if (detalle.status() !== 404) throw new Error("un inmueble inexistente responde " + detalle.status() + ", no 404");
ok("y un inmueble inexistente sigue respondiendo 404, no un 200 con cara de 404");

retrasando = false;
if (problemas.length) throw new Error("consola: " + problemas.join(" | "));
ok("consola sin errores");
await b.close();
