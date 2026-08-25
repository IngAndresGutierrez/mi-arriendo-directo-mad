/**
 * Public API of the collaboration module: **the collaborator and their errands, and nothing else.**
 *
 * The invitation half of this module is gone — grants, capabilities, a roster, accept/decline — and
 * it went because it required the collaborator to be a registered user of the product. For somebody
 * asked to open a door once a month that meant signing up, verifying an email and completing a
 * profile before they could be useful, which is friction with no payoff: the thing being delegated
 * is one job, not a standing role in the platform.
 *
 * What replaces it is smaller on purpose. A landlord types a name and a number, the errand goes out
 * by SMS and WhatsApp, and the collaborator signs in to `/colaborador` with a code — no account to
 * create, no profile, no menu, and no relationship with the rest of the product.
 */
/*
 * Los encargos: lo que el colaborador ve y gestiona.
 *
 * Viven en este módulo y no en uno aparte porque el colaborador ya era de aquí. Se empezó a
 * escribir como `features/assignment` sin mirar que este dominio existía, que es justo el error
 * contra el que avisa `mad-architecture`; está reubicado y usando la palabra que el código ya usaba
 * —"errand"— en vez de inventar una segunda para lo mismo.
 */
export {
  availableActions,
  errandMessage,
  errandState,
  isClosed,
  isOverdue,
  sortForCollaborator,
  ERRAND_STATES,
  ERRAND_STATE_LABELS,
  ERRAND_TYPES,
  ERRAND_TYPE_LABELS,
  type Errand,
  type ErrandState,
  type ErrandType,
} from "./domain/errand";
export {
  CODE_LENGTH,
  CODE_MAX_ATTEMPTS,
  CODE_PROBLEM_MESSAGES,
  codeProblem,
  type Collaborator,
} from "./domain/collaborator-auth";
export { getErrandFor, listErrandsForCollaborator, listErrandsForLandlord } from "./data/errand";
export {
  acceptErrand,
  cancelErrand,
  completeErrand,
  declineErrand,
  type ErrandActionResult,
} from "./actions/errand";
export { createErrand, type CreateErrandResult } from "./actions/create-errand";
export {
  requestCollaboratorCode,
  verifyCollaboratorCode,
} from "./actions/collaborator-session";
export { CollaboratorLogin } from "./ui/collaborator-login";
export { ErrandActions } from "./ui/errand-actions";
export { ErrandForm } from "./ui/errand-form";
