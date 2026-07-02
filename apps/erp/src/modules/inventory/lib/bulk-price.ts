import { z } from "zod";

/**
 * Alcance del ajuste masivo: todo el catálogo activo, una categoría, o una
 * lista explícita de productos. `buildScopeCondition` traduce esto a SQL.
 */
const scopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all") }),
  z.object({ kind: z.literal("category"), category: z.string().min(1) }),
  z.object({
    kind: z.literal("products"),
    productIds: z.array(z.number().int().positive()).min(1),
  }),
]);

export const bulkPriceAdjustmentSchema = z
  .object({
    scope: scopeSchema,
    mode: z.enum(["percent", "fixed"]),
    direction: z.enum(["increase", "decrease"]),
    value: z.number().finite().gt(0),
    target: z.enum(["retail", "wholesale", "both"]),
    rounding: z.enum(["none", "cents", "fifty", "whole"]),
    reason: z.string().max(200).optional(),
  })
  .superRefine((input, ctx) => {
    if (input.mode === "percent" && input.direction === "decrease" && input.value > 100) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "No se puede disminuir un precio en más del 100%",
      });
    }
  });

export type BulkPriceAdjustmentInput = z.infer<typeof bulkPriceAdjustmentSchema>;
export type BulkPriceScope = z.infer<typeof scopeSchema>;

/**
 * Construye la expresión SQL del precio ajustado para una columna dada.
 *
 * Seguridad: el fragmento resultante SOLO se arma con (a) el nombre de
 * columna, que en este archivo siempre proviene de un literal TS
 * ("retail_price" | "wholesale_price"), nunca de input de usuario; (b)
 * tokens fijos derivados de los enums ya validados por Zod (`mode`,
 * `direction`, `rounding`); y (c) el valor numérico `value`, verificado
 * *aquí también* con `Number.isFinite` como defensa en profundidad (no basta
 * con confiar en que el caller ya validó con Zod). Nunca interpolar aquí
 * `category` ni `reason`: esos deben viajar como parámetros bind en las
 * queries que consuman este fragmento (ver `buildScopeCondition`).
 *
 * El caller controla el prefijo/alias de `column` (p. ej. puede pasar
 * "pp.retail_price" si lo necesita calificado); esta función no lo valida
 * más allá del literal type, así que solo debe invocarse con los dos
 * nombres de columna soportados.
 */
type PriceColumn = "retail_price" | "wholesale_price";

export function buildPriceExpression(
  column: PriceColumn | `${string}.${PriceColumn}`,
  input: Pick<BulkPriceAdjustmentInput, "mode" | "direction" | "value" | "rounding">
): string {
  if (!Number.isFinite(input.value)) {
    throw new Error("El valor del ajuste de precio debe ser un número finito");
  }

  const value = String(input.value);
  let expr: string;
  if (input.mode === "percent" && input.direction === "increase") {
    expr = `${column} * (1 + ${value}/100)`;
  } else if (input.mode === "percent" && input.direction === "decrease") {
    expr = `${column} * (1 - ${value}/100)`;
  } else if (input.mode === "fixed" && input.direction === "increase") {
    expr = `${column} + ${value}`;
  } else {
    expr = `${column} - ${value}`;
  }

  let rounded: string;
  switch (input.rounding) {
    case "none":
      rounded = expr;
      break;
    case "cents":
      rounded = `ROUND((${expr})::numeric, 2)`;
      break;
    case "fifty":
      rounded = `ROUND((${expr})::numeric * 2) / 2.0`;
      break;
    case "whole":
      rounded = `ROUND((${expr})::numeric)`;
      break;
  }

  return `GREATEST(${rounded}, 0)`;
}

/**
 * Construye el WHERE (sin la palabra "WHERE") para acotar presentaciones
 * según el scope, pensado para componerse con `$queryRawUnsafe` /
 * `$executeRawUnsafe` usando placeholders `$1..$n`.
 *
 * Asume que el caller ya hizo el JOIN `product_presentations pp JOIN
 * products p ON p.product_id = pp.product_id`, con esos alias exactos
 * (`pp` y `p`). `category` y los `productIds` SIEMPRE viajan como parámetros
 * bind, nunca interpolados directamente en el SQL.
 */
export function buildScopeCondition(scope: BulkPriceScope): { sql: string; params: unknown[] } {
  if (scope.kind === "all") {
    return { sql: "TRUE", params: [] };
  }
  if (scope.kind === "category") {
    return { sql: "p.category = $1", params: [scope.category] };
  }
  const placeholders = scope.productIds.map((_, i) => `$${i + 1}`).join(", ");
  return { sql: `pp.product_id IN (${placeholders})`, params: [...scope.productIds] };
}
