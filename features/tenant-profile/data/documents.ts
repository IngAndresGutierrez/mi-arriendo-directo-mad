import "server-only";

import { adminDb, adminStorage } from "@/shared/firebase/admin";

import type { DocumentKind, TenantDocument } from "../domain/documents";

type Snapshot = { id: string; data: () => Record<string, unknown> | undefined };

function iso(value: unknown): string {
  return typeof value === "object" && value !== null && "toDate" in value
    ? (value as { toDate: () => Date }).toDate().toISOString()
    : new Date(0).toISOString();
}

function toDocument(snapshot: Snapshot): TenantDocument | null {
  const data = snapshot.data();
  if (!data) return null;

  return {
    id: snapshot.id,
    kind: data.kind as DocumentKind,
    path: String(data.path ?? ""),
    name: String(data.name ?? ""),
    contentType: String(data.contentType ?? ""),
    size: Number(data.size ?? 0),
    uploadedAt: iso(data.uploadedAt),
  };
}

/** What this tenant has uploaded, oldest first so three payslips keep the order they came in. */
export async function listTenantDocuments(uid: string): Promise<readonly TenantDocument[]> {
  const snapshot = await adminDb()
    .collection("tenantProfiles")
    .doc(uid)
    .collection("documents")
    .orderBy("uploadedAt", "asc")
    .limit(50)
    .get();

  return snapshot.docs
    .map((doc) => toDocument(doc as unknown as Snapshot))
    .filter((document): document is TenantDocument => document !== null);
}

/** How long a link to a document stays valid. Long enough to read it, short enough to be useless later. */
const LINK_TTL_MS = 60 * 60 * 1000;

/**
 * A document plus a link that opens it.
 *
 * The bucket is private, so there is no URL anyone can just hold on to: the server signs one per
 * request, valid for an hour. That is what lets a landlord read a payslip without the file
 * becoming permanently reachable by whoever the link is forwarded to — and what makes a document
 * stop being readable once the process is over, without deleting anything.
 */
export type ViewableDocument = TenantDocument & { readonly url: string };

export async function withSignedUrls(
  documents: readonly TenantDocument[],
): Promise<readonly ViewableDocument[]> {
  const bucket = adminStorage().bucket();

  const signed = await Promise.all(
    documents.map(async (document) => {
      try {
        const [url] = await bucket.file(document.path).getSignedUrl({
          action: "read",
          expires: Date.now() + LINK_TTL_MS,
        });

        return { ...document, url };
      } catch (error) {
        // A record whose file is gone should not take the page down with it.
        console.error(`could not sign ${document.path}:`, error);

        return null;
      }
    }),
  );

  return signed.filter((document): document is ViewableDocument => document !== null);
}
