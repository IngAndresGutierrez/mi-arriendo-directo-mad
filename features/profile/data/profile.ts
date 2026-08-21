import "server-only";

import { cache } from "react";

import type { UserRole } from "@/shared/auth/session";
import type { Department, Gender } from "../domain/colombia";
import { adminDb } from "@/shared/firebase/admin";

/** Forma que consume la UI: serializable, sin `Timestamp`. */
export type Profile = {
  readonly fullName: string;
  readonly email: string;
  /** E.164, p. ej. `+573001234567`. */
  readonly phone: string;
  /** ISO del país elegido: `+1` lo comparten varios, no se deduce del número. */
  readonly phoneCountry: string;
  readonly gender: Gender;
  readonly address: {
    readonly line: string;
    readonly city: string;
    readonly department: Department;
  };
  /** `YYYY-MM-DD`. */
  readonly birthDate: string;
  readonly role: UserRole;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Perfil del usuario, o `null` si aún no completó el onboarding.
 *
 * Cacheado por request: la misma lectura la necesitan el guard y la pantalla que la usa.
 * Si el documento existe pero está incompleto, devuelve `null` para que el guard mande a
 * completarlo en lugar de renderizar una pantalla con huecos.
 */
export const getProfile = cache(async (uid: string): Promise<Profile | null> => {
  const snapshot = await adminDb.collection("users").doc(uid).get();
  if (!snapshot.exists) return null;

  const data = snapshot.data() ?? {};
  const address = (data.address ?? {}) as Record<string, unknown>;

  const fullName = asString(data.fullName);
  const email = asString(data.email);
  const phone = asString(data.phone);
  const phoneCountry = asString(data.phoneCountry);
  const gender = asString(data.gender);
  const birthDate = asString(data.birthDate);
  const line = asString(address.line);
  const city = asString(address.city);
  const department = asString(address.department);
  const role = asString(data.role);

  // Un perfil a medias cuenta como inexistente: mejor volver al formulario que renderizar
  // una pantalla con campos vacíos.
  if (
    !fullName ||
    !email ||
    !phone ||
    !phoneCountry ||
    !gender ||
    !birthDate ||
    !line ||
    !city ||
    !department ||
    !role
  ) {
    return null;
  }

  return {
    fullName,
    email,
    phone,
    phoneCountry,
    gender: gender as Gender,
    address: {
      line,
      city,
      department: department as Department,
    },
    birthDate,
    role: role as UserRole,
  };
});

export async function hasProfile(uid: string): Promise<boolean> {
  return (await getProfile(uid)) !== null;
}
