function CarouselSkeleton() {
  return (
    <section className="border-b border-line py-12 md:py-16">
      <div className="px-5 md:px-10">
        <div className="h-2.5 w-20 bg-surface" />
        <div className="mt-4 h-[26px] w-44 bg-surface md:h-[32px]" />
      </div>
      <div className="mt-8 flex overflow-hidden px-5 md:px-10">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="w-[230px] flex-none border-r border-line-soft px-5 pt-5 pb-6"
          >
            <div className="aspect-square w-full bg-surface" />
            <div className="mt-[18px] h-2.5 w-16 bg-surface" />
            <div className="mt-3 h-3.5 w-3/4 bg-surface" />
            <div className="mt-3 h-3 w-1/2 bg-surface" />
            <div className="mt-[18px] border-t border-line-soft pt-[14px]">
              <div className="h-4 w-24 bg-surface" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function HomeLoading() {
  return (
    <div className="flex flex-1 flex-col">
      <section className="border-b border-line px-5 pt-[58px] pb-[52px] md:px-10 md:pt-[86px] md:pb-[76px]">
        <div className="mx-auto h-2.5 w-40 bg-surface" />
        <div className="mx-auto mt-6 h-[42px] w-full max-w-[640px] bg-surface md:h-[66px]" />
        <div className="mx-auto mt-4 h-[42px] w-full max-w-[420px] bg-surface md:h-[66px]" />
        <div className="mx-auto mt-6 h-3.5 w-full max-w-[470px] bg-surface" />
        <div className="mx-auto mt-2.5 h-3.5 w-full max-w-[380px] bg-surface" />
        <div className="mx-auto mt-9 h-3 w-32 bg-surface" />
      </section>

      <section className="border-b border-line px-5 py-12 md:px-10 md:py-16">
        <div className="h-2.5 w-20 bg-surface" />
        <div className="mt-4 h-[26px] w-56 bg-surface md:h-[32px]" />
        <div className="mt-8 overflow-hidden">
          <div className="-mr-px -mb-px grid grid-cols-2 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex min-h-[92px] items-end border-r border-b border-line-soft px-5 py-5"
              >
                <div className="h-3 w-20 bg-surface" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <CarouselSkeleton />
      <CarouselSkeleton />
    </div>
  );
}
