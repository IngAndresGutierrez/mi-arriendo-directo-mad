import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")),l.slice(l.indexOf("=")+1).replace(/^"|"$/g,"")]));
const KEY = env.NEXT_PUBLIC_FIREBASE_API_KEY;
const BASE = "https://www.miarriendodirecto.com";
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Esperar a que el deployment nuevo sirva: reintenta el login hasta que deje de dar 401.
let attempt = 0, ses, cookie, su;
while (attempt < 14) {
  attempt++;
  su = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`,
    { method: "POST", body: JSON.stringify({ email: `login-check-${Date.now()}@miarriendodirecto.test`, password: "ClaveDePrueba1", returnSecureToken: true }) }).then(r => r.json());
  ses = await fetch(BASE + "/api/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken: su.idToken }) });
  cookie = (ses.headers.getSetCookie?.() ?? []).find(c => c.startsWith("session="))?.split(";")[0];
  console.log(`  intento ${String(attempt).padStart(2)}  POST /api/session -> ${ses.status}${cookie ? "  cookie creada ✓" : ""}`);
  if (ses.ok) break;
  await sleep(25000);
}
if (!ses.ok) { console.log("UID=" + su.localId); console.log("sigue fallando:", (await ses.text()).slice(0,120)); process.exit(2); }

const g1 = await fetch(BASE + "/inicio", { headers: { cookie }, redirect: "manual" });
console.log(`  GET /inicio (sin perfil)      ${g1.status} -> ${g1.headers.get("location")}`);
const g2 = await fetch(BASE + "/registro/completar-perfil", { headers: { cookie }, redirect: "manual" });
console.log(`  GET onboarding con sesión     ${g2.status}`);
if (g2.status === 200) {
  const html = await g2.text();
  console.log(`  formulario de perfil          ${html.includes("Completa tu perfil") ? "sí ✓" : "NO"}`);
  console.log(`  botón de cerrar sesión        ${html.includes("Cerrar sesión") ? "sí ✓" : "NO"}`);
}
const out = await fetch(BASE + "/api/session", { method: "DELETE", headers: { cookie } });
console.log(`  DELETE /api/session           ${out.status}`);
const g3 = await fetch(BASE + "/inicio", { headers: { cookie }, redirect: "manual" });
console.log(`  GET /inicio tras cerrar       ${g3.status} -> ${g3.headers.get("location")}`);
console.log("UID=" + su.localId);
