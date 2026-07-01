---
name: notifying-with-sonner
description: Use when adding, editing, or reviewing user-facing toast notifications in Mareyway client components — showing success/error feedback after a server action, validating a form before submit, or handling an ActionResult in the UI.
---

# Notificaciones con Sonner (Mareyway)

Toda notificación al usuario en la plataforma usa **Sonner** vía `toast`. El `<Toaster />` ya está montado globalmente en `src/components/providers.tsx` (`position="top-right" richColors closeButton`) con estilos custom en `src/components/ui/sonner.tsx`. **No montar otro `<Toaster />` ni tocar ese setup.**

## Import

```ts
import { toast } from "sonner";
```

Solo se usa en componentes cliente (`"use client"`). Nunca en server actions ni queries.

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

## Qué tipo usar

| Situación | Llamada |
|---|---|
| Mutación exitosa | `toast.success("...")` |
| Error de action / validación | `toast.error("...")` |
| Aviso no bloqueante (raro) | `toast.warning("...")` |
| Detalle secundario | `toast.error("Título", { description: "Detalle" })` |

- Por defecto solo `success` y `error`. `warning` solo para avisos genuinos no-bloqueantes.
- **No usar** `toast.loading` / `toast.promise` para el estado de carga: el repo usa un botón deshabilitado con `isSubmitting` + spinner (`Loader2`). Seguí ese patrón.
- **No emojis** en los mensajes (regla del repo).

## Errores comunes

| Error | Correcto |
|---|---|
| `toast.error("Error: " + e.message)` | `toast.error(result.error)` (mensaje en español de la action) |
| Mensaje en inglés o con tecnicismos | Español, claro, sin nombres de campos técnicos |
| `toast()` genérico sin tipo | `toast.success` / `toast.error` según corresponda |
| Montar otro `<Toaster />` | Ya está global en `providers.tsx` |
| Olvidar `router.refresh()` tras éxito | Refrescar salvo que la UI ya se actualice sola |
| Cerrar el dialog después del toast | Cerrar el dialog **antes** del toast |

## Referencia

- Setup: `src/components/ui/sonner.tsx`, `src/components/providers.tsx`.
- Ejemplos vivos del patrón: `src/modules/*/components/*-list-client.tsx` (p. ej. suppliers, pacas, envios).
- `ActionResult<T>`: `src/types/index.ts`.
