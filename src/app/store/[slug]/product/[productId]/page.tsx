"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IconGlyph, PublicFooter, StoreHeader } from "@/components/ui";
import { addToCart, readCart, writeCurrentStoreHref } from "@/lib/cart";
import { getCategoryMainLabel } from "@/lib/categories";
import { formatNaira } from "@/lib/data";
import { getProductFacts, getProductShortDescription, loadLiveStoreProduct, loadStoreBySlug, type StoreProduct, type StoreProfile } from "@/lib/storefront";
import { isWishlisted, toggleWishlist } from "@/lib/wishlist";

export default function ProductDetailsPage() {
  const params = useParams<{ slug: string; productId: string }>();
  const router = useRouter();
  const slug = params.slug;
  const productId = params.productId;
  const [profile, setProfile] = useState<StoreProfile | null>(null);
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [qty, setQty] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      writeCurrentStoreHref(`/store/${slug}`);
      setCartCount(readCart().filter((item) => item.store_slug === slug).reduce((sum, item) => sum + item.qty, 0));
      try {
        const nextProfile = await loadStoreBySlug(slug);
        if (!nextProfile) {
          setMessage("Store not found.");
          return;
        }
        const nextProduct = await loadLiveStoreProduct(nextProfile.user_id, productId);
        setProfile(nextProfile);
        setProduct(nextProduct);
        setFavorite(isWishlisted(productId, slug));
        if (!nextProduct) {
          setMessage("This product is not available right now.");
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not load this product.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [productId, slug]);

  function addSelectedToCart(openCheckout = false) {
    if (!profile || !product) {
      return;
    }

    let nextCart = readCart();
    for (let index = 0; index < qty; index += 1) {
      nextCart = addToCart({
        id: product.id,
        user_id: product.user_id,
        store_slug: profile.store_slug,
        name: product.name,
        category: product.category,
        variant_options: product.variant_options,
        price: product.price,
        stock: product.stock,
        image_url: product.image_url,
      });
    }
    setCartCount(nextCart.filter((item) => item.store_slug === profile.store_slug).reduce((sum, item) => sum + item.qty, 0));
    if (openCheckout) {
      router.push(`/checkout?store=${encodeURIComponent(profile.store_slug)}`);
    } else {
      setMessage(`${product.name} added to cart.`);
    }
  }

  function toggleFavoriteState() {
    if (!profile || !product) {
      return;
    }
    toggleWishlist({
      id: product.id,
      user_id: product.user_id,
      store_slug: profile.store_slug,
      name: product.name,
      sku: product.sku,
      category: product.category,
      variant_options: product.variant_options,
      price: product.price,
      stock: product.stock,
      image_url: product.image_url,
    });
    setFavorite((current) => !current);
  }

  const sellerName = profile?.business_name ?? "Store";
  const storeHref = `/store/${slug}`;
  const cartHref = `/cart?store=${encodeURIComponent(slug)}`;
  const facts = product ? getProductFacts(product) : [];

  return (
    <main className="min-h-screen bg-[#f2f6fb]">
      <StoreHeader sellerName={sellerName} storeHref={storeHref} cartHref={cartHref} cartCount={cartCount} searchTerm={searchTerm} onSearchChange={setSearchTerm} whatsappPhone={profile?.whatsapp_phone} />
      <section className="border-b border-slate-200 bg-[linear-gradient(135deg,#fff7ed_0%,#eff6ff_50%,#dcfce7_100%)]">
        <div className="mx-auto max-w-7xl px-5 py-8">
          <Link href={`${storeHref}#products`} className="text-sm font-black text-[#16A34A]">Back to products</Link>
          <h1 className="mt-3 text-4xl font-black text-[#0F172A] sm:text-6xl">Product details</h1>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[1fr_420px]">
        {loading ? (
          <>
            <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-lg">
              <div className="aspect-[4/3] animate-pulse rounded-lg bg-slate-200" />
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="aspect-video animate-pulse rounded-lg bg-slate-200" />
                <div className="aspect-video animate-pulse rounded-lg bg-slate-200" />
                <div className="aspect-video animate-pulse rounded-lg bg-slate-200" />
              </div>
            </div>
            <aside className="h-fit rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-lg lg:sticky lg:top-28">
              <div className="h-8 w-32 animate-pulse rounded-full bg-slate-200" />
              <div className="mt-5 h-10 w-4/5 animate-pulse rounded bg-slate-200" />
              <div className="mt-4 h-4 w-full animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-slate-200" />
              <div className="mt-6 h-12 w-40 animate-pulse rounded bg-slate-200" />
              <div className="mt-8 h-12 w-full animate-pulse rounded-lg bg-slate-200" />
            </aside>
          </>
        ) : !product ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm font-bold text-amber-800">{message}</div>
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-lg">
              <div className="aspect-[4/3] bg-slate-100 bg-cover bg-center" style={product.image_url ? { backgroundImage: `url(${product.image_url})` } : undefined} />
              <div className="grid gap-3 border-t border-slate-100 p-4 sm:grid-cols-3">
                {[product.image_url, product.image_url, product.image_url].map((image, index) => (
                  <div key={`${product.id}-${index}`} className="aspect-video rounded-lg bg-slate-100 bg-cover bg-center" style={image ? { backgroundImage: `url(${image})` } : undefined} />
                ))}
              </div>
            </div>

            <aside className="h-fit rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-lg lg:sticky lg:top-28">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="rounded-full bg-[#DCFCE7] px-3 py-1 text-xs font-black uppercase tracking-wide text-[#166534]">{getCategoryMainLabel(product.category)}</p>
                  <h2 className="mt-4 text-3xl font-black leading-tight text-[#111827]">{product.name}</h2>
                </div>
                <button onClick={toggleFavoriteState} className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#E5E7EB] bg-white shadow-sm ${favorite ? "text-rose-600" : "text-slate-500"}`} aria-label={favorite ? "Remove from wishlist" : "Add to wishlist"}>
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill={favorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
                  </svg>
                </button>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#6B7280]">{getProductShortDescription(product)}</p>
              <p className="mt-5 text-4xl font-black text-[#0F172A]">{formatNaira(product.price)}</p>
              <div className="mt-5 grid gap-2 text-sm font-semibold text-slate-700">
                <p><strong>Seller:</strong> {sellerName}</p>
                <p><strong>Stock:</strong> {product.stock} available</p>
                <p><strong>SKU:</strong> {product.sku}</p>
                <p><strong>Condition:</strong> {facts.find((item) => item.toLowerCase().startsWith("condition:"))?.replace(/^Condition:\s*/i, "") || "New"}</p>
              </div>
              {facts.length ? (
                <div className="mt-5 rounded-lg bg-[#F3F4F6] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Product information</p>
                  <ul className="mt-3 grid gap-2 text-sm font-semibold text-slate-700">
                    {facts.map((fact) => <li key={fact}>{fact}</li>)}
                  </ul>
                </div>
              ) : null}
              <div className="mt-5 flex items-center justify-between rounded-lg border border-[#E5E7EB] p-2">
                <button onClick={() => setQty((current) => Math.max(1, current - 1))} className="grid h-11 w-11 place-items-center rounded-md bg-[#F3F4F6] text-xl font-black">-</button>
                <span className="text-xl font-black">{qty}</span>
                <button onClick={() => setQty((current) => Math.min(product.stock, current + 1))} className="grid h-11 w-11 place-items-center rounded-md bg-[#F3F4F6] text-xl font-black">+</button>
              </div>
              {message ? <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</p> : null}
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button onClick={() => addSelectedToCart(false)} className="flex items-center justify-center gap-2 rounded-lg bg-[#16A34A] px-5 py-3 text-sm font-black text-white transition hover:bg-[#15803D]">
                  <IconGlyph name="cart" className="h-4 w-4" />
                  Add to Cart
                </button>
                <button onClick={() => addSelectedToCart(true)} className="rounded-lg bg-[#0F172A] px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800">Buy Now</button>
              </div>
              <p className="mt-4 text-xs font-semibold leading-5 text-slate-500">Delivery fee is controlled by this seller from their dashboard. Payment is completed securely through Paystack.</p>
            </aside>
          </>
        )}
      </section>
      <PublicFooter sellerName={sellerName} storeHref={storeHref} />
    </main>
  );
}
