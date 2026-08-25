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
        <div className="fixed inset-0 z-[9999] grid place-items-center bg-white/80 px-5 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-5 py-3 shadow-lg">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />
            <p className="text-sm font-bold text-slate-700">Loading...</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
