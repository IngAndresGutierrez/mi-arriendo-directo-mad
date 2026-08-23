/** En completar-perfil, la ciudad depende del departamento: se abre vacía y se limpia al cambiarlo. */
import { chromium } from "playwright";
import { BASE, config, ok, settled } from "./lib.mjs";
const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();

const email = `depciudad-${STAMP}@miarriendodirecto.test`;

await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
  { method: "POST", body: JSON.stringify({ email, password: "ClaveDePrueba1", returnSecureToken: true }) }).then(r => r.json());

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1100, height: 1000 } })).newPage();
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
ok("el paso de completar perfil sigue ahí");

const ciudad = p.getByLabel("Ciudad", { exact: true });
if (await ciudad.isEnabled()) throw new Error("la ciudad no espera al departamento");
if (!(await ciudad.innerText()).includes("Elige primero el departamento")) {
  throw new Error("el placeholder no explica que falta el departamento: " + (await ciudad.innerText()));
}
ok("sin departamento, la ciudad está deshabilitada y lo dice");

await p.getByLabel("Departamento").click();
await p.getByRole("option", { name: "Caldas", exact: true }).click();
await ciudad.click();
const opciones = await p.getByRole("option").allInnerTexts();
if (!opciones.includes("Manizales") || !opciones.includes("Chinchiná")) {
  throw new Error("no ofrece los municipios de Caldas: " + JSON.stringify(opciones.slice(0, 8)));
}
if (opciones.includes("Medellín")) throw new Error("ofrece municipios de otro departamento");
ok("con Caldas ofrece sus municipios y solo esos", `${opciones.length} opciones`);
await p.screenshot({ path: `${SHOT_DIR}/dep-ciudad.png`, fullPage: false });
await p.getByRole("option", { name: "Manizales", exact: true }).click();
if (!(await ciudad.innerText()).includes("Manizales")) throw new Error("no quedó seleccionada");
ok("elegir la ciudad la deja puesta");

await p.getByLabel("Departamento").click();
await p.getByRole("option", { name: "Antioquia", exact: true }).click();
const tras = await ciudad.innerText();
if (tras.includes("Manizales")) throw new Error("Manizales sobrevivió al cambio de departamento");
ok("cambiar de departamento limpia la ciudad", JSON.stringify(tras.trim()));
await ciudad.click();
const deAntioquia = await p.getByRole("option").allInnerTexts();
if (!deAntioquia.includes("Medellín")) throw new Error("no cambió el catálogo de ciudades");
ok("y ofrece las del nuevo departamento");
await p.keyboard.press("Escape");

// El resto del formulario, para comprobar que guarda el par
await p.getByLabel("Nombre completo").fill("Ana Propietaria Pérez");
await p.getByLabel("Teléfono").fill("3001234567");
await p.getByLabel("Día", { exact: true }).fill("10");
await p.getByLabel("Mes", { exact: true }).click();
await p.getByRole("option", { name: "Mayo", exact: true }).click();
await p.getByLabel("Año", { exact: true }).fill("1990");
await p.getByLabel("Dirección", { exact: true }).fill("Calle 1 # 2-3");
await p.getByLabel("Género").click();
await p.getByRole("option", { name: /Femenino/i }).first().click();
await ciudad.click();
await p.getByRole("option", { name: "Envigado", exact: true }).click();
await p.getByRole("checkbox").click();
await p.getByRole("button", { name: /Guardar|Continuar|Finalizar/i }).click();
await p.waitForURL(/\/inicio/, { timeout: 30000 });
await settled(p);
ok("guarda el par que sí existe");

await p.goto(BASE + "/perfil-inquilino", { waitUntil: "domcontentloaded" });
await settled(p);
await p.waitForSelector("#address\\.city", { timeout: 15000 });
const enPerfil = await p.getByLabel("Ciudad", { exact: true }).innerText();
if (!enPerfil.includes("Envigado")) throw new Error("Mi perfil no recupera la ciudad: " + enPerfil);
ok("y Mi perfil la recupera", enPerfil.trim());

await p.setViewportSize({ width: 390, height: 844 });
if (await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) throw new Error("scroll horizontal a 390px");
ok("390px sin scroll horizontal");
if (problemas.length) throw new Error("consola: " + problemas.join(" | "));
ok("consola sin errores");
await b.close();
