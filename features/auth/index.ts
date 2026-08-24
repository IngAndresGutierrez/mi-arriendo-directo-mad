/**
 * Public API of the access module. Anything not exported here is internal to the feature
 * and can be moved or renamed without searching the whole repo.
 */
export { LoginForm } from "./ui/login-form";
export { SignupForm } from "./ui/signup-form";
export { NewPasswordForm } from "./ui/new-password-form";
export { PasswordResetForm } from "./ui/password-reset-form";
export { createSessionSchema } from "./validations/auth";
/*
 * `requestPasswordReset` is deliberately **not** here. It imports the Admin SDK, so exporting it
 * from the module's public entry would make `@/features/auth` pull `firebase-admin` for every
 * importer — and the two forms above are Client Components. The form that calls it lives inside
 * this feature and imports it by relative path, which is what relative imports are for.
 */
