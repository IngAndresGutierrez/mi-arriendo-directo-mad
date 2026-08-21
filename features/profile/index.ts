/**
 * API pública del módulo de perfil. Lo que no esté aquí es interno del feature.
 */
export { requireCompleteProfile } from "./data/guards";
export { getProfile, type Profile } from "./data/profile";
export { completeProfile, type CompleteProfileResult } from "./actions/complete-profile";
export { CompleteProfileForm } from "./ui/complete-profile-form";
