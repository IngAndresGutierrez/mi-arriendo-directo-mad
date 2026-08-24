/**
 * The half of the application module a Client Component — or another module's domain — may
 * import. `index.ts` also re-exports the data layer, which is `server-only`.
 */
export {
  canAdvance,
  canClose,
  closedAtLabel,
  isUnbuilt,
  nextStage,
  stageDescription,
  stageIndex,
  stageProgress,
  stageProgressLabel,
  stageState,
  APPLICATION_STATUS_LABELS,
  STAGES,
  STAGE_LABELS,
  type Application,
  type ApplicationStatus,
  type Stage,
  type StageState,
} from "./domain/application";
export {
  checkProgress,
  checkStatusOf,
  CHECK_SOURCES,
  CHECK_STATUS_LABELS,
  type CheckResults,
  type CheckSourceId,
  type CheckStatus,
} from "./domain/background-check";
export {
  interviewState,
  interviewWhen,
  INTERVIEW_MINUTES,
  INTERVIEW_STATE_LABELS,
  type Interview,
} from "./domain/interview";
export {
  challengeProblem,
  challengeProblemMessage,
  contractBlocker,
  contractBlockerMessage,
  contractFileProblem,
  contractState,
  hasSigned,
  maskChannel,
  replacingVoids,
  validSignatures,
  CONTRACT_CONTENT_TYPES,
  CONTRACT_PARTIES,
  CONTRACT_PARTY_LABELS,
  CONTRACT_STATE_LABELS,
  OTP_LENGTH,
  SIGNATURE_CHANNELS,
  SIGNATURE_CHANNEL_LABELS,
  SIGNATURE_CLAUSE,
  SIGNATURE_CLAUSE_VERSION,
  type Contract,
  type ContractDocument,
  type ContractParty,
  type ContractSignature,
  type SignatureChannel,
} from "./domain/contract";
export {
  canWaiveGuarantee,
  guaranteeState,
  isProviderLink,
  GUARANTEE_PLAN,
  GUARANTEE_PROVIDER,
  GUARANTEE_STATE_LABELS,
  type Guarantee,
} from "./domain/guarantee";
/*
 * El pago del canon: hacia dónde va, el comprobante y el veredicto.
 *
 * Está aquí y no solo en `index.ts` porque **el arriendo lo reutiliza tal cual**: el primer canon
 * *es* el primer mes de la tenencia, y la cuenta que el propietario declaró en esta etapa es la
 * misma a la que llegan los once siguientes. Una segunda copia de `PaymentReceipt` serían dos
 * cosas que pueden separarse, y la primera en hacerlo sería el campo contra el que el propietario
 * confirma.
 */
export {
  payoutShape,
  payoutSummary,
  receiptFileProblem,
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPES,
  PAYOUT_METHODS,
  PAYOUT_METHOD_LABELS,
  RECEIPT_CONTENT_TYPES,
  RECEIPT_MAX_BYTES,
  type AccountType,
  type PaymentReceipt,
  type Payout,
  type PayoutMethod,
  type ReceiptVerdict,
} from "./domain/payout";
/*
 * El esquema del pago, una sola vez.
 *
 * Es Zod puro — no toca el servidor ni la red — y **una segunda copia serían noventa líneas que
 * pueden separarse**: el día que un banco cambie el formato de su número de cuenta, la copia que
 * nadie recuerde arreglar es la que rechaza una cuenta que funciona. La unión discriminada vive
 * donde la escribió la etapa del primer canon y el arriendo la reutiliza tal cual.
 */
export { payoutSchema, type PayoutInput } from "./validations/payout";
