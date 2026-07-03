export const dynamic = "force-dynamic";

import { getPurchaseOrders } from "@/modules/purchasing/queries/purchase-queries";
import { getActiveSuppliersForPicker } from "@/modules/suppliers/queries/supplier-queries";
import { getActiveCurrencies } from "@/modules/envios/queries/currency-queries";
import { getBaseCurrency } from "@/lib/currency";
import { PurchaseOrderListClient } from "@/modules/purchasing/components/purchase-order-list-client";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";

export default async function PurchaseOrdersPage() {
  const [orders, suppliers, warehouses, products, currencies, baseCurrency] = await Promise.all([
    getPurchaseOrders(),
    getActiveSuppliersForPicker(),
    db.warehouse.findMany({
      where: { isActive: true },
      select: { warehouseId: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.product.findMany({
      where: { isActive: true, isService: false },
      select: {
        productId: true,
        name: true,
        unit: true,
        costPrice: true,
        isCatchWeight: true,
        presentations: {
          where: { isActive: true },
          select: { presentationId: true, name: true, factor: true, isBase: true, piecesPerUnit: true },
          orderBy: [{ isBase: "desc" }, { sortOrder: "asc" }],
        },
      },
      orderBy: { name: "asc" },
    }),
    getActiveCurrencies(),
    getBaseCurrency(db),
  ]);

  // Tasa vigente de cada moneda activa hacia la base, para mostrar el
  // equivalente en vivo en el formulario sin exponer lógica de conversión al cliente.
  const rates = await db.exchangeRate.findMany({
    where: {
      OR: [{ quoteCurrencyId: baseCurrency.currencyId }, { baseCurrencyId: baseCurrency.currencyId }],
    },
  });
  const rateByCurrencyId = new Map<number, number>();
  for (const r of rates) {
    if (r.quoteCurrencyId === baseCurrency.currencyId) {
      rateByCurrencyId.set(r.baseCurrencyId, r.rate.toNumber());
    } else if (r.baseCurrencyId === baseCurrency.currencyId) {
      rateByCurrencyId.set(r.quoteCurrencyId, 1 / r.rate.toNumber());
    }
  }
  const currenciesForClient = currencies.map((c) => ({
    currencyId: c.currencyId,
    code: c.code,
    symbol: c.symbol,
    rateToBase: c.currencyId === baseCurrency.currencyId ? 1 : rateByCurrencyId.get(c.currencyId) ?? null,
  }));

  const productsForClient = products.map((p) => ({
    ...p,
    costPrice: p.costPrice != null ? Number(p.costPrice) : null,
    presentations: p.presentations.map((pr) => ({
      presentationId: pr.presentationId,
      name: pr.name,
      factor: Number(pr.factor),
      isBase: pr.isBase,
      piecesPerUnit: pr.piecesPerUnit,
    })),
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ordenes de Compra"
        description="Gestiona tus pedidos a proveedores y recepciones de mercancia"
      />
      <PurchaseOrderListClient
        orders={orders as Parameters<typeof PurchaseOrderListClient>[0]["orders"]}
        suppliers={suppliers}
        warehouses={warehouses}
        products={productsForClient}
        currencies={currenciesForClient}
        baseCurrencyId={baseCurrency.currencyId}
        baseCurrencyCode={baseCurrency.code}
      />
    </div>
  );
}
