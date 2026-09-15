import { z } from "zod";

export const modelGroupMemberSchema = z.object({
  productId: z.number().int("Producto inválido").positive("Producto inválido"),
  modelLabel: z
    .string()
    .trim()
    .min(1, "Cada modelo necesita una etiqueta")
    .max(40, "La etiqueta no puede superar 40 caracteres"),
  modelSortOrder: z
    .number("El orden debe ser un número")
    .int("El orden debe ser un número entero")
    .nonnegative("El orden no puede ser negativo"),
});

export const modelGroupInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "El nombre del grupo es obligatorio")
      .max(120, "El nombre no puede superar 120 caracteres"),
    optionLabel: z
      .string()
      .trim()
      .min(1, "El nombre del eje es obligatorio")
      .max(40, "El nombre del eje no puede superar 40 caracteres")
      .default("Modelo"),
    members: z.array(modelGroupMemberSchema).min(1, "Agrega al menos un modelo"),
    version: z.number().int("Versión inválida").nonnegative("Versión inválida").optional(),
  })
  .refine(
    (data) => new Set(data.members.map((m) => m.productId)).size === data.members.length,
    { message: "Un producto no puede repetirse dentro del grupo", path: ["members"] }
  )
  .refine(
    (data) =>
      new Set(data.members.map((m) => m.modelLabel.trim().toLowerCase())).size ===
      data.members.length,
    {
      message: "Las etiquetas de los modelos deben ser únicas (sin distinguir mayúsculas)",
      path: ["members"],
    }
  );

export type ModelGroupMemberInput = z.infer<typeof modelGroupMemberSchema>;
export type ModelGroupInput = z.input<typeof modelGroupInputSchema>;
export type ModelGroupData = z.output<typeof modelGroupInputSchema>;
