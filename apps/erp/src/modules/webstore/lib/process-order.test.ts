import { describe, it, expect, vi, beforeEach } from "vitest";

const { tx, mocks } = vi.hoisted(() => {
  const tx = {
    company: { findUnique: vi.fn() },
    customer: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    product: { findMany: vi.fn(), findUnique: vi.fn() },
    productPresentation: { findMany: vi.fn() },
    salesOrder: { create: vi.fn() },
    salesOrderLine: { createMany: vi.fn() },
    invoice: { create: vi.fn(), update: vi.fn() },
    invoicePayment: { create: vi.fn() },
    webstoreOrderLog: { update: vi.fn() },
  };

  const mocks = {
    nextFolio: vi.fn(),
    createAuditLog: vi.fn().mockResolvedValue(undefined),
    getEffectiveLinePrices: vi.fn(),
    getDefaultWebstoreWarehouseId: vi.fn(),
    resolveSkusBatch: vi.fn(),
    dispatchLines: vi.fn(),
  };

  return { tx, mocks };
});

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: (fn: (tx: unknown) => unknown) => fn(tx),
  },
}));

vi.mock("@/lib/folio", () => ({
  nextFolio: mocks.nextFolio,
  DOC_TYPES: { SALES_ORDER: "SO", INVOICE: "INV" },
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: mocks.createAuditLog,
}));

vi.mock("@/modules/inventory/lib/effective-price", () => ({
  getEffectiveLinePrices: mocks.getEffectiveLinePrices,
  lineKey: (productId: number, presentationId?: number | null) =>
    `${productId}:${presentationId ?? "base"}`,
}));

vi.mock("@/modules/sales/lib/dispatch-lines", () => ({
  dispatchLines: mocks.dispatchLines,
}));

vi.mock("./dispatch-warehouse", () => ({
  getDefaultWebstoreWarehouseId: mocks.getDefaultWebstoreWarehouseId,
}));

vi.mock("./resolve-skus", () => ({
  isSkuResolved: (p: { isActive: boolean; webstoreEnabled: boolean }) =>
    p.isActive && p.webstoreEnabled,
  resolveSkusBatch: mocks.resolveSkusBatch,
}));

import { processWebstoreOrder, NeedsReviewError } from "./process-order";
import type { WebstoreOrderPayload } from "./schemas";

function basePayload(overrides: Partial<WebstoreOrderPayload> = {}): WebstoreOrderPayload {
  return {
    externalOrderId: "ext-1",
    currency: "USD",
    customer: {
      email: "cliente@test.com",
      name: "Cliente Test",
      phone: "5551234567",
    },
    lines: [{ sku: "SKU-1", quantity: 2, unitPrice: 10 }],
    ...overrides,
  } as WebstoreOrderPayload;
}

describe("processWebstoreOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.company.findUnique.mockResolvedValue({ id: 1, currency: "USD" });
    tx.customer.findFirst.mockResolvedValue(null);
    tx.customer.create.mockResolvedValue({ customerId: 99, email: "cliente@test.com" });
    tx.salesOrder.create.mockResolvedValue({ orderId: 500 });
    tx.salesOrderLine.createMany.mockResolvedValue({ count: 1 });
    tx.webstoreOrderLog.update.mockResolvedValue({});
    mocks.nextFolio.mockResolvedValue("OV-000001");
    mocks.getDefaultWebstoreWarehouseId.mockResolvedValue(1);
  });

  it("procesa un pedido normal (sin catch-weight): crea factura y descuenta stock", async () => {
    mocks.resolveSkusBatch.mockResolvedValue(
      new Map([["SKU-1", { productId: 1, sku: "SKU-1", isActive: true, webstoreEnabled: true }]])
    );
    tx.product.findMany.mockResolvedValue([{ productId: 1, isCatchWeight: false }]);
    tx.productPresentation.findMany.mockResolvedValue([]);
    mocks.getEffectiveLinePrices.mockResolvedValue(
      new Map([["1:base", { basePrice: 10, finalPrice: 10, appliedDiscounts: [], factor: 1 }]])
    );
    tx.invoice.create.mockResolvedValue({ invoiceId: 700 });
    mocks.dispatchLines.mockResolvedValue({ lineResults: [], priceOverrides: [] });

    const result = await processWebstoreOrder(1, basePayload());

    expect(result.status).toBe("processed");
    expect(result.invoiceId).toBe(700);
    expect(mocks.dispatchLines).toHaveBeenCalledTimes(1);
    expect(tx.webstoreOrderLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "processed", invoiceId: 700 }),
      })
    );
    expect(result.lines).toEqual([{ sku: "SKU-1", priceIsEstimated: false }]);
  });

  it("pedido con línea catch-weight: crea SalesOrder pero NO factura, y NO llama dispatchLines", async () => {
    mocks.resolveSkusBatch.mockResolvedValue(
      new Map([["SKU-QUESO-CAJA", { productId: 2, sku: "SKU-QUESO-CAJA", isActive: true, webstoreEnabled: true, presentationId: 10 }]])
    );
    tx.product.findMany.mockResolvedValue([{ productId: 2, isCatchWeight: true }]);
    tx.productPresentation.findMany.mockResolvedValue([{ presentationId: 10, piecesPerUnit: 5 }]);
    mocks.getEffectiveLinePrices.mockResolvedValue(
      new Map([
        [
          "2:10",
          {
            basePrice: 50,
            finalPrice: 50,
            appliedDiscounts: [],
            factor: 2.5, // peso nominal kg
            pricePerBase: 20, // precio por kg
          },
        ],
      ])
    );

    const payload = basePayload({
      lines: [{ sku: "SKU-QUESO-CAJA", quantity: 3, unitPrice: 50 }],
    });

    const result = await processWebstoreOrder(1, payload);

    expect(result.status).toBe("awaiting_weighing");
    expect(result.invoiceId).toBeNull();
    expect(result.salesOrderId).toBe(500);
    expect(mocks.dispatchLines).not.toHaveBeenCalled();
    expect(tx.invoice.create).not.toHaveBeenCalled();
    expect(tx.webstoreOrderLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "awaiting_weighing", salesOrderId: 500 }),
      })
    );
    expect(result.lines[0]).toMatchObject({
      sku: "SKU-QUESO-CAJA",
      priceIsEstimated: true,
    });
    expect(result.lines[0].estimatedWeightKg).toBeCloseTo(7.5); // 3 × 2.5 kg nominal

    // SalesOrderLine: unitPrice = pricePerBase (por kg), pieces = quantity × piecesPerUnit
    expect(tx.salesOrderLine.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            productId: 2,
            unitPrice: 20,
            pieces: 15,
            baseQuantity: 7.5,
          }),
        ],
      })
    );
  });

  it("catch-weight sin presentación piecesPerUnit configurada: manda a needs_review", async () => {
    mocks.resolveSkusBatch.mockResolvedValue(
      new Map([["SKU-QUESO-BASE", { productId: 3, sku: "SKU-QUESO-BASE", isActive: true, webstoreEnabled: true }]])
    );
    tx.product.findMany.mockResolvedValue([{ productId: 3, isCatchWeight: true }]);
    tx.productPresentation.findMany.mockResolvedValue([]);
    mocks.getEffectiveLinePrices.mockResolvedValue(
      new Map([["3:base", { basePrice: 20, finalPrice: 20, appliedDiscounts: [], factor: 1, pricePerBase: 20 }]])
    );

    const payload = basePayload({
      lines: [{ sku: "SKU-QUESO-BASE", quantity: 1, unitPrice: 20 }],
    });

    await expect(processWebstoreOrder(1, payload)).rejects.toThrow(NeedsReviewError);
  });
});
