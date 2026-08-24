"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { IconGlyph, PublicFooter, StoreHeader } from "@/components/ui";
import { addToCart, readCart, writeCurrentStoreHref } from "@/lib/cart";
import { formatNaira } from "@/lib/data";
import { loadStoreBySlug, type StoreProfile } from "@/lib/storefront";
import { readWishlist, removeWishlistItem, type WishlistItem } from "@/lib/wishlist";

export default function WishlistPage() {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<StoreProfile | null>(null);
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [cartCount, setCartCount] = useState(0);
  const storeHref = `/store/${slug}`;
  const cartHref = `/cart?store=${encodeURIComponent(slug)}`;

  useEffect(() => {
    async function load() {
      setProfile(await loadStoreBySlug(slug));
      setItems(readWishlist(slug));
      setCartCount(readCart().filter((item) => item.store_slug === slug).reduce((sum, item) => sum + item.qty, 0));
      writeCurrentStoreHref(storeHref);
    }
    load();
  }, [slug, storeHref]);

  function addWishlistItem(item: WishlistItem) {
    const nextCart = addToCart(item);
    setCartCount(nextCart.filter((cartItem) => cartItem.store_slug === slug).reduce((sum, cartItem) => sum + cartItem.qty, 0));
  }

  function removeItem(id: string) {
    removeWishlistItem(id, slug);
    setItems(readWishlist(slug));
  }

  const sellerName = profile?.business_name ?? "Store";

  return (
    <main className="min-h-screen bg-[#f2f6fb]">
      <StoreHeader sellerName={sellerName} storeHref={storeHref} cartHref={cartHref} cartCount={cartCount} searchTerm={searchTerm} onSearchChange={setSearchTerm} whatsappPhone={profile?.whatsapp_phone} />
      <section className="mx-auto max-w-5xl px-5 py-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#16A34A]">Wishlist</p>
        <h1 className="mt-2 text-4xl font-black text-[#0F172A] sm:text-6xl">Saved products</h1>
        <div className="mt-8 grid gap-4">
          {items.map((item) => (
            <article key={item.id} className="grid gap-4 rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:grid-cols-[120px_1fr_auto] sm:items-center">
              <div className="aspect-square rounded-lg bg-slate-100 bg-cover bg-center" style={item.image_url ? { backgroundImage: `url(${item.image_url})` } : undefined} />
              <div>
                <h2 className="text-xl font-black text-[#111827]">{item.name}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">{item.category}</p>
                <p className="mt-2 text-xl font-black text-[#0F172A]">{formatNaira(item.price)}</p>
              </div>
              <div className="grid gap-2">
                <Link href={`${storeHref}/product/${item.id}`} className="rounded-lg border border-slate-300 px-4 py-2 text-center text-sm font-black text-slate-800">View product</Link>
                <button onClick={() => addWishlistItem(item)} className="flex items-center justify-center gap-2 rounded-lg bg-[#16A34A] px-4 py-2 text-sm font-black text-white"><IconGlyph name="cart" className="h-4 w-4" /> Add to Cart</button>
                <button onClick={() => removeItem(item.id)} className="rounded-lg bg-rose-50 px-4 py-2 text-sm font-black text-rose-700">Remove</button>
              </div>
            </article>
          ))}
        </div>
        {items.length === 0 ? <p className="mt-8 rounded-lg bg-white p-5 text-sm font-bold text-slate-600 shadow-sm">Your wishlist is empty. Save products with the heart button.</p> : null}
      </section>
      <PublicFooter sellerName={sellerName} storeHref={storeHref} />
    </main>
  );
}
