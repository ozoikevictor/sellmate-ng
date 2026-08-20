"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProductCard, PublicFooter, SectionTitle, StatCard } from "@/components/ui";
import { readCart } from "@/lib/cart";
import { supabase } from "@/lib/supabase";

type LandingProduct = {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  stock: number;
  status: string;
  image_url: string | null;
};

type LandingProfile = {
  user_id: string;
  business_name: string;
  city: string;
  store_slug: string;
};

export default function LandingPage() {
  const [profile, setProfile] = useState<LandingProfile | null>(null);
  const [products, setProducts] = useState<LandingProduct[]>([]);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    async function loadPublicStats() {
      const profileQuery = supabase
        .from("seller_profiles")
        .select("user_id,business_name,city,store_slug")
        .order("updated_at", { ascending: false })
        .limit(1);

      const { data: profileData } = await profileQuery.maybeSingle();

      if (profileData) {
        setProfile(profileData);
      }

      let query = supabase
        .from("products")
        .select("id,name,sku,category,price,stock,status,image_url")
        .eq("status", "Live")
        .order("created_at", { ascending: false });

      if (profileData?.user_id) {
        query = query.eq("user_id", profileData.user_id);
      }

      const { data } = await query;
      setProducts(data ?? []);
    }

    function syncCartCount() {
      setCartCount(readCart().reduce((sum, item) => sum + item.qty, 0));
    }

    loadPublicStats();
    syncCartCount();
    window.addEventListener("sellmate-cart-updated", syncCartCount);
    window.addEventListener("storage", syncCartCount);

    return () => {
      window.removeEventListener("sellmate-cart-updated", syncCartCount);
      window.removeEventListener("storage", syncCartCount);
    };
  }, []);

  const businessName = profile?.business_name || "your store";
  const storeHref = `/store/${profile?.store_slug || "ada-fashion"}`;
  const city = profile?.city || "Nigeria";

  const publicMetrics = useMemo(() => {
    const lowStockCount = products.filter((product) => product.stock > 0 && product.stock <= 5).length;
    return [
      { label: "Live products", value: String(products.length), change: "Public shop", tone: "blue" },
      { label: "Items in your cart", value: String(cartCount), change: cartCount > 0 ? "Ready to checkout" : "Start shopping", tone: "green" },
      { label: "Low stock items", value: String(lowStockCount), change: lowStockCount > 0 ? "Selling fast" : "In stock", tone: lowStockCount > 0 ? "amber" : "slate" },
      { label: "Customer checkout", value: "Open", change: "No seller login", tone: "green" },
    ];
  }, [cartCount, products]);

  return (
    <main className="bg-[linear-gradient(180deg,#f8fafc_0%,#e2e8f0_44%,#f8fafc_100%)] pt-20">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-300 bg-white/95 shadow-sm backdrop-blur">
        <nav className="mx-auto flex min-h-20 max-w-7xl flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-0">
          <Link href="/" className="flex items-center" aria-label="SellMate NG home">
            <Image src="/sellmate-logo.png" alt="SellMate logo" width={48} height={48} className="h-10 w-10 rounded-md bg-white object-contain ring-1 ring-slate-300 sm:h-12 sm:w-12" />
          </Link>
          <div className="flex w-full items-center gap-2 overflow-x-auto pb-1 sm:w-auto sm:gap-4 sm:overflow-visible sm:pb-0">
            <Link href={storeHref} className="hidden text-sm font-bold text-slate-700 hover:text-slate-950 sm:inline">Shop products</Link>
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
              {businessName} storefront for WhatsApp orders.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              Customers open {businessName} to browse goods and checkout. Business owners log in to manage products, orders, inventory, receipts, and customers.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="rounded-md bg-emerald-700 px-5 py-3 text-sm font-black text-white">Create seller account</Link>
              <Link href={storeHref} className="rounded-md border border-slate-400 bg-slate-100 px-5 py-3 text-sm font-black text-slate-800">Shop products</Link>
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
        <SectionTitle eyebrow={`${city} storefront preview`} title={`${businessName} products`} action={<Link href={storeHref} className="text-sm font-bold text-emerald-700">Open public store</Link>} />
        <div className="grid gap-4 md:grid-cols-3">
          {products.slice(0, 3).map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      </section>
          <PublicFooter />
    </main>
  );
}


