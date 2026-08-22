---
name: shadcn-tailwind
description: "Building UI with shadcn/ui and Tailwind CSS v4 while respecting the MAD UI design system (purple 2D124D, cyan 00E5FF). Use it when creating or modifying any visual component, when touching app/globals.css or components.json, and when choosing classes or colors. Alias - shadcn-ui, tailwind-css."
---

# shadcn/ui + Tailwind CSS v4

The repo's real stack: **Tailwind CSS v4** (`@tailwindcss/postcss`, no `tailwind.config.js`) +
React 19 + Next.js 16.

## Tailwind v4 is CSS-first: there is no tailwind.config.js

```css
/* app/globals.css */
@import "tailwindcss";          /* ← replaces @tailwind base/components/utilities */
```

- The configuration lives in `@theme` inside the CSS, **not** in a JS file. If you need to add
  a color, a font or a radius, declare it there.
- `@theme inline { --color-x: var(--x) }` exposes the variable as a utility (`bg-x`, `text-x`,
  `border-x`).
- There is no `@tailwind base;`, no `theme.extend` and no `content: [...]` (class detection is
  automatic).
- v3 → v4 changes worth remembering: `shadow-sm` → `shadow-xs`, `outline-none` →
  `outline-hidden`, `bg-opacity-*` → `bg-black/50`, and spacing uses the `--spacing` scale.

**Tailwind silently drops classes that do not exist.** If you are unsure about a class name,
verify it before writing it; an invented class does not fail, it just paints nothing.

## Brand tokens (the source of truth)

**`app/globals.css` already exists and is the source of truth**: it holds the brand palette, the
semantic tokens (light + dark), the `sidebar` and `chart` tokens the shadcn components consume,
and the domain status tokens. When you need a new color, add it there; never write it in the
component.

Purple `#2D124D` and cyan `#00E5FF` are **never** written as a loose hex in a component. They
are consumed as semantic tokens: `bg-primary`, `text-primary`, `bg-accent`, `ring-ring`.

The file's structure (a summary — the full content is in the repo):

```css
/* app/globals.css */
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";   /* base styles from the shadcn v4 CLI */

@custom-variant dark (&:is(.dark *));

:root {
  /* --- brand palette --- */
  --brand-purple-950: #1a0a2e;
  --brand-purple-900: #2d124d;   /* BRAND PURPLE */
  --brand-purple-100: #efe6fa;
  --brand-cyan-500: #00e5ff;     /* BRAND CYAN */
  --brand-cyan-700: #008a99;

  /* --- semantic tokens (the ones components use) --- */
  --radius: 0.625rem;
  --background: #f8f9fa;            /* MAD UI: off-white / sand */
  --foreground: var(--brand-purple-950);
  --card: #ffffff;                  /* white cards over the sand background */

  /* structure, headings, active borders */
  --primary: var(--brand-purple-900);
  --primary-foreground: #ffffff;

  /* primary CTA, "approved" badge, progress bars */
  --accent: var(--brand-cyan-500);
  --accent-foreground: var(--brand-purple-900);   /* DARK text on cyan */

  --ring: var(--brand-cyan-600);

  /* Brand panel: purple in BOTH themes (login side column, hero, footer) */
  --brand-panel: var(--brand-purple-900);
  --brand-panel-foreground: #f5f3ff;
  --brand-panel-muted: #cdc2e0;

  /* domain statuses: their own traffic light, neither purple nor cyan */
  --status-pending: #b45309;
  --status-approved: #15803d;
  --status-rejected: #b91c1c;
  --status-current: var(--brand-cyan-700);
  --status-overdue: #b91c1c;
  /* …each one also has its `-bg` variant */
}

.dark {
  --background: var(--brand-purple-950);
  --primary: var(--brand-cyan-500);          /* ⚠️ in dark mode primary is CYAN */
  --primary-foreground: var(--brand-purple-950);
  --brand-panel: var(--brand-purple-950);    /* the brand panel stays purple */
}

@theme inline {
  --color-background: var(--background);
  --color-primary: var(--primary);
  --color-accent: var(--accent);
  --color-brand-panel: var(--brand-panel);
  --color-status-approved: var(--status-approved);
  /* …every token that must become a utility is mapped here */
  --radius-lg: var(--radius);
  --font-sans: var(--font-geist-sans);
}

@layer base {
  * { @apply border-border outline-ring/50; }
  body { @apply bg-background text-foreground antialiased; }
}
```

If you add a new token, remember to map it in `@theme inline` as well, or Tailwind will not
generate the utility.

### Color rules (MAD UI, see CLAUDE.md)

| Token | Hex | Use |
| --- | --- | --- |
| `primary` | `#2D124D` deep purple | Headings, structure, sidebar, active borders, hierarchy text |
| `accent` | `#00E5FF` electric cyan | **Primary CTA**, "approved" badge, progress bars, focus ring |
| `background` | `#F8F9FA` off-white | Page and container backgrounds |
| `card` | `#FFFFFF` | Cards over the sand background (they separate without a heavy border) |

- The **primary CTA is cyan** (`bg-accent text-accent-foreground`); purple is for structure and
  typographic hierarchy, and for secondary/dark buttons.
- Cyan is an *attention* color: do not use it as the background of large sections or wide
  surfaces; over a big area it tires the eye and loses its signal.
- `#00E5FF` has very high luminance: **white text on cyan does not pass AA**. On cyan always use
  `--accent-foreground` (dark purple). The other way round, on purple `#2D124D`, both cyan and
  white have plenty of contrast.
- Never `bg-[#2D124D]`, `text-[#00E5FF]` or `style={{ color: "#00E5FF" }}` in a component. If a
  token is missing, add it to `globals.css` and use it by name.
- **`bg-primary` is not for brand surfaces**: in dark mode `--primary` is cyan and a whole panel
  turns cyan. Use `bg-brand-panel`.
- The domain statuses (pending / approved / rejected / current / overdue) use their own tokens,
  not purple or cyan, so the traffic light reads instantly.

## shadcn/ui

Components are **installed as code in the repo**, not imported from a library. Edit them freely;
they are not a node_module.

It is already initialized: `components.json` with `style: "radix-nova"` (**Radix** primitives,
**lucide** icons, `cssVariables: true`), plus `shared/lib/utils.ts` and `shared/ui/*`.

```bash
pnpm dlx shadcn@latest add input dialog table badge select sidebar
```

Do not run `init` again (it overwrites `components.json` and `app/globals.css`, and with them
the MAD UI tokens). To add components, always use `add`.

⚠️ **Never pass `--overwrite` to `add`.** The flag does not only apply to the component you
asked for: `add` reinstalls that component's dependencies too, from the registry, losing every
local edit. Installing `dialog` this way rewrote `shared/ui/button.tsx` and dropped the `accent`
variant and the `xl` size — the cyan CTA that every form in the product submits with, so the
damage would have shipped as buttons silently falling back to the default variant.

The habit that catches it: after any `shadcn add`, read `git diff --stat` and question any file
you did not expect to see. Recovering is `git checkout shared/ui/<file>.tsx`, and it only works
while the tree is clean enough to tell what changed — one more reason to add components in their
own commit rather than in the middle of a feature.

Conventions:
- Location: `shared/ui/*` (generated primitives), `shared/form/*` (pre-wired fields),
  `shared/shell/*` (app chrome), and each domain's components in `features/<domain>/ui/*`. Never
  put business logic inside `shared/ui`. The `mad-architecture` skill owns this layout.
- **Do not rewrite a primitive from scratch** if it exists in the registry: install it and adapt.
- ⚠️ The `radix-nova` registry **does not expose `form`**: `shadcn add form` does nothing. Build
  forms with `Label` + `Input` + react-hook-form, reusing `shared/form/*`, which already wires
  the label, the error and the ARIA attributes (the `zod-react-hook-form` skill).
- Compose classes with `cn()` from `shared/lib/utils.ts` (clsx + tailwind-merge), so the class
  coming from the `className` prop wins over the component's:

```tsx
import { cn } from "@/shared/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-lg border bg-card p-6 shadow-xs", className)} {...props} />;
}
```

- Variants with `class-variance-authority`, not string conditionals. Keys in English (they are
  stored values), labels in es-CO (they are copy):

```tsx
const badgeVariants = cva("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", {
  variants: {
    status: {
      pending: "bg-status-pending-bg text-status-pending",
      approved: "bg-status-approved-bg text-status-approved",
      rejected: "bg-status-rejected-bg text-status-rejected",
    },
  },
  defaultVariants: { status: "pending" },
});
```

- shadcn components with state (`Dialog`, `Select`, `Popover`, `Sheet`) are Client Components:
  keep them at the leaves of the tree so you do not client-ify whole pages (the
  `nextjs-app-router` skill).
- The font resolves through `--font-sans` → `--font-geist-sans`, declared in `app/layout.tsx`
  with `next/font`. If you change the font, update both sides.
- Dark mode is **not active**: shadcn uses the class variant (`.dark`) and nothing adds it. The
  dark tokens exist and are correct, but today the app renders in light only.

## Minimum accessibility

- Visible focus on every interactive control: `focus-visible:ring-2 focus-visible:ring-ring
  focus-visible:ring-offset-2`. Never `outline-none` without a replacement.
- Icon-only button → `aria-label`.
- Form errors associated through `aria-describedby` + `aria-invalid` (`shared/form/text-field.tsx`
  already does it).
- Never communicate state by color alone: pair it with text or an icon.
- UI text in **Colombian Spanish** (it is the one thing that stays in Spanish, along with the
  URLs); amounts with `Intl.NumberFormat("es-CO", { style: "currency", currency: "COP",
  maximumFractionDigits: 0 })`.
