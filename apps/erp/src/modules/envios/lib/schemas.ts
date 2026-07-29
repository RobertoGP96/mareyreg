// Zod schemas compartidos por server actions y formularios.
import { z } from "zod";

export const currencySchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Código mínimo 2 caracteres")
    .max(8, "Código máximo 8 caracteres")
    .regex(/^[A-Z0-9]+$/, "Solo mayúsculas y números"),
  name: z.string().trim().min(1, "Nombre requerido").max(60),
  symbol: z.string().trim().min(1, "Símbolo requerido").max(8),
  kind: z.enum(["cash", "digital"]).default("cash"),
  decimalPlaces: z.coerce.number().int().min(0).max(8),
  active: z.boolean().optional(),
});
export type CurrencyInput = z.infer<typeof currencySchema>;

export const transferSchema = z.object({
  fromAccountId: z.coerce.number().int().positive("Selecciona cuenta origen"),
  toAccountId: z.coerce.number().int().positive("Selecciona cuenta destino"),
  amount: z.coerce.number().positive("Monto debe ser positivo"),
  description: z.string().trim().max(500).nullish(),
  occurredAt: z.string().datetime().nullish().or(z.string().length(0).nullish()),
  status: z.enum(["pending", "confirmed"]).default("confirmed"),
  rateOverride: z.coerce.number().positive().nullish(),
}).refine((d) => d.fromAccountId !== d.toAccountId, {
  message: "Origen y destino deben ser cuentas distintas",
  path: ["toAccountId"],
});
export type TransferInput = z.infer<typeof transferSchema>;

export const operationSchema = z.object({
  accountId: z.coerce.number().int().positive("Selecciona una cuenta"),
  type: z.enum(["deposit", "withdrawal", "adjustment"]),
  amount: z.coerce.number().refine((v) => Number.isFinite(v) && v !== 0, "Monto inválido"),
  description: z.string().trim().max(500).nullish(),
  reference: z.string().trim().max(80).nullish(),
  occurredAt: z.string().datetime().nullish().or(z.string().length(0).nullish()),
  status: z.enum(["pending", "confirmed"]).default("confirmed"),
});
export type OperationInput = z.infer<typeof operationSchema>;

export const conversionDirectionSchema = z.enum(["credit", "debit"]);
export type ConversionDirection = z.infer<typeof conversionDirectionSchema>;

export const conversionOperationSchema = z.object({
  direction: conversionDirectionSchema.default("credit"),
  accountId: z.coerce.number().int().positive("Selecciona una cuenta"),
  externalAmount: z.coerce.number().positive("Monto debe ser positivo"),
  externalCurrencyId: z.coerce.number().int().positive("Selecciona la moneda de origen"),
  description: z.string().trim().max(500).nullish(),
  reference: z.string().trim().max(80).nullish(),
  occurredAt: z.string().datetime().nullish().or(z.string().length(0).nullish()),
  status: z.enum(["pending", "confirmed"]).default("confirmed"),
  rateOverride: z.coerce.number().positive().nullish(),
});
export type ConversionOperationInput = z.infer<typeof conversionOperationSchema>;

export const depositWithConversionSchema = conversionOperationSchema;
export type DepositWithConversionInput = ConversionOperationInput;

export const batchRegularRowSchema = z.object({
  kind: z.literal("regular"),
  accountId: z.coerce.number().int().positive("Selecciona una cuenta"),
  type: z.enum(["deposit", "withdrawal", "adjustment"]),
  amount: z.coerce.number().refine((v) => Number.isFinite(v) && v !== 0, "Monto inválido"),
  description: z.string().trim().max(500).nullish(),
  reference: z.string().trim().max(80).nullish(),
  occurredAt: z.string().datetime().nullish().or(z.string().length(0).nullish()),
  status: z.enum(["pending", "confirmed"]).default("confirmed"),
});

export const batchConversionRowSchema = z.object({
  kind: z.literal("conversion"),
  direction: conversionDirectionSchema.default("credit"),
  accountId: z.coerce.number().int().positive("Selecciona una cuenta"),
  externalAmount: z.coerce.number().positive("Monto debe ser positivo"),
  externalCurrencyId: z.coerce.number().int().positive("Selecciona la moneda de origen"),
  description: z.string().trim().max(500).nullish(),
  reference: z.string().trim().max(80).nullish(),
  occurredAt: z.string().datetime().nullish().or(z.string().length(0).nullish()),
  status: z.enum(["pending", "confirmed"]).default("confirmed"),
  rateOverride: z.coerce.number().positive().nullish(),
});

export const batchRowSchema = z.discriminatedUnion("kind", [
  batchRegularRowSchema,
  batchConversionRowSchema,
]);
export type BatchRowInput = z.infer<typeof batchRowSchema>;

export const batchOperationsSchema = z
  .array(batchRowSchema)
  .min(1, "Agrega al menos una fila")
  .max(50, "Máximo 50 filas por lote");
export type BatchOperationsInput = z.infer<typeof batchOperationsSchema>;

export const accountSchema = z.object({
  groupId: z.coerce.number().int().positive("Selecciona un grupo"),
  currencyId: z.coerce.number().int().positive("Selecciona una moneda"),
  accountNumber: z
    .string()
    .trim()
    .min(2, "Número mínimo 2 caracteres")
    .max(40)
    .regex(/^[A-Z0-9_-]+$/, "Solo mayúsculas, números, _ y -"),
  name: z.string().trim().min(1, "Nombre requerido").max(120),
  openingBalance: z.coerce.number().nullish(),
  active: z.boolean().optional(),
  allowNegativeBalance: z.boolean().optional(),
});
export type AccountInput = z.infer<typeof accountSchema>;

export const exchangeRateRuleSchema = z
  .object({
    name: z.string().trim().min(1, "Nombre requerido").max(80),
    baseCurrencyId: z.coerce.number().int().positive("Selecciona moneda base"),
    quoteCurrencyId: z.coerce.number().int().positive("Selecciona moneda destino"),
    minAmount: z.coerce.number().min(0, "Mínimo no puede ser negativo"),
    maxAmount: z.coerce.number().nullish(),
    minInclusive: z.boolean().optional(),
    maxInclusive: z.boolean().optional(),
    rate: z.coerce.number().positive("Tasa debe ser mayor a 0"),
    active: z.boolean().optional(),
  })
  .refine((r) => r.baseCurrencyId !== r.quoteCurrencyId, {
    message: "Base y destino deben ser distintas",
    path: ["quoteCurrencyId"],
  })
  .refine((r) => r.maxAmount == null || r.maxAmount > r.minAmount, {
    message: "Máximo debe ser mayor que mínimo",
    path: ["maxAmount"],
  });
export type ExchangeRateRuleInput = z.infer<typeof exchangeRateRuleSchema>;

export const assignAccountRulesSchema = z.object({
  accountId: z.coerce.number().int().positive(),
  ruleIds: z.array(z.coerce.number().int().positive()).default([]),
});
export type AssignAccountRulesInput = z.infer<typeof assignAccountRulesSchema>;

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

export const DELIVERY_PHOTO_ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export const DELIVERY_PHOTO_ACCEPT_ATTR = DELIVERY_PHOTO_ACCEPTED_MIME.join(",");
export const DELIVERY_PHOTO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

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
    courierId: z.coerce.number().int().positive().nullish(),
    commissionAmount: z.coerce.number().min(0, "La comisión no puede ser negativa").default(0),
    commissionCurrencyId: z.coerce.number().int().positive().nullish(),
    photoUrl: z
      .string()
      .trim()
      .max(500)
      .url("URL inválida")
      .nullish()
      .or(z.literal("").transform(() => null)),
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

export const currencyDenominationSchema = z.object({
  currencyId: z.coerce.number().int().positive("Selecciona una moneda"),
  value: z.coerce.number().positive("El valor debe ser mayor a 0"),
  label: z.string().trim().max(40).nullish(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  active: z.boolean().optional(),
});
export type CurrencyDenominationInput = z.infer<typeof currencyDenominationSchema>;

export const accountGroupSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Código mínimo 2 caracteres")
    .max(40)
    .regex(/^[A-Z0-9_]+$/, "Solo mayúsculas, números y guion bajo"),
  name: z.string().trim().min(1, "Nombre requerido").max(120),
  description: z.string().trim().max(500).nullish(),
  userId: z.coerce.number().int().positive("Selecciona un responsable"),
  active: z.boolean().optional(),
});
export type AccountGroupInput = z.infer<typeof accountGroupSchema>;
