/**
 * One-off migration: Spanish -> English collection, field, claim and value names.
 * Run with --apply to write; without it, it only prints what it would do.
 */
import { readFileSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")),l.slice(l.indexOf("=")+1).replace(/^"|"$/g,"")]));
initializeApp({ credential: cert({ projectId: env.FIREBASE_PROJECT_ID, clientEmail: env.FIREBASE_CLIENT_EMAIL, privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g,"\n") }) });
const db = getFirestore();
const auth = getAuth();
const apply = process.argv.includes("--apply");

const ROLE = { inquilino: "tenant", propietario: "landlord", admin: "admin" };
const GENDER = { femenino: "female", masculino: "male", no_binario: "non_binary", prefiero_no_decir: "prefer_not_to_say" };
const FIELD = { nombre: "fullName", telefono: "phone", telefonoPais: "phoneCountry", genero: "gender",
  direccion: "address", fechaNacimiento: "birthDate", rol: "role", aceptoTerminosEn: "termsAcceptedAt" };
const ADDRESS = { linea: "line", ciudad: "city", departamento: "department" };

function migrateProfile(data) {
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    const key = FIELD[k] ?? k;
    if (key === "address" && v && typeof v === "object") {
      out.address = Object.fromEntries(Object.entries(v).map(([ak, av]) => [ADDRESS[ak] ?? ak, av]));
    } else if (key === "role") out.role = ROLE[v] ?? v;
    else if (key === "gender") out.gender = GENDER[v] ?? v;
    else out[key] = v;
  }
  return out;
}

const old = await db.collection("usuarios").get();
console.log(`usuarios: ${old.size} documento(s)`);
for (const doc of old.docs) {
  const next = migrateProfile(doc.data());
  console.log(`  ${doc.id.slice(0,8)}…`);
  console.log(`    antes:   ${Object.keys(doc.data()).join(", ")}`);
  console.log(`    despues: ${Object.keys(next).join(", ")}  role=${next.role} gender=${next.gender}`);
  if (apply) {
    await db.collection("users").doc(doc.id).set(next);
    const written = await db.collection("users").doc(doc.id).get();
    if (!written.exists) throw new Error("la copia no quedo escrita: no borro el original");
    await doc.ref.delete();
    console.log("    escrito en users/ y borrado de usuarios/");
  }
}

for (const name of ["contratos", "inmuebles", "postulaciones"]) {
  const snap = await db.collection(name).limit(1).get();
  console.log(`${name}: ${snap.empty ? "vacia, nada que migrar" : "TIENE DATOS — revisar"}`);
}

const users = await auth.listUsers(1000);
for (const u of users.users) {
  const claims = u.customClaims ?? {};
  if (!("rol" in claims)) { console.log(`claims ${u.email}: nada que migrar (${JSON.stringify(claims)})`); continue; }
  const { rol, ...rest } = claims;
  const next = { ...rest, role: ROLE[rol] ?? rol };
  console.log(`claims ${u.email}: ${JSON.stringify(claims)} -> ${JSON.stringify(next)}`);
  if (apply) {
    await auth.setCustomUserClaims(u.uid, next);
    // The old token stays signed with the previous claim until it is refreshed.
    await auth.revokeRefreshTokens(u.uid);
    console.log("    claim actualizado y refresh tokens revocados");
  }
}
console.log(apply ? "\nMIGRACION APLICADA" : "\n(en seco: nada escrito — usa --apply)");
