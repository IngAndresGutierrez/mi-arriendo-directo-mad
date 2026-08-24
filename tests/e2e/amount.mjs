import { chromium } from "playwright";
import {
  acceptLegalConsents,
  BASE,
  config,
  createAccount,
  fillBirthdate,
  MONTHS,
  ok,
  settled,
  LOGIN_PATH,
} from "./lib.mjs";
import { join } from "node:path";
const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();
const SHOT = join(SHOT_DIR, "amount.png");

const email = `amount-${STAMP}@miarriendodirecto.test`;
const su = await createAccount(API_KEY, email);
console.log("UID=" + su.localId);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });

await p.goto(BASE + LOGIN_PATH, { waitUntil: "domcontentloaded" });
await settled(p);
await p.getByLabel("Correo electrónico").fill(email);
await p.getByLabel("Contraseña").fill("ClaveDePrueba1");
await p.getByRole("button", { name: /Ingresar|Iniciar/i }).click();
await p.waitForURL(/completar-perfil/, { timeout: 25000 });
await settled(p);
await p.getByLabel("Nombre completo").fill("Ana Pérez Uno");
await p.getByLabel("Teléfono").fill("3001234567");
await fillBirthdate(p, "10", MONTHS[Number("05") - 1], "1990");
await p.getByLabel("Dirección", { exact: true }).fill("Calle 1 # 2-3");
for (const [l, o] of [["Género", /Femenino/i], ["Departamento", /Caldas/], ["Ciudad", /^Manizales$/]]) { await p.getByLabel(l).click(); await p.getByRole("option", { name: o }).first().click(); }
await acceptLegalConsents(p);
await p.getByRole("button", { name: /Guardar|Continuar/i }).click();
await p.waitForURL(/\/inicio/, { timeout: 30000 });
await settled(p);
await p.goto(BASE + "/inmuebles/publicar", { waitUntil: "domcontentloaded" });
await settled(p);

const rent = p.getByLabel("Canon mensual (COP)");
await rent.click();

// 1. se va formateando tecla a tecla
const seen = [];
for (const ch of "1800000") {
  await p.keyboard.type(ch);
  seen.push(await rent.inputValue());
}
console.log("  progresión:", seen.join(" → "));
if (seen.at(-1) !== "1.800.000") throw new Error(`terminó en ${seen.at(-1)}`);
if (seen[3] !== "1.800") throw new Error(`a los 4 dígitos mostraba ${seen[3]}`);
ok("agrupa mientras se escribe");

// 2. el cursor no salta al final al editar en medio
await rent.evaluate((el) => el.setSelectionRange(1, 1));   // justo después del "1"
await p.keyboard.type("9");
const afterInsert = await rent.inputValue();
const caret = await rent.evaluate((el) => el.selectionStart);
if (afterInsert !== "19.800.000") throw new Error(`quedó ${afterInsert}`);
if (caret !== 2) throw new Error(`el cursor quedó en ${caret}, no en 2`);
ok("al insertar en medio el cursor se queda donde estaba", `"${afterInsert}", cursor en ${caret}`);

// 3. borrar deja el campo vacío, no un cero pegado
await rent.press("ControlOrMeta+a");
await rent.press("Backspace");
if ((await rent.inputValue()) !== "") throw new Error("no quedó vacío");
ok("al borrar todo vuelve el placeholder");

// 4. no acepta letras ni signos
await p.keyboard.type("abc-12x3");
const filtered = await rent.inputValue();
if (filtered !== "123") throw new Error(`dejó pasar ${filtered}`);
ok("ignora letras y signos", `"abc-12x3" → "${filtered}"`);

await rent.press("ControlOrMeta+a");
await p.keyboard.type("1800000");
const admin = p.getByLabel("Administración (COP)");
await admin.click();
await p.keyboard.type("250000");
if ((await admin.inputValue()) !== "250.000") throw new Error("la administración no se formateó");
ok("administración también", await admin.inputValue());
await p.screenshot({ path: SHOT, clip: { x: 330, y: 0, width: 700, height: 1000 } });
await b.close();
