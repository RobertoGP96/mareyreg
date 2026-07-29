export default function HomeLoading() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="grad-header rounded-b-[26px] px-5 pt-[22px] pb-[58px] md:mt-6 md:rounded-[26px] md:px-10 md:pt-9 md:pb-[74px]">
        <div className="h-[14px] w-24 rounded bg-white/15" />
        <div className="mt-2 h-6 w-40 rounded-md bg-white/25" />
        <div className="mt-[18px] h-[60px] w-3/4 rounded-md bg-white/10 md:mt-6" />
        <div className="mt-[18px] h-[46px] rounded-[14px] border border-white/15 bg-white/10 md:mt-6 md:max-w-xl" />
      </div>
      <div className="-mt-[30px] grid grid-cols-4 gap-2.5 px-5 md:-mt-[38px] md:gap-4 md:px-10">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[86px] rounded-[14px] bg-white shadow-[0_4px_14px_rgba(10,31,63,.08)] motion-safe:animate-pulse md:h-[72px]"
          />
        ))}
      </div>
      <div className="px-5 pt-[22px] pb-2 md:px-10 md:pt-8">
        <div className="h-5 w-32 rounded bg-white motion-safe:animate-pulse" />
      </div>
      <div className="flex gap-3.5 overflow-hidden px-5 pt-1.5 pb-5 md:gap-5 md:px-10">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="w-[164px] flex-none overflow-hidden rounded-2xl bg-white shadow-[0_3px_12px_rgba(10,31,63,.07)] motion-safe:animate-pulse md:w-[210px]"
          >
            <div className="h-[118px] bg-photo md:h-[150px]" />
            <div className="space-y-2 px-3 pt-[11px] pb-[13px]">
              <div className="h-3.5 w-3/4 rounded bg-photo" />
              <div className="h-4 w-1/2 rounded bg-photo" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
