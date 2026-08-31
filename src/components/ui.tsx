"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { LogoutButton, useAuth } from "@/components/auth";
import { formatNaira } from "@/lib/data";
import { supabase } from "@/lib/supabase";

export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    blue: "bg-sky-50 text-sky-800 ring-sky-200",
    red: "bg-rose-50 text-rose-700 ring-rose-200",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${tones[tone] ?? tones.slate}`}>{children}</span>;
}

export function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">{eyebrow}</p> : null}
        <h1 className="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, change, tone }: { label: string; value: string; change: string; tone: string }) {
  return (
    <div className="sellmate-card rounded-lg p-4">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-xl font-bold text-slate-950 sm:text-2xl">{value}</p>
        <Badge tone={tone}>{change}</Badge>
      </div>
    </div>
  );
}

export function VendoraqLogo({ compact = false, tone = "dark", iconOnly = false }: { compact?: boolean; tone?: "dark" | "light"; iconOnly?: boolean }) {
  const textColor = tone === "light" ? "text-white" : "text-[#0F172A]";
  const mutedColor = tone === "light" ? "text-slate-300" : "text-slate-500";

  return (
    <span className="flex items-center gap-2.5" aria-label="VENDORAQ">
      <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#0F172A] shadow-[0_10px_24px_rgba(22,163,74,0.24)] ring-1 ring-[#16A34A]/30 sm:h-12 sm:w-12">
        <span className="absolute -left-2 top-4 h-1 w-5 rounded-full bg-[#16A34A]" />
        <span className="absolute -left-3 top-6 h-1 w-7 rounded-full bg-[#16A34A]/70" />
        <span className="absolute -left-1 top-8 h-1 w-4 rounded-full bg-[#16A34A]/50" />
        <svg viewBox="0 0 48 48" className="h-8 w-8 text-white" aria-hidden="true">
          <path d="M15 18h24l-3 13H18l-3-13Z" fill="currentColor" opacity="0.95" />
          <path d="M18 18c0-6 4-10 10-10s10 4 10 10" fill="none" stroke="#16A34A" strokeWidth="4" strokeLinecap="round" />
          <path d="M13 18h5l3 17h15" fill="none" stroke="#16A34A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M24 16l7 8 9-14" fill="none" stroke="#22C55E" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="23" cy="39" r="3.2" fill="#16A34A" />
          <circle cx="36" cy="39" r="3.2" fill="#16A34A" />
        </svg>
      </span>
      {!iconOnly ? <span className="leading-none">
        <span className={`block font-black tracking-tight ${textColor} ${compact ? "text-xl" : "text-2xl sm:text-3xl"}`}>
          VENDOR<span className="text-[#16A34A]">AQ</span>
        </span>
        {!compact ? <span className={`mt-1 hidden text-[10px] font-black uppercase tracking-[0.32em] sm:block ${mutedColor}`}>Sell. Connect. Grow.</span> : null}
      </span> : null}
    </span>
  );
}
function makeStoreSlug(businessName: string, userId: string) {
  const baseSlug = businessName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${baseSlug || "store"}-${userId.slice(0, 6)}`;
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [storeSlug, setStoreSlug] = useState("store");
  const [storeReady, setStoreReady] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const canOpenStore = Boolean(user?.id && storeReady);
  const storeHref = `/store/${storeSlug}`;
  const links = [
    { key: "overview", label: "Overview", href: "/dashboard", icon: "dashboard" },
    { key: "products", label: "Products", href: "/dashboard/products", icon: "products" },
    { key: "orders", label: "Orders", href: "/dashboard/orders", icon: "orders" },
    { key: "messages", label: "Messages", href: "/dashboard/messages", icon: "messages" },
    { key: "customers", label: "Customers", href: "/dashboard/customers", icon: "customers" },
    { key: "analytics", label: "Analytics", href: "/dashboard/analytics", icon: "analytics" },
    { key: "billing", label: "Billing & Payments", href: "/dashboard/billing", icon: "billing" },
    { key: "store", label: "Store", href: storeHref, icon: "store" },
    { key: "delivery", label: "Delivery / Tracking", href: "/dashboard/settings", icon: "delivery" },
    { key: "settings", label: "Settings", href: "/dashboard/settings", icon: "settings" },
  ];
  const activeLink = links.find((link) => (link.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(link.href))) ?? links[0];
  const isDashboardChatOpen = pathname === "/dashboard/messages" && Boolean(searchParams.get("chat"));

  useEffect(() => {
    if (!user?.id) {
      return;
    }
    const timer = window.setTimeout(async () => {
      setStoreReady(false);
      const { data } = await supabase.from("seller_profiles").select("store_slug").eq("user_id", user.id).maybeSingle();
      if (data?.store_slug) {
        setStoreSlug(data.store_slug);
        setStoreReady(true);
        return;
      }

      const fallbackSlug = makeStoreSlug(user.business, user.id);
      setStoreSlug(fallbackSlug);
      await supabase.from("seller_profiles").upsert(
        {
          user_id: user.id,
          owner_name: user.name,
          business_name: user.business,
          whatsapp_phone: user.whatsapp,
          city: "",
          store_slug: fallbackSlug,
        },
        { onConflict: "user_id" },
      );
      setStoreReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user?.business, user?.id, user?.name, user?.whatsapp]);

  const sellerInitial = (user?.business || user?.name || "V").trim().charAt(0).toUpperCase();

  if (isDashboardChatOpen) {
    return <main className="min-h-screen overflow-hidden bg-slate-50">{children}</main>;
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#F8FAFC_0%,#EEF6F3_45%,#F8FAFC_100%)]">
      <aside className={`fixed inset-y-0 left-0 z-40 hidden overflow-hidden border-r border-slate-200/80 bg-[#07111F] text-white shadow-[18px_0_60px_rgba(15,23,42,0.12)] transition-[width] duration-300 lg:block ${sidebarCollapsed ? "w-20 p-3" : "w-72 p-5"}`}>
        <div className="flex h-full min-h-0 flex-col">
          <div className={`flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"}`}>
            <Link href="/dashboard" className={`min-w-0 rounded-2xl border border-slate-100 bg-white shadow-sm ${sidebarCollapsed ? "p-2" : "flex-1 p-3"}`} title="Dashboard home">
              <VendoraqLogo compact iconOnly={sidebarCollapsed} />
            </Link>
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              className={`h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/10 text-slate-100 shadow-sm transition hover:bg-white/15 ${sidebarCollapsed ? "hidden" : "grid"}`}
              aria-label="Collapse dashboard sidebar"
              title="Collapse sidebar"
            >
              <IconGlyph name="x" className="h-5 w-5" />
            </button>
          </div>
          <div className={`mt-5 rounded-2xl border border-white/10 bg-white/10 transition ${sidebarCollapsed ? "p-2" : "p-4"}`}>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#22C55E] text-lg font-black text-[#07111F] shadow-sm">{sellerInitial}</span>
              <div className={`min-w-0 ${sidebarCollapsed ? "hidden" : "block"}`}>
                <p className="truncate text-sm font-black text-white">{user?.business ?? "Seller workspace"}</p>
                <p className="text-xs font-bold text-slate-300">Vendor control center</p>
              </div>
            </div>
            <div className={`mt-4 items-center justify-between rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-slate-200 ring-1 ring-white/10 ${sidebarCollapsed ? "hidden" : "flex"}`}>
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#22C55E]" /> Store status</span>
              <span className="text-[#4ADE80]">Live</span>
            </div>
          </div>
          <nav className={`mt-6 min-h-0 flex-1 space-y-1.5 overflow-y-auto ${sidebarCollapsed ? "" : "pr-1"}`}>
            {links.map((link) => {
              const active = link.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.key}
                  href={link.href}
                  title={link.label}
                  className={`flex items-center rounded-2xl py-3 text-sm font-black transition ${sidebarCollapsed ? "justify-center px-2" : "gap-3 px-3.5"} ${
                    active ? "bg-white text-[#07111F] shadow-[0_12px_30px_rgba(0,0,0,0.22)]" : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span className={`grid h-9 w-9 place-items-center rounded-xl ${active ? "bg-[#DCFCE7] text-[#16A34A]" : "bg-white/10 text-slate-300"}`}>
                    <MenuIcon name={link.icon} />
                  </span>
                  <span className={sidebarCollapsed ? "sr-only" : ""}>{link.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className={`mt-4 rounded-2xl border border-white/10 bg-white/10 p-3 ${sidebarCollapsed ? "hidden" : "block"}`}>
            <p className="text-xs font-bold leading-5 text-slate-300">Share your store link with customers when your products are ready.</p>
            {canOpenStore ? (
              <Link href={storeHref} className="mt-3 flex min-h-10 items-center justify-center rounded-xl bg-[#22C55E] px-3 py-2 text-xs font-black text-[#07111F] transition hover:bg-[#4ADE80]">
                Open storefront
              </Link>
            ) : null}
          </div>
        </div>
      </aside>
      <section className={`min-w-0 transition-[padding] duration-300 ${sidebarCollapsed ? "lg:pl-20" : "lg:pl-72"}`}>
        <header className={`fixed left-0 right-0 top-0 z-50 border-b border-slate-200/80 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-xl transition-[left] duration-300 sm:px-6 ${sidebarCollapsed ? "lg:left-20" : "lg:left-72"}`}>
          <div className="flex min-w-0 items-center justify-between gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
              className="hidden h-11 w-11 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 lg:grid"
              aria-label={sidebarCollapsed ? "Expand dashboard sidebar" : "Collapse dashboard sidebar"}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <IconGlyph name="menu" className="h-5 w-5" />
            </button>
            {canOpenStore ? (
              <Link href={storeHref} className="min-w-0 lg:hidden"><VendoraqLogo compact /></Link>
            ) : (
              <span className="min-w-0 lg:hidden"><VendoraqLogo compact /></span>
            )}
            <div className="hidden min-w-0 flex-1 lg:block">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#16A34A]">Vendor dashboard</p>
              <p className="truncate text-lg font-black text-[#0F172A]">{activeLink.label}</p>
              <p className="truncate text-sm font-bold text-slate-500">{user?.business ?? "Seller workspace"} · Manage products, orders, payments and delivery</p>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <span className="hidden rounded-full border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-black text-[#166534] sm:inline-flex">
                Logged in
              </span>
              {canOpenStore ? (
                <Link href={storeHref} className="rounded-full bg-[#16A34A] px-4 py-2.5 text-xs font-black text-white shadow-[0_10px_24px_rgba(22,163,74,0.22)] transition hover:bg-[#15803D]">
                  View store
                </Link>
              ) : (
                <span className="rounded-full border border-slate-200 bg-slate-100 px-4 py-2.5 text-xs font-black text-slate-500 shadow-sm">
                  Loading store...
                </span>
              )}
              <LogoutButton />
            </div>
          </div>
          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {links.map((link) => {
              const active = link.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.key}
                  href={link.href}
                  className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-black ${
                    active
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  <MenuIcon name={link.icon} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </header>
        <div className={isDashboardChatOpen ? "mx-auto max-w-[1500px] px-0 pb-0 pt-36 sm:pt-32 lg:pt-24" : "mx-auto max-w-[1500px] px-4 pb-6 pt-40 sm:px-6 sm:pt-36 lg:pb-8 lg:pt-28"}>{children}</div>
      </section>
    </main>
  );
}

export function MenuIcon({ name }: { name: string }) {
  const common = "h-4 w-4 shrink-0";
  const icons: Record<string, ReactNode> = {
    dashboard: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common} aria-hidden="true">
        <path d="M4 13h6V4H4v9Z" />
        <path d="M14 20h6V4h-6v16Z" />
        <path d="M4 20h6v-3H4v3Z" />
      </svg>
    ),
    account: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common} aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c1.7-4 4.3-6 8-6s6.3 2 8 6" />
      </svg>
    ),
    products: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common} aria-hidden="true">
        <path d="M4 7l8-4 8 4-8 4-8-4Z" />
        <path d="M4 7v10l8 4 8-4V7" />
        <path d="M12 11v10" />
      </svg>
    ),
    orders: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common} aria-hidden="true">
        <path d="M7 4h10l2 16H5L7 4Z" />
        <path d="M9 8c0 2 1.3 3 3 3s3-1 3-3" />
      </svg>
    ),
    messages: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common} aria-hidden="true">
        <path d="M21 12a7 7 0 0 1-7 7H8l-5 3 1.6-4.8A7 7 0 1 1 21 12Z" />
        <path d="M8 11h8" />
        <path d="M8 14h5" />
      </svg>
    ),
    customers: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common} aria-hidden="true">
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="10" r="2.5" />
        <path d="M3 20c1.2-4 3.2-6 6-6s4.8 2 6 6" />
        <path d="M14 15c2.7.3 4.7 2 6 5" />
      </svg>
    ),
    inventory: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common} aria-hidden="true">
        <path d="M4 6h16v14H4V6Z" />
        <path d="M4 10h16" />
        <path d="M9 14h6" />
      </svg>
    ),
    analytics: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common} aria-hidden="true">
        <path d="M5 19V9" />
        <path d="M12 19V5" />
        <path d="M19 19v-7" />
      </svg>
    ),
    receipts: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common} aria-hidden="true">
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
        <path d="M9 8h6" />
        <path d="M9 13h6" />
      </svg>
    ),
    billing: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common} aria-hidden="true">
        <path d="M3 7h18v10H3V7Z" />
        <path d="M3 10h18" />
        <path d="M7 15h4" />
      </svg>
    ),
    store: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common} aria-hidden="true">
        <path d="M4 10h16" />
        <path d="M5 10l1.5-5h11L19 10" />
        <path d="M6 10v10h12V10" />
        <path d="M9 20v-5h6v5" />
      </svg>
    ),
    delivery: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common} aria-hidden="true">
        <path d="M3 7h11v9H3V7Z" />
        <path d="M14 10h4l3 3v3h-7" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
      </svg>
    ),
    settings: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common} aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3" />
        <path d="M12 19v3" />
        <path d="M2 12h3" />
        <path d="M19 12h3" />
        <path d="M4.9 4.9l2.1 2.1" />
        <path d="M17 17l2.1 2.1" />
        <path d="M19.1 4.9 17 7" />
        <path d="M7 17l-2.1 2.1" />
      </svg>
    ),
  };

  return icons[name] ?? null;
}


export function SellerLogo({
  name,
  logoUrl,
  size = "md",
}: {
  name: string;
  logoUrl?: string | null;
  size?: "sm" | "md";
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "S";
  const boxSize = size === "sm" ? "h-10 w-10 text-sm" : "h-12 w-12 text-base";

  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-md bg-white font-black text-emerald-700 shadow-sm ring-1 ring-slate-300 ${boxSize}`}>
      {logoUrl ? <Image src={logoUrl} alt={`${name} logo`} width={48} height={48} className="h-full w-full object-contain p-1" /> : initials}
    </span>
  );
}


export function IconGlyph({ name, className = "h-5 w-5" }: { name: "search" | "heart" | "cart" | "user" | "home" | "menu" | "lock" | "x" | "messages"; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const icons: Record<string, ReactNode> = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />,
    cart: <><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2.5 3h2.8l2.2 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H6.3" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.8-4.2 4.5-6.3 8-6.3s6.2 2.1 8 6.3" /></>,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>,
    menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
    messages: <><path d="M21 12a7 7 0 0 1-7 7H8l-5 3 1.6-4.8A7 7 0 1 1 21 12Z" /><path d="M8 11h8" /><path d="M8 14h5" /></>,
  };

  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
      {icons[name]}
    </svg>
  );
}

export function CartIconLink({ href, count, label = "View shopping cart" }: { href: string; count: number; label?: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#0F172A] transition hover:bg-[#F3F4F6] hover:text-[#16A34A] focus:outline-none focus:ring-4 focus:ring-[#16A34A]/20"
    >
      <IconGlyph name="cart" className="h-5 w-5" />
      <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#16A34A] px-1 text-[10px] font-black leading-none text-white ring-2 ring-white">
        {count > 99 ? "99+" : count}
      </span>
    </Link>
  );
}

export function HeaderIconButton({ href, icon, label }: { href: string; icon: "search" | "heart" | "user" | "home" | "menu"; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#0F172A] transition hover:bg-[#F3F4F6] hover:text-[#16A34A] focus:outline-none focus:ring-4 focus:ring-[#16A34A]/20"
    >
      <IconGlyph name={icon} className="h-5 w-5" />
    </Link>
  );
}
export function PlatformHeader({
  cartCount,
  storeHref = "/store/ada-fashion",
  isLoggedInSeller = false,
  onHelpClick,
}: {
  cartCount: number;
  storeHref?: string;
  isLoggedInSeller?: boolean;
  onHelpClick?: () => void;
}) {
  const navLinks = [
    { href: "/", label: "Home" },
    { href: storeHref, label: "Explore" },
    { href: "#how-it-works", label: "How It Works" },
    { href: "/register", label: "For Sellers" },
    { href: "#help", label: "Help" },
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#E5E7EB] bg-white/95 shadow-[0_8px_24px_rgba(15,23,42,0.06)] backdrop-blur">
      <nav className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:min-h-20 sm:px-5">
        <Link href="/" className="flex shrink-0 items-center" aria-label="VENDORAQ home">
          <VendoraqLogo compact />
        </Link>
        <div className="hidden items-center gap-1 rounded-full bg-[#F3F4F6] p-1 lg:flex">
          {navLinks.map((link) =>
            link.label === "Help" && onHelpClick ? (
              <button
                key={link.href + link.label}
                type="button"
                onClick={onHelpClick}
                className="rounded-full px-3 py-2 text-sm font-bold text-[#0F172A]/80 transition hover:bg-white hover:text-[#16A34A] hover:shadow-sm"
              >
                {link.label}
              </button>
            ) : (
              <Link key={link.href + link.label} href={link.href} className="rounded-full px-3 py-2 text-sm font-bold text-[#0F172A]/80 transition hover:bg-white hover:text-[#16A34A] hover:shadow-sm">
                {link.label}
              </Link>
            ),
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <CartIconLink href="/cart" count={cartCount} />
          {isLoggedInSeller ? (
            <Link href={storeHref} className="rounded-full bg-[#16A34A] px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-[#15803D] sm:text-sm">My store</Link>
          ) : (
            <>
              <Link href="/login" className="hidden rounded-full px-3 py-2 text-sm font-black text-[#0F172A]/80 transition hover:bg-[#F3F4F6] hover:text-[#16A34A] sm:inline-flex">Login</Link>
              <Link href="/register" className="rounded-full bg-[#16A34A] px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-[#15803D] sm:text-sm">Start Selling</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

export function StoreHeader({
  sellerName,
  sellerLogoUrl,
  storeHref,
  cartHref,
  cartCount,
  searchTerm,
  onSearchChange,
  whatsappPhone,
}: {
  sellerName: string;
  sellerLogoUrl?: string | null;
  storeHref: string;
  cartHref: string;
  cartCount: number;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  whatsappPhone?: string | null;
}) {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [replyMessages, setReplyMessages] = useState<Array<{ id: string; product_id?: string | null; product_name: string; seller_reply: string; replied_at?: string | null }>>([]);
  const [readReplyIds, setReadReplyIds] = useState<string[]>([]);
  const [isRepliesOpen, setIsRepliesOpen] = useState(false);
  const productPageHref = `${storeHref}/products`;
  const categoriesHref = `${storeHref}/categories`;
  const wishlistHref = `${storeHref}/wishlist`;
  const ordersHref = `${storeHref}/orders`;
  const supportHref = `${storeHref}/support`;
  const chatHref = `${storeHref}/chat`;
  const storeSlug = storeHref.split("/store/")[1]?.split(/[?#/]/)[0] ?? "";
  const unreadReplyMessages = replyMessages.filter((message) => !readReplyIds.includes(message.id));
  const drawerLinks: Array<{ label: string; href?: string; icon: "home" | "search" | "menu" | "heart" | "cart" | "user" | "messages"; disabled?: boolean }> = [
    { label: "Home", href: storeHref, icon: "home" },
    { label: "All Products", href: productPageHref, icon: "search" },
    { label: "Categories", href: categoriesHref, icon: "menu" },
    { label: "Chat Seller", href: chatHref, icon: "messages" },
    { label: "Wishlist", href: wishlistHref, icon: "heart" },
    { label: "My Cart", href: cartHref, icon: "cart" },
    { label: "My Orders", href: ordersHref, icon: "user" },
    { label: "Login / Account", href: "/login", icon: "user" },
    { label: "Contact / Support", href: supportHref, icon: "user" },
  ];
  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function closeMenu() {
      setIsMenuOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("scroll", closeMenu, { passive: true, once: true });
    window.addEventListener("wheel", closeMenu, { passive: true, once: true });
    window.addEventListener("touchmove", closeMenu, { passive: true, once: true });

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("scroll", closeMenu);
      window.removeEventListener("wheel", closeMenu);
      window.removeEventListener("touchmove", closeMenu);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!storeSlug) return;

    async function loadCustomerReplies() {
      const savedIds = readCustomerMessageIds(storeSlug);
      setReadReplyIds(readCustomerReadReplyIds(storeSlug));
      if (savedIds.length === 0) {
        setReplyMessages([]);
        return;
      }

      try {
        const response = await fetch(`/api/customer-messages?store=${encodeURIComponent(storeSlug)}&ids=${encodeURIComponent(savedIds.join(","))}`);
        const data = await response.json();
        if (response.ok) {
          setReplyMessages((data.messages ?? []).filter((message: { seller_reply?: string | null }) => message.seller_reply));
        }
      } catch {
        setReplyMessages([]);
      }
    }

    loadCustomerReplies();
    window.addEventListener("sellmate-customer-messages-updated", loadCustomerReplies);
    return () => window.removeEventListener("sellmate-customer-messages-updated", loadCustomerReplies);
  }, [storeHref, storeSlug]);

  function markReplyRead(messageId: string) {
    if (!storeSlug) return;
    markCustomerReplyRead(storeSlug, messageId);
    setReadReplyIds(readCustomerReadReplyIds(storeSlug));
    window.dispatchEvent(new Event("sellmate-customer-messages-updated"));
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchTerm.trim();
    router.push(query ? `${productPageHref}?q=${encodeURIComponent(query)}` : productPageHref);
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#E5E7EB] bg-white shadow-sm">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-3 sm:h-[68px] sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            aria-label="Open store menu"
            aria-expanded={isMenuOpen}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-white text-[#1F2937] transition hover:bg-[#F3F4F6] active:scale-95 focus:outline-none focus:ring-4 focus:ring-[#16A34A]/20"
          >
            <IconGlyph name="menu" className="h-5 w-5" />
          </button>
          <Link href={storeHref} className="flex min-w-0 items-center gap-2 text-base font-black leading-tight text-[#1F2937] sm:gap-3 sm:text-lg">
            <SellerLogo name={sellerName} logoUrl={sellerLogoUrl} size="sm" />
            <span className="truncate capitalize">{sellerName}</span>
          </Link>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2">
          <button type="button" onClick={() => setIsRepliesOpen(true)} className="relative grid h-10 w-10 place-items-center rounded-full text-[#0F172A] transition hover:bg-[#F3F4F6] hover:text-[#16A34A]" aria-label="View seller replies">
            <IconGlyph name="messages" className="h-5 w-5" />
            {unreadReplyMessages.length > 0 ? (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#16A34A] px-1 text-[10px] font-black text-white">
                {unreadReplyMessages.length}
              </span>
            ) : null}
          </button>
          <CartIconLink href={cartHref} count={cartCount} />
          <Link href="/login" className="hidden h-10 items-center gap-2 rounded-full px-3 text-sm font-black text-[#0F172A] transition hover:bg-[#F3F4F6] hover:text-[#16A34A] lg:inline-flex">
            <IconGlyph name="user" className="h-4 w-4" />
            Account
          </Link>
        </div>
      </nav>
      <div className="border-t border-[#E5E7EB] bg-white px-3 py-2 sm:px-5">
        <form onSubmit={submitSearch} className="mx-auto max-w-7xl">
          <label className="relative block">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><IconGlyph name="search" className="h-4 w-4" /></span>
            <input
              value={searchTerm}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search products, brands and categories"
              className="h-11 w-full rounded-full border border-[#E5E7EB] bg-[#F5F5F5] pl-9 pr-12 text-sm font-semibold text-[#1F2937] outline-none transition focus:border-[#16A34A] focus:bg-white focus:ring-4 focus:ring-[#16A34A]/10"
            />
            <button type="submit" aria-label="Search products" className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-[#16A34A] text-white transition hover:bg-[#15803D]">
              <IconGlyph name="search" className="h-4 w-4" />
            </button>
          </label>
        </form>
      </div>
      {isMenuOpen ? (
        <div className="fixed inset-0 z-[1000]">
          <style>{`
            @keyframes vendoraq-drawer-in {
              from {
                opacity: 0;
                transform: translateX(-100%);
              }

              to {
                opacity: 1;
                transform: translateX(0);
              }
            }
          `}</style>
          <button
            type="button"
            className="absolute inset-0 h-full w-full bg-slate-950/35"
            aria-label="Close store menu"
            onClick={() => setIsMenuOpen(false)}
          />
          <aside className="vendoraq-mobile-drawer relative z-[1001] flex h-[100dvh] w-[min(86vw,20rem)] flex-col overflow-y-auto border-r border-[#E5E7EB] bg-white shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] px-4 py-4">
              <Link href={storeHref} onClick={() => setIsMenuOpen(false)} className="flex min-w-0 items-center gap-3">
                <SellerLogo name={sellerName} logoUrl={sellerLogoUrl} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-base font-black capitalize text-[#0F172A]">{sellerName}</p>
                  <p className="text-xs font-bold text-slate-500">Customer store menu</p>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                aria-label="Close store menu"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#E5E7EB] bg-white text-[#0F172A] transition hover:bg-[#F3F4F6] focus:outline-none focus:ring-4 focus:ring-[#16A34A]/20"
              >
                <IconGlyph name="x" className="h-5 w-5" />
              </button>
            </div>
            <nav className="grid gap-1 px-3 py-4">
              {drawerLinks.map((item) =>
                item.disabled ? (
                  <button
                    key={item.label}
                    type="button"
                    disabled
                    className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-3 text-left text-sm font-black text-slate-400"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F3F4F6] text-slate-400">
                      <IconGlyph name={item.icon} className="h-5 w-5" />
                    </span>
                    <span>{item.label}</span>
                  </button>
                ) : (
                  <Link
                    key={item.label}
                    href={item.href ?? storeHref}
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-black text-[#1F2937] transition hover:bg-[#F3F4F6] hover:text-[#16A34A]"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F3F4F6] text-[#16A34A]">
                      <IconGlyph name={item.icon} className="h-5 w-5" />
                    </span>
                    <span>{item.label}</span>
                  </Link>
                ),
              )}
            </nav>
            <div className="mt-auto border-t border-[#E5E7EB] p-4">
              <div className="mb-4 grid gap-2">
                <Link href="/register" onClick={() => setIsMenuOpen(false)} className="rounded-md bg-[#16A34A] px-4 py-3 text-center text-sm font-black text-white">
                  Sell on Vendura
                </Link>
                <Link href="/login" onClick={() => setIsMenuOpen(false)} className="rounded-md border border-[#E5E7EB] bg-white px-4 py-3 text-center text-sm font-black text-[#0F172A]">
                  Vendor Login
                </Link>
              </div>
              <p className="rounded-lg border border-emerald-100 bg-[#F0FDF4] p-3 text-xs font-bold leading-5 text-slate-600">
                {whatsappPhone ? `Need help? Contact this store on WhatsApp: ${whatsappPhone}` : "Browse products, add to cart, and checkout inside this store."}
              </p>
            </div>
          </aside>
        </div>
      ) : null}
      {isRepliesOpen ? (
        <div className="fixed inset-0 z-[1000] grid place-items-end bg-slate-950/35 p-0 sm:place-items-center sm:p-4">
          <button type="button" className="absolute inset-0" aria-label="Close seller replies" onClick={() => setIsRepliesOpen(false)} />
          <section className="relative max-h-[88dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Seller replies</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">Your messages</h2>
              </div>
              <button type="button" onClick={() => setIsRepliesOpen(false)} aria-label="Close seller replies" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-700">
                <IconGlyph name="x" className="h-5 w-5" />
              </button>
            </div>
            {replyMessages.length === 0 ? (
              <p className="py-8 text-sm font-semibold leading-6 text-slate-500">No seller replies yet. When a seller replies to your product question, it will show here.</p>
            ) : (
              <div className="grid gap-3 py-4">
                {replyMessages.map((message) => (
                  <article key={message.id} className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">{message.product_name}</p>
                      {readReplyIds.includes(message.id) ? <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-500 ring-1 ring-emerald-100">Read</span> : null}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{message.seller_reply}</p>
                    {message.replied_at ? <p className="mt-3 text-xs font-bold text-slate-500">{new Date(message.replied_at).toLocaleString()}</p> : null}
                    <Link
                      href={`${chatHref}?message=${encodeURIComponent(message.id)}${message.product_id ? `&product=${encodeURIComponent(message.product_id)}` : ""}`}
                      onClick={() => {
                        markReplyRead(message.id);
                        setIsRepliesOpen(false);
                      }}
                      className="mt-3 inline-flex rounded-md bg-[#16A34A] px-4 py-2 text-xs font-black text-white transition hover:bg-[#15803D]"
                    >
                      Reply in chat
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </header>
  );
}

const CUSTOMER_MESSAGE_KEY = "sellmate-ng-customer-messages";
const CUSTOMER_READ_REPLIES_KEY = "sellmate-ng-read-replies";

function readCustomerMessageIds(storeSlug: string) {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CUSTOMER_MESSAGE_KEY) || "{}") as Record<string, string[]>;
    return Array.isArray(parsed[storeSlug]) ? parsed[storeSlug] : [];
  } catch {
    return [];
  }
}

function readCustomerReadReplyIds(storeSlug: string) {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CUSTOMER_READ_REPLIES_KEY) || "{}") as Record<string, string[]>;
    return Array.isArray(parsed[storeSlug]) ? parsed[storeSlug] : [];
  } catch {
    return [];
  }
}

function markCustomerReplyRead(storeSlug: string, messageId: string) {
  if (typeof window === "undefined") return;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CUSTOMER_READ_REPLIES_KEY) || "{}") as Record<string, string[]>;
    const current = Array.isArray(parsed[storeSlug]) ? parsed[storeSlug] : [];
    parsed[storeSlug] = [messageId, ...current.filter((id) => id !== messageId)].slice(0, 50);
    window.localStorage.setItem(CUSTOMER_READ_REPLIES_KEY, JSON.stringify(parsed));
  } catch {
    window.localStorage.setItem(CUSTOMER_READ_REPLIES_KEY, JSON.stringify({ [storeSlug]: [messageId] }));
  }
}

export function CheckoutHeader({
  sellerName,
  sellerLogoUrl,
  storeHref,
  cartHref,
  cartCount,
  mode,
}: {
  sellerName: string;
  sellerLogoUrl?: string | null;
  storeHref: string;
  cartHref?: string;
  cartCount?: number;
  mode: "cart" | "checkout" | "success";
}) {
  const isCheckout = mode === "checkout";
  const statusText = mode === "success" ? "Payment complete" : isCheckout ? "Secure checkout" : "Secure shopping cart";
  const actionText = mode === "success" ? "Back to store" : "Shop products";

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#E5E7EB] bg-white/95 shadow-[0_8px_24px_rgba(15,23,42,0.06)] backdrop-blur">
      <nav className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href={storeHref} className="flex min-w-0 items-center gap-3">
          <SellerLogo name={sellerName} logoUrl={sellerLogoUrl} />
          <div className="min-w-0">
            <p className="truncate text-base font-black capitalize leading-tight text-[#0F172A] sm:text-2xl">{sellerName}</p>
            <p className="hidden items-center gap-1 text-xs font-semibold text-slate-500 sm:flex">
              <IconGlyph name="lock" className="h-3.5 w-3.5" />
              {statusText}
            </p>
          </div>
        </Link>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {isCheckout && cartHref ? <CartIconLink href={cartHref} count={cartCount ?? 0} label="Edit cart" /> : null}
          <Link href={storeHref} className="rounded-full bg-[#16A34A] px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-[#15803D] sm:text-sm">{actionText}</Link>
        </div>
      </nav>
    </header>
  );
}

export type CustomerProductDetails = {
  id: string;
  user_id?: string;
  name: string;
  sku?: string | null;
  category: string;
  variant_options?: string | null;
  price: number;
  stock: number;
  image_url?: string | null;
};

export function ProductDetailsModal<TProduct extends CustomerProductDetails>({
  product,
  isFavorite,
  onClose,
  onAddToCart,
  onChangeCartQty,
  onToggleFavorite,
  storeSlug,
  cartQty = 0,
}: {
  product: TProduct;
  isFavorite: boolean;
  onClose: () => void;
  onAddToCart: (product: TProduct) => void;
  onChangeCartQty?: (product: TProduct, qty: number) => void;
  onToggleFavorite: (product: TProduct) => void;
  storeSlug?: string;
  sellerName?: string;
  cartQty?: number;
}) {
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[1100] bg-white">
      <button type="button" className="absolute inset-0 h-full w-full" aria-label="Close product details" onClick={onClose} />
      <section className="relative h-[100dvh] w-full overflow-y-auto bg-white">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:px-6 lg:px-10">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Product details</p>
            <p className="truncate text-sm font-black text-slate-950 sm:text-base">{product.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close product details" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100">
            <IconGlyph name="x" className="h-5 w-5" />
          </button>
        </div>
        <div className="mx-auto grid w-full max-w-7xl items-start gap-0 lg:min-h-[calc(100dvh-4.5rem)] lg:grid-cols-[minmax(0,1.05fr)_minmax(24rem,0.95fr)]">
          <div className="relative min-w-0 bg-slate-100 lg:sticky lg:top-[4.5rem] lg:min-h-[calc(100dvh-4.5rem)]">
            <div className="aspect-[4/3] w-full bg-[linear-gradient(135deg,#f8fafc,#e5e7eb)] bg-contain bg-center bg-no-repeat sm:aspect-[16/10] lg:h-[calc(100dvh-4.5rem)] lg:aspect-auto" style={product.image_url ? { backgroundImage: `url(${product.image_url})` } : undefined} />
            <span className="absolute left-4 top-4 rounded-full bg-[#DCFCE7] px-3 py-1 text-xs font-black uppercase tracking-wide text-[#166534]">{product.category}</span>
          </div>
          <div className="flex min-w-0 flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Product details</p>
                <h2 className="mt-2 break-words text-2xl font-black leading-tight text-slate-950 sm:text-4xl">{product.name}</h2>
              </div>
            </div>
            <p className="mt-5 text-3xl font-black text-[#16A34A]">{formatNaira(product.price)}</p>
            <div className="mt-5 grid gap-3 text-sm font-semibold text-slate-600">
              <div className="flex justify-between gap-4 rounded-lg bg-slate-50 px-4 py-3"><span>Stock available</span><strong className="text-slate-950">{product.stock}</strong></div>
              <div className="flex justify-between gap-4 rounded-lg bg-slate-50 px-4 py-3"><span>Category</span><strong className="text-right text-slate-950">{product.category}</strong></div>
              {product.sku ? <div className="flex justify-between gap-4 rounded-lg bg-slate-50 px-4 py-3"><span>SKU</span><strong className="text-right text-slate-950">{product.sku}</strong></div> : null}
            </div>
            {product.variant_options ? (
              <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Options / description</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{product.variant_options}</p>
              </div>
            ) : null}
            <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
              {cartQty > 0 && onChangeCartQty ? (
                <div className="flex items-center justify-between overflow-hidden rounded-lg border border-emerald-200 bg-emerald-50">
                  <button type="button" onClick={() => onChangeCartQty(product, cartQty - 1)} className="grid h-12 w-14 place-items-center text-xl font-black text-emerald-800">-</button>
                  <span className="text-base font-black text-slate-950">{cartQty} in cart</span>
                  <button type="button" onClick={() => onChangeCartQty(product, cartQty + 1)} className="grid h-12 w-14 place-items-center text-xl font-black text-emerald-800">+</button>
                </div>
              ) : (
                <button type="button" onClick={() => onAddToCart(product)} className="flex items-center justify-center gap-2 rounded-lg bg-[#16A34A] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#15803D]">
                  <IconGlyph name="cart" className="h-4 w-4" />
                  Add to Cart
                </button>
              )}
              <button type="button" onClick={() => onToggleFavorite(product)} className={`flex items-center justify-center gap-2 rounded-lg border px-5 py-3 text-sm font-black transition ${isFavorite ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-700 hover:border-rose-200 hover:text-rose-700"}`}>
                <IconGlyph name="heart" className="h-4 w-4" />
                {isFavorite ? "Saved" : "Save"}
              </button>
            </div>
            {storeSlug ? (
              <Link href={`/store/${storeSlug}/chat?product=${encodeURIComponent(product.id)}`} onClick={onClose} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-[#16A34A]">
                <IconGlyph name="messages" className="h-4 w-4" />
                Chat with seller
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

export function PublicFooter({
  sellerName,
  sellerLogoUrl,
  storeHref = "/",
}: {
  sellerName?: string;
  sellerLogoUrl?: string | null;
  storeHref?: string;
}) {
  const footerName = sellerName || "VENDORAQ";
  const isSellerFooter = Boolean(sellerName);
  const productHref = storeHref;
  const categoryHref = storeHref === "/" ? "/#how-it-works" : `${storeHref}#products`;
  const [activeFooterModal, setActiveFooterModal] = useState<string | null>(null);
  const modalDetails: Record<string, { title: string; eyebrow: string; body: string; points: string[]; actionLabel?: string; actionHref?: string }> = {
    Deals: {
      eyebrow: "Seller deals",
      title: `${footerName} deals`,
      body: isSellerFooter
        ? `Deals here belong to ${footerName}. Customers should use this seller's store link to see live products, discounts, stock, and checkout.`
        : "Deals are seller-specific. Open a seller store to see that seller's products, prices, offers, and checkout flow.",
      points: ["Deals are not shared across all sellers.", "Each seller controls their own products and prices.", "Customers can browse products, add to cart, and checkout from the correct seller store."],
      actionLabel: "View products",
      actionHref: productHref,
    },
    "Seller Guide": {
      eyebrow: "Seller guide",
      title: "How VENDORAQ works for sellers",
      body: "Create your seller account, set your business details, add products with images, share your public store link, then manage orders from your private dashboard.",
      points: ["Register or log in as a seller.", "Add product name, price, stock, category, variants, and image.", "Share your store link with customers on WhatsApp, Instagram, or anywhere.", "Customers order while your dashboard keeps products, orders, receipts, and settings together."],
      actionLabel: "Start selling",
      actionHref: "/register",
    },
    Pricing: {
      eyebrow: "Pricing",
      title: "Simple seller plans",
      body: "Pricing is for business owners using VENDORAQ to run their online store. Customers do not need to pay VENDORAQ to shop.",
      points: ["Free trial for new sellers.", "Upgrade when your product limit is reached.", "Higher plans unlock more products and business tools.", "Payment setup can be completed from the seller dashboard."],
      actionLabel: "Open seller login",
      actionHref: "/login",
    },
    "Help Center": {
      eyebrow: "Help center",
      title: "Getting help on VENDORAQ",
      body: "Use the help center when you need guidance on seller setup, product upload, cart, checkout, payment, delivery, or account access.",
      points: ["Sellers can learn how to add products and manage orders.", "Customers can understand browsing, cart, checkout, and WhatsApp receipt follow-up.", "For urgent order questions, contact the seller directly from the store details."],
    },
    "Track Order": {
      eyebrow: "Coming soon",
      title: "Track order",
      body: "Order tracking is not active yet. For now, customers should contact the seller after checkout using the WhatsApp receipt flow.",
      points: ["Tracking will be added later.", "Paid orders can still be followed up with the seller on WhatsApp.", "The seller dashboard keeps the order record."],
    },
    "Contact Us": {
      eyebrow: "Contact",
      title: "Contact VENDORAQ support",
      body: "For platform support, sellers can reach out about account setup, store links, product upload, payments, and dashboard issues.",
      points: ["Seller account and setup support.", "Help with product images, cart, checkout, and Paystack setup.", "Customers should contact the seller for product delivery questions."],
    },
    Returns: {
      eyebrow: "Returns",
      title: "Returns and order issues",
      body: "Returns are controlled by each seller because every seller manages their own products, delivery, and customer agreement.",
      points: ["Contact the seller first for return questions.", "Keep your order receipt and WhatsApp conversation.", "VENDORAQ helps sellers manage the order flow but each seller sets their own return policy."],
    },
    About: {
      eyebrow: "About",
      title: "About VENDORAQ",
      body: "VENDORAQ helps Nigerian sellers create public stores, collect customer orders, manage products, receive payments, and follow up on WhatsApp from one dashboard.",
      points: ["Built for sellers who sell through WhatsApp and social media.", "Customers can browse without needing a seller dashboard.", "Every seller gets their own public store experience."],
    },
    Terms: {
      eyebrow: "Terms",
      title: "VENDORAQ terms",
      body: "These terms explain the basic rules for using VENDORAQ as a seller or customer.",
      points: ["Sellers are responsible for product accuracy, delivery details, and customer support.", "Customers should review products, totals, and delivery details before payment.", "VENDORAQ provides the store, cart, checkout, and dashboard tools."],
    },
    Privacy: {
      eyebrow: "Privacy",
      title: "Privacy on VENDORAQ",
      body: "VENDORAQ should only collect information needed to run accounts, orders, checkout, delivery, and seller support.",
      points: ["Seller account details are used for dashboard access and store setup.", "Customer delivery details are used to process orders.", "Payment is handled securely through the connected payment provider."],
    },
  };

  const footerColumns = [
    {
      title: "SHOP",
      links: [
        { label: "Products", href: productHref },
        { label: "Categories", href: categoryHref },
        { label: "Deals", modal: "Deals" },
        { label: "New Arrivals", href: categoryHref },
      ],
    },
    {
      title: "SELL",
      links: [
        { label: "Start Selling", href: "/register" },
        { label: "Seller Dashboard", href: "/login" },
        { label: "Seller Guide", modal: "Seller Guide" },
        { label: "Pricing", modal: "Pricing" },
      ],
    },
    {
      title: "SUPPORT",
      links: [
        { label: "Help Center", modal: "Help Center" },
        { label: "Track Order", modal: "Track Order" },
        { label: "Contact Us", modal: "Contact Us" },
        { label: "Returns", modal: "Returns" },
      ],
    },
    {
      title: "COMPANY",
      links: [
        { label: "About", modal: "About" },
        { label: "Terms", modal: "Terms" },
        { label: "Privacy", modal: "Privacy" },
      ],
    },
  ];

  return (
    <footer id="help" className="bg-[#0F172A] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:grid-cols-2 lg:grid-cols-[1.25fr_0.75fr_0.75fr_0.75fr_0.75fr]">
        <div className="max-w-xl">
          <Link href={isSellerFooter ? storeHref : "/"} className="flex w-fit items-center gap-3 text-xl font-black text-white">
            {isSellerFooter ? (
              <SellerLogo name={footerName} logoUrl={sellerLogoUrl} />
            ) : (
              <VendoraqLogo tone="light" />
            )}
            {isSellerFooter ? <span>{footerName}</span> : null}
          </Link>
          <p className="mt-3 text-sm font-black uppercase tracking-[0.18em] text-[#16A34A]">
            {isSellerFooter ? "Powered by VENDORAQ" : "Sell. Connect. Grow."}
          </p>
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
            {isSellerFooter
              ? "Secure product browsing, cart checkout, payment follow-up, and customer support for this seller."
              : "A modern commerce platform for Nigerian sellers to launch online stores, manage orders, receive payments, and grow with confidence."}
          </p>
          <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Newsletter</p>
            <div className="mt-3 flex overflow-hidden rounded-full bg-white p-1">
              <span className="min-w-0 flex-1 px-4 py-2 text-sm font-semibold text-slate-500">Business growth updates</span>
              <Link href="/register" className="rounded-full bg-[#16A34A] px-4 py-2 text-xs font-black text-white transition hover:bg-[#15803D]">
                Join
              </Link>
            </div>
          </div>
        </div>

        {footerColumns.map((column) => (
          <div key={column.title}>
            <h2 className="text-xs font-black uppercase tracking-[0.22em] text-white">{column.title}</h2>
            <div className="mt-2 h-0.5 w-8 rounded-full bg-[#16A34A]" />
            <nav className="mt-5 grid gap-3 text-sm font-bold text-slate-300">
              {column.links.map((link) =>
                "modal" in link ? (
                  <button
                    key={`${column.title}-${link.label}`}
                    type="button"
                    onClick={() => setActiveFooterModal(link.modal ?? null)}
                    className="w-fit text-left transition hover:text-[#16A34A]"
                  >
                    {link.label}
                  </button>
                ) : (
                  <Link key={`${column.title}-${link.label}`} href={link.href} className="transition hover:text-[#16A34A]">
                    {link.label}
                  </Link>
                ),
              )}
            </nav>
          </div>
        ))}
      </div>
      {activeFooterModal ? (
        <FooterInfoModal
          details={modalDetails[activeFooterModal]}
          onClose={() => setActiveFooterModal(null)}
        />
      ) : null}
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 text-xs font-semibold text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 {isSellerFooter ? footerName : "VENDORAQ"}. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">Secure payments</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">Paystack ready</span>
            <span className="text-[#16A34A]">Built for Nigerian sellers.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterInfoModal({
  details,
  onClose,
}: {
  details: { title: string; eyebrow: string; body: string; points: string[]; actionLabel?: string; actionHref?: string };
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-[#0F172A]/80 px-4 py-6 backdrop-blur-md">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-[1.35rem] border border-white/20 bg-white text-[#0F172A] shadow-[0_30px_90px_rgba(15,23,42,0.35)]">
        <div className="relative overflow-hidden bg-[#0F172A] px-5 py-5 text-white sm:px-7">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(22,163,74,0.38),transparent_58%)]" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#16A34A]/40 bg-[#16A34A]/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200">
                  {details.eyebrow}
                </span>
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-black text-slate-200">
                  VENDORAQ support
                </span>
              </div>
              <h2 className="mt-4 text-2xl font-black leading-tight text-white sm:text-4xl">{details.title}</h2>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300 sm:text-base">{details.body}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 text-lg font-black text-white shadow-sm transition hover:border-[#16A34A] hover:bg-[#16A34A]"
              aria-label="Close popup"
            >
              X
            </button>
          </div>
        </div>

        <div className="max-h-[62vh] overflow-y-auto bg-gradient-to-br from-white via-white to-emerald-50/50 p-5 sm:p-7">
          <div className="grid gap-3 sm:grid-cols-2">
            {details.points.map((point) => (
              <div key={point} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#DCFCE7] text-sm font-black text-[#166534]">
                  ✓
                </span>
                <p className="text-sm font-bold leading-6 text-slate-700">{point}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4 sm:flex sm:items-center sm:justify-between sm:gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#16A34A]">What happens next</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                Use the correct store, cart, checkout, or seller account path so customers and sellers stay in the right place.
              </p>
            </div>
            <div className="mt-4 flex shrink-0 flex-wrap gap-3 sm:mt-0">
              {details.actionLabel && details.actionHref ? (
                <Link href={details.actionHref} onClick={onClose} className="rounded-full bg-[#16A34A] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#15803D]">
                  {details.actionLabel}
                </Link>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-800 transition hover:border-[#16A34A] hover:bg-emerald-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export function DataTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="sellmate-card overflow-hidden rounded-lg">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-500">
            <tr>{headers.map((header) => <th key={header} className="px-4 py-3 font-bold">{header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <tr key={index} className="text-slate-700 hover:bg-emerald-50/50">{row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-4">{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ProductCard({ product }: { product: { name: string; price: number; category: string; stock: number; image_url?: string | null } }) {
  return (
    <div className="sellmate-card rounded-lg p-4">
      <div
        className="aspect-[4/3] rounded-md bg-[linear-gradient(135deg,#334155,#94a3b8_55%,#475569)] bg-cover bg-center"
        style={product.image_url ? { backgroundImage: `url(${product.image_url})` } : undefined}
      />
      <div className="mt-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-950">{product.name}</h3>
          <p className="text-sm text-slate-500">{product.category} · {product.stock} left</p>
        </div>
        <p className="font-black text-emerald-700">{formatNaira(product.price)}</p>
      </div>
    </div>
  );
}

