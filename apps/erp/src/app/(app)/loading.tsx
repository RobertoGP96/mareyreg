export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 sm:p-6 md:p-7 shadow-elevated">
        <div className="pointer-events-none absolute inset-0 mesh-bg opacity-50" />
        <div className="relative flex items-start gap-4">
          <div className="size-12 sm:size-14 shrink-0 rounded-xl bg-muted/60 animate-pulse" />
          <div className="flex-1 space-y-2.5">
            <div className="h-3 w-24 rounded-full bg-muted/60 animate-pulse" />
            <div className="h-7 sm:h-8 md:h-10 w-3/4 max-w-md rounded-md bg-muted/70 animate-pulse" />
            <div className="h-3 w-2/3 max-w-sm rounded-full bg-muted/50 animate-pulse" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-3 md:gap-4">
        <div className="md:col-span-3 lg:col-span-6 md:row-span-2 rounded-xl border border-border bg-card p-5 md:p-6 shadow-sm min-h-[200px]">
          <div className="size-12 rounded-xl bg-muted/60 animate-pulse" />
          <div className="mt-4 h-3 w-20 rounded-full bg-muted/50 animate-pulse" />
          <div className="mt-2 h-10 md:h-14 w-2/3 rounded-md bg-muted/70 animate-pulse" />
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="md:col-span-3 lg:col-span-3 rounded-xl border border-border bg-card p-[18px] shadow-sm min-h-[110px]"
          >
            <div className="size-9 rounded-md bg-muted/60 animate-pulse" />
            <div className="mt-3 h-3 w-16 rounded-full bg-muted/50 animate-pulse" />
            <div className="mt-1.5 h-7 w-24 rounded-md bg-muted/70 animate-pulse" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-card px-3 py-2.5 min-h-[60px]"
          >
            <div className="h-2.5 w-12 rounded-full bg-muted/50 animate-pulse" />
            <div className="mt-1.5 h-5 w-16 rounded-md bg-muted/70 animate-pulse" />
          </div>
        ))}
      </div>

      <span className="sr-only">Cargando…</span>
    </div>
  );
}
