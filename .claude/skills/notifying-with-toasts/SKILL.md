---
name: notifying-with-toasts
description: Use when adding, editing, or reviewing user-facing toast notifications in Mareyway client components — showing success/error feedback after a server action, validating a form before submit, or handling an ActionResult in the UI.
---

# Notificaciones (toasts) en Mareyway

Toda notificación al usuario usa el adaptador **`@/lib/toast`**, respaldado por **Sileo** (librería de toasts con animaciones spring). El `<Toaster />` ya está montado globalmente en `src/components/providers.tsx` vía `src/components/ui/toaster.tsx` (position top-right, tema sincronizado con next-themes). **No montar otro `<Toaster />`, no importar `sileo` directamente en componentes, no tocar ese setup.**

## Import

```ts
import { toast } from "@/lib/toast";
```

Solo se usa en componentes cliente (`"use client"`). Nunca en server actions ni queries. **Nunca** `import { sileo } from "sileo"` en componentes — cambios de librería se hacen solo en el adaptador.

## Patrón canónico: manejar un `ActionResult<T>`

Las mutaciones devuelven `ActionResult<T>` (`{ success:true, data }` | `{ success:false, error }`). En el handler del cliente, este es el orden estándar — **respetarlo tal cual**:

```ts
const handleSubmit = async () => {
  setIsSubmitting(true);
  const result = await createSupplier(data);
  setIsSubmitting(false);
  if (result.success) {
    setIsCreateOpen(false);        // 1. cerrar dialog/sheet ANTES del toast
    toast.success("Proveedor creado"); // 2. toast en español, sin punto final
    router.refresh();              // 3. revalidar la vista
  } else {
    toast.error(result.error);     // el mensaje ya viene en español desde la action
  }
};
```

- El mensaje de error se toma **siempre** de `result.error` (la action ya lo devuelve en español, sin tecnicismos). Nunca construir el mensaje de error en el cliente ni exponer `Error.message` crudo.
- Interpolar datos del resultado cuando aporta: `` toast.success(`Orden procesada — folio ${result.data.folio}`) ``.
- Mensaje condicional cuando aplica: `toast.success(pending ? "Pendiente registrada" : "Operación confirmada")`.

## Validación previa (antes de llamar la action)

Si validás en el cliente antes de la mutación, usá `toast.error` con el mensaje y cortá con `return` — no llames la action:

```ts
if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
  toast.error("La imagen no puede pesar más de 5 MB");
  return;
}
```

## Descripciones enriquecidas (JSX)

`description` acepta `ReactNode`. Para eventos con datos que aportan (montos, deltas, listas de errores), usar los bloques de `src/components/ui/toast-content.tsx` en vez de concatenar strings:

| Bloque | Uso |
|---|---|
| `ToastLines` | Contenedor apilado (columna, gap 1) |
| `ToastDetail` | Par etiqueta/valor; `mono` para montos (`font-mono tabular-nums`) |
| `ToastDelta` | Cambio de valor `anterior → nuevo` (precios, tasas) |
| `ToastNote` | Línea secundaria muted |

```tsx
import { ToastDetail, ToastLines } from "@/components/ui/toast-content";

toast.success(`Factura ${result.data.folio} emitida`, {
  description: (
    <ToastLines>
      <ToastDetail label={`${cart.length} artículos`} value={`$${total.toFixed(2)}`} mono />
      {change > 0 && <ToastDetail label="Cambio" value={`$${change.toFixed(2)}`} mono />}
    </ToastLines>
  ),
});
```

Reglas:
- Sileo impone su tipografía; overrides con el modificador `!` de Tailwind (`text-xs!`, `text-muted-foreground!`) — los bloques ya lo hacen.
- Contenido corto (máx ~3 líneas): el toast colapsa a pill y se expande solo unos segundos.
- Solo cuando el dato enriquece el evento (montos, delta de precio, resumen de lote). Para un mensaje simple, string plano.
- Ejemplos vivos: `pos-client.tsx` (venta), `webstore-catalog-client.tsx` (delta de precio), `envios/.../pending-list-client.tsx` (resumen de lote).

## Qué tipo usar

| Situación | Llamada |
|---|---|
| Mutación exitosa | `toast.success("...")` |
| Error de action / validación | `toast.error("...")` |
| Aviso no bloqueante (raro) | `toast.warning("...")` |
| Detalle secundario | `toast.error("Título", { description: "Detalle" })` |

- Por defecto solo `success` y `error`. `warning` solo para avisos genuinos no-bloqueantes.
- **No usar** estados de carga en toasts (`sileo.promise`): el repo usa un botón deshabilitado con `isSubmitting` + spinner (`Loader2`). Seguí ese patrón.
- **No emojis** en los mensajes (regla del repo).

## Errores comunes

| Error | Correcto |
|---|---|
| `toast.error("Error: " + e.message)` | `toast.error(result.error)` (mensaje en español de la action) |
| Mensaje en inglés o con tecnicismos | Español, claro, sin nombres de campos técnicos |
| `import { toast } from "sonner"` / `import { sileo } from "sileo"` | `import { toast } from "@/lib/toast"` |
| Montar otro `<Toaster />` | Ya está global en `providers.tsx` |
| Olvidar `router.refresh()` tras éxito | Refrescar salvo que la UI ya se actualice sola |
| Cerrar el dialog después del toast | Cerrar el dialog **antes** del toast |

## Referencia

- Adaptador: `src/lib/toast.ts` (firma `toast.success(título, { description?, duration? })`).
- Setup: `src/components/ui/toaster.tsx`, `src/components/providers.tsx`.
- Ejemplos vivos del patrón: `src/modules/*/components/*-list-client.tsx` (p. ej. suppliers, pacas, envios).
- `ActionResult<T>`: `src/types/index.ts`.
