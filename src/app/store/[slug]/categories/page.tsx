"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CartIconLink, PublicFooter, StoreHeader } from "@/components/ui";
import { readCart, writeCurrentStoreHref } from "@/lib/cart";
import { getCategoryMainLabel, getStoreCategoryLabels } from "@/lib/categories";
import { formatNaira } from "@/lib/data";
import { loadLiveStoreProducts, loadStoreBySlug, type StoreProduct, type StoreProfile } from "@/lib/storefront";

export default function StoreCategoriesPage() {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<StoreProfile | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [activeCategory, setActiveCategory] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [cartCount, setCartCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const storeHref = `/store/${slug}`;
  const cartHref = `/cart?store=${encodeURIComponent(slug)}`;

  useEffect(() => {
    async function load() {
      setLoading(true);
      writeCurrentStoreHref(storeHref);
      setCartCount(readCart().filter((item) => item.store_slug === slug).reduce((sum, item) => sum + item.qty, 0));
      try {
        const nextProfile = await loadStoreBySlug(slug);
        if (nextProfile) {
          setProfile(nextProfile);
          setProducts(await loadLiveStoreProducts(nextProfile.user_id));
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug, storeHref]);

  const sellerName = profile?.business_name ?? "Store";
  const categories = getStoreCategoryLabels(products.map((product) => product.category));
  const visibleProducts = products.filter((product) => !activeCategory || getCategoryMainLabel(product.category) === activeCategory);

  return (
    <main className="min-h-screen bg-[#f2f6fb]">
      <StoreHeader sellerName={sellerName} storeHref={storeHref} cartHref={cartHref} cartCount={cartCount} searchTerm={searchTerm} onSearchChange={setSearchTerm} whatsappPhone={profile?.whatsapp_phone} />
      <section className="mx-auto max-w-7xl px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#16A34A]">Categories</p>
            <h1 className="mt-2 text-4xl font-black text-[#0F172A] sm:text-6xl">Shop by category</h1>
          </div>
          <CartIconLink href={cartHref} count={cartCount} />
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <button onClick={() => setActiveCategory("")} className={`rounded-full px-4 py-2 text-sm font-black ${activeCategory ? "bg-white text-slate-700" : "bg-[#16A34A] text-white"}`}>All products</button>
          {categories.map((category) => (
            <button key={category} onClick={() => setActiveCategory(category)} className={`rounded-full px-4 py-2 text-sm font-black ${activeCategory === category ? "bg-[#16A34A] text-white" : "bg-white text-slate-700"}`}>{category}</button>
          ))}
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {loading ? Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
              <div className="aspect-square animate-pulse bg-slate-200" />
              <div className="p-4">
                <div className="h-6 w-24 animate-pulse rounded-full bg-slate-200" />
                <div className="mt-3 h-5 w-4/5 animate-pulse rounded bg-slate-200" />
                <div className="mt-3 h-5 w-24 animate-pulse rounded bg-slate-200" />
              </div>
            </div>
          )) : visibleProducts.map((product) => (
            <Link key={product.id} href={`${storeHref}/product/${product.id}`} className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="aspect-square bg-slate-100 bg-cover bg-center" style={product.image_url ? { backgroundImage: `url(${product.image_url})` } : undefined} />
              <div className="p-4">
                <p className="rounded-full bg-[#DCFCE7] px-3 py-1 text-xs font-black text-[#166534]">{getCategoryMainLabel(product.category)}</p>
                <h2 className="mt-3 line-clamp-2 font-black text-[#111827]">{product.name}</h2>
                <p className="mt-2 font-black text-[#0F172A]">{formatNaira(product.price)}</p>
              </div>
            </Link>
          ))}
        </div>
        {!loading && visibleProducts.length === 0 ? <p className="mt-8 rounded-lg bg-amber-50 p-4 text-sm font-bold text-amber-800">No products in this category yet.</p> : null}
      </section>
      <PublicFooter sellerName={sellerName} storeHref={storeHref} />
    </main>
  );
}
