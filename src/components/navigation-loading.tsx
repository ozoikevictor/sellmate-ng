"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import GlobalPageLoader from "@/components/global-page-loader";

export function NavigationLoading({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(false);
  }, [pathname]);

  useEffect(() => {
    if (!loading) {
      return;
    }

    const timer = window.setTimeout(() => setLoading(false), 10000);
    return () => window.clearTimeout(timer);
  }, [loading]);

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
      if (nextUrl.origin !== window.location.origin || nextUrl.href === window.location.href) {
        return;
      }

      setLoading(true);
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return (
    <>
      {children}
      {loading ? <GlobalPageLoader overlay /> : null}
    </>
  );
}
