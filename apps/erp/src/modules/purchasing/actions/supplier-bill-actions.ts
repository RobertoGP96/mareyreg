"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";
import { assertRole, ForbiddenError } from "@/lib/auth-guard";
import { nextFolio, DOC_TYPES } from "@/lib/folio";
import { getBaseCurrency, getRateToBase, GlobalRateNotConfiguredError } from "@/lib/currency";
import type { Prisma } from "@/generated/prisma";

const AUTH_ERROR_MESSAGE = "Debes iniciar sesion para realizar esta accion";

function isAuthError(error: unknown): boolean {
  return error instanceof Error && error.message === "No autenticado";
}

const BUSINESS_ERRORS = new Set([
  "La OC no existe",
  "La OC no tiene proveedor valido",
  "Ya existe una factura para esta OC",
  "Factura no encontrada",
  "El monto debe ser mayor a 0",
  "El monto entregado debe ser mayor a 0",
  "El pago excede el saldo pendiente de la factura",
  "No se puede cancelar una factura con pagos registrados",
  "La factura ya esta cancelada",
  "El total debe ser mayor a 0",
]);

function toUserMessage(error: unknown, fallback: string): string {
  if (error instanceof ForbiddenError) return error.message;
  if (error instanceof GlobalRateNotConfiguredError) return error.message;
  if (error instanceof Error && BUSINESS_ERRORS.has(error.message)) return error.message;
  return fallback;
}

function revalidateAll() {
  revalidatePath("/accounts-payable");
  revalidatePath("/purchase-orders");
}

export interface CreateSupplierBillInput {
  supplierId: number;
  purchaseOrderId?: number;
  issueDate: string; // ISO
  dueDate?: string; // ISO
  total: number;
  notes?: string;
  currencyId?: number; // omitido o = moneda base -> factura en CUP, sin snapshot
}

/**
 * Crea una factura de proveedor manual, o a partir de una OC recibida
 * (si se pasa purchaseOrderId, se valida que la OC exista, pertenezca al
 * supplier informado y no tenga ya una factura asociada).
 */
export async function createSupplierBill(
  data: CreateSupplierBillInput
): Promise<ActionResult<{ billId: number; folio: string }>> {
  try {
    if (data.total <= 0) {
      return { success: false, error: "El total debe ser mayor a 0" };
    }

    const userId = await requireCurrentUserId();

    const bill = await db.$transaction(async (tx) => {
      let supplierId = data.supplierId;
      let currencyId = data.currencyId;

      if (data.purchaseOrderId) {
        const po = await tx.purchaseOrder.findUnique({
          where: { poId: data.purchaseOrderId },
          include: { bills: { select: { billId: true } } },
        });
        if (!po) throw new Error("La OC no existe");
        if (po.bills.length > 0) throw new Error("Ya existe una factura para esta OC");
        supplierId = po.supplierId;
        // Si no se especifica moneda explicitamente, la factura hereda la de la OC.
        if (currencyId == null) currencyId = po.currencyId ?? undefined;
      }

      const folio = await nextFolio(tx, DOC_TYPES.SUPPLIER_BILL);

      // Snapshot de tasa al crear la factura. null moneda = base (CUP), sin snapshot.
      const base = await getBaseCurrency(tx);
      const isBaseCurrency = !currencyId || currencyId === base.currencyId;
      let exchangeRate: number | null = null;
      let totalBase: number | null = null;
      if (!isBaseCurrency) {
        const snapshot = await getRateToBase(tx, currencyId!);
        exchangeRate = snapshot.rate;
        totalBase = data.total * snapshot.rate;
      }

      const created = await tx.supplierBill.create({
        data: {
          folio,
          supplierId,
          purchaseOrderId: data.purchaseOrderId ?? null,
          issueDate: new Date(data.issueDate),
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          total: data.total,
          paid: 0,
          status: "open",
          currencyId: isBaseCurrency ? null : currencyId,
          exchangeRate,
          totalBase,
          notes: data.notes || null,
          createdBy: userId,
        },
      });

      await createAuditLog(tx, {
        action: "create",
        entityType: "SupplierBill",
        entityId: created.billId,
        module: "purchasing",
        userId,
        newValues: { folio, ...data, supplierId },
      });

      return created;
    });

    revalidateAll();
    return { success: true, data: { billId: bill.billId, folio: bill.folio } };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    console.error("createSupplierBill:", error);
    return { success: false, error: toUserMessage(error, "Error al crear la factura") };
  }
}

function computeStatus(total: number, paid: number): "open" | "partial" | "paid" {
  if (paid <= 0) return "open";
  if (paid >= total) return "paid";
  return "partial";
}

class ConcurrencyConflict extends Error {
  constructor() {
    super("Conflicto de concurrencia, reintentar");
    this.name = "ConcurrencyConflict";
  }
}

export interface RegisterSupplierPaymentInput {
  billId: number;
  amount: number;
  method: string;
  paymentDate: string; // ISO
  notes?: string;
  currencyId?: number; // moneda ENTREGADA por el pagador; omitida = moneda de la factura
  amountTendered?: number; // monto en currencyId; requerido si currencyId difiere de la factura
}

/**
 * Registra un pago a proveedor contra una factura, validando de forma
 * atomica que no exceda el saldo pendiente. Usa optimistic locking por
 * `version` (Neon serverless no soporta SELECT FOR UPDATE confiable) con
 * reintento corto ante conflicto de concurrencia.
 *
 * Si la moneda entregada difiere de la moneda de la factura, la conversion
 * pasa SIEMPRE por la moneda base (nunca tasa cruzada directa): se convierte
 * el monto entregado a base con su propia tasa, y ese equivalente se vuelve a
 * convertir a la moneda de la factura con la tasa de esta ultima. `amount`
 * (el campo que alimenta `paid`) siempre queda en la moneda de la factura.
 */
export async function registerSupplierPayment(
  data: RegisterSupplierPaymentInput
): Promise<ActionResult<{ paymentId: number; status: string; balance: number }>> {
  try {
    if (data.amount <= 0) {
      return { success: false, error: "El monto debe ser mayor a 0" };
    }
    // amount se recalcula server-side a partir de amountTendered cuando la
    // moneda entregada difiere de la moneda de la factura (ver mas abajo,
    // dentro de la tx) — validamos amountTendered tambien aqui, temprano,
    // para no llegar a abrir la tx con un monto entregado invalido.
    if (data.amountTendered != null && data.amountTendered <= 0) {
      return { success: false, error: "El monto entregado debe ser mayor a 0" };
    }
    if (!data.method.trim()) {
      return { success: false, error: "El metodo de pago es requerido" };
    }

    const userId = await requireCurrentUserId();

    const MAX_ATTEMPTS = 3;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const result = await db.$transaction(async (tx) => {
          const bill = await tx.supplierBill.findUnique({ where: { billId: data.billId } });
          if (!bill) throw new Error("Factura no encontrada");
          if (bill.status === "cancelled") throw new Error("La factura ya esta cancelada");

          const billCurrencyId = bill.currencyId;
          const base = await getBaseCurrency(tx);
          const billCurrencyIdOrBase = billCurrencyId ?? base.currencyId;
          const tenderedDiffersFromBill =
            data.currencyId != null && data.currencyId !== billCurrencyIdOrBase;

          let amount = data.amount;
          let paymentCurrencyId: number | null = null;
          let amountTendered: number | null = null;
          let paymentExchangeRate: number | null = null;

          if (tenderedDiffersFromBill) {
            if (data.amountTendered == null || data.amountTendered <= 0) {
              throw new Error("El monto entregado debe ser mayor a 0");
            }
            const tenderedSnapshot = await getRateToBase(tx, data.currencyId!);
            const billSnapshot = await getRateToBase(tx, billCurrencyIdOrBase);

            const amountBase = data.amountTendered * tenderedSnapshot.rate;
            amount = amountBase / billSnapshot.rate;
            paymentCurrencyId = data.currencyId!;
            amountTendered = data.amountTendered;
            paymentExchangeRate = tenderedSnapshot.rate;
          } else if (data.currencyId != null) {
            // Moneda entregada === moneda de la factura: amount = amountTendered,
            // exchangeRate se guarda solo como referencia (tasa a base).
            const snapshot = await getRateToBase(tx, data.currencyId);
            amount = data.amountTendered ?? data.amount;
            paymentCurrencyId = data.currencyId;
            amountTendered = data.amountTendered ?? data.amount;
            paymentExchangeRate = snapshot.rate;
          }

          const total = Number(bill.total);
          const currentPaid = Number(bill.paid);
          const newPaid = currentPaid + amount;

          if (newPaid > total) {
            throw new Error("El pago excede el saldo pendiente de la factura");
          }

          const newStatus = computeStatus(total, newPaid);

          const updated = await tx.supplierBill.updateMany({
            where: { billId: data.billId, version: bill.version },
            data: {
              paid: newPaid,
              status: newStatus,
              version: { increment: 1 },
            },
          });

          if (updated.count !== 1) {
            // Version cambio entre la lectura y el update: conflicto de concurrencia.
            throw new ConcurrencyConflict();
          }

          const payment = await tx.supplierPayment.create({
            data: {
              billId: data.billId,
              amount,
              method: data.method,
              paymentDate: new Date(data.paymentDate),
              notes: data.notes || null,
              createdBy: userId,
              currencyId: paymentCurrencyId,
              amountTendered,
              exchangeRate: paymentExchangeRate,
            },
          });

          await createAuditLog(tx, {
            action: "create",
            entityType: "SupplierPayment",
            entityId: payment.paymentId,
            module: "purchasing",
            userId,
            newValues: {
              billId: data.billId,
              amount,
              method: data.method,
              paymentDate: data.paymentDate,
              resultingStatus: newStatus,
              currencyId: paymentCurrencyId,
              amountTendered,
            },
          });

          return {
            paymentId: payment.paymentId,
            status: newStatus,
            balance: Math.max(total - newPaid, 0),
          };
        });

        revalidateAll();
        return { success: true, data: result };
      } catch (err) {
        if (err instanceof ConcurrencyConflict) {
          lastError = err;
          continue; // reintentar
        }
        throw err;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Conflicto de concurrencia, reintentar");
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    if (error instanceof ConcurrencyConflict) {
      console.error("registerSupplierPayment: concurrency conflict exhausted retries");
      return { success: false, error: "Conflicto al registrar el pago, intenta de nuevo" };
    }
    console.error("registerSupplierPayment:", error);
    return { success: false, error: toUserMessage(error, "Error al registrar el pago") };
  }
}

export async function cancelSupplierBill(billId: number): Promise<ActionResult<void>> {
  try {
    const userId = await requireCurrentUserId();
    await assertRole("admin");

    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const bill = await tx.supplierBill.findUnique({
        where: { billId },
        include: { payments: { select: { paymentId: true } } },
      });
      if (!bill) throw new Error("Factura no encontrada");
      if (bill.status === "cancelled") throw new Error("La factura ya esta cancelada");
      if (bill.payments.length > 0) {
        throw new Error("No se puede cancelar una factura con pagos registrados");
      }

      await tx.supplierBill.update({
        where: { billId },
        data: { status: "cancelled", version: { increment: 1 } },
      });

      await createAuditLog(tx, {
        action: "update",
        entityType: "SupplierBill",
        entityId: billId,
        module: "purchasing",
        userId,
        oldValues: { status: bill.status },
        newValues: { status: "cancelled" },
      });
    });

    revalidateAll();
    return { success: true, data: undefined };
  } catch (error) {
    if (isAuthError(error)) return { success: false, error: AUTH_ERROR_MESSAGE };
    console.error("cancelSupplierBill:", error);
    return { success: false, error: toUserMessage(error, "Error al cancelar la factura") };
  }
}
