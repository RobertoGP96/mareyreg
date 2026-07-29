export default function CatalogLoading() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="grad-header rounded-b-[22px] px-5 py-[18px] md:mt-6 md:rounded-[22px] md:px-7 md:py-6">
        <div className="mb-3 h-[22px] w-24 rounded-md bg-white/20" />
        <div className="h-[42px] rounded-[13px] border border-white/15 bg-white/10 md:max-w-xl" />
      </div>
      <div className="flex gap-2 overflow-hidden px-5 pt-3.5 pb-2 md:px-0 md:pt-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-[35px] w-20 flex-none rounded-full bg-white motion-safe:animate-pulse"
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3.5 px-5 pt-4 pb-6 md:grid-cols-3 md:gap-5 md:px-0 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-2xl bg-white shadow-[0_3px_12px_rgba(10,31,63,.06)] motion-safe:animate-pulse"
          >
            <div className="h-[110px] bg-photo md:h-[170px]" />
            <div className="space-y-2 px-3 pt-2.5 pb-3">
              <div className="h-3.5 w-3/4 rounded bg-photo" />
              <div className="h-3 w-1/3 rounded bg-photo" />
              <div className="h-4 w-1/2 rounded bg-photo" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
