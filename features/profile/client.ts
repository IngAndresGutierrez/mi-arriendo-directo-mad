/**
 * The half of the profile module a Client Component may import: the fields and the schema they
 * validate against, with none of the reading or writing.
 */
export { AccountFields } from "./ui/account-fields";
export { AccountForm, type AccountFormValues } from "./ui/account-form";
/*
 * A Server Action belongs here too: a `"use server"` module is exactly what a Client Component
 * is meant to import — Next replaces it with a reference. What it cannot import is the barrel
 * that also re-exports `data/`, which is `server-only` and drags `firebase-admin` with it.
 */
export { updateProfile, type UpdateProfileResult } from "./actions/update-profile";
export {
  accountDetailsSchema,
  type AccountDetailsFormValues,
  type AccountDetailsValues,
} from "./validations/profile";
export { GENDER_OPTIONS, type Gender } from "./domain/profile";
