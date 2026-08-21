import "server-only";

import { redirect } from "next/navigation";

import { COMPLETE_PROFILE_ROUTE } from "@/shared/auth/routes";
import { requireUser, type SessionUser } from "@/shared/auth/session";

import { hasProfile } from "./profile";

/**
 * Sesión **y** perfil completo. Úsalo en toda pantalla del producto.
 *
 * Quien acaba de registrarse tiene sesión pero no perfil: lo manda a completarlo. La
 * pantalla de onboarding usa `requireUser()`, no esta, o el redirect sería un bucle.
 *
 * Vive en este módulo y no en `shared/auth`: "¿tiene perfil?" es una pregunta del dominio
 * de perfil, y tenerla allá obligaba a `shared/` a importar la lectura de Firestore de un
 * feature — un ciclo entre capas que el import diferido escondía sin resolver.
 */
export async function requireCompleteProfile(): Promise<SessionUser> {
  const user = await requireUser();
  if (!(await hasProfile(user.uid))) redirect(COMPLETE_PROFILE_ROUTE);
  return user;
}
