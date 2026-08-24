import "server-only";

import { cache } from "react";

import { adminDb, adminStorage } from "@/shared/firebase/admin";

import { allAttachments, type Incident, type IncidentAttachment, type IncidentDoc } from "../domain/incident";

/** An hour: long enough to watch a video, short enough that a forwarded link dies. */
const ATTACHMENT_LINK_TTL_MS = 60 * 60 * 1000;

/**
 * Fifty reports on one tenancy is already a tenancy with a problem this product does not solve.
 *
 * A cap rather than a pager, for now, and the honest reason is that nobody has fifty: the page says
 * so when it hits the ceiling instead of silently showing the newest fifty as if they were all.
 */
const MAX_INCIDENTS = 50;

type Snapshot = { id: string; data: () => Record<string, unknown> | undefined };

function iso(value: unknown): string {
  return typeof value === "object" && value !== null && "toDate" in value
    ? (value as { toDate: () => Date }).toDate().toISOString()
    : new Date(0).toISOString();
}

function toIncident(snapshot: Snapshot): Incident | null {
  const data = snapshot.data();
  if (!data) return null;

  const doc = data as unknown as IncidentDoc;

  return {
    ...doc,
    id: snapshot.id,
    // Defaulted rather than trusted: a report with no files has no field to read, and one written
    // before either party could answer it has no thread.
    attachments: doc.attachments ?? [],
    updates: doc.updates ?? [],
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
}

/**
 * The incidents reported on one tenancy, newest first.
 *
 * **Newest first, unlike the months.** A month has a place in a calendar and reads as a sequence; an
 * incident is news, and the one that matters is the one that just happened.
 *
 * `orderBy` on a single field needs no composite index — the automatic single-field ones cover it —
 * which is why this collection does not appear in `firestore.indexes.json`. The moment a `where`
 * joins that `orderBy`, it does: see `lease-indexes.test.ts` and the note it carries, because the
 * emulator does not enforce indexes and a missing one only ever fails in production.
 */
export const listIncidents = cache(async (leaseId: string): Promise<readonly Incident[]> => {
  const snapshot = await adminDb()
    .collection("leases")
    .doc(leaseId)
    .collection("incidents")
    .orderBy("createdAt", "desc")
    .limit(MAX_INCIDENTS)
    .get();

  return snapshot.docs
    .map((doc) => toIncident(doc as unknown as Snapshot))
    .filter((incident): incident is Incident => incident !== null);
});

/** An attachment with a link that works for the next hour, or the same attachment without one. */
export type SignedAttachment = IncidentAttachment & { readonly url: string | null };

/**
 * One report with every file on it signed, **keyed by path**.
 *
 * A map rather than a signed copy of each list, because the files hang off two different places now:
 * the report itself and every update in its thread. Signing them together is one pass, and the UI
 * looks a path up wherever it renders it — so the record still comes from the document and only the
 * link comes from here. A path that is absent from the map is a file whose URL could not be signed,
 * which is a different thing from a file that is not there.
 */
export type IncidentRow = {
  readonly incident: Incident;
  readonly urls: Readonly<Record<string, string | null>>;
};

/**
 * Every report with its files signed, ready to render.
 *
 * **The record is read from the document; only the link comes from the signed URL** — the rule this
 * module has now paid for twice, in the canon panel and in the contract stage. Signing can fail: a
 * deleted object, Cloud Storage down, an environment with no service account (which is every
 * emulated driver run). What is lost then is being able to *open* the file, and nothing else — the
 * report, its title, its description and the fact that it came with three photos all still render.
 * A `url` of `null` is that, said in the type instead of by an absent row.
 *
 * The signing is why this is one function and not a call per row: five files across four reports is
 * twenty round trips to Cloud Storage, and awaited one after another that is the page's whole
 * budget. `incidents/{uid}/**` is unreadable to every client — the landlord is not the owner of that
 * folder — so a signed URL is the only way either party opens one.
 */
export async function incidentRows(
  incidents: readonly Incident[],
): Promise<readonly IncidentRow[]> {
  return Promise.all(
    incidents.map(async (incident) => {
      const files = allAttachments(incident);
      const signed = await Promise.all(files.map((one) => signAttachment(one.path)));

      return {
        incident,
        urls: Object.fromEntries(files.map((one, index) => [one.path, signed[index] ?? null])),
      };
    }),
  );
}

async function signAttachment(path: string): Promise<string | null> {
  if (!path) return null;

  try {
    const [url] = await adminStorage()
      .bucket()
      .file(path)
      .getSignedUrl({ action: "read", expires: Date.now() + ATTACHMENT_LINK_TTL_MS });

    return url;
  } catch (error) {
    // A report whose photo is gone must not take the report down with it.
    console.error(`could not sign ${path}:`, error);

    return null;
  }
}
