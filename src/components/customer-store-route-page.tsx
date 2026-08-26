"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LoadingScreen } from "@/components/loading-screen";
import { CartIconLink, IconGlyph, PublicFooter, SectionTitle, StoreHeader } from "@/components/ui";
import { addToCart, readCart, writeCurrentStoreHref } from "@/lib/cart";
import { formatNaira } from "@/lib/data";
import { supabase } from "@/lib/supabase";

type CustomerStoreView = "products" | "categories" | "wishlist" | "orders" | "support";

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

type StoreCache = {
  profile: StoreProfile;
  products: StoreProduct[];
  savedAt: number;
};

const STORE_CACHE_PREFIX = "vendoraq-customer-store-cache:";
const STORE_CACHE_TTL = 1000 * 60 * 5;

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

function productRating(product: StoreProduct) {
  if (product.stock <= 3) return { stars: 5, label: "Selling fast" };
  if (product.stock <= 10) return { stars: 4, label: "Popular pick" };
  if (product.stock <= 25) return { stars: 3, label: "Customer favorite" };
  return { stars: 2, label: "New in store" };
}

export function CustomerStoreRoutePage({ view }: { view: CustomerStoreView }) {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const slug = params.slug;
  const [profile, setProfile] = useState<StoreProfile | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [cartNotice, setCartNotice] = useState("");
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") ?? "");
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  useEffect(() => {
    const cachedStore = readStoreCache(slug);
    const shouldLoadProducts = view === "products" || view === "categories";
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
        setMessage("Store not found. Check the store link and try again.");
        setLoading(false);
        return;
      }

      if (!shouldLoadProducts) {
        setProfile(profileData);
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

    syncCartCount();
    window.addEventListener("sellmate-cart-updated", syncCartCount);
    window.addEventListener("storage", syncCartCount);

    return () => {
      if (hydrateTimer !== null) {
        window.clearTimeout(hydrateTimer);
      }
      window.removeEventListener("sellmate-cart-updated", syncCartCount);
      window.removeEventListener("storage", syncCartCount);
    };
  }, [slug, view]);

  const activeStoreSlug = profile?.store_slug || slug;
  const storeHref = `/store/${activeStoreSlug}`;
  const cartHref = `/cart?store=${encodeURIComponent(activeStoreSlug)}`;
  const sellerName = profile?.logo_text || profile?.business_name || "Store";
  const categories = useMemo(() => Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort(), [products]);
  const selectedCategory = searchParams.get("category") ?? "";

  const filteredProducts = products.filter((product) => {
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch = !query || [product.name, product.category, product.sku, product.variant_options ?? ""].some((value) => value.toLowerCase().includes(query));
    const matchesCategory = !selectedCategory || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  function handleAddToCart(product: StoreProduct) {
    const nextCart = addToCart({
      id: product.id,
      user_id: product.user_id,
      store_slug: activeStoreSlug,
      name: product.name,
      category: product.category,
      variant_options: product.variant_options,
      price: product.price,
      stock: product.stock,
      image_url: product.image_url,
    });
    setCartCount(nextCart.filter((item) => item.store_slug === activeStoreSlug).reduce((sum, item) => sum + item.qty, 0));
    setCartNotice(`${product.name} added to cart`);
    window.setTimeout(() => setCartNotice(""), 2400);
  }

  function toggleFavorite(productId: string) {
    setFavoriteIds((current) => (current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId]));
  }

  if (loading && !profile) return <LoadingScreen />;

  return (
    <main className="min-h-screen bg-[#f2f6fb] pt-[112px] sm:pt-[116px]">
      <StoreHeader
        sellerName={sellerName}
        sellerLogoUrl={profile?.logo_url}
        storeHref={storeHref}
        cartHref={cartHref}
        cartCount={cartCount}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        whatsappPhone={profile?.whatsapp_phone}
      />
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">{profile?.city || "Customer store"}</p>
          <h1 className="mt-2 text-3xl font-black capitalize text-slate-950 sm:text-5xl">{pageTitle(view, sellerName)}</h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">{pageDescription(view, sellerName)}</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-8 sm:py-12">
        {message ? <p className="rounded-md bg-rose-50 p-4 text-sm font-semibold text-rose-700">{message}</p> : null}
        {view === "products" ? <ProductsView products={filteredProducts} favoriteIds={favoriteIds} cartHref={cartHref} cartCount={cartCount} onAddToCart={handleAddToCart} onToggleFavorite={toggleFavorite} /> : null}
        {view === "categories" ? <CategoriesView categories={categories} products={products} storeHref={storeHref} /> : null}
        {view === "wishlist" ? <WishlistView products={products.filter((product) => favoriteIds.includes(product.id))} cartHref={cartHref} cartCount={cartCount} onAddToCart={handleAddToCart} onToggleFavorite={toggleFavorite} /> : null}
        {view === "orders" ? <EmptyPanel title="Customer orders" text="Customer order history is not active yet. Use your WhatsApp receipt or contact this seller for an order update." /> : null}
        {view === "support" ? <SupportView sellerName={sellerName} whatsappPhone={profile?.whatsapp_phone} storeHref={storeHref} /> : null}
      </section>

      {cartNotice ? (
        <div className="fixed bottom-5 left-4 right-4 z-50 sellmate-card rounded-lg p-3 shadow-2xl sm:left-auto sm:right-5 sm:w-80">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-black text-slate-950">{cartNotice}</p>
            <Link href={cartHref} className="shrink-0 rounded-md bg-[#16A34A] px-4 py-2 text-xs font-black text-white">View cart</Link>
          </div>
        </div>
      ) : null}
      <PublicFooter sellerName={sellerName} sellerLogoUrl={profile?.logo_url} storeHref={storeHref} />
    </main>
  );
}

function pageTitle(view: CustomerStoreView, sellerName: string) {
  const titles = {
    products: `${sellerName} products`,
    categories: `${sellerName} categories`,
    wishlist: "Wishlist",
    orders: "My orders",
    support: "Contact / Support",
  };
  return titles[view];
}

function pageDescription(view: CustomerStoreView, sellerName: string) {
  const descriptions = {
    products: `Browse live products from ${sellerName}.`,
    categories: `Choose a category and continue shopping inside ${sellerName}.`,
    wishlist: `Saved products for this ${sellerName} shopping session appear here.`,
    orders: `Check customer order details for ${sellerName}.`,
    support: `Contact ${sellerName} for product, delivery, or payment help.`,
  };
  return descriptions[view];
}

function ProductsView({
  products,
  favoriteIds,
  cartHref,
  cartCount,
  onAddToCart,
  onToggleFavorite,
}: {
  products: StoreProduct[];
  favoriteIds: string[];
  cartHref: string;
  cartCount: number;
  onAddToCart: (product: StoreProduct) => void;
  onToggleFavorite: (productId: string) => void;
}) {
  return (
    <>
      <SectionTitle eyebrow="All products" title="Products you can order now" action={<CartIconLink href={cartHref} count={cartCount} />} />
      {products.length === 0 ? <EmptyPanel title="No products found" text="No live products match this view for the current store." /> : null}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {products.map((product) => (
          <ProductTile key={product.id} product={product} isFavorite={favoriteIds.includes(product.id)} onAddToCart={onAddToCart} onToggleFavorite={onToggleFavorite} />
        ))}
      </div>
    </>
  );
}

function ProductTile({ product, isFavorite, onAddToCart, onToggleFavorite }: { product: StoreProduct; isFavorite: boolean; onAddToCart: (product: StoreProduct) => void; onToggleFavorite: (productId: string) => void }) {
  const rating = productRating(product);
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative overflow-hidden rounded-t-xl bg-slate-100">
        <div className="h-36 bg-[linear-gradient(135deg,#f8fafc,#e5e7eb)] bg-cover bg-center sm:h-48 lg:h-44 xl:h-48" style={product.image_url ? { backgroundImage: `url(${product.image_url})` } : undefined} />
        <button type="button" onClick={() => onToggleFavorite(product.id)} aria-label={isFavorite ? "Remove from wishlist" : "Add to wishlist"} className={`absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-lg bg-white/95 shadow-sm ring-1 ring-[#E5E7EB] ${isFavorite ? "text-rose-600" : "text-slate-600 hover:text-rose-600"}`}>
          <IconGlyph name="heart" className="h-4 w-4" />
        </button>
        <span className="absolute bottom-3 left-3 rounded-full bg-[#DCFCE7] px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#166534] sm:text-xs">{product.category}</span>
      </div>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px] font-black text-[#166534] ring-1 ring-[#E5E7EB]">{"★".repeat(rating.stars)}{"☆".repeat(5 - rating.stars)}</span>
          <span className="text-[10px] font-bold uppercase text-[#6B7280]">{product.stock} available</span>
        </div>
        <h3 className="mt-3 line-clamp-2 text-base font-black leading-tight text-[#111827] sm:text-lg">{product.name}</h3>
        <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-xs font-semibold leading-5 text-[#6B7280] sm:text-sm">{product.variant_options || `SKU: ${product.sku}`}</p>
        <p className="mt-2 text-xs font-black text-[#166534]">{rating.label}</p>
        <p className="mt-4 text-lg font-black text-[#111827] sm:text-xl">{formatNaira(product.price)}</p>
        <button type="button" onClick={() => onAddToCart(product)} className="mt-auto flex w-full items-center justify-center gap-2 rounded-lg bg-[#16A34A] px-3 py-3 text-xs font-black text-white shadow-sm transition hover:bg-[#15803D] sm:text-sm">
          <IconGlyph name="cart" className="h-4 w-4" />
          Add to Cart
        </button>
      </div>
    </article>
  );
}

function CategoriesView({ categories, products, storeHref }: { categories: string[]; products: StoreProduct[]; storeHref: string }) {
  if (categories.length === 0) return <EmptyPanel title="No categories yet" text="This seller has not added product categories yet." />;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((category) => (
        <Link key={category} href={`${storeHref}/products?category=${encodeURIComponent(category)}`} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700">
          <p className="text-lg font-black text-slate-950">{category}</p>
          <p className="mt-2 text-sm font-semibold text-slate-500">{products.filter((product) => product.category === category).length} product(s)</p>
        </Link>
      ))}
    </div>
  );
}

function WishlistView(props: { products: StoreProduct[]; cartHref: string; cartCount: number; onAddToCart: (product: StoreProduct) => void; onToggleFavorite: (productId: string) => void }) {
  if (props.products.length === 0) return <EmptyPanel title="No wishlist items yet" text="Tap the heart on a product to save it while shopping this store." />;
  return <ProductsView {...props} favoriteIds={props.products.map((product) => product.id)} />;
}

function SupportView({ sellerName, whatsappPhone, storeHref }: { sellerName: string; whatsappPhone?: string | null; storeHref: string }) {
  const whatsappHref = whatsappPhone ? `https://wa.me/${whatsappPhone.replace(/\D/g, "")}` : "";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-black text-slate-950">Contact {sellerName}</h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">Ask about product size, stock, delivery, payment, or an existing order.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        {whatsappHref ? <a href={whatsappHref} target="_blank" rel="noreferrer" className="rounded-md bg-[#16A34A] px-5 py-3 text-sm font-black text-white">Message on WhatsApp</a> : null}
        <Link href={storeHref} className="rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-800">Back to store</Link>
      </div>
    </div>
  );
}

function EmptyPanel({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-black text-slate-950">{title}</h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{text}</p>
    </div>
  );
}
