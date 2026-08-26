"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CartIconLink, IconGlyph, PublicFooter, SectionTitle, StoreHeader } from "@/components/ui";
import { LoadingScreen } from "@/components/loading-screen";
import { addToCart, readCart, readWishlist, toggleWishlistItem, writeCurrentStoreHref } from "@/lib/cart";
import { formatNaira } from "@/lib/data";
import { supabase } from "@/lib/supabase";

type StoreProfile = {
  user_id: string;
  business_name: string;
  whatsapp_phone: string;
  city: string;
  store_slug: string;
  logo_url: string | null;
  logo_text: string | null;
};

type StoreProduct = {
  id: string;
  user_id: string;
  name: string;
  sku: string;
  category: string;
  variant_options: string | null;
  price: number;
  stock: number;
  status: string;
  image_url: string | null;
};

const STORE_CACHE_PREFIX = "vendoraq-customer-store-cache:";
const STORE_CACHE_TTL = 1000 * 60 * 5;

type StoreCache = {
  profile: StoreProfile;
  products: StoreProduct[];
  savedAt: number;
};

function readStoreCache(slug: string): StoreCache | null {
  try {
    const raw = sessionStorage.getItem(`${STORE_CACHE_PREFIX}${slug}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoreCache;
    if (Date.now() - parsed.savedAt > STORE_CACHE_TTL) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoreCache(slug: string, profile: StoreProfile, products: StoreProduct[]) {
  try {
    sessionStorage.setItem(`${STORE_CACHE_PREFIX}${slug}`, JSON.stringify({ profile, products, savedAt: Date.now() }));
  } catch {
    // Ignore storage limits; the live Supabase fetch still works.
  }
}

function getProductRating(product: StoreProduct) {
  if (product.stock <= 3) {
    return { stars: 5, label: "Selling fast" };
  }
  if (product.stock <= 10) {
    return { stars: 4, label: "Popular pick" };
  }
  if (product.stock <= 25) {
    return { stars: 3, label: "Customer favorite" };
  }
  return { stars: 2, label: "New in store" };
}

export default function DynamicStorefrontPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [profile, setProfile] = useState<StoreProfile | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [cartNotice, setCartNotice] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [heroIndex, setHeroIndex] = useState(0);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  useEffect(() => {
    const cachedStore = readStoreCache(slug);
    let hydrateTimer: number | null = null;
    if (cachedStore) {
      hydrateTimer = window.setTimeout(() => {
        setProfile(cachedStore.profile);
        setProducts(cachedStore.products);
        setLoading(false);
      }, 0);
    }

    async function loadStore() {
      setLoading(!cachedStore);
      const { data: profileData, error: profileError } = await supabase
        .from("seller_profiles")
        .select("user_id,business_name,whatsapp_phone,city,store_slug,logo_url,logo_text")
        .eq("store_slug", slug)
        .maybeSingle();

      if (profileError) {
        setMessage(profileError.message);
        setLoading(false);
        return;
      }

      if (!profileData) {
        setMessage("Store not found. Check the store slug in seller settings.");
        setLoading(false);
        return;
      }

      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("id,user_id,name,sku,category,variant_options,price,stock,status,image_url")
        .eq("user_id", profileData.user_id)
        .eq("status", "Live")
        .order("created_at", { ascending: false });

      if (productError) {
        setMessage(productError.message);
      } else {
        setProfile(profileData);
        setProducts(productData ?? []);
        writeStoreCache(slug, profileData, productData ?? []);
      }
      setLoading(false);
    }

    loadStore();
    writeCurrentStoreHref(`/store/${slug}`);
    function syncCartCount() {
      setCartCount(readCart().filter((item) => item.store_slug === slug).reduce((sum, item) => sum + item.qty, 0));
    }
    function syncWishlist() {
      setFavoriteIds(readWishlist(slug).map((item) => item.id));
    }

    syncCartCount();
    syncWishlist();
    window.addEventListener("sellmate-cart-updated", syncCartCount);
    window.addEventListener("sellmate-wishlist-updated", syncWishlist);
    window.addEventListener("storage", syncCartCount);
    window.addEventListener("storage", syncWishlist);

    return () => {
      if (hydrateTimer !== null) {
        window.clearTimeout(hydrateTimer);
      }
      window.removeEventListener("sellmate-cart-updated", syncCartCount);
      window.removeEventListener("sellmate-wishlist-updated", syncWishlist);
      window.removeEventListener("storage", syncCartCount);
      window.removeEventListener("storage", syncWishlist);
    };
  }, [slug]);

  function handleAddToCart(product: StoreProduct) {
    const nextCart = addToCart({
      id: product.id,
      user_id: product.user_id,
      store_slug: profile?.store_slug || slug,
      name: product.name,
      category: product.category,
      variant_options: product.variant_options,
      price: product.price,
      stock: product.stock,
      image_url: product.image_url,
    });
    setCartCount(nextCart.filter((item) => item.store_slug === (profile?.store_slug || slug)).reduce((sum, item) => sum + item.qty, 0));
    setCartNotice(`${product.name} added to cart`);
    window.setTimeout(() => setCartNotice(""), 2600);
  }

  function toggleFavorite(product: StoreProduct) {
    const nextWishlist = toggleWishlistItem({
      id: product.id,
      user_id: product.user_id,
      store_slug: profile?.store_slug || slug,
      name: product.name,
      category: product.category,
      variant_options: product.variant_options,
      price: product.price,
      stock: product.stock,
      image_url: product.image_url,
    });
    setFavoriteIds(nextWishlist.filter((item) => item.store_slug === (profile?.store_slug || slug)).map((item) => item.id));
  }

  const businessName = profile?.business_name || "Store";
  const brandName = profile?.logo_text || businessName;
  const logoUrl = profile?.logo_url || "";
  const city = profile?.city || "Nigeria";
  const categories = Array.from(new Set(products.map((product) => product.category).filter(Boolean))).slice(0, 8);
  const heroProducts = products.length > 0 ? products.slice(0, 6) : [];
  const featuredProduct = heroProducts[heroIndex % Math.max(heroProducts.length, 1)];
  const lowStockCount = products.filter((product) => product.stock <= 5).length;
  const activeStoreSlug = profile?.store_slug || slug;
  const storeHomeHref = `/store/${activeStoreSlug}`;
  const storeCartHref = `/cart?store=${encodeURIComponent(activeStoreSlug)}`;

  useEffect(() => {
    if (products.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setHeroIndex((current) => (current + 1) % Math.min(products.length, 6));
    }, 5500);

    return () => window.clearInterval(timer);
  }, [products.length]);

  const filteredProducts = products.filter((product) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return true;
    }

    return [product.name, product.category, product.sku, product.variant_options ?? ""].some((value) => value.toLowerCase().includes(query));
  });

  if (loading && !profile) {
    return <LoadingScreen />;
  }

  return (
    <main className="min-h-screen bg-[#f2f6fb] pt-[112px] sm:pt-[116px]">
      <StoreHeader
        sellerName={brandName}
        sellerLogoUrl={logoUrl}
        storeHref={storeHomeHref}
        cartHref={storeCartHref}
        cartCount={cartCount}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        whatsappPhone={profile?.whatsapp_phone}
      />
      <section className="border-b border-slate-200 bg-[linear-gradient(135deg,#fff7ed_0%,#eff6ff_48%,#dcfce7_100%)]">
        <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[220px_1fr_320px] lg:py-8">
          <aside id="categories" className="hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:block">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Categories</p>
            <div className="grid gap-2 text-sm font-bold text-slate-700">
              {(categories.length ? categories : ["Products", "New arrivals", "Best sellers", "Deals"]).map((category) => (
                <a key={category} href="#products" className="rounded-md px-3 py-2 hover:bg-emerald-50 hover:text-emerald-700">{category}</a>
              ))}
            </div>
          </aside>
          <div className="overflow-hidden rounded-lg bg-slate-950 shadow-xl">
            <div className="grid min-h-[280px] gap-5 bg-[radial-gradient(circle_at_80%_20%,rgba(249,115,22,0.45),transparent_24rem),linear-gradient(135deg,#0f172a,#064e3b)] p-6 text-white sm:p-8 lg:grid-cols-[1fr_280px] lg:items-center">
              <div>
                <p className="w-fit rounded-full bg-[#16A34A] px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-white">{city} storefront</p>
                <h1 className="mt-4 max-w-3xl text-4xl font-black capitalize leading-[1.02] sm:text-5xl lg:text-6xl">
                  {businessName} deals and latest products
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-100 sm:text-lg">
                  Search products, compare stock, add to cart, pay securely, then send your receipt to the seller on WhatsApp.
                </p>
                {featuredProduct ? (
                  <div className="mt-4 flex w-fit flex-wrap items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-black ring-1 ring-white/20">
                    <span className="text-orange-200">Now showing</span>
                    <span className="max-w-[220px] truncate text-white">{featuredProduct.name}</span>
                    <span className="text-emerald-200">{formatNaira(featuredProduct.price)}</span>
                  </div>
                ) : null}
                <div className="mt-5 flex flex-wrap gap-3">
                  <a href="#products" className="rounded-md bg-[#16A34A] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#15803D]">Shop now</a>
                  <Link href={storeCartHref} className="rounded-md bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm hover:bg-slate-100">View cart</Link>
                </div>
              </div>
              <div className="rounded-lg bg-white/10 p-3 ring-1 ring-white/20">
                <div className="relative overflow-hidden rounded-md">
                  <div className="aspect-square rounded-md bg-white/10 bg-cover bg-center transition-all duration-700" style={featuredProduct?.image_url ? { backgroundImage: `url(${featuredProduct.image_url})` } : undefined} />
                  <div className="absolute inset-x-3 bottom-3 rounded-md bg-slate-950/75 p-3 text-white backdrop-blur">
                    <p className="truncate text-sm font-black">{featuredProduct?.name || "Fresh products"}</p>
                    <p className="text-xs font-semibold text-emerald-100">{featuredProduct ? formatNaira(featuredProduct.price) : "Ready for customers"}</p>
                  </div>
                </div>
                {heroProducts.length > 1 ? (
                  <div className="mt-3 flex justify-center gap-2">
                    {heroProducts.map((product, index) => (
                      <button
                        key={product.id}
                        onClick={() => setHeroIndex(index)}
                        className={`h-2 rounded-full transition-all ${index === heroIndex % heroProducts.length ? "w-7 bg-orange-400" : "w-2 bg-white/40 hover:bg-white/70"}`}
                        aria-label={`Show ${product.name}`}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <aside className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase text-slate-500">Live products</p><p className="mt-2 text-3xl font-black text-slate-950">{products.length}</p></div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-sm"><p className="text-xs font-bold uppercase text-emerald-700">Cart items</p><p className="mt-2 text-3xl font-black text-slate-950">{cartCount}</p></div>
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 shadow-sm"><p className="text-xs font-bold uppercase text-orange-700">Low stock</p><p className="mt-2 text-3xl font-black text-slate-950">{lowStockCount}</p></div>
          </aside>
        </div>
        <div className="border-t border-slate-200 bg-white/85">
          <div className="mx-auto grid max-w-7xl gap-2 px-5 py-3 text-xs font-black text-slate-700 sm:grid-cols-4">
            <span>✓ Secure Paystack checkout</span><span>✓ Seller-managed delivery</span><span>✓ WhatsApp order receipt</span><span>✓ Real stock count</span>
          </div>
        </div>
      </section>
      <section id="products" className="mx-auto max-w-7xl px-5 py-8 sm:py-12">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-white">Shop</span>
          {(categories.length ? categories : ["All products"]).map((category) => (
            <button key={category} onClick={() => setSearchTerm(category)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 shadow-sm hover:border-emerald-300 hover:text-emerald-700">{category}</button>
          ))}
          {searchTerm ? <button onClick={() => setSearchTerm("")} className="rounded-full px-3 py-1.5 text-xs font-black text-emerald-700">Clear search</button> : null}
        </div>
        <SectionTitle
          eyebrow="Latest deals"
          title="Products you can order now"
          action={<CartIconLink href={storeCartHref} count={cartCount} />}
        />
        {message ? <p className="rounded-md bg-rose-50 p-4 text-sm font-semibold text-rose-700">{message}</p> : null}
        {loading ? <p className="rounded-md bg-slate-200 p-4 text-sm font-semibold text-slate-600">Loading products...</p> : null}
        {!loading && !message && products.length === 0 ? (
          <p className="rounded-md bg-amber-50 p-4 text-sm font-semibold text-amber-800">No live products yet. Add a product in the seller dashboard and set its status to Live.</p>
        ) : null}
        {!loading && !message && products.length > 0 && filteredProducts.length === 0 ? (
          <p className="rounded-md bg-slate-200 p-4 text-sm font-semibold text-slate-600">No products match your search.</p>
        ) : null}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {filteredProducts.map((product) => {
            const rating = getProductRating(product);
            const isFavorite = favoriteIds.includes(product.id);
            return (
              <article key={product.id} className="group flex h-full flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="relative overflow-hidden rounded-t-xl bg-slate-100">
                  <div
                    className="h-36 bg-[linear-gradient(135deg,#f8fafc,#e5e7eb)] bg-cover bg-center transition duration-300 group-hover:scale-[1.02] sm:h-48 lg:h-44 xl:h-48"
                    style={product.image_url ? { backgroundImage: `url(${product.image_url})` } : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => toggleFavorite(product)}
                    aria-label={isFavorite ? "Remove from favourites" : "Add to favourites"}
                    className={`absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-lg bg-white/95 shadow-sm ring-1 ring-[#E5E7EB] transition hover:bg-white ${isFavorite ? "text-rose-600" : "text-slate-600 hover:text-rose-600"}`}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
                    </svg>
                  </button>
                  <span className="absolute bottom-3 left-3 rounded-full bg-[#DCFCE7] px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#166534] sm:text-xs">
                    {product.category}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px] font-black text-[#166534] ring-1 ring-[#E5E7EB]">
                      {"★".repeat(rating.stars)}{"☆".repeat(5 - rating.stars)}
                    </span>
                    <span className="text-[10px] font-bold uppercase text-[#6B7280]">{product.stock} available</span>
                  </div>
                  <h3 className="mt-3 line-clamp-2 text-base font-black leading-tight text-[#111827] sm:text-lg">{product.name}</h3>
                  <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-xs font-semibold leading-5 text-[#6B7280] sm:text-sm">
                    {product.variant_options || `SKU: ${product.sku}`}
                  </p>
                  <p className="mt-2 text-xs font-black text-[#166534]">{rating.label}</p>
                  <p className="mt-4 text-lg font-black text-[#111827] sm:text-xl">{formatNaira(product.price)}</p>
                  <button onClick={() => handleAddToCart(product)} className="mt-auto flex w-full items-center justify-center gap-2 rounded-lg bg-[#16A34A] px-3 py-3 text-xs font-black text-white shadow-sm transition hover:bg-[#15803D] sm:text-sm">
                    <IconGlyph name="cart" className="h-4 w-4" />
                    Add to Cart
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      {cartNotice || cartCount > 0 ? (
        <div className="fixed bottom-5 left-4 right-4 z-50 sellmate-card rounded-lg p-3 shadow-2xl sm:left-auto sm:right-5 sm:w-80">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">
                {cartNotice ? "Cart updated" : "Shopping cart"}
              </p>
              <p className="mt-1 truncate text-sm font-black text-slate-950">
                {cartNotice || `${cartCount} item${cartCount === 1 ? "" : "s"} in cart`}
              </p>
            </div>
            <Link href={storeCartHref} className="shrink-0 rounded-md bg-[#16A34A] px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-[#15803D]">
              View cart
            </Link>
          </div>
        </div>
      ) : null}
      <PublicFooter sellerName={brandName} sellerLogoUrl={logoUrl} storeHref={storeHomeHref} />
    </main>
  );
}











