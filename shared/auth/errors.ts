/**
 * Traduce los códigos de error de Firebase Auth a mensajes en español.
 *
 * Regla de seguridad: nunca reveles si un correo existe. Credenciales inválidas, usuario
 * inexistente y contraseña incorrecta comparten mensaje, para no convertir el formulario
 * en un enumerador de cuentas.
 */
const MESSAGES: Readonly<Record<string, string>> = {
  "auth/invalid-credential": "Correo o contraseña incorrectos",
  "auth/invalid-email": "Correo o contraseña incorrectos",
  "auth/user-not-found": "Correo o contraseña incorrectos",
  "auth/wrong-password": "Correo o contraseña incorrectos",
  "auth/user-disabled": "Esta cuenta está deshabilitada. Escríbenos para reactivarla.",
  "auth/email-already-in-use": "Ya existe una cuenta con este correo. Inicia sesión.",
  "auth/weak-password": "Esa contraseña es demasiado débil. Usa al menos 8 caracteres.",
  "auth/too-many-requests":
    "Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.",
  "auth/network-request-failed": "Sin conexión. Revisa tu internet e inténtalo de nuevo.",
  "auth/popup-closed-by-user": "Cerraste la ventana de Google antes de terminar.",
  "auth/cancelled-popup-request": "Cerraste la ventana de Google antes de terminar.",
  "auth/popup-blocked":
    "Tu navegador bloqueó la ventana de Google. Habilita las ventanas emergentes.",
  "auth/account-exists-with-different-credential":
    "Ya existe una cuenta con este correo. Inicia sesión con correo y contraseña.",
  "auth/operation-not-allowed":
    "Este método de acceso no está habilitado. Escríbenos para ayudarte.",
  "auth/unauthorized-domain": "Este dominio no está autorizado para iniciar sesión.",
};

const FALLBACK = "No pudimos completar la operación. Inténtalo de nuevo en un momento.";

const CANCELLATION_CODES = new Set([
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
]);

function errorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const { code } = error as { code?: unknown };
  return typeof code === "string" ? code : null;
}

/** Mensaje presentable al usuario. Nunca expone el error crudo de Firebase. */
export function authErrorMessage(error: unknown): string {
  const code = errorCode(error);
  if (!code) return FALLBACK;
  return MESSAGES[code] ?? FALLBACK;
}

/** El usuario cerró el popup: no es un fallo que valga la pena mostrar como error. */
export function isUserCancellation(error: unknown): boolean {
  const code = errorCode(error);
  return code !== null && CANCELLATION_CODES.has(code);
}
