import { chromium } from "playwright";
import { BASE, config, createAccount, settled, LOGIN_PATH } from "./lib.mjs";
const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();

const email = `fecha-${STAMP}@miarriendodirecto.test`;
await createAccount(API_KEY, email);
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 900, height: 900 } })).newPage();
await p.goto(BASE + LOGIN_PATH, { waitUntil: "domcontentloaded" });
await settled(p);
await p.waitForFunction(() => { const f = document.querySelector("form"); return f && Object.keys(f).some((k) => k.startsWith("__react")); }, null, { timeout: 20000 });
await p.getByLabel("Correo electrónico").fill(email);
await p.getByLabel("Contraseña").fill("ClaveDePrueba1");
await p.getByRole("button", { name: /Ingresar|Iniciar/i }).click();
await p.waitForURL(/completar-perfil/, { timeout: 25000 });
await settled(p);
await p.getByLabel("Día", { exact: true }).fill("03");
await p.getByLabel("Mes", { exact: true }).click();
await p.getByRole("option", { name: "Mayo", exact: true }).click();
await p.getByLabel("Año", { exact: true }).fill("1994");
const caja = await p.evaluate(() => {
  // Los cuatro de una sola pasada: leerlos uno por uno deja que el formulario revalide en medio
  // y la fila entera se corre unos píxeles, que se lee como un desalineado que no existe.
  const r = (el) => ({ top: Math.round(el.getBoundingClientRect().top), h: Math.round(el.getBoundingClientRect().height) });
  return {
    /*
     * Por su `id`, no por el texto de su etiqueta. Buscaba `=== "Género"` y la etiqueta dice
     * "Género (opcional)" desde que el campo dejó de ser obligatorio — es un dato sensible y el
     * artículo 6 de la Ley 1581 prohíbe exigirlo. Esta prueba va de alineación, así que la redacción
     * de la etiqueta es justo lo que no debería poder romperla.
     */
    genero: r(document.getElementById("gender")),
    dia: r(document.querySelector('[id$="-day"]')),
    mes: r(document.querySelector('[id$="-month"]')),
    anio: r(document.querySelector('[id$="-year"]')),
  };
});
const tops = Object.values(caja).map((c) => c.top);
const alturas = Object.values(caja).map((c) => c.h);
console.log(`tops — ${Object.entries(caja).map(([k, v]) => `${k} ${v.top}`).join(", ")}`);
console.log(`alturas — ${Object.entries(caja).map(([k, v]) => `${k} ${v.h}px`).join(", ")}`);
const mismaFila = Math.max(...tops) - Math.min(...tops) <= 1;
const mismaAltura = Math.max(...alturas) - Math.min(...alturas) <= 1;
console.log(`misma fila: ${mismaFila ? "sí" : "NO"} — misma altura: ${mismaAltura ? "sí" : "NO"}`);
if (!mismaFila || !mismaAltura) throw new Error("género y fecha de nacimiento no están alineados");

const genero = await p.locator("#gender").boundingBox();
const anio = await p.locator('[id$="-year"]').boundingBox();
if (genero.x + genero.width > anio.x) throw new Error("la fecha no está a la derecha del género");
await p.screenshot({
  path: `${SHOT_DIR}/fecha.png`,
  clip: { x: genero.x - 20, y: genero.y - 60, width: anio.x + anio.width - genero.x + 40, height: 130 },
});
console.log("captura lista");
await b.close();
