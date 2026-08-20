"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoutButton, useAuth } from "@/components/auth";
import { formatNaira } from "@/lib/data";
import { supabase } from "@/lib/supabase";

export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    blue: "bg-sky-50 text-sky-700 ring-sky-200",
    red: "bg-rose-50 text-rose-700 ring-rose-200",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${tones[tone] ?? tones.slate}`}>{children}</span>;
}

export function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">{eyebrow}</p> : null}
        <h1 className="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, change, tone }: { label: string; value: string; change: string; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-xl font-bold text-slate-950 sm:text-2xl">{value}</p>
        <Badge tone={tone}>{change}</Badge>
      </div>
    </div>
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
  const [storeSlug, setStoreSlug] = useState("ada-fashion");
  const links = [
    { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: "dashboard" },
    { key: "account", label: "Account", href: "/dashboard/account", icon: "account" },
    { key: "products", label: "Products", href: "/dashboard/products", icon: "products" },
    { key: "orders", label: "Orders", href: "/dashboard/orders", icon: "orders" },
    { key: "customers", label: "Customers", href: "/dashboard/customers", icon: "customers" },
    { key: "inventory", label: "Inventory", href: "/dashboard/inventory", icon: "inventory" },
    { key: "analytics", label: "Analytics", href: "/dashboard/analytics", icon: "analytics" },
    { key: "receipts", label: "Receipts", href: "/dashboard/receipts", icon: "receipts" },
    { key: "billing", label: "Billing", href: "/dashboard/billing", icon: "billing" },
    { key: "settings", label: "Settings", href: "/dashboard/settings", icon: "settings" },
  ];

  useEffect(() => {
    if (!user?.id) {
      return;
    }
    const timer = window.setTimeout(async () => {
      const { data } = await supabase.from("seller_profiles").select("store_slug").eq("user_id", user.id).maybeSingle();
      if (data?.store_slug) {
        setStoreSlug(data.store_slug);
        return;
      }

      const fallbackSlug = makeStoreSlug(user.business, user.id);
      setStoreSlug(fallbackSlug);
      await supabase.from("seller_profiles").upsert(
        {
          user_id: user.id,
          owner_name: user.name,
          business_name: user.business,
          whatsapp_phone: "",
          city: "",
          store_slug: fallbackSlug,
        },
        { onConflict: "user_id" },
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user?.business, user?.id, user?.name]);

  return (
    <main className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white p-6 lg:block">
        <Link href="/" className="text-xl font-black text-slate-950">SellMate NG</Link>
        <p className="mt-2 text-sm text-slate-500">{user?.business ?? "Ada Fashion"} command center</p>
        <nav className="mt-8 grid gap-1">
          {links.map((link) => {
            const active = link.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(link.href);
            return (
            <Link
              key={link.key}
              href={link.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition ${
                active ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-800"
              }`}
            >
              <MenuIcon name={link.icon} />
              <span>{link.label}</span>
            </Link>
            );
          })}
        </nav>
        <Link href={`/store/${storeSlug}`} className="mt-8 block rounded-md bg-slate-950 px-4 py-3 text-center text-sm font-bold text-white">View storefront</Link>
      </aside>
      <section className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <Link href="/" className="font-black text-slate-950 lg:hidden">SellMate NG</Link>
            <p className="hidden text-sm font-semibold text-slate-700 lg:block">{user?.business ?? "Seller workspace"}</p>
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="hidden text-sm font-semibold text-slate-700 sm:inline">Logged in</span>
              <LogoutButton />
            </div>
          </div>
          <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {links.map((link) => {
              const active = link.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.key}
                  href={link.href}
                  className={`flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-xs font-bold ${
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
        <div className="mx-auto max-w-7xl px-5 py-8">{children}</div>
      </section>
    </main>
  );
}

function MenuIcon({ name }: { name: string }) {
  const common = "h-4 w-4 shrink-0";
  const icons: Record<string, React.ReactNode> = {
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
      {logoUrl ? <img src={logoUrl} alt={`${name} logo`} className="h-full w-full object-contain p-1" /> : initials}
    </span>
  );
}

export function PublicFooter({
  sellerName,
  sellerLogoUrl,
}: {
  sellerName?: string;
  sellerLogoUrl?: string | null;
}) {
  const footerName = sellerName || "SellMate NG";
  const isSellerFooter = Boolean(sellerName);
  return (
    <footer className="border-t border-slate-300 bg-slate-200">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div className="max-w-xl">
          <Link href="/" className="flex w-fit items-center gap-3 text-xl font-black text-slate-950">
            {isSellerFooter ? (
              <SellerLogo name={footerName} logoUrl={sellerLogoUrl} />
            ) : (
              <Image src="/sellmate-logo.png" alt="SellMate logo" width={52} height={52} className="h-12 w-12 rounded-md bg-white object-contain ring-1 ring-slate-300" />
            )}
            <span>{footerName}</span>
          </Link>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
            {isSellerFooter
              ? "Powered by SellMate NG for secure product browsing, cart checkout, payment, and WhatsApp order follow-up."
              : "WhatsApp commerce for Nigerian sellers: public storefronts, carts, orders, receipts, and seller dashboards."}
          </p>
        </div>
        <div>
          <h2 className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Customers</h2>
          <nav className="mt-4 grid gap-3 text-sm font-bold text-slate-700">
            <Link href="/store/ada-fashion" className="hover:text-slate-950">Shop products</Link>
            <Link href="/cart" className="hover:text-slate-950">View cart</Link>
            <Link href="/checkout" className="hover:text-slate-950">Checkout</Link>
          </nav>
        </div>
        {isSellerFooter ? (
          <div>
            <h2 className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Support</h2>
            <nav className="mt-4 grid gap-3 text-sm font-bold text-slate-700">
              <Link href="/checkout" className="hover:text-slate-950">Delivery details</Link>
              <Link href="/cart" className="hover:text-slate-950">Order summary</Link>
              <Link href="/" className="hover:text-slate-950">Powered by SellMate NG</Link>
            </nav>
          </div>
        ) : (
          <div>
            <h2 className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Sellers</h2>
            <nav className="mt-4 grid gap-3 text-sm font-bold text-slate-700">
              <Link href="/login" className="hover:text-slate-950">Seller login</Link>
              <Link href="/register" className="hover:text-slate-950">Start selling</Link>
            </nav>
          </div>
        )}
      </div>
      <div className="border-t border-slate-300">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-4 text-xs font-semibold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>Copyright 2026 SellMate NG.</p>
          <p>Built for Nigerian sellers.</p>
        </div>
      </div>
    </footer>
  );
}
export function DataTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-500">
            <tr>{headers.map((header) => <th key={header} className="px-4 py-3 font-bold">{header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <tr key={index} className="text-slate-700">{row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-4">{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ProductCard({ product }: { product: { name: string; price: number; category: string; stock: number; image_url?: string | null } }) {
  return (
    <div className="rounded-lg border border-slate-300 bg-slate-100 p-4 shadow-sm">
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

