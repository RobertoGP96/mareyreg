export const dynamic = "force-dynamic";

import { listOffers, getOfferKpis, listWebstoreProductsForPicker } from "@/modules/webstore/queries/offer-queries";
import { OfferListClient } from "@/modules/webstore/components/offer-list-client";

export default async function WebstoreOffersPage() {
  const [offers, kpis, products] = await Promise.all([
    listOffers(),
    getOfferKpis(),
    listWebstoreProductsForPicker(),
  ]);

  return (
    <div className="space-y-4">
      <OfferListClient offers={offers} kpis={kpis} products={products} />
    </div>
  );
}
