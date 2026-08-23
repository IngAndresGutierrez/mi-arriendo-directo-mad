/**
 * The half of the lease module a Client Component — or another module's domain — may import.
 * `index.ts` also re-exports the data layer, which is `server-only`.
 */
export {
  currentMonth,
  currentTermEnd,
  isOpen,
  leaseSchedule,
  leaseSummary,
  leaseTermState,
  periodAnchor,
  periodLabel,
  periodOf,
  periodState,
  periodTitle,
  termEndDate,
  verdictApplies,
  LEASE_TERM_STATE_LABELS,
  PERIOD_STATE_LABELS,
  type Lease,
  type LeaseSummary,
  type LeaseTermState,
  type Period,
  type PeriodState,
  type ScheduledMonth,
} from "./domain/lease";
