import { z } from "zod";

export const webstoreOrderLineSchema = z
  .object({
    sku: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative(), // informativo; Mareyway calcula el precio real
    // Piezas registradas (ProductPiece) elegidas por el cliente para líneas
    // catch-weight: el ERP deriva el peso real de estos registros y factura
    // de inmediato (sin awaiting_weighing). length debe ser quantity.
    pieceIds: z.array(z.number().int().positive()).min(1).optional(),
  })
  .refine((l) => !l.pieceIds || l.pieceIds.length === l.quantity, {
    message: "pieceIds debe tener exactamente quantity elementos",
    path: ["pieceIds"],
  });

export const webstoreCustomerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  phone: z.string().optional(),
  taxId: z.string().optional(),
  address: z.string().optional(),
});

export const webstorePaymentSchema = z.object({
  amount: z.number().positive(),
  method: z.string().min(1),
  reference: z.string().optional(),
});

export const webstoreOrderPayloadSchema = z
  .object({
    externalOrderId: z.string().min(1),
    currency: z.string().length(3),
    customer: webstoreCustomerSchema,
    lines: z.array(webstoreOrderLineSchema).min(1),
    payment: webstorePaymentSchema.optional(),
    warehouseId: z.number().int().positive().optional(),
    notes: z.string().optional(),
  })
  .superRefine((payload, ctx) => {
    // Dos líneas no pueden reclamar la misma pieza física.
    const allPieceIds = payload.lines.flatMap((l) => l.pieceIds ?? []);
    if (new Set(allPieceIds).size !== allPieceIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Hay pieceIds duplicados entre las líneas",
        path: ["lines"],
      });
    }
  });

export type WebstoreOrderPayload = z.infer<typeof webstoreOrderPayloadSchema>;

export const webstoreCustomerUpsertSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
  phone: z.string().trim().min(5, "El teléfono debe tener al menos 5 caracteres"),
  email: z.string().trim().email("Email inválido").optional(),
  address: z.string().trim().optional(),
});

export type WebstoreCustomerUpsertInput = z.infer<typeof webstoreCustomerUpsertSchema>;
