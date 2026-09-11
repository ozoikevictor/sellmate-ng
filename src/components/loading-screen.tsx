export function LoadingScreen({ label = "Loading...", exiting = false }: { label?: string; exiting?: boolean }) {
  return (
    <div
      className={`page-loader fixed inset-0 z-[9999] grid h-[100vh] w-[100vw] place-items-center bg-white px-6 ${exiting ? "page-loader-exiting" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="h-14 w-14 rounded-full border-4 border-slate-200 border-t-[#16A34A] page-loader-spinner" aria-hidden="true" />
        <p className="text-sm font-black text-slate-700">{label}</p>
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 items-start gap-x-3 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" aria-label="Loading products">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="min-w-0 rounded-lg p-1" aria-hidden="true">
          <div className="skeleton-shimmer aspect-square rounded-md bg-slate-200" />
          <div className="pt-2">
            <div className="skeleton-shimmer h-4 w-4/5 rounded bg-slate-200" />
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="skeleton-shimmer h-5 w-2/5 rounded bg-slate-200" />
              <div className="skeleton-shimmer h-8 w-8 rounded-full bg-slate-200" />
            </div>
            <div className="skeleton-shimmer mt-2 h-3 w-3/5 rounded bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  );
}
