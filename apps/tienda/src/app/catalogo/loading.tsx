import { ProductGrid, ProductGridCell } from "@/components/product-grid";

/** Sin pulso ni brillo: el sistema no anima la espera, solo reserva la retícula. */
export default function CatalogLoading() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-line px-5 pt-[58px] pb-[46px] md:px-10">
        <div className="mx-auto h-2.5 w-28 bg-surface" />
        <div className="mx-auto mt-5 h-[52px] w-56 bg-surface md:h-[66px] md:w-72" />
        <div className="mx-auto mt-6 h-3 w-full max-w-[470px] bg-surface" />
        <div className="mx-auto mt-9 h-[42px] w-full max-w-[300px] border border-line bg-surface" />
      </div>

      <div className="border-b border-line px-5 md:px-10">
        <div className="flex gap-6 overflow-hidden py-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-2.5 w-16 flex-none bg-surface" />
          ))}
        </div>
      </div>

      <ProductGrid className="px-5 pb-16 md:px-10">
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductGridCell key={i}>
            <div className="flex h-full flex-col gap-[18px] border border-line-soft bg-canvas px-6 pt-[26px] pb-7 shadow-card">
              <div className="aspect-square w-full bg-surface" />
              <div className="flex flex-col gap-[7px]">
                <div className="h-2 w-16 bg-surface" />
                <div className="h-4 w-3/4 bg-surface" />
                <div className="h-3 w-20 bg-surface" />
              </div>
              <div className="mt-auto flex items-end justify-between border-t border-line-soft pt-[14px]">
                <div className="h-4 w-24 bg-surface" />
                <div className="h-3 w-14 bg-surface" />
              </div>
            </div>
          </ProductGridCell>
        ))}
      </ProductGrid>
    </div>
  );
}
