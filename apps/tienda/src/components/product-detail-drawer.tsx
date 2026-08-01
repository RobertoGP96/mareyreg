"use client";

import type { WebstoreProduct } from "@/lib/erp-client";
import { useStore } from "@/lib/store";
import { ProductDetail } from "@/components/product-detail";
import { Drawer } from "@/components/ui/drawer";

interface ProductDetailDrawerProps {
  product: WebstoreProduct;
  open: boolean;
  onClose: () => void;
}

export function ProductDetailDrawer({
  product,
  open,
  onClose,
}: ProductDetailDrawerProps) {
  const { state } = useStore();

  return (
    <Drawer open={open} onClose={onClose} title="Detalles del producto">
      <ProductDetail
        product={product}
        currency={state.currency}
        variant="drawer"
        onAdded={onClose}
      />
    </Drawer>
  );
}
