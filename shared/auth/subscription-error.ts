import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { credentialRevoked } from "./client";

/** What a Firestore listener hands its error callback. Structural: the SDK type is not needed. */
type ListenError = { readonly code?: string; readonly message?: string };

/**
 * What to do when a live subscription is denied.
 *
 * There are two reasons a `permission-denied` reaches an `onSnapshot` error handler, and they want
 * opposite responses:
 *
 * - **The rules really do deny this query.** That is a bug, and the code and message have to reach
 *   the console or nobody can find it.
 * - **The session is over.** Firebase revokes the refresh tokens on a password reset, on an admin
 *   revoking them, and on the account being disabled — and the backend then answers every attached
 *   listener `permission-denied`. Nothing is wrong with the rules, and logging it as though
 *   something were is measurably expensive: the sign-out version of this sent a real diagnosis
 *   through the deployed ruleset, the composite indexes and the shape of seventy production
 *   documents before landing on "somebody pressed Cerrar sesión".
 *
 * `isSigningOut()` separates those two only for the tab that pressed the button, which is the case
 * it was written for. This is the general one, and it settles the question by asking the credential
 * to renew itself: a revoked one cannot, and a live one can.
 *
 * **When the session is gone it refreshes rather than falling silent.** The server verifies its
 * cookie with `checkRevoked`, so a refresh makes the route's own guard send the person to the login
 * — which is the truthful end to this. Staying quiet would leave them on a portal that stopped
 * being theirs, wondering why nothing updates.
 *
 * **And when the credential is fine, the listener is rebuilt before anything is reported.** That
 * case is real and was reported from production: reset the password, sign in again, and the bell
 * logs `permission-denied` even though the new session is perfectly healthy. A listener is created
 * once, under one credential, and the effect that made it never runs again — so the subscription
 * that was denied belongs to the token that has just been revoked, while `credentialRevoked()`
 * answers about the *new* one and says everything is fine. Asking that question alone was the bug:
 * it is the right question about the wrong credential.
 *
 * Re-subscribing settles it and fixes a second thing at the same time. Until now a denied bell
 * stayed dead until the page was reloaded, because nothing ever tried again. `retry` is called at
 * most once per subscription — the caller owns that guard — so a query the rules genuinely refuse
 * costs one extra attempt and then reports, instead of looping.
 *
 * It is shared by the bell and by `useLiveRefresh` because the two had the same gap and fixing one
 * of them would have left the other still shouting about the deployed rules.
 */
export async function reportOrRecover(
  error: ListenError,
  label: string,
  router: Pick<AppRouterInstance, "refresh">,
  /** Rebuilds the subscription. Pass it **only** while a retry is still owed; see the note above. */
  retry?: () => void,
): Promise<void> {
  /*
   * Only `permission-denied` is worth the network call. `failed-precondition` is a missing composite
   * index and `unauthenticated` is its own thing; both are real and both must be reported as they
   * are — asking about the credential there would delay a genuine diagnosis to answer a question
   * nobody asked.
   */
  if (error.code === "permission-denied") {
    if (await credentialRevoked()) {
      router.refresh();

      return;
    }

    if (retry) {
      retry();

      return;
    }
  }

  console.error(label, error.code, error.message);
}
