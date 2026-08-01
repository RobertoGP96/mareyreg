"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { WebstoreCurrency, WebstoreProduct } from "@/lib/erp-client";
import { useSyncCurrency } from "@/lib/store";
import { ProductCarousel } from "@/components/product-carousel";
import { ProductDetail } from "@/components/product-detail";

interface ProductDetailClientProps {
  product: WebstoreProduct;
  related: WebstoreProduct[];
  currency: WebstoreCurrency;
}

export function ProductDetailClient({
  product,
  related,
  currency,
}: ProductDetailClientProps) {
  useSyncCurrency(currency);
  const router = useRouter();

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push("/catalogo");
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-line px-5 py-4 md:px-10">
        <button
          type="button"
          onClick={goBack}
          className="nav-label inline-flex items-center gap-2 text-slate-400 transition-colors duration-150 hover:text-navy-900"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.6} />
          Volver
        </button>
      </div>

      <ProductDetail product={product} currency={currency} variant="page" />

      {related.length > 0 && (
        <ProductCarousel
          eyebrow="Sugerencias"
          title="También te puede interesar"
          products={related}
          className="border-t border-line py-12 md:py-16"
        />
      )}
    </div>
  );
}
