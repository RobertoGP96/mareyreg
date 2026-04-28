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
  exchangeRateRuleId: z.coerce.number().int().positive().nullish(),
  openingBalance: z.coerce.number().nullish(),
  active: z.boolean().optional(),
});
export type AccountInput = z.infer<typeof accountSchema>;

export const rateRangeSchema = z
  .object({
    minAmount: z.coerce.number().min(0, "Mínimo no puede ser negativo"),
    maxAmount: z.coerce.number().nullish(),
    rate: z.coerce.number().positive("Tasa debe ser mayor a 0"),
  })
  .refine(
    (r) => r.maxAmount == null || r.maxAmount > r.minAmount,
    { message: "Máximo debe ser mayor que mínimo", path: ["maxAmount"] }
  );

export const exchangeRateRuleSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(80),
  baseCurrencyId: z.coerce.number().int().positive("Selecciona moneda base"),
  quoteCurrencyId: z.coerce.number().int().positive("Selecciona moneda destino"),
  ranges: z.array(rateRangeSchema).min(1, "Al menos un rango"),
  active: z.boolean().optional(),
}).refine((r) => r.baseCurrencyId !== r.quoteCurrencyId, {
  message: "Base y destino deben ser distintas",
  path: ["quoteCurrencyId"],
}).superRefine((r, ctx) => {
  const sorted = [...r.ranges].sort((a, b) => a.minAmount - b.minAmount);
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const next = sorted[i + 1];
    if (cur.maxAmount == null && next) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Solo el último rango puede tener máximo abierto (∞)",
        path: ["ranges"],
      });
      return;
    }
    if (next && cur.maxAmount != null && next.minAmount < cur.maxAmount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Rango ${i + 1} solapa con rango ${i + 2}`,
        path: ["ranges"],
      });
      return;
    }
  }
});
export type ExchangeRateRuleInput = z.infer<typeof exchangeRateRuleSchema>;

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
