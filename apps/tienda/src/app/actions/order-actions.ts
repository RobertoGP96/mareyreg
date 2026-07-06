"use server";

import { z } from "zod";
import { createOrder } from "@/lib/erp-client";
import { DEFAULT_CURRENCY, fmt } from "@/lib/format";

const submitOrderSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(1),
    phone: z.string().trim().min(1),
    email: z.string().trim().email(),
    address: z.string().trim().optional(),
  }),
  lines: z
    .array(
      z
        .object({
          sku: z.string().min(1),
          quantity: z.number().int().positive(),
          unitPrice: z.number().nonnegative(),
          // Pesajes elegidos por el cliente (catch-weight). Revalidados aquí
          // porque vienen de localStorage.
          pieceIds: z.array(z.number().int().positive()).min(1).optional(),
        })
        .refine((l) => !l.pieceIds || l.pieceIds.length === l.quantity, {
          message: "pieceIds debe tener exactamente quantity elementos",
          path: ["pieceIds"],
        })
    )
    .min(1),
  delivery: z.enum(["domicilio", "recogida"]),
  payment: z.enum(["efectivo", "transferencia"]),
  couponApplied: z.boolean(),
  total: z.number().nonnegative(),
  /** Moneda del catálogo guardada en el store (ver useSyncCurrency). ISO 4217, 3 letras. */
  currency: z.string().length(3),
});

export type SubmitOrderInput = z.infer<typeof submitOrderSchema>;

export type SubmitOrderResult =
  | {
      success: true;
      data: {
        orderNo: string;
        status: "processed" | "needs_review" | "awaiting_weighing";
      };
    }
  | {
      success: false;
      error: string;
      /** Piezas que ya no están disponibles: el checkout las quita del carrito y pide re-elegir. */
      unavailablePieceIds?: number[];
    };

const GENERIC_ERROR = "No pudimos procesar tu pedido. Intenta de nuevo.";

export async function submitOrder(
  input: SubmitOrderInput
): Promise<SubmitOrderResult> {
  try {
    const parsed = submitOrderSchema.safeParse(input);
    if (!parsed.success) {
      console.error("submitOrder validación:", parsed.error.flatten());
      return { success: false, error: "Revisa los datos del pedido." };
    }
    const order = parsed.data;
    // fmt de la nota interna solo necesita code (viene del store; symbol/
    // decimalPlaces no afectan el mensaje si el ERP ya redondeó el total).
    const noteCurrency = { ...DEFAULT_CURRENCY, code: order.currency };

    const deliveryLabel =
      order.delivery === "domicilio" ? "domicilio" : "recogida en tienda";
    const notes = [
      `Entrega: ${deliveryLabel}`,
      `Pago: ${order.payment}`,
      ...(order.couponApplied ? ["Cupón: AZUL10 (−10%)"] : []),
      `Total tienda: ${fmt(order.total, noteCurrency)}`,
    ].join(" · ");

    const result = await createOrder({
      externalOrderId: `tienda-${crypto.randomUUID()}`,
      currency: order.currency,
      customer: {
        email: order.customer.email,
        name: order.customer.name,
        phone: order.customer.phone,
        ...(order.customer.address ? { address: order.customer.address } : {}),
      },
      lines: order.lines,
      notes,
    });

    if (result.status === "processed") {
      return {
        success: true,
        data: {
          orderNo: `A-${result.salesOrderId ?? result.logId}`,
          status: "processed",
        },
      };
    }
    if (result.status === "awaiting_weighing") {
      return {
        success: true,
        data: {
          orderNo: `A-${result.salesOrderId ?? result.logId}`,
          status: "awaiting_weighing",
        },
      };
    }
    if (result.status === "needs_review") {
      return {
        success: true,
        data: { orderNo: `R-${result.logId}`, status: "needs_review" },
      };
    }
    if (result.status === "pieces_unavailable") {
      return {
        success: false,
        error:
          "Algunas piezas que elegiste ya se vendieron. Revisa tu carrito y vuelve a elegir.",
        unavailablePieceIds: result.unavailable.flatMap((u) => u.pieceIds),
      };
    }
    console.error("submitOrder ERP respondió:", result);
    return { success: false, error: GENERIC_ERROR };
  } catch (e) {
    console.error("submitOrder:", e);
    return { success: false, error: GENERIC_ERROR };
  }
}
