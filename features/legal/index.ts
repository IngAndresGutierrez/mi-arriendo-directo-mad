/**
 * Public API of the legal module: the documents, the consent record, the cookie decision and the
 * right to be deleted. Anything not exported here is internal to the feature.
 *
 * The identity of the Responsable and the version of each document live in `shared/legal/`, not
 * here: four layers read them — the pages, the footer, the onboarding form and this module — and
 * two of those are outside `features/`.
 */
export * from "./client";

export { listConsents } from "./data/consent";
export { erasureStatus } from "./data/erasure";
export { deleteAccount, type DeleteAccountResult } from "./actions/delete-account";

export { ConsentHistory } from "./ui/consent-history";
export { LegalDocument, LegalList, LegalSection } from "./ui/legal-document";
