# Mareyway · Guía para agentes IA

Este archivo lo lee Claude Code automáticamente al iniciar sesión en el repo. Mantenerlo corto, opinado y orientado a "qué hacer / qué no hacer". Para guías más largas usar `docs/`.

> Para profundizar: [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md), [docs/MODULE_TEMPLATE.md](docs/MODULE_TEMPLATE.md), [docs/ENVIOS.md](docs/ENVIOS.md).

## Stack

- **Next.js 15.3** App Router · **React 19** · **TypeScript estricto**
- **Prisma 7** + **Neon** serverless adapter (`@prisma/adapter-neon`)
- **shadcn/ui** sobre **Radix** + **Tailwind 4**
- **react-hook-form** + **Zod** + **Sonner** (toasts) + **Recharts**
- **next-auth 5 beta** (sesiones)
- Idioma de la UI: **español** (México). Identificadores y nombres de archivo en inglés.



## Estructura

```
prisma/
  schema.prisma                   # único archivo de modelos (1k+ líneas, secciones por módulo)
  sql/<modulo>-*.sql              # SQL crudo para CHECK / EXCLUDE / matviews (db push no los maneja)
  seed-<modulo>.ts                # seeds opcionales por módulo
src/
  app/(app)/(<modulo>)/           # rutas autenticadas agrupadas por módulo
    layout.tsx                    # SIEMPRE: await requireModule("<id>")
    <ruta>/page.tsx
  modules/<modulo>/
    actions/*.ts                  # "use server" — mutaciones
    queries/*.ts                  # lecturas (server-only, NO "use server")
    components/*.tsx              # cliente; sub-carpetas por entidad si crece
    lib/*.ts                      # utilidades del módulo (schemas Zod, format, helpers de tx)
  components/ui/                  # shadcn + primitives compartidos (NO modificar sin razón)
  lib/                            # helpers globales (db, auth, audit, module-registry)
  types/index.ts                  # ActionResult<T>, re-exports de Prisma
generated/prisma/                 # cliente generado — NO editar, NO commitear si hay .gitignore
```

Patrón a imitar: **`src/modules/pacas/`** (módulo más maduro). Todo módulo nuevo debe seguir su forma.

## Convenciones de Prisma

- PK semántica + `@map("id")`: `userId Int @id @default(autoincrement()) @map("user_id")`. El plural en inglés con `@@map("snake_case")`.
- Columnas: `camelCase` en TS, `snake_case` en DB via `@map`.
- Cascadas: para datos financieros / ledgers usa `Restrict`. `Cascade` solo cuando el hijo no tenga sentido sin el padre y no haya registro de auditoría que preservar.
- Decimal: `@db.Decimal(20, 8)` para montos monetarios. Convertir a `string`/`number` antes de pasar al cliente.
- Concurrencia (Neon serverless **no soporta `SELECT FOR UPDATE` confiable**): usar **optimistic locking con campo `version Int`** + `UPDATE ... WHERE id=$1 AND version=$2 RETURNING ...`. Reintento corto (3 intentos) ante stale.
- `db push` no aplica CHECK ni EXCLUDE ni materialized views. Esos van en `prisma/sql/<modulo>-*.sql` y se aplican manualmente con `psql`.

## Server actions (patrón obligatorio)

```ts
"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createAuditLog, getCurrentUserId } from "@/lib/audit";
import type { ActionResult } from "@/types";

export async function createX(input: XInput): Promise<ActionResult<{ id: number }>> {
  try {
    // 1. Validar (Zod si el input viene de form)
    const userId = await getCurrentUserId();
    const result = await db.$transaction(async (tx) => {
      // 2. Operación principal
      const row = await tx.x.create({ data: ... });
      // 3. Audit dentro de la tx
      await createAuditLog(tx, { action: "create", entityType: "X", entityId: row.id, module: "<modulo>", userId, newValues: input });
      return row;
    });
    revalidatePath("/<modulo>/<ruta>");
    return { success: true, data: { id: result.id } };
  } catch (e) {
    console.error("createX:", e);
    return { success: false, error: "Mensaje en español para el usuario" };
  }
}
```

Reglas:
- **Toda mutación** retorna `ActionResult<T>` (definido en `src/types/index.ts`).
- **Toda mutación** crea audit log dentro de la transacción.
- **Toda mutación** llama a `revalidatePath` en las rutas afectadas.
- Mensajes de error al usuario en **español**, sin tecnicismos. Loguear el error real con `console.error`.
- No exponer `Error.message` directo al cliente.
- Acciones que tocan dinero, balances o ledger **siempre** usan `db.$transaction` y la audit es obligatoria.

## Auth y permisos

- Layouts de módulo: `await requireModule("<id>")` desde `src/lib/auth-guard.ts`.
- IDs y rutas se declaran en `src/lib/module-registry.ts` (sidebar lo lee).
- Usuario actual: `getCurrentUserId()` (devuelve `number | null`) o `requireCurrentUserId()` (lanza si no hay sesión).
- Roles: `admin`, `dispatcher`, `viewer`. Admin pasa todos los `requireModule`.

## UI (mobile-first, premium)

Primitives en `src/components/ui/` (NO inventar variantes; reusar):

- `PageHeader`: header con icon, title, description, badge, slot de acciones. Va siempre al inicio de cada page.
- `ResponsiveFormDialog`: sheet bottom en `<md`, dialog en `>=md`. Para todo formulario.
- `MobileListCard` + `<Table>`: lista con dos vistas (cards en mobile, tabla en desktop). Existe `ResponsiveListView` que las une.
- `MobileFilterSheet`: filtros en mobile.
- `KpiCard` / `MetricTile` / `Spark`: dashboard.
- `StatusPill`: badges de estado (pending/confirmed/cancelled, active/inactive).
- `Fab`: floating action button (mobile primary).
- `EmptyState`: vacíos con icono + frase + CTA.

Reglas:
- **Mobile-first** absoluto. Probar viewport 375px antes de claim "listo".
- Montos monetarios: `font-mono tabular-nums` siempre.
- Signo `−` (U+2212) para negativos, `+` (U+002B) para positivos, coloreados.
- `prefers-reduced-motion`: respetar siempre. Animaciones opcionales detrás de check.
- No emojis en UI ni en código a menos que el usuario lo pida.
- No agregar comentarios "lo que hace el código". Solo el "por qué" cuando sea no-obvio.

## Skills y agentes

Resumen ejecutivo (detalle en [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md)):

- **Explorar el repo (>3 búsquedas)** → `Agent` con `subagent_type: Explore`, en paralelo si las áreas son independientes.
- **Diseñar feature complejo** → `Agent` con `subagent_type: Plan`. Escribir plan a archivo de plan, iterar con `AskUserQuestion`, cerrar con `ExitPlanMode`.
- **Schema / DB / migraciones** → `database-architect` para revisar concurrencia, índices, cascadas. Aplicar SQL crudo en `prisma/sql/`.
- **UI/UX premium / dashboards / formularios** → `ui-ux-designer` agent + skill `vercel:react-best-practices` o `senior-frontend`.
- **Seguridad / auth / endpoints sensibles** → `security-reviewer` después de escribir.
- **Refactor / limpieza** → `refactor-cleaner` o skill `simplify` sobre código tocado en la sesión.
- **Excel real del cliente** → skill `xlsx` (openpyxl). El usuario suele compartir hojas con miles de filas; leer en streaming (`read_only=True`).

Skills útiles ya disponibles: `clean-code`, `senior-frontend`, `senior-fullstack`, `senior-backend`, `senior-architect`, `vercel:nextjs`, `vercel:react-best-practices`, `supabase-postgres-best-practices`, `xlsx`, `pdf-anthropic`, `webapp-testing`.

## Workflow estándar

1. **Entender** — explorar (Explore agent o Grep/Glob), leer ficheros clave, no asumir.
2. **Planear** — para tareas no triviales, escribir un plan en `C:/Users/PC/.claude/plans/<slug>.md` y validar con el usuario (`AskUserQuestion` para ambigüedades) antes de tocar código.
3. **Ejecutar** — implementar PR pequeños y verticales. Cada PR: schema/migración/registry → backend → UI → polish, según el módulo.
4. **Verificar** — `pnpm prisma validate`, `pnpm prisma generate`, `npx tsc --noEmit`, idealmente `pnpm dev` y probar la ruta tocada.
5. **Commitear** — `feat(<modulo>):`, `fix(<modulo>):`, `chore(<modulo>):`. Cuerpo en español, conciso, agrupando cambios por archivo o área. Co-Authored-By incluido.
6. **Pushear** sólo cuando el usuario lo pida, o explícitamente lo confirme.

## Lo que NO hacer

- ❌ No editar `generated/prisma/`, `node_modules/`, `.next/`.
- ❌ No agregar `currency: string` ad-hoc; el modelo `Currency` ya existe (módulo envios).
- ❌ No usar `SELECT FOR UPDATE` con Neon HTTP adapter — corrupción silenciosa.
- ❌ No `Cascade` cuando hay datos financieros o auditables.
- ❌ No exponer `Decimal` de Prisma directo al cliente — siempre serializar (`.toString()` / `.toNumber()` con cuidado).
- ❌ No crear migraciones manuales en `prisma/migrations/` (el proyecto usa `db push`).
- ❌ No `git push --force` ni `--no-verify` salvo que el usuario lo pida explícitamente.
- ❌ No ampliar el alcance de un PR. Un fix es un fix; refactorizar lo de al lado va aparte.
- ❌ No agregar comentarios narrando lo que el código hace.

## Secretos y entorno

- `.env`, `.env.local`: nunca commitear. Si están listados en `.gitignore`, asumir secretos vivos dentro.
- Todas las variables sensibles ya están en Neon Postgres / Vercel. No re-leer `.env` salvo que sea estrictamente necesario.
