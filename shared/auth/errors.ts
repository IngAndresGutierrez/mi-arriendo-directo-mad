import { dictionaryFor, type Dictionary } from "@/shared/i18n/dictionary";
import type { Locale } from "@/shared/i18n/locale";

/**
 * Maps Firebase Auth error codes to user-facing messages.
 *
 * Security rule: never reveal whether an email exists. Invalid credentials, unknown user
 * and wrong password share one message, so the form cannot be used to enumerate accounts.
 */
/**
 * Which message a Firebase code maps to.
 *
 * The **key** of the dictionary entry, not the sentence: the words live in
 * `shared/i18n/messages` like the rest of the copy, and this table stays what it always was — the
 * decision about which failures a person should be told apart.
 *
 * The four credential codes still share one entry, which is the security rule this file exists for:
 * telling "no such account" from "wrong password" turns the login into an account enumerator.
 */
const MESSAGES: Readonly<Record<string, keyof Dictionary["authErrors"]>> = {
  "auth/invalid-credential": "invalidCredential",
  "auth/invalid-email": "invalidCredential",
  "auth/user-not-found": "invalidCredential",
  "auth/wrong-password": "invalidCredential",
  "auth/user-disabled": "userDisabled",
  "auth/email-already-in-use": "emailInUse",
  "auth/weak-password": "weakPassword",
  "auth/too-many-requests": "tooManyRequests",
  "auth/network-request-failed": "networkFailed",
  "auth/popup-closed-by-user": "popupClosed",
  "auth/cancelled-popup-request": "popupClosed",
  "auth/popup-blocked": "popupBlocked",
  "auth/account-exists-with-different-credential": "accountExistsOtherCredential",
  "auth/operation-not-allowed": "operationNotAllowed",
  "auth/unauthorized-domain": "unauthorizedDomain",
};

const CANCELLATION_CODES = new Set([
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
]);

function errorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const { code } = error as { code?: unknown };
  return typeof code === "string" ? code : null;
}

/**
 * Message safe to show the user. Never exposes the raw Firebase error.
 *
 * **The locale is a parameter with no default**, like `catalogMetaTitle`'s: this runs in Client
 * Components (the login form, the Google button) and in Server Actions, and a default is exactly how
 * one of those quietly renders Spanish to somebody reading English. Client callers get the locale
 * from `useLocale()`, which is the one thing the context carries.
 */
export function authErrorMessage(error: unknown, locale: Locale): string {
  const copy = dictionaryFor(locale).authErrors;
  const code = errorCode(error);

  return (code && copy[MESSAGES[code] ?? "fallback"]) || copy.fallback;
}

/** The user closed the popup: not a failure worth surfacing as an error. */
export function isUserCancellation(error: unknown): boolean {
  const code = errorCode(error);
  return code !== null && CANCELLATION_CODES.has(code);
}
