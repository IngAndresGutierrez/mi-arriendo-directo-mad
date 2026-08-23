/**
 * The signature stage: **firma electrónica** taken inside this product.
 *
 * ## Why this is ours and not a provider's
 *
 * A residential lease in Colombia needs no particular form at all — Ley 820 de 2003, art. 3:
 * *"El contrato de arrendamiento para vivienda urbana puede ser verbal o escrito."* So a signature
 * here is not what makes the contract valid. It is **evidence** of what the two parties agreed,
 * and the bar is therefore about how well that evidence holds, not about who certified it.
 *
 * ## What the law asks of it, and where each requirement lives
 *
 * Decreto 2364 de 2012 calls an electronic signature *confiable* when the data used to create it
 * belongs **exclusively to the signer** in the context it is used, and when any **later alteration
 * of the signed message is detectable**. When the method is agreed between the parties there is a
 * presumption in its favour — but the party that *provides* the method must be able to prove it is
 * technically sound, and **that party is us**. So the audit trail below is not decoration: it is
 * how that burden is discharged.
 *
 * | Requirement | Where it is satisfied |
 * | --- | --- |
 * | The parties agreed the method | `acceptedClauseAt` and `clauseVersion`, recorded per signer |
 * | Creation data exclusive to the signer | a one-time code to the channel they already verified, plus the session's own uid |
 * | Alteration detectable | `documentHash` — every signature binds to the SHA-256 of the exact file it signed |
 * | We can prove all of it | `signedAt`, `ip`, `userAgent` and the masked channel, kept on the application |
 *
 * **What this is not**: a *firma digital* with a certificate from an ONAC-accredited entity. That
 * one carries a stronger statutory presumption. The difference is probative weight, not validity,
 * and it is worth revisiting for high-value leases.
 */

/** The two people who sign a lease here. A co-signer is the guarantee stage's business. */
export const CONTRACT_PARTIES = ["landlord", "tenant"] as const;
export type ContractParty = (typeof CONTRACT_PARTIES)[number];

export const CONTRACT_PARTY_LABELS: Readonly<Record<ContractParty, string>> = {
  landlord: "Propietario",
  tenant: "Inquilino",
};

/**
 * Where the one-time code is sent.
 *
 * Only channels this product has already verified for that person: the email came with their
 * account, the phone with their profile. Sending a code to an address typed at signing time would
 * prove the signer controls *that address*, which is not the same as being the party.
 */
export const SIGNATURE_CHANNELS = ["email", "whatsapp"] as const;
export type SignatureChannel = (typeof SIGNATURE_CHANNELS)[number];

export const SIGNATURE_CHANNEL_LABELS: Readonly<Record<SignatureChannel, string>> = {
  email: "correo electrónico",
  whatsapp: "WhatsApp",
};

/**
 * The clause both parties accept, and **its version**.
 *
 * Versioned because the presumption in Decreto 2364 rests on what was agreed, and a signature
 * collected under different wording was agreed to different words. Bumping this is how a change of
 * wording stops applying backwards to signatures already taken.
 */
export const SIGNATURE_CLAUSE_VERSION = 1;

export const SIGNATURE_CLAUSE =
  "Acepto firmar este contrato por medios electrónicos. Entiendo que el código que recibo en mi " +
  "correo o WhatsApp verificado equivale a mi firma, que queda registrado el momento exacto en " +
  "que firmo, y que el documento firmado no puede modificarse después sin que se detecte.";

/** Six digits: short enough to read off a phone, long enough not to be guessed in five tries. */
export const OTP_LENGTH = 6;
/** Ten minutes. Long enough to switch to an inbox, short enough that a leaked code is stale. */
export const OTP_TTL_MS = 10 * 60 * 1000;
/** After this many wrong codes the challenge is dead and a new one has to be requested. */
export const OTP_MAX_ATTEMPTS = 5;

/**
 * What the contract file may be: **a PDF, and only a PDF**.
 *
 * Photos were accepted at first, on the reasoning that somebody who printed and signed the contract
 * has a real document. That turned out to cost more than it gave: a photo cannot be stamped, so the
 * signature has nowhere to be drawn, and the panel ends up explaining a limitation instead of
 * offering a feature. A lease is a PDF.
 *
 * `canStamp` stays as a guard and nothing more: no new upload can be an image, but one that is
 * already stored would otherwise be handed to a PDF renderer, which is a broken screen instead of a
 * clear one.
 */
export const CONTRACT_CONTENT_TYPES = ["application/pdf"] as const;

/** Same ceiling as every other upload in the product. */
export const CONTRACT_MAX_BYTES = 8 * 1024 * 1024;

/**
 * Where each party's drawn signature goes on the page.
 *
 * Coordinates are **normalised to 0..1** against the page box, not pixels: the landlord marks the
 * spot on a preview rendered at whatever width their screen gave it, and the stamping happens
 * server-side against the real page size. Storing pixels would tie the record to the zoom level of
 * the browser that placed it.
 *
 * The origin is the **top-left**, as the DOM sees it. `pdf-lib` measures from the bottom, and the
 * conversion happens once, where the stamping is — not in whatever component last touched this.
 */
export type SignatureSpot = {
  readonly party: ContractParty;
  /** Zero-based. */
  readonly page: number;
  /** 0..1 from the left edge, 0..1 from the top edge: the box's top-left corner. */
  readonly x: number;
  readonly y: number;
  /** 0..1 of the page's width and height. */
  readonly width: number;
  readonly height: number;
};

/** What a signature box takes up by default: a signature line's worth of a page. */
export const SPOT_DEFAULT_WIDTH = 0.28;
export const SPOT_DEFAULT_HEIGHT = 0.06;

/** The contract as uploaded, before anybody signs it. */
export type ContractDocument = {
  /** `contracts/{applicationId}/…` — written by the server, never reachable by a client. */
  readonly path: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly bytes: number;
  /** SHA-256 of the bytes, lowercase hex. What every signature binds itself to. */
  readonly sha256: string;
  /** ISO 8601. */
  readonly uploadedAt: string;
};

/**
 * One party's signature, and the evidence that it was theirs.
 *
 * The name and the identity document are copied in rather than read from the profile at display
 * time: what matters is what they were when this was signed, and a profile edited afterwards must
 * not rewrite the record.
 */
export type ContractSignature = {
  readonly party: ContractParty;
  readonly uid: string;
  /** As it stood when they signed. */
  readonly fullName: string;
  /** Type and number as declared, e.g. "Cédula de ciudadanía 1053812345". */
  readonly documentId: string;
  /** ISO 8601, when the correct code was entered. */
  readonly signedAt: string;
  /** ISO 8601, when they accepted the clause. */
  readonly acceptedClauseAt: string;
  readonly clauseVersion: number;
  /** SHA-256 of the file they signed. A signature whose hash no longer matches does not count. */
  readonly documentHash: string;
  readonly channel: SignatureChannel;
  /** Masked, never the full address or number: the other party reads this. */
  readonly sentTo: string;
  readonly ip: string;
  readonly userAgent: string;
  /**
   * The drawn signature, as a PNG in `contracts/{applicationId}/strokes/…`, or empty.
   *
   * Empty is a legitimate signature: the code is what stands for consent, and the stroke is what
   * makes the document *look* signed. A contract uploaded as a photo cannot be stamped, so there
   * the stroke has nowhere to go and the signature is no less valid for it.
   */
  readonly strokePath: string;
};

/**
 * The PDF the parties download: the original with both strokes stamped on it, plus a page of
 * evidence.
 *
 * **Derived, and deliberately not what the signatures bind to.** Stamping changes the bytes, so
 * hashing this would invalidate the very signatures it displays. The original's hash stays the
 * anchor; this one carries its own so a tampered copy is still detectable.
 */
export type StampedContract = {
  readonly path: string;
  readonly sha256: string;
  /** ISO 8601. */
  readonly generatedAt: string;
};

export type Contract = {
  readonly document: ContractDocument | null;
  readonly signatures: readonly ContractSignature[];
  /** Where each party signs on the page. Empty until the landlord marks them. */
  readonly spots: readonly SignatureSpot[];
  /** Generated once both have signed; `null` before that. */
  readonly stamped: StampedContract | null;
  /** Anything worth leaving written down. Both sides read it. */
  readonly note: string;
};

/** Only a PDF can carry a stamped signature. A photo of a contract is still a contract. */
export function canStamp(document: ContractDocument | null): boolean {
  return document?.contentType === "application/pdf";
}

export function spotFor(
  contract: Contract | null,
  party: ContractParty,
): SignatureSpot | null {
  return contract?.spots.find((spot) => spot.party === party) ?? null;
}

/**
 * Whether the landlord has marked where both parties sign.
 *
 * Not a blocker: a contract with no spots is still signable — the code is what signs it — and the
 * stroke simply has nowhere to be drawn. What it gates is whether the drawing pad is offered.
 */
export function spotsReady(contract: Contract | null): boolean {
  return (
    canStamp(contract?.document ?? null) &&
    CONTRACT_PARTIES.every((party) => spotFor(contract, party) !== null)
  );
}

/** A spot is inside the page and big enough to hold a signature. */
export function spotProblem(spot: {
  readonly page: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}): string | null {
  if (!Number.isInteger(spot.page) || spot.page < 0) return "La página no es válida.";
  for (const value of [spot.x, spot.y, spot.width, spot.height]) {
    if (!Number.isFinite(value)) return "La posición no es válida.";
  }
  if (spot.width <= 0 || spot.height <= 0) return "El recuadro de la firma está vacío.";
  if (spot.x < 0 || spot.y < 0) return "El recuadro se sale de la página.";
  if (spot.x + spot.width > 1 || spot.y + spot.height > 1) {
    return "El recuadro se sale de la página.";
  }

  return null;
}

/**
 * The signatures that still count.
 *
 * **This is the "alteration detectable" requirement, made operational.** A signature is bound to
 * the hash of the file it was given, so replacing the document needs no cleanup: the old signatures
 * stop matching and the stage falls back to unsigned by itself. Nothing can be slipped underneath a
 * signature that was already collected.
 */
export function validSignatures(contract: Contract | null): readonly ContractSignature[] {
  const hash = contract?.document?.sha256;
  if (!contract || !hash) return [];

  return contract.signatures.filter((signature) => signature.documentHash === hash);
}

export function hasSigned(contract: Contract | null, party: ContractParty): boolean {
  return validSignatures(contract).some((signature) => signature.party === party);
}

export const CONTRACT_STATES = ["none", "awaiting_signatures", "signed"] as const;
export type ContractState = (typeof CONTRACT_STATES)[number];

export const CONTRACT_STATE_LABELS: Readonly<Record<ContractState, string>> = {
  none: "Sin contrato",
  awaiting_signatures: "Pendiente de firma",
  signed: "Firmado",
};

export function contractState(contract: Contract | null): ContractState {
  if (!contract?.document?.path) return "none";

  return CONTRACT_PARTIES.every((party) => hasSigned(contract, party))
    ? "signed"
    : "awaiting_signatures";
}

/**
 * Why the process cannot move past the signature.
 *
 * Both parties, or it is not a contract. This is also what finally gives the advance button a
 * reason at this stage: before there was nothing to verify, so it was simply always enabled.
 */
export type ContractBlocker =
  | "no_document"
  | "awaiting_both"
  | "awaiting_landlord"
  | "awaiting_tenant"
  | null;

export function contractBlocker(contract: Contract | null): ContractBlocker {
  if (contractState(contract) === "none") return "no_document";

  const landlord = hasSigned(contract, "landlord");
  const tenant = hasSigned(contract, "tenant");

  if (!landlord && !tenant) return "awaiting_both";
  if (!landlord) return "awaiting_landlord";
  if (!tenant) return "awaiting_tenant";

  return null;
}

export function contractBlockerMessage(
  blocker: ContractBlocker,
  isLandlord: boolean,
): string | null {
  switch (blocker) {
    case "no_document":
      return isLandlord
        ? "Sube el contrato de arrendamiento para que las dos partes puedan firmarlo."
        : "El propietario subirá el contrato aquí para que los dos lo firmen.";
    case "awaiting_both":
      return "Falta que firmen las dos partes.";
    case "awaiting_landlord":
      return isLandlord ? "Falta tu firma." : "Ya firmaste. Falta la firma del propietario.";
    case "awaiting_tenant":
      return isLandlord ? "Ya firmaste. Falta la firma del inquilino." : "Falta tu firma.";
    default:
      return null;
  }
}

/**
 * Why a file was refused, as a sentence, or `null` when it is fine.
 *
 * Pure so the browser can say it before spending an upload and the action can say it again without
 * trusting that it did — the same rule in one place instead of two that drift.
 */
export function contractFileProblem(file: {
  readonly type: string;
  readonly size: number;
}): string | null {
  if (!CONTRACT_CONTENT_TYPES.includes(file.type as (typeof CONTRACT_CONTENT_TYPES)[number])) {
    return "El contrato tiene que ser un PDF.";
  }
  if (file.size <= 0) return "El archivo está vacío.";
  if (file.size > CONTRACT_MAX_BYTES) return "El archivo pesa más de 8 MB.";

  return null;
}

/**
 * How many signatures replacing the document would throw away.
 *
 * The landlord is warned before it happens rather than told afterwards: the signatures do not
 * survive a new file, and discovering that after asking the tenant to sign again is a bad way to
 * learn it.
 */
export function replacingVoids(contract: Contract | null): number {
  return validSignatures(contract).length;
}

// ---------------------------------------------------------------------------
// The one-time code
// ---------------------------------------------------------------------------

/** What is kept about a challenge in flight. The code itself is never stored in the clear. */
export type SignatureChallenge = {
  readonly party: ContractParty;
  /** SHA-256 of the code. A leaked document never leaks a usable code. */
  readonly codeHash: string;
  readonly channel: SignatureChannel;
  readonly sentTo: string;
  /** ISO 8601. */
  readonly issuedAt: string;
  readonly attempts: number;
  /** The hash it was issued for: a challenge does not survive a new document either. */
  readonly documentHash: string;
};

export type ChallengeProblem =
  | "missing"
  | "wrong_party"
  | "stale_document"
  | "too_many_attempts"
  | "expired"
  | "none";

/**
 * Whether a challenge may still be answered — before looking at whether the code is right.
 *
 * Separate from the comparison so the reasons are testable without any hashing, and so the action
 * cannot accidentally accept an expired code by checking the two things in the wrong order.
 */
export function challengeProblem(
  challenge: SignatureChallenge | null,
  party: ContractParty,
  documentHash: string,
  now: number,
): ChallengeProblem {
  if (!challenge) return "missing";
  if (challenge.party !== party) return "wrong_party";
  if (challenge.documentHash !== documentHash) return "stale_document";
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) return "too_many_attempts";
  if (now - Date.parse(challenge.issuedAt) > OTP_TTL_MS) return "expired";

  return "none";
}

export function challengeProblemMessage(problem: ChallengeProblem): string | null {
  switch (problem) {
    case "missing":
      return "Pide un código nuevo para firmar.";
    case "expired":
      return "El código ya venció. Pide uno nuevo.";
    case "too_many_attempts":
      return "Demasiados intentos. Pide un código nuevo.";
    case "stale_document":
      return "El contrato cambió después de que pediste el código. Pide uno nuevo.";
    case "wrong_party":
      return "Ese código no es para ti.";
    default:
      return null;
  }
}

/**
 * An email or a phone, shown with most of it hidden.
 *
 * The other party reads this as evidence of *where* the code went, and that is all they need: the
 * full address of the person on the other side is not theirs to have.
 */
export function maskChannel(channel: SignatureChannel, value: string): string {
  if (channel === "email") {
    const at = value.lastIndexOf("@");
    if (at <= 0) return "•••";

    const name = value.slice(0, at);
    const domain = value.slice(at);
    const head = name.slice(0, Math.min(2, name.length));

    return `${head}${"•".repeat(Math.max(3, name.length - head.length))}${domain}`;
  }

  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return "•••";

  return `${"•".repeat(Math.max(3, digits.length - 4))}${digits.slice(-4)}`;
}
