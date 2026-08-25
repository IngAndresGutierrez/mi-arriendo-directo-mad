/**
 * `/ajustes`: las tres pestañas de la cuenta.
 *
 * Lo que este driver afirma no es que la pantalla se dibuje, sino las tres cosas que la hacen real:
 *
 * 1. **Los datos son un documento con dos puertas.** Cambiar el teléfono aquí lo cambia en el perfil
 *    de inquilino, porque no hay dos copias — es la corrección que dio forma a la pestaña Perfil.
 * 2. **Los interruptores escriben.** Se lee `users/{uid}/settings/notifications` con el Admin SDK
 *    después de mover uno: afirmar que el interruptor se ve movido afirmaría el estado de React.
 * 3. **La contraseña cambia de verdad.** Se cierra sesión y se entra con la nueva, y la vieja deja de
 *    servir. Todo lo demás puede estar bien y la cuenta seguir con la contraseña anterior.
 */
import {
  adminAuth,
  adminDb,
  assertNoHorizontalScroll,
  assertQuiet,
  BASE,
  config,
  createAccount,
  hydrated,
  launch,
  ok,
  openSession,
  PASSWORD,
  reactReady,
  signInWithPassword,
  settled,
} from "./lib.mjs";

const { apiKey: API_KEY, stamp: STAMP, shotDir: SHOT_DIR } = config();

const NEW_PASSWORD = "OtraClaveDePrueba9";
const email = `ajustes-${STAMP}@miarriendodirecto.test`;
await createAccount(API_KEY, email);

const { browser, problems } = await launch();
const page = await openSession(browser, { email, name: "Ana Ajustes Pérez", problems });

const uid = (await adminAuth().getUserByEmail(email)).uid;
const settingsRef = adminDb().collection("users").doc(uid).collection("settings").doc("notifications");
const tab = (name) => page.getByRole("tab", { name });

try {
  // ── El menú lleva ahí ───────────────────────────────────────────────────────────────────────
  // Era una entrada deshabilitada con su insignia "Pronto": lo que se comprueba es que ya no lo es.
  const entry = page.locator('[data-slot="app-sidebar"]').getByRole("link", { name: "Ajustes" });
  if ((await entry.count()) === 0) throw new Error("«Ajustes» no es un enlace en el menú");
  await entry.click();
  await page.waitForURL(/\/ajustes$/, { timeout: 20000 });
  await settled(page);
  ok("el menú lleva a /ajustes", "la entrada dejó de estar deshabilitada");

  // ── Perfil: un documento con dos puertas ────────────────────────────────────────────────────
  await hydrated(page);
  // Acotado al textbox exacto: en el perfil de inquilino hay tres cosas cuyo nombre accesible
  // empieza por "Teléfono" —el de la cuenta, el de la referencia y la casilla que la autoriza—, así
  // que un `getByLabel` suelto encuentra tres y muere por ambigüedad.
  const phone = page.getByRole("textbox", { name: "Teléfono", exact: true });
  await phone.fill("3009998877");
  await page.getByRole("button", { name: /Guardar cambios/i }).click();
  await page.getByText("Tus datos están guardados").waitFor({ timeout: 20000 });
  ok("los datos de cuenta se guardan desde Ajustes");

  await page.goto(BASE + "/perfil-inquilino", { waitUntil: "domcontentloaded" });
  await settled(page);
  await hydrated(page);
  const echoed = await page
    .getByRole("textbox", { name: "Teléfono", exact: true })
    .inputValue();
  if (echoed !== "3009998877") {
    throw new Error(`el perfil de inquilino muestra ${JSON.stringify(echoed)}, no el teléfono nuevo`);
  }
  ok("el mismo dato aparece en el perfil de inquilino", "un documento, dos puertas");

  await page.goto(BASE + "/ajustes", { waitUntil: "domcontentloaded" });
  await settled(page);

  // ── Notificaciones ──────────────────────────────────────────────────────────────────────────
  await tab("Notificaciones").click();
  const panel = page.locator('[data-slot="notification-preferences"]');
  await panel.waitFor({ timeout: 20000 });

  // La regla que la tabla no puede expresar, dicha antes de la tabla.
  if (!(await panel.getByText(/La campana del portal no se apaga/i).count())) {
    throw new Error("la pantalla no dice que la campana no se apaga");
  }
  ok("dice que la campana no se apaga");

  const processRow = panel.locator('[data-slot="preference-row"][data-category="process"]');
  const remindersRow = panel.locator('[data-slot="preference-row"][data-category="reminders"]');

  /*
   * WhatsApp no manda avisos de proceso, así que ahí no hay interruptor apagado: no hay control.
   * Un control que no hace nada es peor que uno ausente, y esta es la aserción que lo fija.
   */
  if (await processRow.locator('[data-slot="switch"][data-channel="whatsapp"]').count()) {
    throw new Error("hay un interruptor de WhatsApp en una categoría que no sale por WhatsApp");
  }
  if (!(await remindersRow.locator('[data-slot="switch"][data-channel="whatsapp"]').count())) {
    throw new Error("falta el interruptor de WhatsApp en los recordatorios, que sí salen por ahí");
  }
  ok("WhatsApp solo se ofrece donde el producto lo manda");

  // Un `Switch` de Radix ignora un clic al que todavía no se le enganchó el manejador, y Playwright
  // no reintenta: desde su punto de vista la acción se hizo. De ahí `reactReady` sobre el elemento.
  await reactReady(page, '[data-slot="preference-row"][data-category="process"] [data-slot="switch"]');
  const processEmail = processRow.locator('[data-slot="switch"][data-channel="email"]');
  await processEmail.click();
  await panel.getByText("Guardado").waitFor({ timeout: 20000 });

  // La consecuencia real, leída del documento y no del estado de React.
  const afterToggle = (await settingsRef.get()).data();
  if (afterToggle?.process?.email !== false) {
    throw new Error(`el documento dice ${JSON.stringify(afterToggle?.process)}, no que el correo quedó apagado`);
  }
  if (afterToggle?.lease?.email !== true) {
    throw new Error("apagar una categoría apagó otra");
  }
  ok("apagar el correo de una categoría lo escribe en Firestore", "y no toca las demás");

  await page.getByRole("button", { name: "Desactivar todo", exact: true }).click();
  /*
   * Se espera a la consecuencia y no a un plazo: el documento es lo que decide, y una espera fija es
   * una carrera con el cronómetro puesto en lo que bastaba en la máquina donde se escribió.
   */
  let allOff = (await settingsRef.get()).data();
  for (let i = 0; i < 20 && allOff?.reminders?.whatsapp !== false; i += 1) {
    await page.waitForTimeout(250);
    allOff = (await settingsRef.get()).data();
  }
  for (const category of ["process", "lease", "reminders", "errands"]) {
    if (allOff?.[category]?.email !== false) {
      throw new Error(`«Desactivar todo» dejó ${category}.email en ${allOff?.[category]?.email}`);
    }
  }
  ok("«Desactivar todo» escribe la tabla entera");

  await page.getByRole("button", { name: "Activar todo", exact: true }).click();
  let allOn = (await settingsRef.get()).data();
  for (let i = 0; i < 20 && allOn?.process?.email !== true; i += 1) {
    await page.waitForTimeout(250);
    allOn = (await settingsRef.get()).data();
  }
  if (allOn?.process?.email !== true) throw new Error("«Activar todo» no volvió a encenderlo");
  ok("«Activar todo» lo devuelve");

  await assertNoHorizontalScroll(page, "ajustes/notificaciones");
  await page.screenshot({ path: `${SHOT_DIR}/ajustes-notificaciones.png`, fullPage: true });

  // ── Seguridad ───────────────────────────────────────────────────────────────────────────────
  await tab("Seguridad").click();
  const methods = page.locator('[data-slot="sign-in-methods"]');
  await methods.waitFor({ timeout: 20000 });
  if (!(await methods.getByText("Correo y contraseña").count())) {
    throw new Error("no dice con qué entra esta cuenta");
  }
  /*
   * Y no inventa un inventario de sesiones que Firebase no expone. La aserción es negativa a
   * propósito: la referencia pedía esa lista y lo honesto fue no dibujarla.
   */
  if (await page.getByText(/Dispositivo actual/i).count()) {
    throw new Error("hay una lista de dispositivos, que este producto no puede saber");
  }
  ok("dice cómo entras y no finge una lista de dispositivos");

  const form = page.locator('[data-slot="change-password"]');
  await reactReady(page, '[data-slot="change-password"]');

  // Primero la actual equivocada: una comprobación que nunca dice que no no comprueba nada.
  const beforeProvoked = problems.length;
  await form.getByLabel("Contraseña actual").fill("NoEsLaMia1");
  await form.getByLabel("Contraseña nueva").fill(NEW_PASSWORD);
  await form.getByRole("button", { name: /Cambiar contraseña/i }).click();
  await form.getByText("Esa no es tu contraseña actual.").waitFor({ timeout: 20000 });
  ok("una contraseña actual equivocada se rechaza, y lo dice en su campo");

  /*
   * Esa es la única petición que este driver hace fallar a propósito: Identity Toolkit contesta 400
   * a una reautenticación con la contraseña equivocada, y el navegador lo escribe en la consola. Se
   * descuenta **solo lo que apareció durante ese paso y solo si es un 400** — no se apaga la vigilancia
   * de consola, que es lo que dejaría pasar el siguiente error de verdad.
   */
  const during = problems.splice(beforeProvoked);
  problems.push(...during.filter((message) => !/status of 400/.test(message)));

  await form.getByLabel("Contraseña actual").fill(PASSWORD);
  await form.getByLabel("Contraseña nueva").fill(NEW_PASSWORD);
  await form.getByRole("button", { name: /Cambiar contraseña/i }).click();
  /*
   * Se espera a cualquiera de los dos desenlaces, no solo al bueno. Esperar únicamente el éxito
   * convierte cualquier fallo en «expiró la espera», que es el mensaje que no dice nada: lo que hace
   * falta saber es qué frase salió en pantalla.
   */
  const changed = page.getByText(/Tu contraseña quedó cambiada/i);
  const failed = form.locator('[role="alert"], [data-slot="field-error"]');
  await Promise.race([
    changed.waitFor({ timeout: 25000 }),
    failed.first().waitFor({ timeout: 25000 }),
  ]).catch(() => undefined);
  if (!(await changed.count())) {
    throw new Error(`no cambió la contraseña: ${(await failed.allTextContents()).join(" | ") || "sin mensaje en pantalla"}`);
  }
  ok("la contraseña se cambia desde dentro de la cuenta");

  await assertNoHorizontalScroll(page, "ajustes/seguridad");
  await page.screenshot({ path: `${SHOT_DIR}/ajustes-seguridad.png`, fullPage: true });

  /*
   * La aserción que importa, y la única que no se puede fingir: entrar con la nueva y que la vieja
   * ya no sirva. Todo lo anterior puede estar verde con la cuenta en la contraseña de siempre.
   */
  if ((await signInWithPassword(API_KEY, email, NEW_PASSWORD)).error) {
    throw new Error("la contraseña nueva no sirve para entrar");
  }
  if (!(await signInWithPassword(API_KEY, email, PASSWORD)).error) {
    throw new Error("la contraseña vieja todavía sirve");
  }
  ok("se entra con la nueva y la vieja dejó de servir");

  /*
   * Lo que **no** se afirma aquí, y es deliberado: que la sesión de este navegador sobreviva al
   * cambio. Cambiar la contraseña revoca los refresh tokens, así que la cookie —firmada con un token
   * anterior— dejaría de valer si `changePassword` no volviera a sellarla; pero el emulador de Auth
   * sigue aceptando el token previo, igual que hace tras un `accounts:resetPassword`. Una aserción
   * que no puede fallar se lee como cobertura y es peor que ninguna, así que aquí queda dicha en vez
   * de escrita. Si siguieras en la página después de esto, es que funciona.
   */

  // ── 390px ───────────────────────────────────────────────────────────────────────────────────
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE + "/ajustes", { waitUntil: "domcontentloaded" });
  await settled(page);
  await assertNoHorizontalScroll(page, "ajustes/perfil a 390px");
  await tab("Notificaciones").click();
  await page.locator('[data-slot="notification-preferences"]').waitFor({ timeout: 20000 });
  await assertNoHorizontalScroll(page, "ajustes/notificaciones a 390px");
  await page.screenshot({ path: `${SHOT_DIR}/ajustes-movil.png`, fullPage: true });
  ok("cabe a 390px sin scroll horizontal");

  assertQuiet(problems);
} finally {
  await browser.close();
}
