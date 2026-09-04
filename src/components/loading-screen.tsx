export function LoadingScreen({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-white/25 px-5 backdrop-blur-[2px]">
      <div className="flex items-center gap-3 rounded-full border border-white/70 bg-white/85 px-5 py-3 shadow-[0_18px_45px_rgba(15,23,42,0.18)] ring-1 ring-slate-950/5">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-100 border-t-emerald-600" />
        <p className="text-sm font-black text-slate-800">{label}</p>
      </div>
    </div>
  );
}
