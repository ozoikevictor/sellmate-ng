export function LoadingScreen({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-white/90 px-5">
      <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-5 py-3 shadow-lg">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />
        <p className="text-sm font-bold text-slate-700">{label}</p>
      </div>
    </div>
  );
}
