import { z } from "zod";

export const webstoreOrderLineSchema = z.object({
  sku: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(), // informativo; Mareyway calcula el precio real
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

export const webstoreOrderPayloadSchema = z.object({
  externalOrderId: z.string().min(1),
  currency: z.string().length(3).default("USD"),
  customer: webstoreCustomerSchema,
  lines: z.array(webstoreOrderLineSchema).min(1),
  payment: webstorePaymentSchema.optional(),
  warehouseId: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

export type WebstoreOrderPayload = z.infer<typeof webstoreOrderPayloadSchema>;
