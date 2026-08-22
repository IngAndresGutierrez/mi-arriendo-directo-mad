/**
 * Public API of the application module. Anything not exported here is internal to the feature.
 */
export {
  applicationBlocker,
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
export { DossierSummary } from "./ui/dossier-summary";
export { StageActions } from "./ui/stage-actions";
export { StageTimeline } from "./ui/stage-timeline";
