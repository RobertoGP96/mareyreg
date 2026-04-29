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

export const depositWithConversionSchema = z.object({
  accountId: z.coerce.number().int().positive("Selecciona una cuenta"),
  externalAmount: z.coerce.number().positive("Monto debe ser positivo"),
  externalCurrencyId: z.coerce.number().int().positive("Selecciona la moneda de origen"),
  description: z.string().trim().max(500).nullish(),
  reference: z.string().trim().max(80).nullish(),
  occurredAt: z.string().datetime().nullish().or(z.string().length(0).nullish()),
  status: z.enum(["pending", "confirmed"]).default("confirmed"),
  rateOverride: z.coerce.number().positive().nullish(),
});
export type DepositWithConversionInput = z.infer<typeof depositWithConversionSchema>;

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
