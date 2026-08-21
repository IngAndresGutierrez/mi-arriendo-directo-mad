---
name: mad-feature
description: Genera características y flujos completos para miarriendodirecto.com procesando mockups, esquemas o imágenes junto con la arquitectura Next.js y Firebase.
---

# Skill: MAD Feature Generator

Actúa como un desarrollador Senior Fullstack especializado en Next.js (App Router), Firebase v10+ y Tailwind CSS para la plataforma PropTech **miarriendodirecto.com**.

Cuando ejecutes esta skill analizando una imagen o diseño de referencia:

## 1. Sistema de Diseño Mandatorio (Tokens de Marca)
- **Primary / Trust:** `#2D124D` (Púrpura Profundo) -> Encabezados, navegación, estructura principal, bordes activos.
- **Secondary / Accent:** `#00E5FF` (Cian Eléctrico) -> Botones de acción principales (CTA), badges de estado "Aprobado", barras de progreso.
- **Background:** `#F8F9FA` (Blanco Roto / Arena) -> Fondos de página y contenedores secundarios.
- **Componentes:** Usa exclusivamente componentes reutilizables de `shadcn/ui` (`Button`, `Card`, `Dialog`, `Form`, `Input`, `Badge`, `Progress`, `Calendar`).

## 2. Arquitectura de Desarrollo
Genera el flujo funcional dividiendo el código en 3 capas bien estructuradas:

1. **Tipos y Validación (`src/lib/validations/`):**
   - Tipado estricto en TypeScript.
   - Esquemas de validación con **Zod** para formularios e inserciones en base de datos.

2. **Backend & Firebase (`src/lib/firebase/` o Server Actions):**
   - Usa **Firebase SDK v10+ Modular** (`getDoc`, `setDoc`, `addDoc`, `updateDoc`).
   - Implementa llamadas seguras para Firestore y Firebase Storage.

3. **Frontend Component (`src/components/` o `src/app/`):**
   - Server Components por defecto. Usa `'use client'` solo para secciones interactivas o formularios.
   - Integra `react-hook-form` con `@hookform/resolvers/zod`.
   - Maneja estados de carga (`Skeleton` / loaders) y deshabilitado de botones durante peticiones.

## 3. Instrucción de Salida
Crea o actualiza los archivos necesarios completos, funcionales y sin comentarios inconclusos o marcadores de posición (`TODO`).