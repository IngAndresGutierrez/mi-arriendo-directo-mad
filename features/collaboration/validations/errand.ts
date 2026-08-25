import { z } from "zod";

import { COUNTRY_ISO_CODES, DEFAULT_COUNTRY_ISO, phoneRuleFor, toE164 } from "@/shared/phone/countries";

import { ERRAND_TYPES } from "../domain/errand";
import { CODE_LENGTH } from "../domain/collaborator-auth";

/*
 * The day, the hour and "is it in the future" come from the interview's slot rules.
 *
 * An errand is the third thing in this product that arranges a moment somebody has to turn up to,
 * after the interview and the visit — and those two already share this module precisely because
 * three copies of "read these two fields as Bogotá wall time" is three chances to be an hour out.
 * Colombia has no daylight saving, so the fixed offset is exact all year.
 */
export { BOGOTA_OFFSET, toInstant, validateSlot } from "@/features/application/client";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * The phone a collaborator is reached and identified by.
 *
 * Validated per country through `phoneRuleFor`, exactly like the profile's, and stored in **E.164**
 * with the country ISO beside it — the country is never derived from the number, because `+1` is
 * shared by four countries in this product's list.
 */
const phone = z
  .object({
    phoneCountry: z.enum(COUNTRY_ISO_CODES, { error: "Elige el país" }).default(DEFAULT_COUNTRY_ISO),
    phoneNational: z
      .string({ error: "Escribe el número" })
      .trim()
      .min(1, { error: "Escribe el número" }),
  })
  .superRefine((value, ctx) => {
    const digits = value.phoneNational.replace(/\D/g, "");
    const rule = phoneRuleFor(value.phoneCountry);

    if (!rule.pattern.test(digits)) {
      ctx.addIssue({ code: "custom", message: rule.message, path: ["phoneNational"] });
      return;
    }
    if (!toE164(value.phoneCountry, digits)) {
      ctx.addIssue({ code: "custom", message: "Ese número no es válido", path: ["phoneNational"] });
    }
  });

/** Adding somebody who will receive encargos. The landlord types both fields. */
export const collaboratorSchema = z.intersection(
  z.object({
    name: z
      .string({ error: "Escribe el nombre" })
      .trim()
      .min(3, { error: "Escribe el nombre completo" })
      .max(80, { error: "El nombre es demasiado largo" }),
  }),
  phone,
);

export type CollaboratorInput = z.output<typeof collaboratorSchema>;

/**
 * Creating an errand.
 *
 * `title` has a minimum because "Encargo" as a title tells the collaborator nothing, and the
 * message that reaches their phone is mostly this line. `description` is where the detail goes and
 * is required for the same reason: this person is not in the conversation the landlord has been
 * having, so what is obvious to the landlord is all they know.
 */
export const errandSchema = z.object({
  propertyId: z.string({ error: "Elige el inmueble" }).trim().min(1, { error: "Elige el inmueble" }),
  /*
   * **No hay `collaboratorUid` aquí, y quitarlo fue arreglar un bug.** Lo pedía de una versión
   * anterior en la que el propietario elegía de una lista de colaboradores existentes; el
   * formulario manda nombre y teléfono, y es `createErrand` quien resuelve o crea la cuenta desde
   * el número. El campo sobrevivió al cambio de diseño y hacía fallar la validación **siempre**,
   * con el error en un campo que el formulario no dibuja: `handleSubmit` no llamaba a nada y el
   * botón parecía muerto. Se reportó como "no ocurre nada al darle click".
   */
  type: z.enum(ERRAND_TYPES, { error: "Elige qué hay que hacer" }),
  title: z
    .string({ error: "Escribe qué hay que hacer" })
    .trim()
    .min(5, { error: "Escribe en una frase qué hay que hacer" })
    .max(120, { error: "El título es demasiado largo" }),
  description: z
    .string({ error: "Cuenta el detalle" })
    .trim()
    .min(10, { error: "Da el detalle: esta persona no estuvo en la conversación" })
    .max(1000, { error: "El texto es demasiado largo" }),
  day: z.string({ error: "Elige una fecha" }).regex(DAY, { error: "Elige una fecha" }),
  time: z.string({ error: "Elige una hora" }).regex(TIME, { error: "Elige una hora" }),
});

export type ErrandInput = z.output<typeof errandSchema>;

/**
 * Declining, with a reason.
 *
 * **The reason is required**, unlike the landlord's rejection of an application, and the asymmetry
 * is deliberate: a landlord who says no to an applicant owes them a courtesy, while a collaborator
 * who says no leaves a job that still has to be done by somebody. "No puedo el jueves" and "ese
 * barrio me queda lejísimos" send the landlord to different next steps.
 */
export const declineErrandSchema = z.object({
  errandId: z.string().trim().min(1),
  reason: z
    .string({ error: "Cuenta por qué no puedes" })
    .trim()
    .min(4, { error: "Una frase basta: al propietario le sirve para buscar otra opción" })
    .max(300, { error: "El texto es demasiado largo" }),
});

/** Finishing it. The note is optional; a job done is a job done. */
export const completeErrandSchema = z.object({
  errandId: z.string().trim().min(1),
  note: z.string().trim().max(600, { error: "El texto es demasiado largo" }).default(""),
  /*
   * Evidence is uploaded straight to Cloud Storage by the browser and only its paths arrive here —
   * the route the listing photos and the incident attachments already take, because a Server
   * Action's body is capped at 1 MB by Next and a photo of a meter reading is bigger than that.
   * The action confirms every object exists in the bucket before recording it.
   */
  evidence: z
    .array(z.string().trim().min(1))
    .max(6, { error: "Máximo 6 archivos" })
    .default([]),
});

export const acceptErrandSchema = z.object({ errandId: z.string().trim().min(1) });

export const cancelErrandSchema = z.object({
  errandId: z.string().trim().min(1),
  reason: z.string().trim().max(300, { error: "El texto es demasiado largo" }).default(""),
});

/** Asking for a sign-in code: just the number, in the same two fields as everywhere else. */
export const requestCodeSchema = phone;

export type RequestCodeInput = z.output<typeof requestCodeSchema>;

/**
 * The code itself.
 *
 * Digits only and exactly `CODE_LENGTH`, derived from the constant rather than written as `6`: the
 * screen, the sender and this schema all have to agree, and a literal here is the one that stays
 * behind when the constant changes.
 */
export const verifyCodeSchema = z.intersection(
  phone,
  z.object({
    code: z
      .string({ error: "Escribe el código" })
      .trim()
      .regex(new RegExp(`^\\d{${CODE_LENGTH}}$`), { error: `El código son ${CODE_LENGTH} dígitos` }),
  }),
);

export type VerifyCodeInput = z.output<typeof verifyCodeSchema>;

/**
 * What the landlord's form submits: the errand and the person, in one flat object.
 *
 * The action validates the two halves separately — `errandSchema` and `collaboratorSchema` — because
 * they authorize against different things: the property has to be the landlord's, the phone has to
 * resolve to a collaborator. This is the shape the *form* needs, so `useForm` has one resolver and
 * one set of errors rather than two that can disagree about which field is red.
 */
export const createErrandFormSchema = z.intersection(errandSchema, collaboratorSchema);

export type CreateErrandFormInput = z.output<typeof createErrandFormSchema>;
