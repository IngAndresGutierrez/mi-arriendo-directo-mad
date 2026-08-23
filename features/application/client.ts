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
  contractState,
  isPdfContract,
  CONTRACT_PROVIDER,
  CONTRACT_STATE_LABELS,
  type SignedContract,
} from "./domain/contract";
export {
  guaranteeState,
  isProviderLink,
  GUARANTEE_PLAN,
  GUARANTEE_PROVIDER,
  GUARANTEE_STATE_LABELS,
  type Guarantee,
} from "./domain/guarantee";
