---
name: zod-react-hook-form
description: Validación de formularios con Zod v4 + React Hook Form + shadcn Form, y validación en Server Actions. Úsala al construir postulaciones, carga de documentos de identidad, información de ingresos, registro/login o cualquier formulario, y al definir un schema de validación.
---

# Zod v4 + React Hook Form

Versiones objetivo: `zod` **v4**, `react-hook-form` **v7**, `@hookform/resolvers` **v5**.

```bash
pnpm add zod react-hook-form @hookform/resolvers
pnpm dlx shadcn@latest add form input select textarea checkbox
```

## Zod v4: la API cambió respecto a v3

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

Otras notas de v4: `.default()` aplica a la salida, `z.coerce.*` sigue existiendo,
`z.output<typeof s>` vs `z.input<typeof s>` importan cuando hay `transform`/`coerce`.

### Trampa: el orden de validación y normalización

`.trim()` y `.toLowerCase()` son **transformaciones que corren después de validar**. Por eso
`z.email().trim()` rechaza `"  a@b.com "`: valida con los espacios y recorta después. Es un
bug real y silencioso — en móvil el autocompletado y el pegado añaden espacios constantemente.

```ts
// ❌ rechaza correos con espacios al pegar
z.email({ error: "Correo inválido" }).trim().toLowerCase()

// ✅ normaliza primero, valida después
const emailNormalizado = z
  .string({ error: "Ingresa tu correo" })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Correo inválido" }));
```

Extrae el campo a una constante reutilizable como esa en vez de repetir la cadena en cada
schema: así el arreglo se hace una vez. En el repo está en `lib/validations/auth.ts`.

## Un schema por caso de uso, en `lib/schemas/`

Los schemas son la **frontera única** de datos externos. Se comparten entre cliente y
servidor: mismo archivo, mismo mensaje de error.

```ts
// lib/schemas/postulacion.ts
import { z } from "zod";

const CEDULA = /^\d{6,10}$/;
const CELULAR_CO = /^3\d{9}$/;
const MAX_ARCHIVO = 8 * 1024 * 1024;
const TIPOS_DOC = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

const archivo = z
  .instanceof(File, { error: "Adjunta un archivo" })
  .refine((f) => f.size > 0, { error: "El archivo está vacío" })
  .refine((f) => f.size <= MAX_ARCHIVO, { error: "Máximo 8 MB" })
  .refine((f) => (TIPOS_DOC as readonly string[]).includes(f.type), {
    error: "Solo JPG, PNG, WEBP o PDF",
  });

export const postulacionSchema = z
  .object({
    inmuebleId: z.string().min(1),

    // identidad
    nombreCompleto: z.string().trim().min(3, { error: "Ingresa tu nombre completo" }).max(120),
    tipoDocumento: z.enum(["CC", "CE", "PASAPORTE", "PEP"], { error: "Selecciona el tipo" }),
    numeroDocumento: z.string().trim().regex(CEDULA, { error: "Número de documento inválido" }),
    email: z.email({ error: "Correo inválido" }).toLowerCase(),
    celular: z.string().trim().regex(CELULAR_CO, { error: "Celular colombiano de 10 dígitos" }),

    // ingresos (enteros en COP)
    ingresoMensual: z.coerce
      .number({ error: "Ingresa tu ingreso mensual" })
      .int({ error: "Sin decimales" })
      .positive({ error: "Debe ser mayor a cero" })
      .max(1_000_000_000),
    tipoContratoLaboral: z.enum(["indefinido", "fijo", "prestacion", "independiente", "pensionado"]),
    tieneCodeudor: z.boolean().default(false),
    codeudorDocumento: z.string().trim().regex(CEDULA).optional(),

    // documentos
    cedulaFrente: archivo,
    cedulaReverso: archivo,
    certificadoLaboral: archivo,

    aceptaTratamientoDatos: z.literal(true, {
      error: "Debes autorizar el tratamiento de datos personales",
    }),
  })
  // validación cruzada: siempre al final, después del object
  .refine((d) => !d.tieneCodeudor || Boolean(d.codeudorDocumento), {
    error: "Ingresa el documento del codeudor",
    path: ["codeudorDocumento"],
  });

export type PostulacionInput = z.output<typeof postulacionSchema>;
```

Reglas:
- **Nunca** valides solo en el cliente. El schema del cliente es UX; el del servidor es
  seguridad. Es el mismo módulo, ejecutado dos veces.
- Datos sensibles (documento, ingresos) **no** se guardan en `localStorage` ni en la URL como
  `searchParams`.
- El schema de servidor puede ser más estricto (p. ej. `.strict()` para rechazar campos
  extra); nunca menos.
- Un `z.literal(true)` es la forma correcta de exigir un checkbox de consentimiento — un
  `z.boolean()` acepta `false`.

## Formulario con RHF + shadcn

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { postulacionSchema, type PostulacionInput } from "@/lib/schemas/postulacion";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { enviarPostulacion } from "./actions";

export function FormularioPostulacion({ inmuebleId }: { inmuebleId: string }) {
  const form = useForm<PostulacionInput>({
    resolver: zodResolver(postulacionSchema),
    mode: "onBlur",                       // valida al salir del campo, no en cada tecla
    defaultValues: {                      // SIEMPRE define defaults: evita inputs uncontrolled
      inmuebleId,
      nombreCompleto: "",
      numeroDocumento: "",
      email: "",
      celular: "",
      tieneCodeudor: false,
    },
  });

  async function onSubmit(values: PostulacionInput) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(values)) {
      if (v instanceof File) fd.append(k, v);
      else if (v !== undefined) fd.append(k, String(v));
    }
    const res = await enviarPostulacion(fd);
    if (!res.ok) {
      // mapea errores del servidor a los campos
      for (const [campo, mensajes] of Object.entries(res.errors ?? {})) {
        form.setError(campo as keyof PostulacionInput, { message: mensajes?.[0] });
      }
      if (res.message) form.setError("root", { message: res.message });
      return;
    }
    form.reset();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="numeroDocumento"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Número de documento</FormLabel>
              <FormControl>
                <Input inputMode="numeric" autoComplete="off" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Enviando…" : "Enviar postulación"}
        </Button>
      </form>
    </Form>
  );
}
```

Puntos que se rompen si los ignoras:
- `defaultValues` completo para cada campo, o RHF alterna controlled/uncontrolled y React
  advierte.
- Inputs de archivo **no** se registran con `{...field}`: usa
  `onChange={(e) => field.onChange(e.target.files?.[0])}` y no pases `value`.
- `form.formState.isSubmitting` para el estado pending, no un `useState` propio.
- No dupliques la regla de validación en JSX (`required`, `maxLength`): la fuente de verdad es
  el schema.
- Autocomplete correcto en cada campo (`email`, `tel`, `name`) — mejora conversión y a11y.

## Validación en la Server Action (obligatoria)

```ts
"use server";
import { z } from "zod";
import { postulacionSchema } from "@/lib/schemas/postulacion";
import { requireUser } from "@/lib/auth/session";

export type ActionState = { ok: boolean; message?: string; errors?: Record<string, string[]> };

export async function enviarPostulacion(formData: FormData): Promise<ActionState> {
  const user = await requireUser();

  const parsed = postulacionSchema.safeParse({
    ...Object.fromEntries(formData),
    tieneCodeudor: formData.get("tieneCodeudor") === "true",
    aceptaTratamientoDatos: formData.get("aceptaTratamientoDatos") === "true",
    cedulaFrente: formData.get("cedulaFrente"),
    cedulaReverso: formData.get("cedulaReverso"),
    certificadoLaboral: formData.get("certificadoLaboral"),
  });

  if (!parsed.success) {
    // no filtres el error crudo de Zod al cliente: puede contener los valores enviados
    return { ok: false, errors: z.flattenError(parsed.error).fieldErrors };
  }

  // ...persistir con Admin SDK usando parsed.data (nunca el FormData crudo)
  return { ok: true };
}
```

Nunca:
- Persistir `Object.fromEntries(formData)` directo (mass assignment: el cliente puede mandar
  `estado: "aprobada"`).
- Devolver `parsed.error` completo al cliente, ni loggear los valores de documentos/ingresos.
- Confiar en un `uid` o `propietarioUid` que venga del formulario: sale de la sesión.

Combina siempre con las skills `firebase-admin-sdk` (autorización + escritura) y
`firestore-security-rules` (la validación equivalente del lado de la base de datos).
