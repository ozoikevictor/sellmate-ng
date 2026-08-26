"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { LoadingScreen } from "@/components/loading-screen";

export function NavigationLoading({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const loadingTimer = useRef<number | null>(null);

  function clearLoadingTimer() {
    if (loadingTimer.current !== null) {
      window.clearTimeout(loadingTimer.current);
      loadingTimer.current = null;
    }
  }

  useEffect(() => {
    clearLoadingTimer();
    loadingTimer.current = window.setTimeout(() => {
      setLoading(false);
    }, 0);

    return clearLoadingTimer;
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

      clearLoadingTimer();
      loadingTimer.current = window.setTimeout(() => {
        setLoading(true);
      }, 140);
    }

    document.addEventListener("click", handleClick, true);
    return () => {
      clearLoadingTimer();
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  return (
    <>
      {children}
      {loading ? <LoadingScreen /> : null}
    </>
  );
}
