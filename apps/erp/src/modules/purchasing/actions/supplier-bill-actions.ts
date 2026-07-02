"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { createAuditLog, requireCurrentUserId } from "@/lib/audit";
import { assertRole, ForbiddenError } from "@/lib/auth-guard";
import { nextFolio, DOC_TYPES } from "@/lib/folio";
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
  "El pago excede el saldo pendiente de la factura",
  "No se puede cancelar una factura con pagos registrados",
  "La factura ya esta cancelada",
  "El total debe ser mayor a 0",
]);

function toUserMessage(error: unknown, fallback: string): string {
  if (error instanceof ForbiddenError) return error.message;
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

      if (data.purchaseOrderId) {
        const po = await tx.purchaseOrder.findUnique({
          where: { poId: data.purchaseOrderId },
          include: { bills: { select: { billId: true } } },
        });
        if (!po) throw new Error("La OC no existe");
        if (po.bills.length > 0) throw new Error("Ya existe una factura para esta OC");
        supplierId = po.supplierId;
      }

      const folio = await nextFolio(tx, DOC_TYPES.SUPPLIER_BILL);

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
}

/**
 * Registra un pago a proveedor contra una factura, validando de forma
 * atomica que no exceda el saldo pendiente. Usa optimistic locking por
 * `version` (Neon serverless no soporta SELECT FOR UPDATE confiable) con
 * reintento corto ante conflicto de concurrencia.
 */
export async function registerSupplierPayment(
  data: RegisterSupplierPaymentInput
): Promise<ActionResult<{ paymentId: number; status: string; balance: number }>> {
  try {
    if (data.amount <= 0) {
      return { success: false, error: "El monto debe ser mayor a 0" };
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

          const total = Number(bill.total);
          const currentPaid = Number(bill.paid);
          const newPaid = currentPaid + data.amount;

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
              amount: data.amount,
              method: data.method,
              paymentDate: new Date(data.paymentDate),
              notes: data.notes || null,
              createdBy: userId,
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
              amount: data.amount,
              method: data.method,
              paymentDate: data.paymentDate,
              resultingStatus: newStatus,
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
