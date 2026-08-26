import { dictionaryFor } from "@/shared/i18n/dictionary";
import type { Locale } from "@/shared/i18n/locale";

import { DOCUMENT_KINDS, type DocumentKind } from "./documents";
import { DOCUMENT_TYPES, OCCUPATIONS, type DocumentType, type Occupation } from "./tenant-profile";

/**
 * Every label the dossier needs, in one language, as **plain records**.
 *
 * The same move `features/property/domain/labels.ts` makes, and for the same reason: these were
 * `DOCUMENT_TYPE_LABELS`, `OCCUPATION_LABELS`, `EMPLOYER_LABELS`, `DOCUMENT_LABELS` and
 * `DOCUMENT_HINTS` sitting beside their unions. The keys are unchanged — they are the stored values
 * — and only the words moved into `shared/i18n/messages`.
 *
 * **Everything here is a string**, never a function, because the dossier's fields and the document
 * checklist are Client Components: a function cannot cross the RSC boundary. `labels.test.ts`
 * asserts it, the way the property one does.
 */
export type DossierLabels = {
  readonly documentTypes: Readonly<Record<DocumentType, string>>;
  readonly occupations: Readonly<Record<Occupation, string>>;
  readonly employerLabels: Readonly<Record<Occupation, string>>;
  readonly documentLabels: Readonly<Record<DocumentKind, string>>;
  readonly documentHints: Readonly<Record<DocumentKind, string>>;
};

/**
 * Built from the unions rather than written out, so a value added to `OCCUPATIONS` or
 * `DOCUMENT_KINDS` with no word for it fails `pnpm typecheck` here.
 */
export function dossierLabels(locale: Locale): DossierLabels {
  const copy = dictionaryFor(locale).dossier;

  const from = <K extends PropertyKey>(keys: readonly K[], of: Readonly<Record<K, string>>) =>
    Object.fromEntries(keys.map((key) => [key, of[key]])) as unknown as Readonly<Record<K, string>>;

  return {
    documentTypes: from(DOCUMENT_TYPES, copy.documentTypes),
    occupations: from(OCCUPATIONS, copy.occupations),
    employerLabels: from(OCCUPATIONS, copy.employerLabels),
    documentLabels: from(DOCUMENT_KINDS, copy.documentLabels),
    documentHints: from(DOCUMENT_KINDS, copy.documentHints),
  };
}
