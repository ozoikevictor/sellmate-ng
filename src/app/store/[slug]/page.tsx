"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { IconGlyph, ProductDetailsModal, PublicFooter, SectionTitle, StoreHeader } from "@/components/ui";
import { LoadingScreen } from "@/components/loading-screen";
import { addToCart, readCart, readWishlist, toggleWishlistItem, updateCartQty, writeCurrentStoreHref } from "@/lib/cart";
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
  image_urls?: string[] | null;
};

type SortOption = "newest" | "price-low" | "price-high" | "low-stock";

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
    return { ...parsed, products: stripProductGalleries(parsed.products) };
  } catch {
    return null;
  }
}

function writeStoreCache(slug: string, profile: StoreProfile, products: StoreProduct[]) {
  try {
    sessionStorage.setItem(`${STORE_CACHE_PREFIX}${slug}`, JSON.stringify({ profile, products: stripProductGalleries(products), savedAt: Date.now() }));
  } catch {
    // Ignore storage limits; the live Supabase fetch still works.
  }
}

function stripProductGalleries(products: StoreProduct[]) {
  return products.map(({ image_urls, ...product }) => product);
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

function sortProducts(products: StoreProduct[], sortBy: SortOption) {
  return [...products].sort((first, second) => {
    if (sortBy === "price-low") return first.price - second.price;
    if (sortBy === "price-high") return second.price - first.price;
    if (sortBy === "low-stock") return first.stock - second.stock;
    return 0;
  });
}

function productBadge(product: StoreProduct) {
  if (product.stock <= 3) return { label: "Low stock", className: "bg-rose-50 text-rose-700 ring-rose-100" };
  if (product.stock <= 10) return { label: "Selling fast", className: "bg-orange-50 text-orange-700 ring-orange-100" };
  return { label: "In stock", className: "bg-emerald-50 text-emerald-700 ring-emerald-100" };
}

function pickHeroProducts(products: StoreProduct[]) {
  const withImages = products.filter((product) => Boolean(product.image_url));
  const withoutImages = products.filter((product) => !product.image_url);
  return [...withImages, ...withoutImages];
}

export default function DynamicStorefrontPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [profile, setProfile] = useState<StoreProfile | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const [cartQtyById, setCartQtyById] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [cartNotice, setCartNotice] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [heroIndex, setHeroIndex] = useState(0);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  useEffect(() => {
    const cachedStore = readStoreCache(slug);
    if (cachedStore) {
      setProfile(cachedStore.profile);
      setProducts(cachedStore.products);
      setLoading(false);
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
      const storeCart = readCart().filter((item) => item.store_slug === slug);
      setCartCount(storeCart.reduce((sum, item) => sum + item.qty, 0));
      setCartQtyById(Object.fromEntries(storeCart.map((item) => [item.id, item.qty])));
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
    setCartQtyById(Object.fromEntries(nextCart.filter((item) => item.store_slug === (profile?.store_slug || slug)).map((item) => [item.id, item.qty])));
    setCartNotice(`${product.name} added to cart`);
    window.setTimeout(() => setCartNotice(""), 2600);
  }

  function handleChangeCartQty(product: StoreProduct, qty: number) {
    const nextCart = updateCartQty(product.id, Math.max(0, Math.min(qty, product.stock)));
    const storeCart = nextCart.filter((item) => item.store_slug === (profile?.store_slug || slug));
    setCartCount(storeCart.reduce((sum, item) => sum + item.qty, 0));
    setCartQtyById(Object.fromEntries(storeCart.map((item) => [item.id, item.qty])));
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

  async function openProductDetails(product: StoreProduct) {
    setSelectedProduct(product);
    const { data } = await supabase.from("products").select("image_urls").eq("id", product.id).maybeSingle();
    const gallery = Array.isArray(data?.image_urls) ? (data.image_urls as string[]) : null;
    if (!gallery?.length) {
      return;
    }
    setSelectedProduct((current) => (current?.id === product.id ? { ...current, image_urls: gallery } : current));
  }

  const businessName = profile?.business_name || "Store";
  const brandName = profile?.logo_text || businessName;
  const logoUrl = profile?.logo_url || "";
  const categories = Array.from(new Set(products.map((product) => product.category).filter(Boolean))).slice(0, 10);
  const heroProducts = pickHeroProducts(products);
  const heroFeature = heroProducts[heroIndex % Math.max(heroProducts.length, 1)] || products[0];
  const featuredProducts = products.slice(0, 6);
  const newArrivalProducts = products.slice(0, 6);
  const activeStoreSlug = profile?.store_slug || slug;
  const storeHomeHref = `/store/${activeStoreSlug}`;
  const storeCartHref = `/cart?store=${encodeURIComponent(activeStoreSlug)}`;

  useEffect(() => {
    if (products.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setHeroIndex((current) => (current + 1) % products.length);
    }, 5500);

    return () => window.clearInterval(timer);
  }, [products.length]);

  const filteredProducts = products.filter((product) => {
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch = !query || [product.name, product.category, product.sku, product.variant_options ?? ""].some((value) => value.toLowerCase().includes(query));
    const matchesCategory = selectedCategory === "All" || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });
  const displayProducts = sortProducts(filteredProducts, sortBy);

  if (loading && !profile) {
    return <LoadingScreen />;
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#F3F6F8] pt-[160px]">
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
      <section className="border-b border-slate-200 bg-[#F3F6F8]">
        <div className="mx-auto grid max-w-7xl gap-3 px-3 py-3 sm:px-5 lg:grid-cols-[13rem_minmax(0,1fr)] lg:py-5">
          <aside className="hidden min-w-0 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200 lg:block">
            <p className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Shop categories</p>
            <nav className="grid min-w-0 gap-1">
              {(categories.length ? categories.slice(0, 8) : ["Products"]).map((category) => (
                <Link
                  key={category}
                  href={`${storeHomeHref}/products${category === "Products" ? "" : `?category=${encodeURIComponent(category)}`}`}
                  className="flex min-w-0 items-center justify-between gap-2 overflow-hidden px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700"
                  title={category}
                >
                  <span className="min-w-0 flex-1 truncate">{category}</span>
                  <span className="shrink-0 text-xs text-slate-400">{products.filter((item) => item.category === category).length || ""}</span>
                </Link>
              ))}
            </nav>
          </aside>
          <div className="grid gap-3">
            <div className="relative overflow-hidden rounded-[1.35rem] border border-emerald-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
              <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${heroIndex % Math.max(heroProducts.length || products.slice(0, 8).length, 1) * 100}%)` }}>
                {(heroProducts.length ? heroProducts : products.slice(0, 8)).map((product, index) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => openProductDetails(product)}
                    className="grid min-h-[205px] min-w-full snap-center grid-cols-[minmax(0,1fr)_46%] items-stretch text-left sm:min-h-[280px] lg:min-h-[370px] lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]"
                  >
                    <span className="flex min-w-0 flex-col justify-between bg-[linear-gradient(135deg,#ECFDF5_0%,#FFFFFF_58%,#F8FAFC_100%)] px-4 py-5 sm:px-8 sm:py-8 lg:pr-6">
                      <span>
                        <span className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-[#047857] sm:text-xs sm:tracking-[0.18em]">{brandName}</span>
                        <span className="mt-2 line-clamp-3 max-w-xl text-[1.45rem] font-black leading-tight text-[#0F172A] sm:text-4xl lg:text-[3.15rem]">{product.name}</span>
                        <span className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[#16A34A] px-4 py-2 text-lg font-black leading-none text-white shadow-sm sm:text-2xl">{formatNaira(product.price)}</span>
                          <span className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-black text-emerald-800">{product.stock} available</span>
                        </span>
                        <span className="mt-3 line-clamp-2 max-w-md text-xs font-semibold leading-5 text-[#475569] sm:text-sm sm:leading-6">{product.category}{product.variant_options ? ` / ${product.variant_options}` : ""}</span>
                        <span className="mt-4 hidden flex-wrap gap-2 lg:flex">
                          <span className="rounded-full bg-slate-950 px-3 py-1.5 text-[11px] font-black text-white">{products.length} live products</span>
                          <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 ring-1 ring-slate-200">Fast cart checkout</span>
                          <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 ring-1 ring-slate-200">Chat to bargain</span>
                        </span>
                        <span className="mt-4 hidden grid-cols-2 gap-2 xl:grid">
                          {(heroProducts.length ? heroProducts : products)
                            .filter((item) => item.id !== product.id)
                            .slice(0, 4)
                            .map((item) => (
                              <span key={item.id} className="flex min-w-0 items-center gap-2 rounded-xl bg-white px-2.5 py-2 shadow-sm ring-1 ring-emerald-100">
                                <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-slate-100">
                                  {item.image_url ? <img src={item.image_url} alt="" className="h-full w-full object-contain" /> : null}
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-[11px] font-black text-slate-950">{item.name}</span>
                                  <span className="block text-[10px] font-black text-[#16A34A]">{formatNaira(item.price)}</span>
                                </span>
                              </span>
                            ))}
                        </span>
                      </span>
                      <span className="mt-3 flex flex-wrap gap-2 sm:gap-3">
                        <span className="rounded-full bg-[#16A34A] px-4 py-2 text-xs font-black text-white shadow-sm sm:px-5 sm:py-3 sm:text-sm">Shop now</span>
                        <span className="rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-xs font-black text-slate-800 sm:px-5 sm:py-3 sm:text-sm">Chat seller</span>
                      </span>
                    </span>
                    <span className="grid min-w-0 place-items-stretch bg-[#DDF7EA] p-2 sm:p-4 lg:p-5">
                      <span className="grid h-full min-h-0 w-full place-items-center overflow-hidden rounded-2xl bg-white p-3 shadow-lg ring-1 ring-emerald-100 sm:p-5 lg:p-6">
                        {product.image_url ? <img src={product.image_url} alt={product.name} decoding="async" loading={index > 0 ? "lazy" : "eager"} className="max-h-full max-w-full object-contain" /> : <IconGlyph name="cart" className="h-10 w-10 text-slate-300" />}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-white/80 px-2 py-1 shadow-sm">
                {(heroProducts.length ? heroProducts : products.slice(0, 8)).slice(0, 8).map((product, index) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setHeroIndex(index)}
                    aria-label={`Show banner ${index + 1}`}
                    className={`h-2 rounded-full transition ${index === heroIndex % Math.max(heroProducts.length || products.slice(0, 8).length, 1) ? "w-6 bg-[#16A34A]" : "w-2 bg-slate-400"}`}
                  />
                ))}
              </div>
            </div>
            <div className="-mx-3 overflow-hidden bg-[#064E3B] p-[3px] shadow-sm sm:mx-0 sm:rounded-xl">
              <div className="flex gap-[3px] overflow-x-auto bg-[#064E3B] pb-0">
              {(heroProducts.length ? heroProducts : products.slice(0, 8)).slice(0, 8).map((product, index) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => {
                    setHeroIndex(index);
                    openProductDetails(product);
                  }}
                  className="flex min-w-[9.5rem] items-center gap-2 bg-white p-2 text-left transition hover:bg-emerald-50"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-white ring-1 ring-slate-100">
                    {product.image_url ? <img src={product.image_url} alt={product.name} loading="lazy" decoding="async" className="h-full w-full bg-white object-contain" /> : <IconGlyph name="cart" className="h-4 w-4 text-slate-400" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-black text-slate-950">{product.name}</span>
                    <span className="block text-[11px] font-black text-[#16A34A]">{formatNaira(product.price)}</span>
                  </span>
                </button>
              ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      <TrustBar />
      <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <SectionTitle eyebrow="Categories" title="Shop by Category" />
          <Link href={`${storeHomeHref}/categories`} className="text-sm font-black text-[#16A34A]">View all</Link>
        </div>
        <CategoryShelf categories={categories} products={products} storeHref={storeHomeHref} />
      </section>
      <ProductShelf title="Featured Products" actionLabel="View all products" actionHref={`${storeHomeHref}/products`} storeHref={storeHomeHref} products={featuredProducts} favoriteIds={favoriteIds} cartQtyById={cartQtyById} onAddToCart={handleAddToCart} onChangeCartQty={handleChangeCartQty} onToggleFavorite={toggleFavorite} onViewDetails={openProductDetails} />
      <ProductShelf title="New Arrivals" storeHref={storeHomeHref} products={newArrivalProducts} favoriteIds={favoriteIds} cartQtyById={cartQtyById} onAddToCart={handleAddToCart} onChangeCartQty={handleChangeCartQty} onToggleFavorite={toggleFavorite} onViewDetails={openProductDetails} />
      <section id="products" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-5 sm:py-12">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-white">Shop</span>
          {["All", ...(categories.length ? categories : ["Products"])].map((category) => (
            <button key={category} onClick={() => setSelectedCategory(category)} className={`rounded-full border px-3 py-1.5 text-xs font-black shadow-sm ${selectedCategory === category ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:text-emerald-700"}`}>{category}</button>
          ))}
          {searchTerm || selectedCategory !== "All" ? <button onClick={() => { setSearchTerm(""); setSelectedCategory("All"); }} className="rounded-full px-3 py-1.5 text-xs font-black text-emerald-700">Clear filters</button> : null}
        </div>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <SectionTitle eyebrow="Marketplace shelf" title="Products you can order now" />
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-bold text-slate-500">{displayProducts.length} of {products.length} product(s){searchTerm ? ` for "${searchTerm}"` : ""}</p>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-700 shadow-sm outline-none focus:border-[#16A34A] focus:ring-4 focus:ring-emerald-100">
              <option value="newest">Newest</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
              <option value="low-stock">Low stock first</option>
            </select>
          </div>
        </div>
        {message ? <p className="rounded-md bg-rose-50 p-4 text-sm font-semibold text-rose-700">{message}</p> : null}
        {loading ? <p className="rounded-md bg-slate-200 p-4 text-sm font-semibold text-slate-600">Loading products...</p> : null}
        {!loading && !message && products.length === 0 ? (
          <p className="rounded-md bg-amber-50 p-4 text-sm font-semibold text-amber-800">No live products yet. Add a product in the seller dashboard and set its status to Live.</p>
        ) : null}
        {!loading && !message && products.length > 0 && displayProducts.length === 0 ? (
          <p className="rounded-md bg-slate-200 p-4 text-sm font-semibold text-slate-600">No products match your search.</p>
        ) : null}
        <ProductGrid storeHref={storeHomeHref} products={displayProducts} favoriteIds={favoriteIds} cartQtyById={cartQtyById} onAddToCart={handleAddToCart} onChangeCartQty={handleChangeCartQty} onToggleFavorite={toggleFavorite} onViewDetails={openProductDetails} />
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
            <Link href={`/checkout?store=${encodeURIComponent(activeStoreSlug)}`} className="shrink-0 rounded-md bg-slate-950 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-slate-800">
              Checkout
            </Link>
          </div>
        </div>
      ) : null}
      {selectedProduct ? (
        <ProductDetailsModal
          product={selectedProduct}
          isFavorite={favoriteIds.includes(selectedProduct.id)}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
          onChangeCartQty={handleChangeCartQty}
          onToggleFavorite={toggleFavorite}
          cartQty={cartQtyById[selectedProduct.id] ?? 0}
          storeSlug={activeStoreSlug}
          sellerName={brandName}
        />
      ) : null}
      <PublicFooter sellerName={brandName} sellerLogoUrl={logoUrl} storeHref={storeHomeHref} />
    </main>
  );
}

function HeroCollage({ products, activeIndex }: { products: StoreProduct[]; activeIndex: number }) {
  if (products.length === 0) {
    return (
      <div className="relative min-h-[120px] rounded-lg bg-white/70 sm:min-h-[190px]">
        <div className="absolute left-2 top-4 h-16 w-16 rounded-lg border border-slate-200 bg-white shadow-sm sm:left-8 sm:top-8 sm:h-24 sm:w-24" />
        <div className="absolute bottom-4 right-2 h-20 w-20 rounded-lg border border-slate-200 bg-white shadow-sm sm:bottom-8 sm:right-8 sm:h-32 sm:w-32" />
      </div>
    );
  }

  const orderedProducts = products.map((_, index) => products[(activeIndex + index) % products.length]).slice(0, 5);
  const slots = [
    "left-[2%] top-[20%] h-14 w-14 sm:left-[6%] sm:top-[18%] sm:h-24 sm:w-24",
    "left-[30%] top-[4%] h-20 w-20 sm:left-[34%] sm:top-[8%] sm:h-36 sm:w-36",
    "right-[2%] top-[30%] h-14 w-14 sm:right-[4%] sm:top-[24%] sm:h-28 sm:w-28",
    "bottom-[7%] left-[18%] hidden h-20 w-24 sm:block",
    "bottom-[10%] right-[18%] hidden h-16 w-24 lg:block",
  ];

  return (
    <div className="relative min-h-[120px] sm:min-h-[220px]">
      <div className="absolute inset-0 rounded-lg bg-white/55" />
      {orderedProducts.map((product, index) => (
        <div key={product.id} className={`absolute ${slots[index]} overflow-hidden rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg`}>
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} loading={index > 1 ? "lazy" : "eager"} className="h-full w-full object-contain" />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function TrustBar() {
  return (
    <section className="border-y border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-2 px-4 py-3 text-xs font-black text-[#0F172A] sm:grid-cols-4 sm:px-5">
        {["Bargain in chat", "Secure payment", "Seller delivery", "Order record"].map((item) => (
          <div key={item} className="rounded-lg border border-emerald-100 bg-[#F7FBF9] px-3 py-2 text-center text-slate-700">{item}</div>
        ))}
      </div>
    </section>
  );
}

function CategoryShelf({ categories, products, storeHref }: { categories: string[]; products: StoreProduct[]; storeHref: string }) {
  if (categories.length === 0) {
    return <p className="rounded-lg border border-slate-200 bg-white p-5 text-sm font-semibold text-[#64748B]">No categories available yet.</p>;
  }

  return (
    <div className="-mx-4 overflow-hidden bg-[#064E3B] p-[3px] shadow-sm sm:mx-0 sm:rounded-xl">
      <div className="flex gap-[3px] overflow-x-auto bg-[#064E3B]">
      {categories.map((category) => {
        const product = products.find((item) => item.category === category && item.image_url) ?? products.find((item) => item.category === category);
        return (
          <Link key={category} href={`${storeHref}/products?category=${encodeURIComponent(category)}`} className="flex min-w-[11rem] items-center gap-3 bg-white p-3 transition hover:bg-emerald-50">
            <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-md bg-white ring-1 ring-slate-100">
              {product?.image_url ? <img src={product.image_url} alt={category} loading="lazy" decoding="async" className="h-full w-full bg-white object-contain" /> : <IconGlyph name="menu" className="h-5 w-5 text-[#16A34A]" />}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black text-[#0F172A]">{category}</span>
              <span className="text-xs font-bold text-[#64748B]">{products.filter((item) => item.category === category).length} items</span>
            </span>
          </Link>
        );
      })}
      </div>
    </div>
  );
}

function ProductShelf({ title, actionLabel, actionHref, storeHref, products, favoriteIds, cartQtyById, onAddToCart, onChangeCartQty, onToggleFavorite, onViewDetails }: { title: string; actionLabel?: string; actionHref?: string; storeHref: string; products: StoreProduct[]; favoriteIds: string[]; cartQtyById: Record<string, number>; onAddToCart: (product: StoreProduct) => void; onChangeCartQty: (product: StoreProduct, qty: number) => void; onToggleFavorite: (product: StoreProduct) => void; onViewDetails: (product: StoreProduct) => void }) {
  if (products.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-5">
      <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <SectionTitle eyebrow="Shop" title={title} />
        {actionHref ? <Link href={actionHref} className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-[#047857] ring-1 ring-emerald-100">{actionLabel ?? "View all"}</Link> : null}
      </div>
      <ProductGrid storeHref={storeHref} products={products} favoriteIds={favoriteIds} cartQtyById={cartQtyById} onAddToCart={onAddToCart} onChangeCartQty={onChangeCartQty} onToggleFavorite={onToggleFavorite} onViewDetails={onViewDetails} />
    </section>
  );
}

function ProductGrid({ storeHref, products, favoriteIds, cartQtyById, onAddToCart, onChangeCartQty, onToggleFavorite, onViewDetails }: { storeHref: string; products: StoreProduct[]; favoriteIds: string[]; cartQtyById: Record<string, number>; onAddToCart: (product: StoreProduct) => void; onChangeCartQty: (product: StoreProduct, qty: number) => void; onToggleFavorite: (product: StoreProduct) => void; onViewDetails: (product: StoreProduct) => void }) {
  return (
    <div className="grid grid-cols-2 items-stretch gap-[3px] overflow-hidden rounded-xl bg-[#047857] p-[3px] shadow-sm sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {products.map((product) => (
        <ProductCard key={product.id} storeHref={storeHref} product={product} isFavorite={favoriteIds.includes(product.id)} cartQty={cartQtyById[product.id] ?? 0} onAddToCart={onAddToCart} onChangeCartQty={onChangeCartQty} onToggleFavorite={onToggleFavorite} onViewDetails={onViewDetails} />
      ))}
    </div>
  );
}

function ProductCard({ product, isFavorite, cartQty, onAddToCart, onChangeCartQty, onToggleFavorite, onViewDetails }: { storeHref: string; product: StoreProduct; isFavorite: boolean; cartQty: number; onAddToCart: (product: StoreProduct) => void; onChangeCartQty: (product: StoreProduct, qty: number) => void; onToggleFavorite: (product: StoreProduct) => void; onViewDetails: (product: StoreProduct) => void }) {
  const rating = getProductRating(product);
  const badge = productBadge(product);

  return (
    <article className="group min-w-0 bg-white p-2 transition hover:z-10 hover:bg-[#FBFFFD] hover:shadow-[0_12px_28px_rgba(15,23,42,0.14)] active:shadow-[0_8px_18px_rgba(15,23,42,0.10)]">
      <div className="relative overflow-hidden rounded-lg bg-[#F8FAFC] ring-1 ring-slate-100">
        <button type="button" onClick={() => onViewDetails(product)} aria-label={`View details for ${product.name}`} className="grid aspect-square w-full place-items-center">
          {product.image_url ? <img src={product.image_url} alt={product.name} loading="lazy" decoding="async" className="h-full w-full bg-white object-cover transition duration-300 group-hover:scale-[1.03]" /> : <span className="text-xs font-bold text-[#64748B]">No image</span>}
        </button>
        <button type="button" onClick={() => onToggleFavorite(product)} aria-label={isFavorite ? "Remove from wishlist" : "Add to wishlist"} className={`absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/95 shadow-sm ring-1 ring-[#E5E7EB] ${isFavorite ? "text-rose-600" : "text-slate-500 hover:text-rose-600"}`}>
          <IconGlyph name="heart" className="h-3.5 w-3.5" />
        </button>
        {badge.label !== "In stock" ? <span className={`absolute bottom-1.5 left-1.5 max-w-[calc(100%-0.75rem)] truncate rounded px-1.5 py-0.5 text-[9px] font-black ring-1 ${badge.className}`}>{badge.label}</span> : null}
      </div>
      <div className="pt-2">
        <button type="button" onClick={() => onViewDetails(product)} className="block text-left">
          <h3 className="line-clamp-2 min-h-[2.3rem] text-[13px] font-semibold leading-[1.15rem] text-[#1F2937] transition hover:text-[#16A34A]">{product.name}</h3>
        </button>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-lg font-black leading-none text-[#0F172A]">{formatNaira(product.price)}</p>
          {cartQty > 0 ? (
            <div className="flex shrink-0 items-center overflow-hidden rounded-full border border-slate-300 bg-white">
              <button type="button" onClick={() => onChangeCartQty(product, cartQty - 1)} className="grid h-7 w-7 place-items-center text-sm font-black text-[#16A34A]">-</button>
              <span className="min-w-5 text-center text-xs font-black text-slate-950">{cartQty}</span>
              <button type="button" onClick={() => onChangeCartQty(product, cartQty + 1)} className="grid h-7 w-7 place-items-center text-sm font-black text-[#16A34A]">+</button>
            </div>
          ) : (
            <button type="button" onClick={() => onAddToCart(product)} aria-label={`Add ${product.name} to cart`} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-950 bg-white text-slate-950 transition hover:border-[#16A34A] hover:text-[#16A34A]">
              <IconGlyph name="cart" className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-[#64748B]">
          <span className="shrink-0 text-black">★ ★ ★ ★ ★</span>
          <span className="truncate">{rating.stars}.0</span>
          <span className="shrink-0">{product.stock} sold</span>
        </div>
        <p className="mt-1 truncate text-[11px] font-semibold text-[#64748B]">{product.category}</p>
      </div>
    </article>
  );
}











