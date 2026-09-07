"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { LoadingScreen } from "@/components/loading-screen";

export function NavigationLoading({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [exiting, setExiting] = useState(false);
  const loadingTimer = useRef<number | null>(null);
  const exitTimer = useRef<number | null>(null);

  function clearLoadingTimer() {
    if (loadingTimer.current !== null) {
      window.clearTimeout(loadingTimer.current);
      loadingTimer.current = null;
    }
  }

  function clearExitTimer() {
    if (exitTimer.current !== null) {
      window.clearTimeout(exitTimer.current);
      exitTimer.current = null;
    }
  }

  useEffect(() => {
    clearLoadingTimer();
    clearExitTimer();
    if (!loading) return;

    setExiting(true);
    exitTimer.current = window.setTimeout(() => {
      setLoading(false);
      setExiting(false);
      exitTimer.current = null;
    }, 220);

    return () => {
      clearExitTimer();
    };
  }, [pathname, loading]);

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
      clearExitTimer();
      setExiting(false);
      loadingTimer.current = window.setTimeout(() => {
        setLoading(true);
        loadingTimer.current = null;
      }, 140);
    }

    document.addEventListener("click", handleClick, true);
    return () => {
      clearLoadingTimer();
      clearExitTimer();
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  return (
    <>
      {children}
      {loading ? <LoadingScreen exiting={exiting} /> : null}
    </>
  );
}
