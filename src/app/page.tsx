"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PublicFooter, SectionTitle, StatCard } from "@/components/ui";
import { readCart } from "@/lib/cart";
import { supabase } from "@/lib/supabase";

type SellerSummary = {
  businessName: string;
  storeSlug: string;
  productCount: number;
  lowStockCount: number;
  products: Array<{
    id: string;
    name: string;
    category: string;
    price: number;
    stock: number;
    image_url: string | null;
  }>;
};

export default function LandingPage() {
  const [cartCount, setCartCount] = useState(0);
  const [sellerSummary, setSellerSummary] = useState<SellerSummary | null>(null);

  useEffect(() => {
    async function loadSellerSummary() {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;

      if (!userId) {
        setSellerSummary(null);
        return;
      }

      const { data: profileData } = await supabase
        .from("seller_profiles")
        .select("business_name,store_slug")
        .eq("user_id", userId)
        .maybeSingle();

      const { data: productData } = await supabase
        .from("products")
        .select("id,name,category,price,stock,status,image_url")
        .eq("user_id", userId)
        .eq("status", "Live")
        .order("created_at", { ascending: false });

      setSellerSummary({
        businessName: profileData?.business_name || "Your store",
        storeSlug: profileData?.store_slug || "ada-fashion",
        productCount: productData?.length ?? 0,
        lowStockCount: productData?.filter((product) => Number(product.stock) <= 3).length ?? 0,
        products: (productData ?? []).slice(0, 3),
      });
    }

    function syncCartCount() {
      setCartCount(readCart().reduce((sum, item) => sum + item.qty, 0));
    }

    loadSellerSummary();
    syncCartCount();
    window.addEventListener("sellmate-cart-updated", syncCartCount);
    window.addEventListener("storage", syncCartCount);

    return () => {
      window.removeEventListener("sellmate-cart-updated", syncCartCount);
      window.removeEventListener("storage", syncCartCount);
    };
  }, []);

  const demoStoreHref = "/store/ada-fashion";
  const storeHref = sellerSummary ? `/store/${sellerSummary.storeSlug}` : demoStoreHref;
  const isLoggedInSeller = Boolean(sellerSummary);

  const publicMetrics = useMemo(() => {
    if (sellerSummary) {
      return [
        { label: "Your store", value: sellerSummary.businessName, change: "Logged in", tone: "green" },
        { label: "Live products", value: String(sellerSummary.productCount), change: "Available", tone: "blue" },
        { label: "Items in your cart", value: String(cartCount), change: cartCount > 0 ? "Ready" : "Empty", tone: "slate" },
        { label: "Low stock", value: String(sellerSummary.lowStockCount), change: sellerSummary.lowStockCount > 0 ? "Check stock" : "Healthy", tone: sellerSummary.lowStockCount > 0 ? "amber" : "green" },
      ];
    }

    return [
      { label: "Seller dashboard", value: "Ready", change: "Manage shop", tone: "blue" },
      { label: "Items in your cart", value: String(cartCount), change: cartCount > 0 ? "Ready to checkout" : "Start shopping", tone: "green" },
      { label: "Storefronts", value: "Public", change: "Share links", tone: "slate" },
      { label: "Payments", value: "Paystack", change: "Test mode", tone: "amber" },
    ];
  }, [cartCount, sellerSummary]);

  return (
    <main className="bg-[linear-gradient(180deg,#f8fafc_0%,#e2e8f0_44%,#f8fafc_100%)] pt-20">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-300 bg-white/95 shadow-sm backdrop-blur">
        <nav className="mx-auto flex min-h-20 max-w-7xl flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-0">
          <Link href={storeHref} className="flex items-center" aria-label="Open SellMate store">
            <Image src="/sellmate-logo.png" alt="SellMate logo" width={48} height={48} className="h-10 w-10 rounded-md bg-white object-contain ring-1 ring-slate-300 sm:h-12 sm:w-12" />
          </Link>
          <div className="flex w-full items-center gap-2 overflow-x-auto pb-1 sm:w-auto sm:gap-4 sm:overflow-visible sm:pb-0">
            {isLoggedInSeller ? (
              <Link href={storeHref} className="shrink-0 rounded-md bg-emerald-700 px-3 py-2 text-xs font-black text-white shadow-sm ring-1 ring-emerald-600 hover:bg-emerald-800 sm:px-4 sm:text-sm">My store</Link>
            ) : (
              <Link href={demoStoreHref} className="hidden text-sm font-bold text-slate-700 hover:text-slate-950 sm:inline">Demo store</Link>
            )}
            <Link href="/cart" className="shrink-0 rounded-md bg-slate-200 px-3 py-2 text-xs font-black text-slate-800 ring-1 ring-slate-400 hover:bg-slate-100 sm:text-sm">Cart · {cartCount}</Link>
            {isLoggedInSeller ? null : (
              <>
                <Link href="/login" className="shrink-0 rounded-md px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 hover:text-slate-950 sm:text-sm">Seller login</Link>
                <Link href="/register" className="shrink-0 rounded-md bg-slate-950 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 sm:px-4 sm:text-sm">Start selling</Link>
              </>
            )}
          </div>
        </nav>
      </header>
      <section className="border-b border-slate-300 bg-[linear-gradient(135deg,#e2e8f0_0%,#f8fafc_48%,#d1fae5_100%)]">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:min-h-[calc(100vh-5rem)] lg:grid-cols-[1fr_0.92fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">WhatsApp commerce for Nigerian sellers</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-black capitalize leading-[1.02] text-slate-950 sm:text-5xl lg:text-6xl">
              {isLoggedInSeller ? `${sellerSummary?.businessName} store control.` : "Create your online store and manage WhatsApp orders."}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              {isLoggedInSeller
                ? "You are logged in. Open your store to see your public products, pictures, available stock, cart, and checkout flow."
                : "SellMate NG helps sellers create a public shop, add products, collect customer orders, receive Paystack payments, and manage everything from a private dashboard."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {isLoggedInSeller ? (
                <Link href={storeHref} className="rounded-md bg-emerald-700 px-5 py-3 text-sm font-black text-white">Open my store</Link>
              ) : (
                <>
                  <Link href="/register" className="rounded-md bg-emerald-700 px-5 py-3 text-sm font-black text-white">Create seller account</Link>
                  <Link href="/login" className="rounded-md border border-slate-400 bg-slate-100 px-5 py-3 text-sm font-black text-slate-800">Seller login</Link>
                </>
              )}
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
        {isLoggedInSeller ? (
          <>
            <SectionTitle
              eyebrow="Your products"
              title="Products available in your store"
              action={<Link href={storeHref} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-emerald-700">View my store</Link>}
            />
            {sellerSummary?.products.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sellerSummary.products.map((product) => (
                  <article key={product.id} className="group overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-xl">
                    <div className="relative bg-slate-200 p-3">
                      <div
                        className="h-52 rounded-md bg-[linear-gradient(135deg,#334155,#94a3b8_55%,#475569)] bg-cover bg-center shadow-inner transition duration-300 group-hover:scale-[1.02]"
                        style={product.image_url ? { backgroundImage: `url(${product.image_url})` } : undefined}
                      />
                      <span className="absolute right-6 top-6 rounded-full bg-white/95 px-3 py-1 text-xs font-black text-emerald-700 shadow-sm ring-1 ring-emerald-100">
                        {product.stock} left
                      </span>
                    </div>
                    <div className="p-5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{product.category}</span>
                        <span className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Live</span>
                      </div>
                      <h2 className="mt-3 line-clamp-2 text-xl font-black leading-tight text-slate-950">{product.name}</h2>
                      <p className="mt-2 text-2xl font-black text-emerald-700">
                        {new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(product.price)}
                      </p>
                      <Link href={storeHref} className="mt-5 block rounded-md bg-slate-950 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-emerald-700">
                        View product
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
                <h2 className="text-lg font-black text-slate-950">No live products yet</h2>
                <p className="mt-2 text-sm leading-6 text-amber-800">Add products in your dashboard and set them to Live so they can appear here.</p>
              </div>
            )}
          </>
        ) : (
          <>
            <SectionTitle eyebrow="How it works" title="One platform for sellers and customers" action={<Link href={storeHref} className="text-sm font-bold text-emerald-700">View demo store</Link>} />
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
          </>
        )}
      </section>
      <PublicFooter />
    </main>
  );
}
