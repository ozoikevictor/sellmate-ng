"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

function isCustomerShoppingPath(pathname: string) {
  return pathname === "/cart" || pathname === "/checkout" || pathname.startsWith("/store/");
}

export function NavigationLoading({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(false);
  }, [pathname]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const link = target.closest("a");
      if (!link) {
        return;
      }

      const href = link.getAttribute("href");
      const targetWindow = link.getAttribute("target");
      if (!href || href.startsWith("#") || targetWindow === "_blank") {
        return;
      }

      const nextUrl = new URL(href, window.location.href);
      if (nextUrl.origin !== window.location.origin || nextUrl.pathname === window.location.pathname) {
        return;
      }

      if (isCustomerShoppingPath(nextUrl.pathname)) {
        setLoading(true);
      }
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return (
    <>
      {children}
      {loading ? (
        <div className="fixed inset-0 z-[9999] grid place-items-center bg-slate-950/65 px-5 backdrop-blur-md">
          <div className="w-full max-w-sm overflow-hidden rounded-lg border border-white/20 bg-white shadow-2xl">
            <div className="bg-[linear-gradient(135deg,#0f172a,#064e3b_55%,#f97316)] p-5 text-white">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/15 ring-1 ring-white/25">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/30 border-t-orange-300" />
              </div>
              <p className="mt-4 text-center text-lg font-black">Opening your shopping page</p>
              <p className="mt-2 text-center text-xs font-semibold leading-5 text-slate-100">We are connecting the correct store, cart, and checkout details.</p>
            </div>
            <div className="p-4">
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-orange-500" />
              </div>
              <p className="mt-3 text-center text-xs font-black uppercase tracking-[0.18em] text-emerald-700">SellMate secure flow</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
