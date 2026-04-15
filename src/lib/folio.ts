import type { Prisma } from "@/generated/prisma";

type PrismaTx = Prisma.TransactionClient;

export const DOC_TYPES = {
  PURCHASE_ORDER: "PO",
  GOODS_RECEIPT: "RCP",
  QUOTE: "QUOTE",
  SALES_ORDER: "SO",
  INVOICE: "INV",
  RETURN: "RET",
  STOCK_COUNT: "COUNT",
} as const;

export type DocType = (typeof DOC_TYPES)[keyof typeof DOC_TYPES];

const DEFAULT_PREFIX: Record<string, string> = {
  PO: "PO-",
  RCP: "RCP-",
  QUOTE: "COT-",
  SO: "OV-",
  INV: "FAC-",
  RET: "DEV-",
  COUNT: "CNT-",
};

/**
 * Generate next folio for a document type within a transaction.
 * Uses upsert + atomic increment to avoid race conditions.
 */
export async function nextFolio(tx: PrismaTx, docType: string): Promise<string> {
  const prefix = DEFAULT_PREFIX[docType] ?? `${docType}-`;

  const seq = await tx.documentSequence.upsert({
    where: { docType },
    create: {
      docType,
      prefix,
      lastNumber: 1,
      padLength: 6,
    },
    update: {
      lastNumber: { increment: 1 },
    },
  });

  return `${seq.prefix}${String(seq.lastNumber).padStart(seq.padLength, "0")}`;
}
