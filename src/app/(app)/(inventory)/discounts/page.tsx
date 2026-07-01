export const dynamic = "force-dynamic";

import { getDiscounts } from "@/modules/inventory/queries/discount-queries";
import { getProducts } from "@/modules/inventory/queries/product-queries";
import { getActiveCustomersForPicker } from "@/modules/customers/queries/customer-queries";
import { DiscountListClient } from "@/modules/inventory/components/discount-list-client";

export default async function DiscountsPage() {
  const [discountsRaw, products, customersRaw] = await Promise.all([
    getDiscounts(),
    getProducts(),
    getActiveCustomersForPicker(),
  ]);

  const customers = customersRaw.map((c) => ({ customerId: c.customerId, name: c.name }));

  const discounts = discountsRaw.map((d) => ({
    discountId: d.discountId,
    name: d.name,
    type: d.type,
    value: Number(d.value),
    minQty: d.minQty != null ? Number(d.minQty) : null,
    startsAt: d.startsAt ? d.startsAt.toISOString() : null,
    endsAt: d.endsAt ? d.endsAt.toISOString() : null,
    productId: d.productId,
    productName: d.product ? `${d.product.name}${d.product.sku ? ` (${d.product.sku})` : ""}` : null,
    category: d.category,
    customerId: d.customerId,
    customerName: d.customer?.name ?? null,
    stackable: d.stackable,
    isActive: d.isActive,
  }));

  const productOptions = products.map((p) => ({
    productId: p.productId,
    name: p.name,
    category: p.category,
  }));

  return (
    <div className="space-y-4">
      <DiscountListClient
        discounts={discounts}
        products={productOptions}
        customers={customers}
      />
    </div>
  );
}
