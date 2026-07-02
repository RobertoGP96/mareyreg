import { z } from "zod";

export const CONTRACT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export const CONTRACT_ACCEPTED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
] as const;

export type ContractMime = (typeof CONTRACT_ACCEPTED_MIME)[number];

export const CONTRACT_ACCEPT_ATTR = ".pdf,.doc,.docx";

export const contractStatusSchema = z.enum(["active", "expired", "cancelled"]);
export type ContractStatus = z.infer<typeof contractStatusSchema>;

export const contractMetaSchema = z.object({
  driverId: z.coerce.number().int().positive("Selecciona un conductor"),
  contractNo: z
    .string()
    .trim()
    .min(2, "Folio mínimo 2 caracteres")
    .max(80, "Folio máximo 80 caracteres"),
  startDate: z.string().min(1, "Fecha de inicio requerida"),
  endDate: z.string().nullish().or(z.string().length(0).nullish()),
  status: contractStatusSchema.default("active"),
  notes: z.string().trim().max(2000).nullish(),
});
export type ContractMetaInput = z.infer<typeof contractMetaSchema>;

export const contractUpdateSchema = contractMetaSchema.partial({
  driverId: true,
  contractNo: true,
  startDate: true,
});
export type ContractUpdateInput = z.infer<typeof contractUpdateSchema>;

export function isContractMime(mime: string): mime is ContractMime {
  return (CONTRACT_ACCEPTED_MIME as readonly string[]).includes(mime);
}

export function isPdfMime(mime: string): boolean {
  return mime === "application/pdf";
}

export function isWordMime(mime: string): boolean {
  return (
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/msword"
  );
}
