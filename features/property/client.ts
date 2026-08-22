/**
 * The half of the property module a Client Component may import.
 *
 * `index.ts` re-exports the data layer, which is `server-only` and pulls in `firebase-admin`.
 * A client bundle that touched it would fail to build — which is the guard working — so the
 * pure half has a door of its own. Everything here is domain: constants, labels and types.
 */
export {
  LEASE_TERMS,
  LEASE_TERM_LABELS,
  PARKING_LABELS,
  PROPERTY_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
  propertyMonthlyCost,
  publicLocationLabel,
  type LeaseTerm,
  type Property,
  type PropertyPhoto,
} from "./domain/property";
