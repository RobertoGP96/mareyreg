"use client";

import { Heart } from "lucide-react";
import type { WebstoreCurrency, WebstoreProduct } from "@/lib/erp-client";
import { useStore, useSyncCurrency } from "@/lib/store";
import { EmptyState } from "@/components/empty-state";
import { ProductCard } from "@/components/product-card";
import { ProductGrid, ProductGridCell } from "@/components/product-grid";
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
      <ScreenHeader eyebrow="Tu selección" title="Favoritos">
        <span className="tabular text-[13px] text-slate-400">
          {favorites.length}{" "}
          {favorites.length === 1 ? "producto" : "productos"}
        </span>
      </ScreenHeader>

      {favorites.length === 0 ? (
        <EmptyState
          icon={Heart}
          eyebrow="Lista vacía"
          title="Sin favoritos todavía"
          description="Toca el corazón de un producto para guardarlo aquí."
          ctaLabel="Explorar catálogo"
          ctaHref="/catalogo"
        />
      ) : (
        <ProductGrid className="px-5 pb-16 md:px-10">
          {favorites.map((product, index) => (
            <ProductGridCell key={product.sku}>
              <ProductCard
                product={product}
                variant="favorite"
                priority={index < 4}
              />
            </ProductGridCell>
          ))}
        </ProductGrid>
      )}
    </div>
  );
}
