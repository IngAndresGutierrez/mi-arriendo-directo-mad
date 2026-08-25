/**
 * The half of the collaboration module a Client Component may import.
 *
 * `index.ts` also re-exports the data layer, which is `server-only` and pulls in `firebase-admin`;
 * a client bundle that touched it would fail to build, which is the guard working. Everything here
 * is pure domain.
 *
 * It used to export the grant model — capabilities, statuses, `hasCapability`. That went with the
 * invitation flow: a collaborator is no longer a registered user with standing permissions on a
 * property, but somebody with a job and a code to open it.
 */
export {
  availableActions,
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
export { CODE_LENGTH, CODE_PROBLEM_MESSAGES } from "./domain/collaborator-auth";
