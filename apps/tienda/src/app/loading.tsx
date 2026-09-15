import { CAROUSEL_CARD_WIDTH } from "@/components/product-card";

function CardSkeleton() {
  return (
    <div
      className={`${CAROUSEL_CARD_WIDTH} flex-none rounded-lg bg-canvas p-3.5 pb-[18px] shadow-card`}
    >
      <div className="aspect-square w-full rounded-md bg-surface" />
      <div className="mt-3.5 h-2.5 w-16 rounded-full bg-surface" />
      <div className="mt-2.5 h-3.5 w-3/4 rounded-full bg-surface" />
      <div className="mt-2.5 h-3 w-1/2 rounded-full bg-surface" />
      <div className="mt-3.5 flex items-center justify-between border-t border-line pt-3">
        <div className="h-4 w-20 rounded-full bg-surface" />
        <div className="h-8 w-16 rounded-full bg-surface" />
      </div>
    </div>
  );
}

function CarouselSkeleton() {
  return (
    <section>
      <div className="h-2.5 w-20 rounded-full bg-surface" />
      <div className="mt-2.5 h-5 w-44 rounded-full bg-surface md:h-6" />
      <div className="-mx-5 mt-4 flex gap-3 overflow-hidden px-5 pt-2 pb-2 md:-mx-6 md:gap-4 md:px-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}

export default function HomeLoading() {
  return (
    <div className="flex flex-1 flex-col motion-safe:animate-pulse">
      <section className="border-b border-line bg-canvas px-5 pt-14 pb-12 md:px-10 md:pt-[72px] md:pb-16">
        <div className="mx-auto h-2.5 w-36 rounded-full bg-surface" />
        <div className="mx-auto mt-6 h-8 w-full max-w-[560px] rounded-full bg-surface md:h-12" />
        <div className="mx-auto mt-3 h-8 w-full max-w-[360px] rounded-full bg-surface md:h-12" />
        <div className="mx-auto mt-6 h-3.5 w-full max-w-[470px] rounded-full bg-surface" />
        <div className="mx-auto mt-2.5 h-3.5 w-full max-w-[380px] rounded-full bg-surface" />
        <div className="mx-auto mt-8 flex justify-center gap-3.5">
          <div className="h-11 w-40 rounded-full bg-surface" />
          <div className="h-11 w-40 rounded-full bg-surface" />
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-10 px-5 py-10 md:px-6 md:py-11">
        <section>
          <div className="h-2.5 w-20 rounded-full bg-surface" />
          <div className="mt-2.5 h-5 w-56 rounded-full bg-surface md:h-6" />
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex min-h-[88px] items-end rounded-lg bg-canvas p-4 shadow-card"
              >
                <div className="h-3 w-20 rounded-full bg-surface" />
              </div>
            ))}
          </div>
        </section>

        <CarouselSkeleton />
        <CarouselSkeleton />
      </div>
    </div>
  );
}
