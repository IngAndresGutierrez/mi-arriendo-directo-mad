import "server-only";

import { redirect } from "next/navigation";

import { COMPLETE_PROFILE_ROUTE } from "@/shared/auth/routes";
import { requireUser, type SessionUser } from "@/shared/auth/session";

import { hasProfile } from "./profile";

/**
 * Session **and** a complete profile. Use this on every product screen.
 *
 * Someone who just signed up has a session but no profile: send them to complete it. The
 * onboarding screen uses `requireUser()`, not this one, or the redirect would loop.
 *
 * It lives in this module and not in `shared/auth`: "do they have a profile?" is a question
 * of the profile domain, and keeping it there forced `shared/` to import a feature's
 * Firestore read — a cycle between layers that the deferred import hid without solving.
 */
export async function requireCompleteProfile(): Promise<SessionUser> {
  const user = await requireUser();
  if (!(await hasProfile(user.uid))) redirect(COMPLETE_PROFILE_ROUTE);
  return user;
}
