// Zod schemas compartidos por server actions y formularios del módulo entregas.
import { z } from "zod";
import { DELIVERY_PHOTO_KINDS } from "./photo-kinds";

export const recipientSchema = z.object({
  fullName: z.string().trim().min(2, "Nombre mínimo 2 caracteres").max(120),
  phone: z.string().trim().max(40).nullish(),
  address: z.string().trim().max(500).nullish(),
  mapUrl: z
    .string()
    .trim()
    .max(500)
    .url("URL inválida")
    .nullish()
    .or(z.literal("").transform(() => null)),
  active: z.boolean().optional(),
});
export type RecipientInput = z.infer<typeof recipientSchema>;

export const deliveryProviderSchema = z.object({
  name: z.string().trim().min(2, "Nombre mínimo 2 caracteres").max(120),
  active: z.boolean().optional(),
});
export type DeliveryProviderInput = z.infer<typeof deliveryProviderSchema>;

export const DELIVERY_PHOTO_ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export const DELIVERY_PHOTO_ACCEPT_ATTR = DELIVERY_PHOTO_ACCEPTED_MIME.join(",");
export const DELIVERY_PHOTO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const DELIVERY_PHOTOS_MAX = 10;

/**
 * Una foto ya subida a Blob. `photoId` viaja solo al editar: identifica las
 * fotos existentes que se conservan; sin él, la foto es nueva.
 */
export const deliveryPhotoSchema = z.object({
  photoId: z.coerce.number().int().positive().nullish(),
  url: z.string().trim().max(500).url("URL de foto inválida"),
  kind: z.enum(DELIVERY_PHOTO_KINDS).default("receipt"),
  caption: z.string().trim().max(160).nullish(),
});
export type DeliveryPhotoInput = z.infer<typeof deliveryPhotoSchema>;

export const deliveryPhotosSchema = z
  .array(deliveryPhotoSchema)
  .max(DELIVERY_PHOTOS_MAX, `Máximo ${DELIVERY_PHOTOS_MAX} fotos por entrega`);

export const deliveryPhotoMetaSchema = z.object({
  kind: z.enum(DELIVERY_PHOTO_KINDS),
  caption: z.string().trim().max(160).nullish(),
});
export type DeliveryPhotoMetaInput = z.infer<typeof deliveryPhotoMetaSchema>;

export const deliveryLineDenominationSchema = z.object({
  denominationId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive("La cantidad debe ser mayor a 0"),
});
export type DeliveryLineDenominationInput = z.infer<typeof deliveryLineDenominationSchema>;

/**
 * En moneda de EFECTIVO el monto no se captura: se deriva de Σ(valor × cantidad)
 * del desglose. En moneda DIGITAL no hay billetes y `amount` se captura directo.
 *
 * Cuál de los dos aplica depende de `Currency.kind`, que Zod no conoce: el
 * emparejamiento lo valida `resolveDeliveryLines` dentro de la transacción.
 */
export const cashDeliveryLineSchema = z.object({
  currencyId: z.coerce.number().int().positive("Selecciona una moneda"),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0").nullish(),
  denominations: z
    .array(deliveryLineDenominationSchema)
    .max(30, "Máximo 30 denominaciones por monto")
    .default([]),
});
export type CashDeliveryLineInput = z.infer<typeof cashDeliveryLineSchema>;

export const cashDeliverySchema = z
  .object({
    recipientId: z.coerce.number().int().positive("Selecciona un destinatario"),
    providerId: z.coerce.number().int().positive().nullish(),
    courierId: z.coerce.number().int().positive().nullish(),
    commissionAmount: z.coerce.number().min(0, "La comisión no puede ser negativa").default(0),
    commissionCurrencyId: z.coerce.number().int().positive().nullish(),
    photos: deliveryPhotosSchema.default([]),
    lines: z
      .array(cashDeliveryLineSchema)
      .min(1, "Agrega al menos un monto")
      .max(10, "Máximo 10 montos por entrega"),
    reference: z.string().trim().max(80).nullish(),
    notes: z.string().trim().max(500).nullish(),
    occurredAt: z.string().datetime().nullish().or(z.string().length(0).nullish()),
  })
  .refine((d) => new Set(d.lines.map((l) => l.currencyId)).size === d.lines.length, {
    message: "No repitas la misma moneda; suma los montos en una sola línea",
    path: ["lines"],
  })
  .refine((d) => d.commissionAmount === 0 || d.courierId != null, {
    message: "Selecciona el mensajero al asignar una comisión",
    path: ["courierId"],
  })
  .refine((d) => d.commissionAmount === 0 || d.commissionCurrencyId != null, {
    message: "Selecciona la moneda de la comisión",
    path: ["commissionCurrencyId"],
  })
  .refine(
    (d) =>
      d.lines.every(
        (l) => new Set(l.denominations.map((x) => x.denominationId)).size === l.denominations.length
      ),
    { message: "Denominación repetida en un mismo monto", path: ["lines"] }
  );
export type CashDeliveryInput = z.infer<typeof cashDeliverySchema>;

export const courierProfileSchema = z
  .object({
    userId: z.coerce.number().int().positive("Selecciona un usuario"),
    phone: z.string().trim().max(40).nullish(),
    notes: z.string().trim().max(500).nullish(),
    defaultCommission: z.coerce.number().min(0, "La comisión no puede ser negativa").nullish(),
    defaultCommissionCurrencyId: z.coerce.number().int().positive().nullish(),
    active: z.boolean().optional(),
  })
  .refine(
    (c) =>
      c.defaultCommission == null ||
      c.defaultCommission === 0 ||
      c.defaultCommissionCurrencyId != null,
    {
      message: "Selecciona la moneda de la comisión por defecto",
      path: ["defaultCommissionCurrencyId"],
    }
  );
export type CourierProfileInput = z.infer<typeof courierProfileSchema>;
