/**
 * One-off backfill: properties published before slugs were reserved get their slug stored and
 * its reservation created, so their URL resolves without the id.
 */
import { readFileSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")),l.slice(l.indexOf("=")+1).replace(/^"|"$/g,"")]));
initializeApp({ credential: cert({ projectId: env.FIREBASE_PROJECT_ID, clientEmail: env.FIREBASE_CLIENT_EMAIL, privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g,"\n") }) });
const db = getFirestore();
const apply = process.argv.includes("--apply");

const slugify = (title, city) =>
  `${title} ${city}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70).replace(/-+$/g, "");

for (const d of (await db.collection("properties").get()).docs) {
  const x = d.data();
  const base = x.slug || slugify(x.title, x.area?.city ?? "");
  let slug = base, n = 1;
  while (true) {
    const taken = await db.collection("propertySlugs").doc(slug).get();
    if (!taken.exists || taken.data()?.propertyId === d.id) break;
    slug = `${base}-${++n}`;
  }
  console.log(`  ${d.id} | "${x.title}" -> /inmuebles/${slug}${x.slug ? "" : "  (no tenía slug guardado)"}`);
  if (apply) {
    await db.collection("propertySlugs").doc(slug).set({ propertyId: d.id });
    await d.ref.update({ slug });
    console.log("    reservado y guardado");
  }
}
console.log(apply ? "BACKFILL APLICADO" : "(en seco: nada escrito — usa --apply)");
process.exit(0);
