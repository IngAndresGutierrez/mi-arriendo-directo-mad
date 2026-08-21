---
name: shadcn-tailwind
description: "Construir UI con shadcn/ui y Tailwind CSS v4 respetando el sistema de diseño MAD UI (púrpura 2D124D, cian 00E5FF). Úsala al crear o modificar cualquier componente visual, al tocar app/globals.css o components.json, y al elegir clases o colores. Alias - shadcn-ui, tailwind-css."
---

# shadcn/ui + Tailwind CSS v4

Stack real del repo: **Tailwind CSS v4** (`@tailwindcss/postcss`, sin `tailwind.config.js`) +
React 19 + Next.js 16.

## Tailwind v4 es CSS-first: no hay tailwind.config.js

```css
/* app/globals.css */
@import "tailwindcss";          /* ← reemplaza @tailwind base/components/utilities */
```

- La configuración vive en `@theme` dentro del CSS, **no** en un archivo JS. Si necesitas
  agregar un color, fuente o radio, se declara ahí.
- `@theme inline { --color-x: var(--x) }` expone la variable como utilidad (`bg-x`,
  `text-x`, `border-x`).
- No existen `@tailwind base;` ni `theme.extend` ni `content: [...]` (la detección de clases
  es automática).
- Cambios de v3 a tener presentes: `shadow-sm` → `shadow-xs`, `outline-none` →
  `outline-hidden`, `bg-opacity-*` → `bg-black/50`, y los espacios usan la escala
  `--spacing`.

**Tailwind descarta silenciosamente clases que no existen.** Si dudas de un nombre de clase,
verifícalo antes de escribirlo; una clase inventada no falla, simplemente no pinta nada.

## Tokens de marca (fuente de verdad)

**`app/globals.css` ya existe y es la fuente de verdad**: contiene la paleta de marca, los
tokens semánticos (light + dark), los tokens de `sidebar` y `chart` que consumen los
componentes de shadcn, y los tokens de estado del dominio. Al necesitar un color nuevo,
agrégalo ahí; no lo escribas en el componente.

Púrpura `#2D124D` y cian `#00E5FF` **nunca** se escriben como hex suelto en un componente.
Se consumen como token semántico: `bg-primary`, `text-primary`, `bg-accent`, `ring-ring`.

Estructura del archivo (resumen — el contenido completo está en el repo):

```css
/* app/globals.css */
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";   /* estilos base del CLI de shadcn v4 */

@custom-variant dark (&:is(.dark *));

:root {
  /* --- paleta de marca --- */
  --brand-purple-950: #1a0a2e;
  --brand-purple-900: #2d124d;   /* PÚRPURA DE MARCA */
  --brand-purple-800: #3d1a66;
  --brand-purple-700: #4e2280;
  --brand-purple-600: #6330a3;
  --brand-purple-500: #7c45c4;
  --brand-purple-300: #bfa0e6;
  --brand-purple-100: #efe6fa;
  --brand-purple-50:  #f8f4fe;

  --brand-cyan-700: #008a99;
  --brand-cyan-600: #00b8cc;
  --brand-cyan-500: #00e5ff;     /* CIAN DE MARCA */
  --brand-cyan-300: #8af3ff;
  --brand-cyan-100: #e0fcff;

  /* --- tokens semánticos (los que usan los componentes) --- */
  --radius: 0.625rem;
  --background: #f8f9fa;            /* MAD UI: blanco roto / arena */
  --foreground: var(--brand-purple-950);
  --card: #ffffff;                  /* tarjetas blancas sobre el fondo arena */
  --card-foreground: var(--brand-purple-950);
  --popover: #ffffff;
  --popover-foreground: var(--brand-purple-950);

  /* estructura, encabezados, bordes activos */
  --primary: var(--brand-purple-900);
  --primary-foreground: #ffffff;

  --secondary: var(--brand-purple-100);
  --secondary-foreground: var(--brand-purple-900);

  /* CTA principal, badges "Aprobado", barras de progreso */
  --accent: var(--brand-cyan-500);
  --accent-foreground: var(--brand-purple-900);   /* texto OSCURO sobre cian */

  --muted: #f4f4f5;
  --muted-foreground: #57534e;
  --destructive: #c81e1e;
  --destructive-foreground: #ffffff;
  --border: #e7e5e4;
  --input: #e7e5e4;
  --ring: var(--brand-cyan-600);

  /* estados del dominio */
  --estado-pendiente: #b45309;
  --estado-aprobada: #15803d;
  --estado-rechazada: #b91c1c;
  --estado-al-dia: var(--brand-cyan-700);
  --estado-en-mora: #b91c1c;
}

.dark {
  --background: var(--brand-purple-950);
  --foreground: #f5f3ff;
  --card: var(--brand-purple-900);
  --card-foreground: #f5f3ff;
  --popover: var(--brand-purple-900);
  --popover-foreground: #f5f3ff;
  --primary: var(--brand-cyan-500);
  --primary-foreground: var(--brand-purple-950);
  --secondary: var(--brand-purple-800);
  --secondary-foreground: #f5f3ff;
  --accent: var(--brand-cyan-500);
  --accent-foreground: var(--brand-purple-950);
  --muted: var(--brand-purple-800);
  --muted-foreground: #c4b5fd;
  --border: color-mix(in oklab, #ffffff 12%, transparent);
  --input: color-mix(in oklab, #ffffff 16%, transparent);
  --ring: var(--brand-cyan-500);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  /* el preset usa multiplicadores, no sumas de px */
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

/* Además el archivo real define y expone los tokens de `sidebar` (--sidebar,
   --sidebar-primary, ...), de `chart` (--chart-1..5) y de estado del dominio
   (--estado-aprobada, --estado-en-mora, ...). Si agregas un token nuevo, recuerda
   mapearlo también en `@theme inline` o Tailwind no generará la utilidad. */

@layer base {
  * { @apply border-border outline-ring/50; }
  body { @apply bg-background text-foreground antialiased; }
}
```

### Reglas de uso del color (MAD UI, ver CLAUDE.md)

| Token | Hex | Uso |
| --- | --- | --- |
| `primary` | `#2D124D` púrpura profundo | Encabezados, estructura, sidebar, bordes activos, texto de jerarquía |
| `accent` | `#00E5FF` cian eléctrico | **CTA principal**, badge "Aprobado", barras de progreso, focus ring |
| `background` | `#F8F9FA` blanco roto | Fondo de página y contenedores |
| `card` | `#FFFFFF` | Tarjetas sobre el fondo arena (así se separan sin borde fuerte) |

- El **CTA principal va en cian** (`bg-accent text-accent-foreground`); el púrpura queda para
  estructura y jerarquía tipográfica, y para botones secundarios/oscuros.
- El cian es color de *atención*: no lo uses como fondo de secciones grandes ni de superficies
  extensas; en área amplia cansa y pierde la señal de acción.
- `#00E5FF` tiene luminancia altísima: **texto blanco sobre cian no pasa AA**. Sobre cian
  siempre va `--accent-foreground` (púrpura oscuro). Al revés, sobre púrpura `#2D124D` el
  cian y el blanco tienen contraste de sobra.
- Nunca `bg-[#2D124D]`, `text-[#00E5FF]` ni `style={{ color: "#00E5FF" }}` en un componente.
  Si falta un token, agrégalo a `globals.css` y úsalo por nombre.
- Los estados del dominio (pendiente / aprobada / rechazada / al día / en mora) usan sus
  propios tokens, no púrpura ni cian, para que el semáforo se lea de inmediato.

## shadcn/ui

Los componentes se **instalan como código en el repo**, no se importan de una librería. Se
editan libremente; no son un node_module.

Ya está inicializado: `components.json` con `style: "radix-nova"` (primitivas de **Radix**,
iconos de **lucide**, `cssVariables: true`), más `lib/utils.ts` y `components/ui/button.tsx`.

```bash
pnpm dlx shadcn@latest add input form dialog table badge select sidebar
```

No vuelvas a correr `init` (sobreescribe `components.json` y `app/globals.css`, y con ello los
tokens MAD UI). Para agregar componentes usa siempre `add`.

Convenciones:
- Ubicación: `components/ui/*` (primitivas generadas) y `components/*` (composiciones del
  producto). No metas lógica de negocio dentro de `components/ui`.
- **No reescribas una primitiva desde cero** si existe en el registry: instálala y ajústala.
- Composición de clases siempre con `cn()` de `lib/utils.ts` (clsx + tailwind-merge), para
  que la clase de la prop `className` gane sobre la del componente:

```tsx
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-lg border bg-card p-6 shadow-xs", className)} {...props} />;
}
```

- Variantes con `class-variance-authority`, no con condicionales de strings:

```tsx
const badgeVariants = cva("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", {
  variants: {
    estado: {
      pendiente: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
      aprobada: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
      rechazada: "bg-red-50 text-red-800 ring-1 ring-red-200",
    },
  },
  defaultVariants: { estado: "pendiente" },
});
```

- shadcn `Form` es un wrapper de react-hook-form: úsalo junto con la skill
  `zod-react-hook-form`.
- Los componentes de shadcn con estado (`Dialog`, `Select`, `Popover`, `Sheet`) son Client
  Components: mantenlos en hojas del árbol para no cliente-ificar páginas enteras
  (skill `nextjs-app-router`).
- La fuente se resuelve vía `--font-sans` → `--font-geist-sans`, que declara
  `app/layout.tsx` con `next/font`. Si cambias la fuente, actualiza ambos lados.

## Accesibilidad mínima

- Focus visible en todo control interactivo: `focus-visible:ring-2 focus-visible:ring-ring
  focus-visible:ring-offset-2`. Nunca `outline-none` sin reemplazo.
- Botón con solo icono → `aria-label`.
- Errores de formulario asociados con `aria-describedby` + `aria-invalid` (shadcn `FormMessage`
  ya lo hace).
- Nada de comunicar estado solo por color: acompaña con texto o icono.
- Textos de UI en **español de Colombia**; montos con `Intl.NumberFormat("es-CO", { style:
  "currency", currency: "COP", maximumFractionDigits: 0 })`.
