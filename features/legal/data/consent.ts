import "server-only";

import { cache } from "react";
import { Timestamp } from "firebase-admin/firestore";

import { adminDb } from "@/shared/firebase/admin";
import { CONSENTS_SUBCOLLECTION, CONSENT_KINDS, type ConsentKind } from "@/shared/legal/documents";

import {
  normalizeConsentVersion,
  withLegacyConsent,
  type ConsentRecord,
} from "../domain/consent";

/** Firestore holds `Timestamp`; a component gets an ISO string. */
function toIso(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isConsentKind(value: unknown): value is ConsentKind {
  return typeof value === "string" && (CONSENT_KINDS as readonly string[]).includes(value);
}

/**
 * What this person has authorised — **this is the derecho de acceso** of Ley 1581 art. 8, lit. a.
 *
 * It reads two places and folds them into one list. The subcollection holds every authorisation
 * given since consents were versioned; `termsAcceptedAt` on the profile is what every account
 * created before that has, and `withLegacyConsent` reads it for what it was — one checkbox
 * covering both documents, at version 1. Ignoring it would tell a consenting user they had never
 * consented, and asking them again would be asking for something they already gave.
 *
 * **It never throws.** It is read by the profile screen alongside the erasure card, and a screen
 * that 500s is a screen from which nobody can exercise any right at all — the same contract
 * `listNotifications` has, and for a stronger reason.
 *
 * Cached per request: the page shows the history and also asks whether anything is pending.
 */
export const listConsents = cache(
  async (uid: string): Promise<readonly ConsentRecord[]> => {
    try {
      const profileRef = adminDb().collection("users").doc(uid);

      const [snapshot, profile] = await Promise.all([
        profileRef.collection(CONSENTS_SUBCOLLECTION).get(),
        profileRef.get(),
      ]);

      const records = snapshot.docs.flatMap<ConsentRecord>((document) => {
        const data = document.data();
        const grantedAt = toIso(data.grantedAt);

        // A kind the code no longer knows, or a record with no date, is not a usable
        // authorisation. Dropping it is safer than surfacing one nobody can interpret.
        if (!isConsentKind(data.kind) || !grantedAt) return [];

        return [
          {
            id: document.id,
            kind: data.kind,
            version: normalizeConsentVersion(data.version),
            grantedAt,
            ip: asString(data.ip),
            userAgent: asString(data.userAgent),
          },
        ];
      });

      return withLegacyConsent(records, toIso(profile.data()?.termsAcceptedAt));
    } catch (error) {
      console.error(`listConsents failed for ${uid}:`, error);

      return [];
    }
  },
);
