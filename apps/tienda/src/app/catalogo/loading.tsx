import { ProductGrid, ProductGridCell } from "@/components/product-grid";

function CardSkeleton() {
  return (
    <div className="flex h-full flex-col gap-3.5 rounded-lg bg-canvas p-3 pb-4 shadow-card sm:p-4 sm:pb-5">
      <div className="aspect-square w-full rounded-md bg-surface" />
      <div className="flex flex-col gap-2">
        <div className="h-2.5 w-16 rounded-full bg-surface" />
        <div className="h-3.5 w-3/4 rounded-full bg-surface" />
        <div className="h-3 w-1/2 rounded-full bg-surface" />
      </div>
      <div className="mt-auto flex items-end justify-between border-t border-line pt-3">
        <div className="h-4 w-20 rounded-full bg-surface" />
        <div className="h-9 w-9 rounded-full bg-surface sm:w-16" />
      </div>
    </div>
  );
}

export default function CatalogLoading() {
  return (
    <div className="flex flex-1 flex-col motion-safe:animate-pulse">
      <section className="border-b border-line bg-canvas px-5 pt-12 pb-10 md:pt-14 md:pb-12">
        <div className="mx-auto h-2.5 w-28 rounded-full bg-surface" />
        <div className="mx-auto mt-6 h-9 w-52 rounded-full bg-surface md:h-[52px] md:w-72" />
        <div className="mx-auto mt-5 h-3.5 w-full max-w-[470px] rounded-full bg-surface" />
        <div className="mx-auto mt-2.5 h-3.5 w-full max-w-[380px] rounded-full bg-surface" />
      </section>

      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-5 py-6 md:px-6 md:py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          <div className="-mx-5 flex gap-2 overflow-hidden px-5 md:mx-0 md:px-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-9 w-20 flex-none rounded-full bg-surface" />
            ))}
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <div className="h-9 w-24 rounded-full bg-surface" />
            <div className="h-9 w-36 rounded-full bg-surface" />
          </div>
        </div>

        <ProductGrid>
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductGridCell key={i}>
              <CardSkeleton />
            </ProductGridCell>
          ))}
        </ProductGrid>
      </div>
    </div>
  );
}
