import { chromium } from "playwright";
import {
  acceptLegalConsents,
  BASE,
  config,
  createAccount,
  declareReferenceAuthorized,
  fillBirthdate,
  MONTHS,
  ok,
  settled,
} from "./lib.mjs";
const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();


/** La fecha de nacimiento son tres campos: día, mes y año. */
const email = `perfil-${STAMP}@miarriendodirecto.test`;
await createAccount(API_KEY, email);
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
const problems = [];
p.on("pageerror", (e) => problems.push("pageerror: " + e.message));
p.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) problems.push("console: " + m.text().slice(0, 130)); });

await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await settled(p);
await p.waitForFunction(() => { const f = document.querySelector("form"); return f && Object.keys(f).some((k) => k.startsWith("__react")); }, null, { timeout: 20000 });
await p.getByLabel("Correo electrónico").fill(email);
await p.getByLabel("Contraseña").fill("ClaveDePrueba1");
await p.getByRole("button", { name: /Ingresar|Iniciar/i }).click();
await p.waitForURL(/completar-perfil/, { timeout: 25000 });
await settled(p);
await p.getByLabel("Nombre completo").fill("Ana María Restrepo");
await p.getByLabel("Teléfono").fill("3001234567");
await fillBirthdate(p, "10", MONTHS[Number("05") - 1], "1990");
await p.getByLabel("Dirección", { exact: true }).fill("Calle 60 #10-20, apto 301");
for (const [l, o] of [["Género", /Femenino/i], ["Departamento", /Caldas/], ["Ciudad", /^Manizales$/]]) { await p.getByLabel(l).click(); await p.getByRole("option", { name: o }).first().click(); }
await acceptLegalConsents(p);
await p.getByRole("button", { name: /Guardar|Continuar/i }).click();
await p.waitForURL(/\/inicio/, { timeout: 30000 });
await settled(p);
ok("registro completado");

// Lo que se llenó ahí aparece en el perfil, sin volver a preguntarlo.
await p.goto(BASE + "/perfil-inquilino", { waitUntil: "domcontentloaded" });
await settled(p);
await p.waitForFunction(() => document.querySelector("#fullName")?.value === "Ana María Restrepo", null, { timeout: 20000 });
const filled = await p.evaluate(() => ({
  nombre: document.querySelector("#fullName")?.value,
  telefono: document.querySelector('input[name="phone.national"]')?.value,
  direccion: document.querySelector('input[name="address.line"]')?.value,
  // La ciudad es un selector: su valor se lee del texto del trigger, no de un input.
  ciudad: document.querySelector('#address\\.city')?.innerText?.trim(),
}));
// La fecha vuelve repartida en los tres campos, con el mes por su nombre.
const nacimiento = {
  dia: await p.getByLabel("Día", { exact: true }).inputValue(),
  mes: (await p.getByLabel("Mes", { exact: true }).innerText()).trim(),
  anio: await p.getByLabel("Año", { exact: true }).inputValue(),
};
if (nacimiento.dia !== "10" || nacimiento.mes !== "Mayo" || nacimiento.anio !== "1990") {
  throw new Error("la fecha no volvió repartida: " + JSON.stringify(nacimiento));
}
filled.nacimiento = `${nacimiento.dia} de ${nacimiento.mes} de ${nacimiento.anio}`;
for (const [campo, valor] of Object.entries(filled)) {
  if (!valor) throw new Error(`"${campo}" llegó vacío al perfil`);
}
if (filled.telefono !== "3001234567") throw new Error("el teléfono no volvió a nacional: " + filled.telefono);
ok("los datos del registro llegan diligenciados", JSON.stringify(filled));

const genero = await p.getByLabel("Género").innerText();
const depto = await p.getByLabel("Departamento").innerText();
if (!genero.includes("Femenino") || !depto.includes("Caldas")) throw new Error(`los selectores no llegaron: ${genero} / ${depto}`);
ok("los selectores también", `${genero.trim()} · ${depto.trim()}`);
ok("y la fecha de nacimiento vuelve en día, mes y año", filled.nacimiento);

// Un día que no existe en ese mes no se guarda como otro día.
await p.getByLabel("Día", { exact: true }).fill("31");
await p.getByLabel("Mes", { exact: true }).click();
await p.getByRole("option", { name: "Febrero", exact: true }).click();
await p.getByRole("button", { name: /Guardar mis datos/i }).click();
await p.waitForFunction(() => /fecha/i.test(document.body.innerText) && document.querySelector("p.text-destructive") !== null, null, { timeout: 15000 });
ok("el 31 de febrero no pasa: lo rechaza en vez de correrlo a marzo");
await p.getByLabel("Día", { exact: true }).fill("10");
await p.getByLabel("Mes", { exact: true }).click();
await p.getByRole("option", { name: "Mayo", exact: true }).click();

// Y el nombre de la referencia ya no se confunde con el propio.
const rotulos = await p.locator("label").allInnerTexts();
if (rotulos.filter((t) => t.trim() === "Nombre completo").length !== 1) throw new Error("hay dos 'Nombre completo': " + JSON.stringify(rotulos.filter((t) => t.includes("Nombre"))));
if (!rotulos.some((t) => t.includes("Nombre de tu referencia"))) throw new Error("la referencia no dice de quién es");
ok("solo un 'Nombre completo', y la referencia dice de quién es");

// Dos teléfonos en la misma página no pueden compartir id, o escribir en uno llena el otro.
const dupes = await p.evaluate(() => {
  const ids = [...document.querySelectorAll("[id]")].map((el) => el.id);
  return ids.filter((id, i) => ids.indexOf(id) !== i);
});
if (dupes.length) throw new Error("ids duplicados: " + JSON.stringify(dupes));
ok("sin ids duplicados con los dos teléfonos en pantalla");
await p.screenshot({ path: `${SHOT_DIR}/perfil.png`, fullPage: true });

// Corregir un dato lo guarda de verdad.
await p.getByLabel("Nombre completo").fill("Ana María Restrepo Vélez");
await p.getByLabel("Número de documento").fill("1053812345");
await p.getByLabel("Dónde trabajas").fill("Crehana");
await p.getByLabel("Ingresos mensuales (COP)").click();
await p.keyboard.press("ControlOrMeta+a");
await p.keyboard.type("6000000");
await p.getByLabel("Personas que vivirían ahí").fill("2");
await p.getByLabel("Nombre de tu referencia").fill("Carolina Restrepo");
await p.getByLabel("Qué relación tienen").fill("Jefe directo");
await p.getByLabel("Teléfono de tu referencia").fill("3009876543");
await declareReferenceAuthorized(p);
await p.getByRole("button", { name: /Guardar mis datos/i }).click();
try {
  await p.waitForFunction(() => document.body.innerText.includes("tus datos quedaron guardados"), null, { timeout: 25000 });
} catch {
  const errores = await p.locator("p.text-destructive, [role=\"alert\"]").allInnerTexts();
  throw new Error("no confirmó. errores en pantalla=" + JSON.stringify(errores));
}
ok("guarda las dos mitades de una sola vez");

await p.reload({ waitUntil: "domcontentloaded" });
await p.waitForFunction(() => document.querySelector("#fullName")?.value === "Ana María Restrepo Vélez", null, { timeout: 20000 });
ok("el nombre corregido persiste");

// Y el saludo de Inicio usa el nombre nuevo.
await p.goto(BASE + "/inicio", { waitUntil: "domcontentloaded" });
await settled(p);
if (!(await p.evaluate(() => document.body.innerText)).includes("Ana")) throw new Error("el saludo no usa el nombre");
ok("Inicio saluda con ese nombre");

console.log(problems.length ? "  PROBLEMAS:\n   " + problems.join("\n   ") : "  OK    consola sin errores");
await b.close();
