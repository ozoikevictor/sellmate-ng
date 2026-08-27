"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LoadingScreen } from "@/components/loading-screen";
import { IconGlyph, ProductDetailsModal, PublicFooter, SectionTitle, StoreHeader } from "@/components/ui";
import { addToCart, CustomerOrder, readCart, readCustomerOrders, readWishlist, toggleWishlistItem, writeCurrentStoreHref } from "@/lib/cart";
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

type SortOption = "newest" | "price-low" | "price-high" | "low-stock";

type StoreCache = {
  profile: StoreProfile;
  products: StoreProduct[];
  savedAt: number;
};

const STORE_CACHE_PREFIX = "vendoraq-customer-store-cache:";
const STORE_CACHE_TTL = 1000 * 60 * 5;
const DEMO_STORE_SLUG = "ada-fashion";

const demoProfile: StoreProfile = {
  user_id: "demo-store",
  business_name: "Demo Store",
  whatsapp_phone: "",
  city: "Sample",
  store_slug: DEMO_STORE_SLUG,
  logo_url: null,
  logo_text: "Demo Store",
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

function productRating(product: StoreProduct) {
  if (product.stock <= 3) return { stars: 5, label: "Selling fast" };
  if (product.stock <= 10) return { stars: 4, label: "Popular pick" };
  if (product.stock <= 25) return { stars: 3, label: "Customer favorite" };
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
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  useEffect(() => {
    const isDemoStore = slug === DEMO_STORE_SLUG;
    const cachedStore = isDemoStore ? null : readStoreCache(slug);
    const savedWishlist = readWishlist(slug);
    const shouldLoadProducts = view === "products" || view === "categories" || (view === "wishlist" && savedWishlist.length > 0);
    let hydrateTimer: number | null = null;
    if (cachedStore) {
      hydrateTimer = window.setTimeout(() => {
        setProfile(cachedStore.profile);
        setProducts(cachedStore.products);
        setLoading(false);
      }, 0);
    }

    async function loadStore() {
      if (isDemoStore) {
        setProfile(demoProfile);
        setProducts([]);
        setMessage("");
        setLoading(false);
        return;
      }

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
    function syncWishlist() {
      setFavoriteIds(readWishlist(slug).map((item) => item.id));
    }
    function syncCustomerOrders() {
      setCustomerOrders(readCustomerOrders(slug));
    }

    syncCartCount();
    syncWishlist();
    syncCustomerOrders();
    window.addEventListener("sellmate-cart-updated", syncCartCount);
    window.addEventListener("sellmate-wishlist-updated", syncWishlist);
    window.addEventListener("sellmate-customer-orders-updated", syncCustomerOrders);
    window.addEventListener("storage", syncCartCount);
    window.addEventListener("storage", syncWishlist);
    window.addEventListener("storage", syncCustomerOrders);

    return () => {
      if (hydrateTimer !== null) {
        window.clearTimeout(hydrateTimer);
      }
      window.removeEventListener("sellmate-cart-updated", syncCartCount);
      window.removeEventListener("sellmate-wishlist-updated", syncWishlist);
      window.removeEventListener("sellmate-customer-orders-updated", syncCustomerOrders);
      window.removeEventListener("storage", syncCartCount);
      window.removeEventListener("storage", syncWishlist);
      window.removeEventListener("storage", syncCustomerOrders);
    };
  }, [slug, view]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchTerm(searchParams.get("q") ?? ""), 0);
    return () => window.clearTimeout(timer);
  }, [searchParams]);

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
  const displayProducts = sortProducts(filteredProducts, sortBy);

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

  function toggleFavorite(product: StoreProduct) {
    const nextWishlist = toggleWishlistItem({
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
    setFavoriteIds(nextWishlist.filter((item) => item.store_slug === activeStoreSlug).map((item) => item.id));
  }

  if (loading && !profile) return <LoadingScreen />;

  return (
    <main className="flex min-h-screen flex-col bg-[#f2f6fb] pt-[176px] sm:pt-[128px]">
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
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-5 sm:py-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">{profile?.city || "Customer store"}</p>
          <h1 className="mt-2 text-3xl font-black capitalize text-slate-950 sm:text-4xl">{pageTitle(view, sellerName)}</h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">{pageDescription(view, sellerName)}</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-5 sm:py-12">
        {message ? <p className="rounded-md bg-rose-50 p-4 text-sm font-semibold text-rose-700">{message}</p> : null}
        {view === "products" ? <ProductsView products={displayProducts} totalProducts={products.length} searchTerm={searchTerm} selectedCategory={selectedCategory} sortBy={sortBy} onSortChange={setSortBy} favoriteIds={favoriteIds} onAddToCart={handleAddToCart} onToggleFavorite={toggleFavorite} onViewDetails={setSelectedProduct} /> : null}
        {view === "categories" ? <CategoriesView categories={categories} products={products} storeHref={storeHref} /> : null}
        {view === "wishlist" ? <WishlistView products={sortProducts(products.filter((product) => favoriteIds.includes(product.id)), sortBy)} totalProducts={favoriteIds.length} searchTerm="" selectedCategory="" sortBy={sortBy} onSortChange={setSortBy} onAddToCart={handleAddToCart} onToggleFavorite={toggleFavorite} onViewDetails={setSelectedProduct} /> : null}
        {view === "orders" ? <OrdersView orders={customerOrders} /> : null}
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
      {selectedProduct ? (
        <ProductDetailsModal
          product={selectedProduct}
          isFavorite={favoriteIds.includes(selectedProduct.id)}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
          onToggleFavorite={toggleFavorite}
        />
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
  totalProducts,
  searchTerm,
  selectedCategory,
  sortBy,
  onSortChange,
  favoriteIds,
  onAddToCart,
  onToggleFavorite,
  onViewDetails,
}: {
  products: StoreProduct[];
  totalProducts: number;
  searchTerm: string;
  selectedCategory: string;
  sortBy: SortOption;
  onSortChange: (value: SortOption) => void;
  favoriteIds: string[];
  onAddToCart: (product: StoreProduct) => void;
  onToggleFavorite: (product: StoreProduct) => void;
  onViewDetails: (product: StoreProduct) => void;
}) {
  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <SectionTitle eyebrow="Marketplace shelf" title="Products you can order now" />
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-bold text-slate-500">{products.length} of {totalProducts} product(s){searchTerm ? ` for "${searchTerm}"` : ""}{selectedCategory ? ` in ${selectedCategory}` : ""}</p>
          <select value={sortBy} onChange={(event) => onSortChange(event.target.value as SortOption)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-700 shadow-sm outline-none focus:border-[#16A34A] focus:ring-4 focus:ring-emerald-100">
            <option value="newest">Newest</option>
            <option value="price-low">Price: low to high</option>
            <option value="price-high">Price: high to low</option>
            <option value="low-stock">Low stock first</option>
          </select>
        </div>
      </div>
      {products.length === 0 ? <EmptyPanel title="No products found" text="No live products match this view for the current store." /> : null}
      <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-[repeat(auto-fill,minmax(170px,200px))] sm:justify-start sm:gap-4">
        {products.map((product) => (
          <ProductTile key={product.id} product={product} isFavorite={favoriteIds.includes(product.id)} onAddToCart={onAddToCart} onToggleFavorite={onToggleFavorite} onViewDetails={onViewDetails} />
        ))}
      </div>
    </>
  );
}

function ProductTile({ product, isFavorite, onAddToCart, onToggleFavorite, onViewDetails }: { product: StoreProduct; isFavorite: boolean; onAddToCart: (product: StoreProduct) => void; onToggleFavorite: (product: StoreProduct) => void; onViewDetails: (product: StoreProduct) => void }) {
  const rating = productRating(product);
  const badge = productBadge(product);
  return (
    <article className="group flex h-[300px] min-w-0 flex-col overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:h-[320px]">
      <div className="relative bg-[#F7F9FC]">
        <button type="button" onClick={() => onViewDetails(product)} aria-label={`View details for ${product.name}`} className="grid aspect-square w-full place-items-center p-2.5 sm:p-3">
          {product.image_url ? <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.03]" /> : <span className="text-xs font-bold text-[#64748B]">No image</span>}
        </button>
        <button type="button" onClick={() => onToggleFavorite(product)} aria-label={isFavorite ? "Remove from wishlist" : "Add to wishlist"} className={`absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white shadow-sm ring-1 ring-[#E5E7EB] ${isFavorite ? "text-rose-600" : "text-slate-500 hover:text-rose-600"}`}>
          <IconGlyph name="heart" className="h-4 w-4" />
        </button>
        <span className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-white/95 px-2 py-1 text-[10px] font-black uppercase text-[#64748B] ring-1 ring-[#E5E7EB]">{product.category}</span>
      </div>
      <div className="flex flex-1 flex-col p-2.5 sm:p-3">
        <button type="button" onClick={() => onViewDetails(product)} className="text-left">
          <h3 className="line-clamp-2 min-h-9 text-[13px] font-bold leading-[18px] text-[#0F172A] transition hover:text-[#16A34A] sm:text-sm">{product.name}</h3>
        </button>
        <p className="mt-1.5 text-[15px] font-black text-[#0F172A] sm:text-base">{formatNaira(product.price)}</p>
        <div className="mt-1.5 text-[11px] font-bold text-[#64748B]">
          <span>★ {rating.stars}.0</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className={`truncate rounded-full px-2 py-1 text-[10px] font-black ring-1 ${badge.className}`}>{badge.label}</span>
          <button type="button" onClick={() => onAddToCart(product)} aria-label={`Add ${product.name} to cart`} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#16A34A] text-white transition hover:bg-[#15803D]">
            <IconGlyph name="cart" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

function CategoriesView({ categories, products, storeHref }: { categories: string[]; products: StoreProduct[]; storeHref: string }) {
  if (categories.length === 0) return <EmptyPanel title="No categories yet" text="This seller has not added product categories yet." />;
  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
      {categories.map((category) => {
        const product = products.find((item) => item.category === category && item.image_url) ?? products.find((item) => item.category === category);
        return (
        <Link key={category} href={`${storeHref}/products?category=${encodeURIComponent(category)}`} className="flex min-w-[13rem] items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700">
          <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-md bg-[#F7F9FC]">
            {product?.image_url ? <img src={product.image_url} alt={category} loading="lazy" className="h-full w-full object-contain p-1" /> : <IconGlyph name="menu" className="h-5 w-5 text-[#16A34A]" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-lg font-black text-slate-950">{category}</span>
            <span className="text-sm font-semibold text-slate-500">{products.filter((item) => item.category === category).length} product(s)</span>
          </span>
        </Link>
        );
      })}
    </div>
  );
}

function WishlistView(props: { products: StoreProduct[]; totalProducts: number; searchTerm: string; selectedCategory: string; sortBy: SortOption; onSortChange: (value: SortOption) => void; onAddToCart: (product: StoreProduct) => void; onToggleFavorite: (product: StoreProduct) => void; onViewDetails: (product: StoreProduct) => void }) {
  if (props.products.length === 0) return <EmptyPanel title="No wishlist items yet" text="Tap the heart on a product to save it while shopping this store." />;
  return <ProductsView {...props} favoriteIds={props.products.map((product) => product.id)} />;
}

function OrdersView({ orders }: { orders: CustomerOrder[] }) {
  if (orders.length === 0) return <EmptyPanel title="No orders yet" text="When you checkout from this store, your order will appear here on this device." />;

  return (
    <div className="grid gap-4">
      {orders.map((order) => (
        <article key={order.orderId} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Order {order.orderId.slice(0, 8)}</p>
              <h2 className="mt-2 text-xl font-black text-slate-950">{formatNaira(order.total)}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">{new Date(order.created_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800 ring-1 ring-emerald-100">{order.status}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">{order.payment_status}</span>
            </div>
          </div>
          <div className="mt-4 grid gap-2 text-sm font-semibold text-slate-600">
            {order.items.map((item) => (
              <p key={`${order.orderId}-${item.id}`} className="flex justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
                <span>{item.name} x {item.qty}</span>
                <span className="font-black text-slate-950">{formatNaira(item.price * item.qty)}</span>
              </p>
            ))}
          </div>
          <p className="mt-4 text-sm font-semibold leading-6 text-slate-500">Delivery: {order.delivery_address}, {order.city}</p>
        </article>
      ))}
    </div>
  );
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
