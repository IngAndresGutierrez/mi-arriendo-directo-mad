/**
 * The signature stage: the contract is signed **outside** this product, and the signed file
 * comes back in.
 *
 * Each landlord signs with their own **ZapSign** account, on its free tier — five documents a
 * month, which is more than a landlord with a handful of properties signs. That is deliberate and
 * not a limitation to work around here: the account is theirs, the quota is theirs, and this
 * product neither holds their credentials nor counts their documents. Trying to would mean asking
 * every landlord for an API token to save them one upload.
 *
 * So the shape is the same honest half as the guarantee: point at the tool, say what to do there,
 * and **keep what came out of it**. The difference is that here something real comes back — the
 * PDF both parties signed — and that file is the record of the lease. It is the one artefact in
 * this whole process that a court would ask for.
 */

/**
 * Where the contract is signed. The account is the landlord's, not this product's.
 *
 * `url` points straight at the "new document" screen rather than at ZapSign's home page: the
 * landlord arrives with a signed contract to upload, and a link that lands them on a marketing
 * page makes them navigate for it.
 */
export const CONTRACT_PROVIDER = {
  name: "ZapSign",
  url: "https://app.zapsign.co/conta/documentos/novo",
  /** What the free tier allows, per landlord, per month. */
  freeMonthlyDocuments: 5,
} as const;

/**
 * Said plainly, because "firma digital" sounds like something with a cost and a setup.
 *
 * This step happens **outside** this product, on the landlord's own account, and both of those
 * facts read as friction until somebody says the price and the effort out loud.
 */
export const CONTRACT_EXTERNAL_NOTE =
  `Este paso se hace fuera de la plataforma, en ${CONTRACT_PROVIDER.name}, y es gratis: creas la ` +
  `cuenta en un minuto, sin tarjeta. Nosotros no cobramos nada por esto.`;

export const CONTRACT_STEPS = [
  `Crea tu cuenta gratuita en ${CONTRACT_PROVIDER.name} si no la tienes. Toma un minuto y no pide tarjeta.`,
  "Sube el contrato de arrendamiento y agrega como firmantes al inquilino y a ti.",
  "Cuando los dos hayan firmado, descarga el PDF firmado.",
  "Súbelo aquí: queda guardado para las dos partes y con eso el proceso avanza.",
] as const;

/**
 * What the signed file may be.
 *
 * A PDF is what ZapSign gives back, and it is what this should be. Images are accepted too
 * because a landlord who printed, signed and photographed the contract has a real document —
 * refusing it would push them to rename a JPG to `.pdf`, which is worse for everyone.
 */
export const CONTRACT_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/** Same ceiling as every other upload in the product. */
export const CONTRACT_MAX_BYTES = 8 * 1024 * 1024;

export type SignedContract = {
  /** `contracts/{applicationId}/…` — written by the server, never reachable by a client. */
  readonly path: string;
  /** What the landlord's file was called, for a download that keeps its name. */
  readonly fileName: string;
  readonly contentType: string;
  readonly bytes: number;
  /** ISO 8601. */
  readonly uploadedAt: string;
  /** Anything worth leaving written down. Both sides read it. */
  readonly note: string;
};

export const CONTRACT_STATES = ["none", "signed"] as const;
export type ContractState = (typeof CONTRACT_STATES)[number];

export const CONTRACT_STATE_LABELS: Readonly<Record<ContractState, string>> = {
  none: "Sin firmar",
  signed: "Firmado",
};

export function contractState(contract: SignedContract | null): ContractState {
  return contract?.path ? "signed" : "none";
}

export function isPdfContract(contract: Pick<SignedContract, "contentType">): boolean {
  return contract.contentType === "application/pdf";
}

/**
 * Why the process cannot move past the signature.
 *
 * Only the signed file lets it through. "Ya lo firmamos" is not a contract — the file is, and a
 * process that advanced on somebody's word would leave the stage that matters most with nothing
 * in it. This is also what finally gives the advance button a reason at this stage: until now
 * `contract_signature` had nothing to verify, so the button was simply always enabled.
 */
export type ContractBlocker = "not_uploaded" | null;

export function contractBlocker(contract: SignedContract | null): ContractBlocker {
  return contractState(contract) === "signed" ? null : "not_uploaded";
}

export function contractBlockerMessage(
  blocker: ContractBlocker,
  isLandlord: boolean,
): string | null {
  if (blocker !== "not_uploaded") return null;

  return isLandlord
    ? `Sube el contrato firmado por las dos partes para poder continuar.`
    : `El propietario subirá aquí el contrato firmado por las dos partes.`;
}

/**
 * Why a file was refused, as a sentence, or `null` when it is fine.
 *
 * Pure so the browser can say it before spending an upload and the action can say it again
 * without trusting that it did — the same rule in one place instead of two that drift.
 */
export function contractFileProblem(file: {
  readonly type: string;
  readonly size: number;
}): string | null {
  if (!CONTRACT_CONTENT_TYPES.includes(file.type as (typeof CONTRACT_CONTENT_TYPES)[number])) {
    return "El contrato tiene que ser un PDF, o una foto en JPG, PNG o WEBP.";
  }
  if (file.size <= 0) return "El archivo está vacío.";
  if (file.size > CONTRACT_MAX_BYTES) return "El archivo pesa más de 8 MB.";

  return null;
}
