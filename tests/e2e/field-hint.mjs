/** Los dos textos largos del formulario ahora viven en un tooltip: ni se ven de más, ni se pierden. */
import { chromium } from "playwright";
import {
  acceptLegalConsents,
  BASE,
  config,
  createAccount,
  MONTHS,
  ok,
  settled,
} from "./lib.mjs";
const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();

const email = `hint-${STAMP}@miarriendodirecto.test`;
const DIRECCION = "Solo la ve el inquilino cuya postulación apruebes";
const MATRICULA = "El número del certificado de tradición";

await createAccount(API_KEY, email);

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
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
await p.locator('[id$="-day"]').fill("10");
await p.locator('[id$="-month"]').click();
await p.getByRole("option", { name: MONTHS[4], exact: true }).click();
await p.locator('[id$="-year"]').fill("1990");
await p.getByLabel("Dirección", { exact: true }).fill("Calle 1 # 2-3");
for (const [label, option] of [["Género", /Femenino/i], ["Departamento", /Caldas/], ["Ciudad", /^Manizales$/]]) {
  await p.getByLabel(label).click();
  await p.getByRole("option", { name: option }).first().click();
}
await acceptLegalConsents(p);
await p.getByRole("button", { name: /Guardar|Continuar|Finalizar/i }).click();
await p.waitForURL(/\/inicio/, { timeout: 30000 });
await settled(p);
ok("cuenta lista");

await p.goto(BASE + "/inmuebles/publicar", { waitUntil: "domcontentloaded" });
await settled(p);
await p.waitForSelector("#address\\.registryNumber", { timeout: 20000 });

const ocupan = await p.evaluate((frases) => {
  // La copia para lectores de pantalla sigue en el DOM a propósito: lo que no debe pasar es que
  // ocupe alto en el formulario, que era el problema del párrafo permanente.
  return frases.flatMap((frase) =>
    [...document.querySelectorAll("p, div, span")]
      .filter((el) => el.textContent.trim().startsWith(frase) && el.children.length === 0)
      .map((el) => ({ frase, alto: Math.round(el.getBoundingClientRect().height) }))
      .filter((entrada) => entrada.alto > 1),
  );
}, [DIRECCION, MATRICULA]);
if (ocupan.length) throw new Error("el texto sigue ocupando sitio: " + JSON.stringify(ocupan));
ok("ninguno de los dos párrafos ocupa alto en el formulario");

for (const [campo, frase] of [["Dirección", DIRECCION], ["Número de matrícula inmobiliaria", MATRICULA]]) {
  const boton = p.getByRole("button", { name: `Qué es ${campo}` });
  await boton.click();
  await p.getByRole("tooltip").filter({ hasText: frase }).waitFor({ timeout: 5000 });
  ok(`el tooltip de ${campo} explica el campo`);
  const descrito = await p.evaluate((c) => {
    const label = [...document.querySelectorAll("label")].find((l) => l.textContent.trim() === c);
    const input = document.getElementById(label.htmlFor);
    const ids = (input.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);
    return ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
  }, campo);
  if (!descrito.includes(frase)) throw new Error(`el campo ${campo} no queda descrito para un lector de pantalla`);
  ok(`y un lector de pantalla lo recibe igual`);
  // Tocar fuera lo cierra: con dos iconos en la misma sección, si no, quedan los dos abiertos.
  await p.locator("h2").first().click();
  await p.getByRole("tooltip").filter({ hasText: frase }).waitFor({ state: "detached", timeout: 5000 });
  ok(`y tocando fuera se cierra`);
}

{
  const boton = p.getByRole("button", { name: "Qué es Dirección" });
  await boton.scrollIntoViewIfNeeded();
  await boton.click();
  await p.getByRole("tooltip").filter({ hasText: DIRECCION }).waitFor({ timeout: 5000 });
  const caja = await p.locator("#address\\.line").boundingBox();
  await p.screenshot({
    path: `${SHOT_DIR}/hint.png`,
    clip: { x: caja.x - 30, y: caja.y - 120, width: 640, height: 220 },
  });
}
await p.setViewportSize({ width: 390, height: 844 });
const ancho = await p.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth }));
if (ancho.doc > ancho.win + 1) throw new Error("scroll horizontal en 390px");
await p.getByRole("button", { name: "Qué es Dirección" }).click();
await p.getByRole("tooltip").filter({ hasText: DIRECCION }).waitFor({ timeout: 5000 });
ok("en 390px abre con un toque y no desborda");
await p.screenshot({ path: `${SHOT_DIR}/hint-movil.png`, fullPage: false });

if (problemas.length) throw new Error("errores de consola: " + problemas.join(" | "));
ok("consola sin errores");
await b.close();
