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
export { RentalsCard } from "./ui/rentals-card";
export { DossierSummary } from "./ui/dossier-summary";
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
