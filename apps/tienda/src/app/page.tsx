import { getProducts } from "@/lib/erp-client";

function formatPrice(value: number): string {
  return value.toLocaleString("es-MX", { style: "currency", currency: "USD" });
}

export default async function HomePage() {
  const products = await getProducts();

  if (products.length === 0) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4">
        <h1 className="text-2xl font-semibold tracking-tight">Tienda Mareyway</h1>
        <p className="max-w-sm text-center text-sm text-neutral-500">
          Aún no hay productos disponibles en el catálogo.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Tienda Mareyway</h1>
        <p className="text-sm text-neutral-500">Catálogo conectado al ERP vía la API de webstore.</p>
      </header>

      <ul className="flex flex-col gap-4">
        {products.map((product) => {
          const variants = product.presentations.filter((p) => !p.isBase);
          return (
            <li
              key={product.sku}
              className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{product.name}</p>
                  <p className="text-xs text-neutral-500">SKU: {product.sku}</p>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  {product.compareAtPrice != null && (
                    <span className="text-xs text-neutral-400 line-through">
                      {formatPrice(product.compareAtPrice)}
                    </span>
                  )}
                  <span className="font-semibold">{formatPrice(product.price)}</span>
                </div>
              </div>

              {variants.length > 0 && (
                <ul className="flex flex-col gap-1 border-t border-neutral-100 pt-2">
                  {variants.map((variant) => (
                    <li
                      key={variant.sku}
                      className="flex items-center justify-between gap-3 text-sm text-neutral-600"
                    >
                      <span className="truncate">{variant.name}</span>
                      <span className="font-mono tabular-nums shrink-0">
                        {formatPrice(variant.retailPrice)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
