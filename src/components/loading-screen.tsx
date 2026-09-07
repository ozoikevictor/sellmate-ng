export function LoadingScreen({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      <style>{`
        @keyframes sellmate-loader-slide {
          0% {
            transform: translateX(-110%);
          }

          100% {
            transform: translateX(210%);
          }
        }
      `}</style>
      <div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-emerald-50/50">
        <div className="h-full w-1/2 animate-[sellmate-loader-slide_1.1s_ease-in-out_infinite] rounded-r-full bg-[#16A34A]" />
      </div>
      <div className="absolute left-1/2 top-5 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/70 bg-white/80 px-4 py-2 shadow-[0_18px_45px_rgba(15,23,42,0.14)] backdrop-blur-md ring-1 ring-slate-950/5">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-100 border-t-emerald-600" />
        <p className="text-xs font-black text-slate-800 sm:text-sm">{label}</p>
      </div>
    </div>
  );
}
