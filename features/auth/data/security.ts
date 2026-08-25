import "server-only";

import { adminAuth } from "@/shared/firebase/admin";

/**
 * Cómo entra alguien a su cuenta.
 *
 * `password` y `google` son los dos que este producto ofrece; `phone` es el colaborador, que entra
 * con un código a su teléfono y vive fuera del portal. `other` existe porque Firebase puede devolver
 * un proveedor que este código no conoce, y dibujar un hueco es peor que decir "otro método".
 */
export type SignInMethod = "password" | "google" | "phone" | "other";

export type AccountSecurity = {
  readonly methods: readonly SignInMethod[];
  readonly emailVerified: boolean;
  /** ISO 8601, o `null` si Firebase no lo trae. */
  readonly createdAt: string | null;
  readonly lastSignInAt: string | null;
};

function toMethod(providerId: string): SignInMethod {
  if (providerId === "password") return "password";
  if (providerId === "google.com") return "google";
  if (providerId === "phone") return "phone";

  return "other";
}

/** Firebase entrega estas fechas como cadenas UTC; la pantalla quiere un ISO que pueda formatear. */
function iso(value: string | undefined): string | null {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Cómo está la cuenta de quien pregunta: con qué entra, si verificó su correo y cuándo entró por
 * última vez.
 *
 * **Devuelve `null` cuando no se pudo leer, y no lanza.** Vive en una pestaña de una pantalla de
 * ajustes: que Firebase tenga un mal segundo tiene que costar esa tarjeta, no la página entera con
 * las preferencias de avisos dentro. Es la misma decisión que `listNotifications`, un nivel más
 * abajo.
 *
 * **Lo que deliberadamente no devuelve es una lista de sesiones.** Firebase no expone una: no hay
 * forma de saber en qué dispositivos hay una sesión abierta, así que pintar una fila que diga
 * "dispositivo actual · activo" sería una lista de uno que en realidad solo dice "tú", con la
 * apariencia de un inventario que nadie tiene. Lo que sí es cierto y sí es útil es la última entrada
 * —una que no reconoces es la señal por la que se abre esta pantalla— y el botón que revoca todo.
 */
export async function getAccountSecurity(uid: string): Promise<AccountSecurity | null> {
  try {
    const user = await adminAuth().getUser(uid);

    const methods = [...new Set(user.providerData.map((provider) => toMethod(provider.providerId)))];

    return {
      methods,
      emailVerified: user.emailVerified,
      createdAt: iso(user.metadata.creationTime),
      lastSignInAt: iso(user.metadata.lastSignInTime),
    };
  } catch (error) {
    console.error(`getAccountSecurity failed for ${uid}:`, error);

    return null;
  }
}
