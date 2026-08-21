---
name: zod-react-hook-form
description: Form validation with Zod v4 + React Hook Form, and validation inside Server Actions. Use it when building applications, identity document uploads, income information, signup/login or any form, and when defining a validation schema.
---

# Zod v4 + React Hook Form

Target versions: `zod` **v4**, `react-hook-form` **v7**, `@hookform/resolvers` **v5**.

```bash
pnpm add zod react-hook-form @hookform/resolvers
```

⚠️ The `radix-nova` registry this project uses **does not expose `form`**: `shadcn add form`
does nothing. Build forms with `Label` + `Input` + react-hook-form, and reuse the project's
pre-wired fields (`shared/form/text-field.tsx`, `select-field.tsx`, `phone-field.tsx`), which
already carry the label, the error and the ARIA attributes.

## Zod v4: the API changed from v3

```ts
import { z } from "zod";

// ❌ v3                                   // ✅ v4
z.string().email()                          z.email()
z.string().url()                            z.url()
z.string().uuid()                           z.uuid()
z.string({ required_error: "Requerido" })   z.string({ error: "Requerido" })
z.string().min(2, { message: "Corto" })     z.string().min(2, { error: "Corto" })
z.record(z.string())                        z.record(z.string(), z.unknown())  // 2 args
error.format() / error.flatten()            z.treeifyError(error) / z.flattenError(error)
```

Other v4 notes: `.default()` applies to the output, `z.coerce.*` still exists, and
`z.output<typeof s>` vs `z.input<typeof s>` matters as soon as there is a `transform`/`coerce`.

### Trap: the order of validation and normalization

`.trim()` and `.toLowerCase()` are **transformations that run after validation**. That is why
`z.email().trim()` rejects `"  a@b.com "`: it validates with the spaces and trims afterwards. It
is a real and silent bug — on mobile, autocomplete and pasting add spaces constantly.

```ts
// ❌ rejects pasted emails with spaces
z.email({ error: "Correo inválido" }).trim().toLowerCase()

// ✅ normalize first, validate after
const normalizedEmail = z
  .string({ error: "Ingresa tu correo" })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Correo inválido" }));
```

Extract the field into a reusable constant like that instead of repeating the chain in every
schema: the fix happens once. In this repo it lives in `features/auth/validations/auth.ts`.

## One schema per use case, in `features/<domain>/validations/`

Schemas are the **single boundary** for external data. They are shared between client and
server: same file, same error message.

```ts
// features/application/validations/application.ts
import { z } from "zod";

const NATIONAL_ID = /^\d{6,10}$/;
const MOBILE_CO = /^3\d{9}$/;
const MAX_FILE = 8 * 1024 * 1024;
const DOC_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

const file = z
  .instanceof(File, { error: "Adjunta un archivo" })
  .refine((f) => f.size > 0, { error: "El archivo está vacío" })
  .refine((f) => f.size <= MAX_FILE, { error: "Máximo 8 MB" })
  .refine((f) => (DOC_TYPES as readonly string[]).includes(f.type), {
    error: "Solo JPG, PNG, WEBP o PDF",
  });

export const applicationSchema = z
  .object({
    propertyId: z.string().min(1),

    // identity
    fullName: z.string().trim().min(3, { error: "Ingresa tu nombre completo" }).max(120),
    idType: z.enum(["CC", "CE", "PASAPORTE", "PEP"], { error: "Selecciona el tipo" }),
    idNumber: z.string().trim().regex(NATIONAL_ID, { error: "Número de documento inválido" }),
    email: z.email({ error: "Correo inválido" }).toLowerCase(),
    mobile: z.string().trim().regex(MOBILE_CO, { error: "Celular colombiano de 10 dígitos" }),

    // income (integers in COP)
    monthlyIncome: z.coerce
      .number({ error: "Ingresa tu ingreso mensual" })
      .int({ error: "Sin decimales" })
      .positive({ error: "Debe ser mayor a cero" })
      .max(1_000_000_000),
    employmentType: z.enum(["permanent", "fixed_term", "contractor", "self_employed", "retired"]),
    hasCosigner: z.boolean().default(false),
    cosignerIdNumber: z.string().trim().regex(NATIONAL_ID).optional(),

    // documents
    idFront: file,
    idBack: file,
    employmentLetter: file,

    acceptsDataProcessing: z.boolean().refine((v) => v === true, {
      error: "Debes autorizar el tratamiento de datos personales",
    }),
  })
  // cross-field validation: always last, after the object
  .refine((d) => !d.hasCosigner || Boolean(d.cosignerIdNumber), {
    error: "Ingresa el documento del codeudor",
    path: ["cosignerIdNumber"],
  });

export type ApplicationInput = z.output<typeof applicationSchema>;
```

Rules:
- **Never** validate on the client only. The client schema is UX; the server one is security.
  It is the same module, executed twice.
- Sensitive data (id number, income) is **not** stored in `localStorage` or in the URL as
  `searchParams`.
- The server schema may be stricter (e.g. `.strict()` to reject extra fields); never looser.
- Consent uses `z.boolean().refine((v) => v === true)`, **not** `z.literal(true)`: with the
  literal, the input type is `true` and a checkbox that starts at `false` will not typecheck.
  (Error messages here are user-facing copy, so they stay in es-CO.)

## The form with RHF and the project's fields

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TextField } from "@/shared/form/text-field";
import { SubmitButton } from "@/shared/form/submit-button";
import { FormAlert } from "@/shared/form/form-alert";
import { applicationSchema, type ApplicationInput } from "../validations/application";
import { submitApplication } from "../actions/submit-application";

export function ApplicationForm({ propertyId }: { propertyId: string }) {
  const form = useForm<ApplicationInput>({
    resolver: zodResolver(applicationSchema),
    mode: "onBlur",                       // validate on blur, not on every keystroke
    defaultValues: {                      // ALWAYS define defaults: avoids uncontrolled inputs
      propertyId,
      fullName: "",
      idNumber: "",
      email: "",
      mobile: "",
      hasCosigner: false,
    },
  });

  async function onSubmit(values: ApplicationInput) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(values)) {
      if (v instanceof File) fd.append(k, v);
      else if (v !== undefined) fd.append(k, String(v));
    }
    const res = await submitApplication(fd);
    if (!res.ok) {
      // map server errors onto the fields
      for (const [field, messages] of Object.entries(res.errors ?? {})) {
        form.setError(field as keyof ApplicationInput, { message: messages?.[0] });
      }
      if (res.message) form.setError("root", { message: res.message });
      return;
    }
    form.reset();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <FormAlert message={form.formState.errors.root?.message ?? null} />

      <TextField
        id="idNumber"
        label="Número de documento"
        inputMode="numeric"
        autoComplete="off"
        error={form.formState.errors.idNumber?.message}
        {...form.register("idNumber")}
      />

      <SubmitButton loading={form.formState.isSubmitting} loadingLabel="Enviando…">
        Enviar postulación
      </SubmitButton>
    </form>
  );
}
```

Things that break if you ignore them:
- A complete `defaultValues` for every field, or RHF flips between controlled and uncontrolled
  and React warns.
- File inputs are **not** registered with `{...field}`: use
  `onChange={(e) => field.onChange(e.target.files?.[0])}` and do not pass `value`.
- Use `form.formState.isSubmitting` for the pending state, not your own `useState`.
- Do not duplicate the validation rule in JSX (`required`, `maxLength`): the schema is the
  source of truth.
- Use `useWatch`, never `watch()`: the latter trips `react-hooks/incompatible-library`.
- When the schema transforms, type the hook with input and output:
  `useForm<z.input<S>, unknown, z.output<S>>`, or `handleSubmit` will not fit.
- Correct autocomplete on every field (`email`, `tel`, `name`) — it helps conversion and a11y.

## Validation in the Server Action (mandatory)

```ts
"use server";
import { z } from "zod";
import { requireUser } from "@/shared/auth/session";
import { applicationSchema } from "../validations/application";

export type ActionState = { ok: boolean; message?: string; errors?: Record<string, string[]> };

export async function submitApplication(formData: FormData): Promise<ActionState> {
  const user = await requireUser();

  const parsed = applicationSchema.safeParse({
    ...Object.fromEntries(formData),
    hasCosigner: formData.get("hasCosigner") === "true",
    acceptsDataProcessing: formData.get("acceptsDataProcessing") === "true",
    idFront: formData.get("idFront"),
    idBack: formData.get("idBack"),
    employmentLetter: formData.get("employmentLetter"),
  });

  if (!parsed.success) {
    // do not leak Zod's raw error to the client: it can contain the submitted values
    return { ok: false, errors: z.flattenError(parsed.error).fieldErrors };
  }

  // ...persist with the Admin SDK using parsed.data (never the raw FormData)
  return { ok: true };
}
```

Never:
- Persist `Object.fromEntries(formData)` directly (mass assignment: the client can send
  `status: "approved"`).
- Return the full `parsed.error` to the client, or log the id document / income values.
- Trust a `uid` or a `landlordUid` that arrives in the form: it comes from the session.

Always combine this with the `firebase-admin-sdk` skill (authorization + writing) and
`firestore-security-rules` (the equivalent validation on the database side).
