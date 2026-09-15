"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { WebstoreCurrency, WebstoreProduct } from "@/lib/erp-client";
import { useSyncCurrency } from "@/lib/store";
import { ProductCarousel } from "@/components/product-carousel";
import { ProductDetail } from "@/components/product-detail";
import { Button } from "@/components/ui/button";

interface ProductDetailClientProps {
  product: WebstoreProduct;
  /** Modelos del grupo (incluido `product`), ya ordenados. */
  models: WebstoreProduct[];
  related: WebstoreProduct[];
  currency: WebstoreCurrency;
}

export function ProductDetailClient({
  product,
  models,
  related,
  currency,
}: ProductDetailClientProps) {
  useSyncCurrency(currency);
  const router = useRouter();
  const [current, setCurrent] = useState(product);

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push("/catalogo");
  };

  // Cambiar de modelo no necesita refetch: todos los modelos ya llegaron con
  // la página. Solo se actualiza la URL para que compartir/recargar respete
  // el modelo elegido.
  const selectModel = (sku: string) => {
    const next = models.find((m) => m.sku === sku);
    if (!next) return;
    setCurrent(next);
    window.history.replaceState(null, "", `/producto/${encodeURIComponent(sku)}`);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-[1120px] px-5 pt-5 md:px-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={goBack}
          className="-ml-1 gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          Volver
        </Button>
      </div>

      <ProductDetail
        product={current}
        models={models}
        onSelectModel={selectModel}
        currency={currency}
        variant="page"
      />

      {related.length > 0 && (
        <div className="mx-auto w-full max-w-[1120px] px-5 pb-12 md:px-6">
          <ProductCarousel
            eyebrow="Sugerencias"
            title="También te puede interesar"
            products={related}
            className="border-t border-line pt-10"
          />
        </div>
      )}
    </div>
  );
}
