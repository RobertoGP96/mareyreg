# Workflow con agentes IA — Mareyway

Documento operativo para estandarizar cómo Claude Code (y otros agentes) abordan trabajo en este repo. Complementa [CLAUDE.md](../CLAUDE.md).

## Fases de trabajo

Cualquier tarea no trivial pasa por 5 fases. Forzarlas evita tirar código que el usuario no quería.

### Fase 1 · Entender

| Acción | Cuándo | Tool / Skill |
|---|---|---|
| Lectura puntual de archivo conocido | Sé el path | `Read` |
| Buscar símbolo o string preciso | Sé qué buscar | `Grep` |
| Buscar archivos por patrón | Sé el nombre / glob | `Glob` |
| Exploración abierta del repo (>3 queries) | Scope incierto | `Agent` con `subagent_type: Explore` |
| Análisis de Excel del cliente | Adjunta `.xlsx` | Skill `xlsx` (openpyxl, `read_only=True`) |

**Regla**: si la respuesta requiere más de 3 búsquedas en serie, delegar al Explore agent en lugar de gastar contexto.

### Fase 2 · Planear

Aplicable cuando la tarea cambia >2 archivos o introduce un módulo nuevo.

1. Crear plan en `C:/Users/PC/.claude/plans/<slug>.md` (auto-creado por plan mode).
2. Lanzar `Agent` con `subagent_type: Plan` para diseño técnico (1–3 agentes en paralelo según complejidad).
3. Para schema/concurrencia/integridad: `Agent` con `subagent_type: database-architect`.
4. Para UX premium / dashboards: `Agent` con `subagent_type: ui-ux-designer`.
5. Cerrar dudas con `AskUserQuestion` (decisiones de modelado, naming, alcance) **antes** de implementar.
6. Salir del plan con `ExitPlanMode`.

**Regla**: nunca empezar a editar antes de tener el plan aprobado para tareas grandes.

### Fase 3 · Ejecutar

Implementar en **PRs pequeños y verticales**. Cada PR pasa CI verde, no rompe la `main`, idealmente entrega un slice end-to-end.

Plantilla de orden por módulo nuevo:

| PR | Contenido | Verificación mínima |
|---|---|---|
| 1 | Schema + SQL constraints + seed + module-registry + layout + placeholders | `prisma validate`, `tsc --noEmit` |
| 2 | CRUDs simples (catálogos: monedas, categorías, etc.) | dev server, navegar la lista, crear/editar |
| 3 | Entidades dependientes (cuentas, tasas, productos) | crear con datos reales del cliente |
| 4 | Operaciones core (formularios principales) | flujo feliz y edge cases (sin saldo, etc.) |
| 5 | Flujos avanzados (transferencias, pendientes, bulk) | concurrencia + status transitions |
| 6 | Dashboard + polish (KPIs, atajos, empty states) | mobile + desktop |
| 7 | Hardening (tests, role grants, e2e) | smoke tests pasan |

**Regla TodoWrite**: para cualquier tarea con ≥3 pasos, crear todo list y mantenerlo vivo (un solo `in_progress`, marcar `completed` apenas se termina).

### Fase 4 · Verificar

Antes de decir "listo":

```bash
# Schema
DATABASE_URL='postgresql://placeholder' pnpm prisma validate
DATABASE_URL='postgresql://placeholder' pnpm prisma generate

# Types
npx tsc --noEmit

# Build (cuando se toca app/, components/ o config)
pnpm build

# Runtime (cuando se toca UI)
pnpm dev   # navegar la ruta tocada en mobile (375px) y desktop
```

Para SQL constraints o materialized views: aplicar manualmente con `psql "$DATABASE_URL" -f prisma/sql/<archivo>.sql` y verificar con `psql -c "\d+ <tabla>"`.

### Fase 5 · Commitear y pushear

Convención de mensajes:

```
<tipo>(<modulo>): <resumen en imperativo, ≤72 chars>

<cuerpo en español, 2-6 párrafos, qué cambió y por qué>

<sección opcional con bullets de archivos clave>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

Tipos: `feat`, `fix`, `chore`, `refactor`, `docs`, `style`, `test`, `perf`.

Reglas:
- Un commit = un cambio coherente. No mezclar refactors con features.
- Push solo si el usuario lo pidió o lo confirma explícitamente.
- Nunca `--no-verify`, `--force`, ni `--amend` sobre commits ya pusheados.

## Mapa de agentes especializados

Lista corta de agentes que vale la pena invocar. Para más, ver el sistema completo de agentes.

| Agente | Para qué | Cuándo |
|---|---|---|
| `Explore` | Exploración rápida del repo | Scope incierto, >3 búsquedas |
| `Plan` | Diseño de implementación | Tareas no triviales, módulos nuevos |
| `database-architect` | Revisar schema, concurrencia, índices | Antes de aplicar migraciones que tocan ledgers |
| `database-reviewer` | QA de queries y migraciones existentes | Cuando hay queries lentas o sospecha de N+1 |
| `ui-ux-designer` | Premium UX, dashboards, flujos críticos | Antes de gastar tiempo en UI compleja |
| `react-performance-optimizer` | Optimizar re-renders y bundles | Cuando hay quejas de lentitud |
| `security-reviewer` | Revisar endpoints/auth/auditoría | Después de tocar auth, server actions sensibles, payments |
| `code-reviewer` | Code review pre-merge | Antes de PR grande |
| `refactor-cleaner` | Eliminar muerto, simplificar | Tras ramas largas, antes de release |
| `e2e-runner` | Tests end-to-end con Playwright | Flujos críticos del cliente |
| `debugger` | Diagnosticar bug reproducible | Stack trace o repro disponible |
| `error-detective` | Investigar errores en logs / producción | Síntomas sin causa clara |

**Reglas para invocar agentes**:
- Brief auto-contenido: paths exactos, líneas, qué reportar, longitud máxima.
- Para trabajos independientes, lanzarlos **en paralelo** (un solo mensaje con varias `Agent` calls).
- Confiar pero verificar: leer los cambios del agente antes de marcar `completed`.

## Skills recomendados

| Tarea | Skill |
|---|---|
| Excel del cliente (lectura/análisis) | `xlsx` |
| PDFs (lectura, splitting, llenado) | `pdf-anthropic` |
| Convenciones de código limpio | `clean-code`, `simplify` |
| Frontend pesado (React/Next 15) | `senior-frontend`, `vercel:nextjs`, `vercel:react-best-practices` |
| Backend / API design | `senior-backend`, `vercel:vercel-functions` |
| Postgres + Prisma + Supabase | `supabase-postgres-best-practices` |
| Arquitectura general | `senior-architect` |
| Testing webapps | `webapp-testing` |
| Reducir prompts de permisos | `fewer-permission-prompts` |
| Validar configuración Claude | `update-config` |
| Diseño visual / UI tokens | `ui-design-system`, `ui-ux-pro-max` |

**Regla**: cuando el usuario invoque `/<nombre>`, ejecutar la skill via tool `Skill`. No confundir con comandos CLI nativos (`/help`, `/clear`).

## Plantilla de prompt para módulo nuevo

Cuando el usuario pide "agregar módulo X":

```
1. Pregunta de aclaración con AskUserQuestion (4 preguntas máx):
   - Identifier y label en sidebar
   - Decisiones de modelado críticas (relaciones, agrupaciones)
   - Status / soft-delete vs hard-delete
   - Alcance v1: ¿qué entra y qué se difiere a v2?

2. Lanzar EN PARALELO:
   - Agent Explore: estructura actual + módulo de referencia (pacas)
   - Skill xlsx (si hay Excel del cliente)
   - Read de prisma/schema.prisma para insertar al final

3. Lanzar EN PARALELO:
   - Agent Plan: diseño completo (schema, actions, queries, UI, verificación)
   - Agent database-architect: revisión de concurrencia y constraints
   - Agent ui-ux-designer: layout premium

4. Consolidar plan en C:/Users/PC/.claude/plans/<slug>.md, incluir:
   - Context (problema y outcome)
   - Schema completo
   - Archivos a crear/modificar con paths
   - Plan de PRs incrementales (PR 1...PR N)
   - Verificación end-to-end
   - Riesgos y open questions

5. ExitPlanMode → esperar aprobación.

6. Implementar PR 1 completo (schema + registry + layout + placeholders).
   Verificar (prisma validate, tsc) → commit → push si el usuario lo pidió.

7. Continuar con PR 2…N en sesiones posteriores o iteraciones cortas.
```

## Reglas de oro

1. **Modelar antes de codear.** El schema es la columna vertebral. Si no convence, ningún PR posterior salva el módulo.
2. **Audit + transacción + revalidatePath.** Siempre. No hay excepciones para mutaciones que importen.
3. **Mobile-first y tabular-nums.** El usuario está construyendo herramientas operativas en español. La precisión visual de los números importa.
4. **Mantener `pacas` como espejo.** Cuando dudes del patrón, abre el módulo `pacas` y copia su forma.
5. **El usuario manda en alcance.** No agregar features no pedidas. No "mientras estaba acá toqué esto otro". Si encuentras algo que arreglar fuera de scope, ofrecerlo como PR aparte.
6. **Empujar al puerto antes de seguir.** Cada PR completado se commitea (y se pushea cuando el usuario lo pidió). No acumular cambios sin commitear.
