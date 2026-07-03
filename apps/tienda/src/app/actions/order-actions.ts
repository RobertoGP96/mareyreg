"use server";

import { z } from "zod";
import { createOrder } from "@/lib/erp-client";
import { fmt } from "@/lib/format";

const submitOrderSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(1),
    phone: z.string().trim().min(1),
    email: z.string().trim().email(),
    address: z.string().trim().optional(),
  }),
  lines: z
    .array(
      z.object({
        sku: z.string().min(1),
        quantity: z.number().int().positive(),
        unitPrice: z.number().nonnegative(),
      })
    )
    .min(1),
  delivery: z.enum(["domicilio", "recogida"]),
  payment: z.enum(["efectivo", "transferencia"]),
  couponApplied: z.boolean(),
  total: z.number().nonnegative(),
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
  | { success: false; error: string };

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

    const deliveryLabel =
      order.delivery === "domicilio" ? "domicilio" : "recogida en tienda";
    const notes = [
      `Entrega: ${deliveryLabel}`,
      `Pago: ${order.payment}`,
      ...(order.couponApplied ? ["Cupón: AZUL10 (−10%)"] : []),
      `Total tienda: ${fmt(order.total)}`,
    ].join(" · ");

    const result = await createOrder({
      externalOrderId: `tienda-${crypto.randomUUID()}`,
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
    console.error("submitOrder ERP respondió:", result);
    return { success: false, error: GENERIC_ERROR };
  } catch (e) {
    console.error("submitOrder:", e);
    return { success: false, error: GENERIC_ERROR };
  }
}
