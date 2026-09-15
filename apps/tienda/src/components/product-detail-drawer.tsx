"use client";

import { useState } from "react";
import type { WebstoreProduct } from "@/lib/erp-client";
import { useStore } from "@/lib/store";
import { ProductDetail } from "@/components/product-detail";
import { Drawer } from "@/components/ui/drawer";

interface ProductDetailDrawerProps {
  product: WebstoreProduct;
  /** Modelos del grupo (incluido `product`) para el selector dentro de la hoja. */
  models?: WebstoreProduct[];
  open: boolean;
  onClose: () => void;
}

export function ProductDetailDrawer({
  product,
  models,
  open,
  onClose,
}: ProductDetailDrawerProps) {
  const { state } = useStore();

  // El modelo que se ve en la hoja puede cambiar desde dentro; si la card
  // cambia de modelo (prop nueva) o la hoja se vuelve a abrir, se realinea
  // con lo que muestra la card (precio, foto y "Añadir" de la card siguen
  // siendo los del modelo de la card).
  const [current, setCurrent] = useState(product);
  const [seenProduct, setSeenProduct] = useState(product);
  const [seenOpen, setSeenOpen] = useState(open);
  if (seenProduct !== product || seenOpen !== open) {
    setSeenProduct(product);
    setSeenOpen(open);
    setCurrent(product);
  }

  const selectModel = (sku: string) => {
    const next = models?.find((m) => m.sku === sku);
    if (next) setCurrent(next);
  };

  return (
    <Drawer open={open} onClose={onClose} title="Detalles del producto">
      <ProductDetail
        product={current}
        models={models}
        onSelectModel={selectModel}
        currency={state.currency}
        variant="drawer"
        onAdded={onClose}
      />
    </Drawer>
  );
}
