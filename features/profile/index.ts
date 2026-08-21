/**
 * Public API of the profile module. Anything not exported here is internal to the feature.
 */
export { requireCompleteProfile } from "./data/guards";
export { getProfile, type Profile } from "./data/profile";
export { completeProfile, type CompleteProfileResult } from "./actions/complete-profile";
export { CompleteProfileForm } from "./ui/complete-profile-form";
