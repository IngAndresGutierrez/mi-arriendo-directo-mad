import { z } from "zod";

/** Hoisted: building the RegExp on every call is needless repeated work. */
const HAS_LETTER = /\p{L}/u;
const HAS_DIGIT = /\d/;

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

/**
 * Normalized email.
 *
 * Order matters: `z.email().trim()` validates BEFORE trimming, so an email pasted with a
 * trailing space would be rejected. Normalize first, then validate.
 */
const normalizedEmail = z
  .string({ error: "Ingresa tu correo" })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Ingresa un correo válido" }));

/**
 * Password requirements: the **single source of truth**.
 *
 * `label` feeds the live checklist in the UI and `message` the validation error;
 * `signupSchema` is built from this very list. The rules used to be written twice and
 * could drift apart.
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
 * Authentication schemas. Shared between the form (UX) and the Route Handler that creates
 * the session (security): same module, same rule, same message.
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

/** Signup step 1: the email only. */
export const emailSchema = z.object({ email: normalizedEmail });

export type EmailInput = z.output<typeof emailSchema>;

/** Signup step 2. The rules are derived from PASSWORD_REQUIREMENTS, never repeated. */
export const signupSchema = z.object({
  password: PASSWORD_REQUIREMENTS.reduce(
    (schema, requirement) => schema.refine(requirement.isMet, { error: requirement.message }),
    z
      .string({ error: "Crea una contraseña" })
      .max(PASSWORD_MAX_LENGTH, { error: "La contraseña es demasiado larga" }),
  ),
});

export type SignupInput = z.output<typeof signupSchema>;

/** Body accepted by `POST /api/session`. */
export const createSessionSchema = z.object({
  idToken: z
    .string({ error: "Falta el token de identidad" })
    .min(1, { error: "Falta el token de identidad" })
    .max(4096, { error: "Token inválido" }),
});

export const passwordResetSchema = z.object({ email: normalizedEmail });
