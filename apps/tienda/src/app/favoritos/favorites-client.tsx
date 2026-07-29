"use client";

import { Heart } from "lucide-react";
import type { WebstoreCurrency, WebstoreProduct } from "@/lib/erp-client";
import { useStore, useSyncCurrency } from "@/lib/store";
import { EmptyState } from "@/components/empty-state";
import { ProductCard } from "@/components/product-card";
import { ScreenHeader } from "@/components/screen-header";

export function FavoritesClient({
  products,
  currency,
}: {
  products: WebstoreProduct[];
  currency: WebstoreCurrency;
}) {
  useSyncCurrency(currency);
  const { state } = useStore();
  const favorites = products.filter((p) => state.favs.includes(p.sku));

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Favoritos" />
      {favorites.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Sin favoritos todavía"
          description="Toca el corazón de un producto para guardarlo aquí."
          ctaLabel="Explorar catálogo"
          ctaHref="/catalogo"
        />
      ) : (
        <div className="grid grid-cols-2 gap-3.5 px-5 pt-[18px] pb-6 md:grid-cols-3 md:gap-5 md:px-6 lg:grid-cols-4">
          {favorites.map((product) => (
            <ProductCard
              key={product.sku}
              product={product}
              variant="favorite"
            />
          ))}
        </div>
      )}
    </div>
  );
}
