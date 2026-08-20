"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PublicFooter, SectionTitle, StatCard } from "@/components/ui";
import { readCart } from "@/lib/cart";

export default function LandingPage() {
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    function syncCartCount() {
      setCartCount(readCart().reduce((sum, item) => sum + item.qty, 0));
    }

    syncCartCount();
    window.addEventListener("sellmate-cart-updated", syncCartCount);
    window.addEventListener("storage", syncCartCount);

    return () => {
      window.removeEventListener("sellmate-cart-updated", syncCartCount);
      window.removeEventListener("storage", syncCartCount);
    };
  }, []);

  const demoStoreHref = "/store/ada-fashion";

  const publicMetrics = useMemo(() => {
    return [
      { label: "Seller dashboard", value: "Ready", change: "Manage shop", tone: "blue" },
      { label: "Items in your cart", value: String(cartCount), change: cartCount > 0 ? "Ready to checkout" : "Start shopping", tone: "green" },
      { label: "Storefronts", value: "Public", change: "Share links", tone: "slate" },
      { label: "Payments", value: "Paystack", change: "Test mode", tone: "amber" },
    ];
  }, [cartCount]);

  return (
    <main className="bg-[linear-gradient(180deg,#f8fafc_0%,#e2e8f0_44%,#f8fafc_100%)] pt-20">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-300 bg-white/95 shadow-sm backdrop-blur">
        <nav className="mx-auto flex min-h-20 max-w-7xl flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-0">
          <Link href="/" className="flex items-center" aria-label="SellMate NG home">
            <Image src="/sellmate-logo.png" alt="SellMate logo" width={48} height={48} className="h-10 w-10 rounded-md bg-white object-contain ring-1 ring-slate-300 sm:h-12 sm:w-12" />
          </Link>
          <div className="flex w-full items-center gap-2 overflow-x-auto pb-1 sm:w-auto sm:gap-4 sm:overflow-visible sm:pb-0">
            <Link href={demoStoreHref} className="hidden text-sm font-bold text-slate-700 hover:text-slate-950 sm:inline">Demo store</Link>
            <Link href="/cart" className="shrink-0 rounded-md bg-slate-200 px-3 py-2 text-xs font-black text-slate-800 ring-1 ring-slate-400 hover:bg-slate-100 sm:text-sm">Cart · {cartCount}</Link>
            <Link href="/login" className="shrink-0 rounded-md px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 hover:text-slate-950 sm:text-sm">Seller login</Link>
            <Link href="/register" className="shrink-0 rounded-md bg-slate-950 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 sm:px-4 sm:text-sm">Start selling</Link>
          </div>
        </nav>
      </header>
      <section className="border-b border-slate-300 bg-[linear-gradient(135deg,#e2e8f0_0%,#f8fafc_48%,#d1fae5_100%)]">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:min-h-[calc(100vh-5rem)] lg:grid-cols-[1fr_0.92fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">WhatsApp commerce for Nigerian sellers</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-black capitalize leading-[1.02] text-slate-950 sm:text-5xl lg:text-6xl">
              Create your online store and manage WhatsApp orders.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              SellMate NG helps sellers create a public shop, add products, collect customer orders, receive Paystack payments, and manage everything from a private dashboard.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="rounded-md bg-emerald-700 px-5 py-3 text-sm font-black text-white">Create seller account</Link>
              <Link href="/login" className="rounded-md border border-slate-400 bg-slate-100 px-5 py-3 text-sm font-black text-slate-800">Seller login</Link>
            </div>
          </div>
          <div className="rounded-lg border border-slate-400 bg-slate-700 p-3 shadow-xl">
            <div className="rounded-md bg-slate-100 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {publicMetrics.map((metric) => <StatCard key={metric.label} {...metric} />)}
              </div>
              <div className="mt-4 rounded-lg border border-slate-300 bg-slate-200 p-4">
                <p className="text-sm font-bold text-slate-700">Customer shopping flow</p>
                <p className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">Browse · Cart · Checkout</p>
                <p className="mt-2 text-sm text-slate-600">Public visitors see products and their own cart only. Seller revenue stays inside the dashboard.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-12">
        <SectionTitle eyebrow="How it works" title="One platform for sellers and customers" action={<Link href={demoStoreHref} className="text-sm font-bold text-emerald-700">View demo store</Link>} />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">1. Seller creates store</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">The seller registers, adds business details, delivery fee, logo, products, prices, stock, and WhatsApp number.</p>
          </div>
          <div className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">2. Customer shops</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Customers open the seller store link, search products, add items to cart, and enter delivery details.</p>
          </div>
          <div className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">3. Payment and receipt</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Customers pay through Paystack, then send a neat receipt-style WhatsApp message to the seller.</p>
          </div>
        </div>
      </section>
          <PublicFooter />
    </main>
  );
}


