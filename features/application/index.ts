/**
 * Public API of the application module. Anything not exported here is internal to the feature.
 */
export {
  applicationBlocker,
  canAdvance,
  canClose,
  closedAtLabel,
  isCompleted,
  isUnbuilt,
  nextStage,
  normalizeStage,
  processDescription,
  processStageLabel,
  stageDescription,
  stageIndex,
  stageProgress,
  stageProgressLabel,
  stageState,
  APPLICATION_STATUS_LABELS,
  COMPLETED_LABEL,
  STAGES,
  STAGE_DESCRIPTIONS,
  STAGE_DESCRIPTIONS_LANDLORD,
  STAGE_LABELS,
  type Application,
  type ApplicationStatus,
  type Stage,
  type StageState,
} from "./domain/application";
export {
  getApplicationFor,
  getTenantApplicationTo,
  listApplicationsFor,
} from "./data/application";
export { applyToProperty, type ApplyResult } from "./actions/apply";
export {
  advanceApplication,
  rejectApplication,
  withdrawApplication,
  type StageResult,
} from "./actions/advance";
export { ApplicationForm } from "./ui/application-form";
export { ApplicationCard } from "./ui/application-card";
export { RentalsCard } from "./ui/rentals-card";
export { DossierSummary } from "./ui/dossier-summary";
export { AdvanceButton } from "./ui/advance-button";
export { StageActions } from "./ui/stage-actions";
export { StageTimeline } from "./ui/stage-timeline";
export { authorizeBackgroundChecks, type AuthorizeResult } from "./actions/authorize-checks";
export { BackgroundCheckPanel } from "./ui/background-check-panel";
export { reviewTenantDocument, type ReviewResult } from "./actions/review-document";
export { DocumentReviewPanel, type ReviewableDocument } from "./ui/document-review-panel";
export { LiveApplication } from "./ui/live-application";
export { touchApplicationDocuments } from "./actions/touch-documents";
export { recordBackgroundCheck, type CheckRecordResult } from "./actions/record-check";
export {
  checkProgress,
  checksBlocker,
  checksBlockerMessage,
  checkStatusOf,
  CHECK_SOURCES,
  CHECK_STATUS_LABELS,
  type CheckResults,
  type CheckSourceId,
  type CheckStatus,
} from "./domain/background-check";
export {
  confirmVisit,
  declineVisit,
  proposeVisit,
  recordVisitVerdict,
  type VisitActionResult,
} from "./actions/visit";
export { VisitPanel } from "./ui/visit-panel";
export {
  visitBlocker,
  visitBlockerMessage,
  visitHasPassed,
  visitHostLine,
  visitState,
  visitWhen,
  VISIT_OUTCOMES,
  VISIT_OUTCOME_LABELS,
  VISIT_STATE_LABELS,
  type Visit,
  type VisitHost,
  type VisitOutcome,
  type VisitState,
} from "./domain/visit";
export {
  confirmInterview,
  declineInterview,
  proposeInterview,
  recordInterviewFeedback,
  type InterviewActionResult,
} from "./actions/interview";
export { InterviewPanel } from "./ui/interview-panel";
export {
  interviewBlocker,
  interviewBlockerMessage,
  interviewState,
  interviewWhen,
  INTERVIEW_MINUTES,
  INTERVIEW_STATE_LABELS,
  type Interview,
  type InterviewChannel,
} from "./domain/interview";
export { remindUpcomingInterviews, type ReminderSweep } from "./actions/remind-interviews";
export {
  recordGuaranteePolicy,
  recordGuaranteeRequested,
  saveGuaranteeProgress,
  type GuaranteeActionResult,
  setGuaranteeRequirement,
} from "./actions/guarantee";
export {
  recordReceiptVerdict,
  savePayout,
  uploadReceipt,
  type PayoutActionResult,
} from "./actions/payout";
export {
  firstPaymentBlocker,
  firstPaymentBlockerMessage,
  firstPaymentState,
  payoutShape,
  payoutSummary,
  receiptFileProblem,
  verdictApplies,
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPES,
  FIRST_PAYMENT_STATE_LABELS,
  PAYOUT_METHODS,
  PAYOUT_METHOD_LABELS,
  RECEIPT_CONTENT_TYPES,
  type FirstPayment,
  type PaymentReceipt,
  type Payout,
} from "./domain/payout";
export { GuaranteePanel } from "./ui/guarantee-panel";
export { ContractPanel } from "./ui/contract-panel";
export { FirstPaymentPanel } from "./ui/first-payment-panel";
export {
  removeContract,
  saveSignatureSpots,
  uploadContract,
  type ContractActionResult,
} from "./actions/contract";
export {
  availableSignatureChannels,
  confirmSignature,
  requestSignatureCode,
  type SignatureActionResult,
} from "./actions/signature";
export { withContractUrl, withReceiptUrl, withStampedUrl } from "./data/application";
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
  guaranteeBlocker,
  guaranteeBlockerMessage,
  guaranteeState,
  isProviderLink,
  GUARANTEE_PLAN,
  GUARANTEE_PROVIDER,
  GUARANTEE_STATE_LABELS,
  type Guarantee,
} from "./domain/guarantee";
