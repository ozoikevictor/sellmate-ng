type GlobalPageLoaderProps = {
  overlay?: boolean;
  label?: string;
};

export default function GlobalPageLoader({ overlay = false, label = "Loading..." }: GlobalPageLoaderProps) {
  const wrapperClass = overlay
    ? "fixed inset-0 z-[9999] grid h-[100dvh] w-screen place-items-center overflow-hidden bg-white px-5"
    : "min-h-screen overflow-hidden bg-[#f3f4f6] px-5";

  return (
    <div className={wrapperClass} aria-live="polite" aria-busy="true">
      {!overlay ? (
      <div className="absolute inset-0 opacity-80">
        <div className="mx-auto max-w-7xl px-4 py-5">
          <div className="mb-8 flex items-center justify-between gap-5">
            <div className="h-12 w-44 animate-pulse rounded-2xl bg-slate-200" />
            <div className="hidden h-11 flex-1 animate-pulse rounded-full bg-slate-200 md:block" />
            <div className="h-11 w-28 animate-pulse rounded-full bg-slate-200" />
          </div>
          <div className="grid gap-5 lg:grid-cols-[1fr_0.78fr]">
            <div>
              <div className="mb-5 h-8 w-52 animate-pulse rounded-full bg-slate-200" />
              <div className="mb-3 h-16 max-w-3xl animate-pulse rounded-2xl bg-slate-200" />
              <div className="mb-6 h-16 max-w-2xl animate-pulse rounded-2xl bg-slate-200" />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="h-32 animate-pulse rounded-2xl bg-white shadow-sm" />
                <div className="h-32 animate-pulse rounded-2xl bg-white shadow-sm" />
                <div className="hidden h-32 animate-pulse rounded-2xl bg-white shadow-sm sm:block" />
              </div>
            </div>
            <div className="h-72 animate-pulse rounded-3xl bg-white shadow-sm" />
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="h-56 animate-pulse rounded-2xl bg-white shadow-sm" />
            <div className="h-56 animate-pulse rounded-2xl bg-white shadow-sm" />
            <div className="hidden h-56 animate-pulse rounded-2xl bg-white shadow-sm md:block" />
            <div className="hidden h-56 animate-pulse rounded-2xl bg-white shadow-sm md:block" />
          </div>
        </div>
      </div>
      ) : null}

      <div className="relative z-10 grid min-h-screen place-items-center">
        <div className="flex flex-col items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-2xl border border-emerald-100 bg-emerald-50 shadow-sm">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-emerald-100 border-t-[#16A34A]" />
          </div>
          <p className="text-sm font-black text-slate-700">{label}</p>
        </div>
      </div>
    </div>
  );
}
