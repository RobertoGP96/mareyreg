# Plantilla — Crear un módulo nuevo

Checklist accionable. Llenar de arriba hacia abajo. Cada item es ~5 minutos de trabajo o menos.

> Imitar siempre `src/modules/pacas/` como referencia visual y de patrones.

## 0 · Decidir naming

- [ ] **id** del módulo (string, kebab/snake en español): `<id>`
- [ ] **label** del sidebar (visible al usuario, español): `<Label>`
- [ ] **route group**: `(<id>)` bajo `src/app/(app)/`

## 1 · Schema (`prisma/schema.prisma`)

- [ ] Añadir sección al final del archivo con header decorativo:
  ```
  // =============================================
  // <ID> MODULE - <descripción 1 línea>
  // =============================================
  ```
- [ ] Modelos con PK semántica `<entidad>Id Int @id @default(autoincrement()) @map("id")`.
- [ ] `@@map("snake_case_plural")` en cada modelo.
- [ ] `Decimal` con `@db.Decimal(20, 8)` para montos.
- [ ] Cascadas conservadoras: `Restrict` para relaciones a User y a entidades con audit.
- [ ] Índices compuestos para queries calientes (lista por entidad + fecha, status + fecha).
- [ ] Para concurrencia sobre balances u otros campos mutables: `version Int @default(0)`.
- [ ] Back-relations en `User` si aplica: añadir cerca de la línea 31.

## 2 · SQL constraints (`prisma/sql/<id>-constraints.sql`)

`db push` no aplica esto. Crear el archivo si necesitas:

- [ ] CHECK constraints (ej. balance ≥ 0, rate > 0)
- [ ] EXCLUDE constraints (ej. anti-solape de rangos)
- [ ] Materialized views para dashboard
- [ ] Índices parciales (ej. `WHERE status = 'pending'`)

Documentar en el header del archivo cómo aplicarlo:
```
-- psql "$DATABASE_URL" -f prisma/sql/<id>-constraints.sql
```

## 3 · Seed (`prisma/seed-<id>.ts`)

Si el módulo necesita datos iniciales (catálogos, permisos):

- [ ] Upsert por clave natural (no por `id`).
- [ ] Otorgar `UserModulePermission` a admins existentes.
- [ ] `pnpm tsx prisma/seed-<id>.ts` corre sin errores.

## 4 · Module registry (`src/lib/module-registry.ts`)

- [ ] Importar iconos de `lucide-react` necesarios.
- [ ] Añadir entrada al array `modules`:
  ```ts
  {
    id: "<id>",
    label: "<Label>",
    icon: <IconHeader>,
    enabled: true,
    routes: [
      { name: "Dashboard", href: "/<id>/dashboard", icon: LayoutDashboard },
      // ...
    ],
  },
  ```

## 5 · Estructura de carpetas

```
src/modules/<id>/
  actions/
  queries/
  components/
    shared/
    <entidad>/
  lib/
    schemas.ts        # Zod
    types.ts          # DTOs serializables
    format.ts         # helpers de formato si aplica
src/app/(app)/(<id>)/
  layout.tsx
  <id>/
    dashboard/page.tsx
    <ruta>/page.tsx
```

- [ ] Crear todas las carpetas (vacías, con placeholders si quieres commitear el esqueleto).
- [ ] Crear `layout.tsx`:
  ```ts
  import { requireModule } from "@/lib/auth-guard";
  export default async function <Id>Layout({ children }: { children: React.ReactNode }) {
    await requireModule("<id>");
    return <>{children}</>;
  }
  ```

## 6 · Placeholders por ruta

Por cada `route` del registry, crear `page.tsx` mínimo con `PageHeader`:
```ts
import { PageHeader } from "@/components/ui/page-header";
import { <Icon> } from "lucide-react";
export default function <Page>() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader icon={<Icon>} title="<Título>" description="<una línea>" />
      <p className="text-muted-foreground text-sm">En construcción.</p>
    </div>
  );
}
```

## 7 · Verificación pre-commit

```bash
DATABASE_URL='postgresql://placeholder' pnpm prisma validate
DATABASE_URL='postgresql://placeholder' pnpm prisma generate
npx tsc --noEmit
```

Todo en verde. Si falla, no commitear.

## 8 · Commit del PR 1

```
feat(<id>): scaffold módulo <Label> (PR 1)

<cuerpo: por qué existe el módulo, qué entra en este PR>

Schema (prisma/schema.prisma):
- ...

DB constraints (prisma/sql/<id>-constraints.sql):
- ...

Navegación:
- ...

Próximos PRs implementan ...

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

## 9 · Resto de PRs (incremental)

Seguir tabla de [docs/AI_WORKFLOW.md](AI_WORKFLOW.md):

- PR 2: catálogos (listas, formularios CRUD simples).
- PR 3: entidades dependientes.
- PR 4: operaciones core / flujos principales.
- PR 5: flujos avanzados (transferencias, bulk, status transitions).
- PR 6: dashboard + polish.
- PR 7: hardening.

## 10 · Documentar el módulo

Crear `docs/<ID>.md` con:
- Estado de cada PR (✓ / en curso / pendiente).
- Decisiones de diseño no obvias.
- SQL manual a aplicar.
- Cómo verificar end-to-end.

Ejemplo: [docs/ENVIOS.md](ENVIOS.md).
