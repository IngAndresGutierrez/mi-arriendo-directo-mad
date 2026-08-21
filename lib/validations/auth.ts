import { z } from "zod";

/** Hoisted: crear el RegExp en cada llamada es trabajo repetido innecesario. */
const HAS_LETTER = /\p{L}/u;
const HAS_DIGIT = /\d/;

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

/**
 * Correo normalizado.
 *
 * El orden importa: `z.email().trim()` valida ANTES de recortar, así que un correo pegado
 * con un espacio al final se rechazaría. Se normaliza primero y luego se valida.
 */
const normalizedEmail = z
  .string({ error: "Ingresa tu correo" })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Ingresa un correo válido" }));

/**
 * Requisitos de contraseña: **única fuente de verdad**.
 *
 * `label` alimenta el checklist en vivo de la UI y `message` el mensaje de validación;
 * `signupSchema` se construye a partir de esta misma lista. Antes las reglas estaban
 * escritas dos veces y podían desincronizarse.
 */
export const PASSWORD_REQUIREMENTS = [
  {
    id: "length",
    label: `Al menos ${PASSWORD_MIN_LENGTH} caracteres`,
    message: `Al menos ${PASSWORD_MIN_LENGTH} caracteres`,
    isMet: (value: string) => value.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: "letter",
    label: "Una letra",
    message: "Incluye al menos una letra",
    isMet: (value: string) => HAS_LETTER.test(value),
  },
  {
    id: "digit",
    label: "Un número",
    message: "Incluye al menos un número",
    isMet: (value: string) => HAS_DIGIT.test(value),
  },
] as const;

/**
 * Schemas de autenticación. Se comparten entre el formulario (UX) y la Route Handler que
 * crea la sesión (seguridad): mismo módulo, misma regla, mismo mensaje.
 */
export const loginSchema = z.object({
  email: normalizedEmail,
  password: z
    .string({ error: "Ingresa tu contraseña" })
    .min(PASSWORD_MIN_LENGTH, {
      error: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`,
    })
    .max(PASSWORD_MAX_LENGTH, { error: "La contraseña es demasiado larga" }),
});

export type LoginInput = z.output<typeof loginSchema>;

/** Paso 1 del registro: solo el correo. */
export const emailSchema = z.object({ email: normalizedEmail });

export type EmailInput = z.output<typeof emailSchema>;

/** Paso 2 del registro. Las reglas se derivan de PASSWORD_REQUIREMENTS, no se repiten. */
export const signupSchema = z.object({
  password: PASSWORD_REQUIREMENTS.reduce(
    (schema, requirement) => schema.refine(requirement.isMet, { error: requirement.message }),
    z
      .string({ error: "Crea una contraseña" })
      .max(PASSWORD_MAX_LENGTH, { error: "La contraseña es demasiado larga" }),
  ),
});

export type SignupInput = z.output<typeof signupSchema>;

/** Cuerpo que acepta `POST /api/session`. */
export const createSessionSchema = z.object({
  idToken: z
    .string({ error: "Falta el token de identidad" })
    .min(1, { error: "Falta el token de identidad" })
    .max(4096, { error: "Token inválido" }),
});

export const passwordResetSchema = z.object({ email: normalizedEmail });
