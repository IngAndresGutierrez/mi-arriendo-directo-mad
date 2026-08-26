/**
 * The half of the property module a Client Component may import.
 *
 * `index.ts` re-exports the data layer, which is `server-only` and pulls in `firebase-admin`.
 * A client bundle that touched it would fail to build — which is the guard working — so the
 * pure half has a door of its own. Everything here is domain: constants, labels and types.
 */
export {
  APPROX_RADIUS_M,
  LEASE_TERMS,
  propertyMonthlyCost,
  publicLocationLabel,
  type LeaseTerm,
  type Property,
  type PropertyPhoto,
  type PropertyVideo,
} from "./domain/property";
export { type CityCount } from "./domain/cities";

/** The label records, resolved for one language. Replaces the six `X_LABELS` constants. */
export { propertyLabels, type PropertyLabels } from "./domain/labels";
