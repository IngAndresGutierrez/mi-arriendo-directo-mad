/**
 * Public API of the lease module: the tenancy that runs *after* the nine-stage process.
 *
 * Anything not exported here is internal to the feature.
 */
export {
  AREA_CONDITIONS,
  AREA_CONDITION_LABELS,
  HANDOVER_KINDS,
  HANDOVER_KIND_LABELS,
  HANDOVER_STATE_LABELS,
  MAX_AREA_PHOTOS,
  MAX_HANDOVER_AREAS,
  MAX_OBJECTION_PHOTOS,
  SUGGESTED_AREAS,
  acceptanceApplies,
  availableHandoverActions,
  checkoutBlocker,
  damagedAreas,
  handoverAnchor,
  handoverFingerprint,
  handoverFolder,
  handoverPhotoProblem,
  handoverState,
  isHandoverKind,
  isHandoverSettled,
  isOwnHandoverPath,
  mayDo,
  objectionApplies,
  type AreaCondition,
  type Handover,
  type HandoverArea,
  type HandoverKind,
  type HandoverPhoto,
  type HandoverState,
} from "./domain/handover";
export {
  certificateReference,
  clearance,
  clearanceBlocker,
  receiptBlocker,
  rentReceipt,
  type Clearance,
  type ClearanceBlocker,
  type ReceiptBlocker,
  type RentReceipt,
} from "./domain/certificate";
export { clearancePdf, receiptPdf } from "./actions/certificate-pdf";
export { getHandover, getHandovers, handoverView, type HandoverView } from "./data/handover";
export { HandoverPanel } from "./ui/handover-panel";
export {
  acceptHandover,
  objectHandover,
  saveHandoverDraft,
  submitHandover,
  type HandoverActionResult,
} from "./actions/handover";
export {
  CANON_REMINDERS,
  REMINDER_HORIZON_DAYS,
  canonReminderAudience,
  daysFromDue,
  dueCanonReminder,
  isCanonReminderId,
  remindableMonths,
  type CanonReminderId,
} from "./domain/canon-reminder";
export { remindDueCanons, type CanonSweep } from "./actions/remind-canons";
export {
  currentMonth,
  currentTermEnd,
  isOpen,
  leaseSchedule,
  leaseSummary,
  leaseTermState,
  monthsBetween,
  periodAnchor,
  periodLabel,
  periodOf,
  periodState,
  periodTitle,
  shiftMonths,
  termEndDate,
  termsElapsed,
  verdictApplies,
  LEASE_TERM_STATES,
  LEASE_TERM_STATE_LABELS,
  MAX_SCHEDULED_MONTHS,
  PERIOD_STATES,
  PERIOD_STATE_LABELS,
  type Lease,
  type LeaseSummary,
  type LeaseTermState,
  type Period,
  type PeriodState,
  type ScheduledMonth,
} from "./domain/lease";
export {
  allAttachments,
  allowedTransitions,
  attachmentLimit,
  attachmentProblem,
  attachmentsLabel,
  canTransition,
  incidentAnchor,
  incidentState,
  isIncidentOpen,
  transitionRequiresNote,
  INCIDENT_STATES,
  INCIDENT_STATE_LABELS,
  incidentFolder,
  isImageAttachment,
  isOwnAttachmentPath,
  isVideoAttachment,
  INCIDENT_CONTENT_TYPES,
  INCIDENT_DESCRIPTION_MAX,
  INCIDENT_IMAGE_MAX_BYTES,
  INCIDENT_TITLE_MAX,
  INCIDENT_VIDEO_MAX_BYTES,
  MAX_INCIDENT_ATTACHMENTS,
  type Incident,
  type IncidentAttachment,
  type IncidentState,
  type IncidentUpdate,
} from "./domain/incident";
export {
  incidentRows,
  listIncidents,
  type IncidentRow,
  type SignedAttachment,
} from "./data/incident";
export { reportIncident, updateIncident, type IncidentActionResult } from "./actions/incident";
export {
  focusMonth,
  getLeaseFor,
  leaseIdsAmong,
  listLeasesFor,
  listPeriods,
  monthRows,
  periodsWithReceipts,
  withReceiptUrl,
  type LeaseListing,
  type MonthRow,
} from "./data/lease";
export { startLease } from "./actions/start-lease";
export { saveLeasePayout, type LeasePayoutResult } from "./actions/payout";
export {
  recordCanonVerdict,
  uploadCanonReceipt,
  type CanonActionResult,
} from "./actions/canon";
export { LeaseCard } from "./ui/lease-card";
export { LeaseSummaryPanel } from "./ui/lease-summary-panel";
export { LeaseTabs } from "./ui/lease-tabs";
export { LivePeriods } from "./ui/live-periods";
export { IncidentList } from "./ui/incident-list";
export { MonthList } from "./ui/month-list";
export { PayoutCard } from "./ui/payout-card";
