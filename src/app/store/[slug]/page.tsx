"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PublicFooter, SectionTitle, SellerLogo } from "@/components/ui";
import { addToCart, readCart, writeCurrentStoreHref } from "@/lib/cart";
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

  useEffect(() => {
    async function loadStore() {
      setLoading(true);
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
      }
      setLoading(false);
    }

    loadStore();
    writeCurrentStoreHref(`/store/${slug}`);
    const timer = window.setTimeout(() => {
      setCartCount(readCart().reduce((sum, item) => sum + item.qty, 0));
    }, 0);
    return () => window.clearTimeout(timer);
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
    setCartCount(nextCart.reduce((sum, item) => sum + item.qty, 0));
    setCartNotice(`${product.name} added to cart`);
    window.setTimeout(() => setCartNotice(""), 2600);
  }

  const businessName = profile?.business_name || "Store";
  const brandName = profile?.logo_text || businessName;
  const logoUrl = profile?.logo_url || "";
  const city = profile?.city || "Nigeria";
  const categories = Array.from(new Set(products.map((product) => product.category).filter(Boolean))).slice(0, 8);
  const featuredProduct = products[0];
  const lowStockCount = products.filter((product) => product.stock <= 5).length;
  const storeCartHref = `/cart?store=${encodeURIComponent(slug)}`;

  const filteredProducts = products.filter((product) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return true;
    }

    return [product.name, product.category, product.sku, product.variant_options ?? ""].some((value) => value.toLowerCase().includes(query));
  });

  if (loading && !profile) {
    return (
      <main className="grid min-h-screen place-items-center sellmate-page-bg px-5">
        <div className="sellmate-card rounded-lg p-6 text-center">
          <p className="text-sm font-black text-slate-950">Loading store...</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">Opening the correct seller shop.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f2f6fb] sm:pt-[116px]">
      <header className="relative z-50 border-b border-slate-200 bg-white shadow-sm sm:fixed sm:inset-x-0 sm:top-0">
        <div className="hidden border-b border-slate-100 bg-slate-950 text-white sm:block">
          <div className="mx-auto flex h-9 max-w-7xl items-center justify-between px-5 text-xs font-bold">
            <span>Secure shopping powered by SellMate NG</span>
            <span>{profile?.whatsapp_phone ? `WhatsApp order support: ${profile.whatsapp_phone}` : "Fast checkout · Paystack payment · Seller delivery"}</span>
          </div>
        </div>
        <nav className="mx-auto grid min-h-16 max-w-7xl gap-2 px-4 py-2 sm:min-h-[76px] sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-4 sm:px-5 sm:py-3">
          <Link href="/" className="flex min-w-0 items-center gap-2 text-base font-black leading-tight text-slate-950 sm:gap-3 sm:text-lg">
            <SellerLogo name={brandName} logoUrl={logoUrl} size="sm" />
            <span className="truncate capitalize">{brandName}</span>
          </Link>
          <div className="order-3 sm:order-none">
            <label className="relative block">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">⌕</span>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search products"
                className="h-10 w-full rounded-md border border-slate-300 bg-slate-100 pl-9 pr-4 text-sm font-semibold text-slate-950 outline-none focus:border-emerald-600 focus:bg-white sm:h-11"
              />
            </label>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2">
            <Link href="/" className="hidden rounded-md px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-950 md:inline">SellMate NG</Link>
            <Link href={storeCartHref} className="relative rounded-md bg-slate-950 px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-emerald-700 sm:px-4 sm:text-sm">
              Cart
              <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs text-slate-950">{cartCount}</span>
            </Link>
          </div>
        </nav>
      </header>
      <section className="border-b border-slate-200 bg-[linear-gradient(135deg,#fff7ed_0%,#eff6ff_48%,#dcfce7_100%)]">
        <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[220px_1fr_320px] lg:py-8">
          <aside className="hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:block">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Categories</p>
            <div className="grid gap-2 text-sm font-bold text-slate-700">
              {(categories.length ? categories : ["Products", "New arrivals", "Best sellers", "Deals"]).map((category) => (
                <a key={category} href="#products" className="rounded-md px-3 py-2 hover:bg-orange-50 hover:text-orange-700">{category}</a>
              ))}
            </div>
          </aside>
          <div className="overflow-hidden rounded-lg bg-slate-950 shadow-xl">
            <div className="grid min-h-[280px] gap-5 bg-[radial-gradient(circle_at_80%_20%,rgba(249,115,22,0.45),transparent_24rem),linear-gradient(135deg,#0f172a,#064e3b)] p-6 text-white sm:p-8 lg:grid-cols-[1fr_280px] lg:items-center">
              <div>
                <p className="w-fit rounded-full bg-orange-500 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-white">{city} storefront</p>
                <h1 className="mt-4 max-w-3xl text-4xl font-black capitalize leading-[1.02] sm:text-5xl lg:text-6xl">
                  {businessName} deals and latest products
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-100 sm:text-lg">
                  Search products, compare stock, add to cart, pay securely, then send your receipt to the seller on WhatsApp.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <a href="#products" className="rounded-md bg-orange-500 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-orange-600">Shop now</a>
                  <Link href={storeCartHref} className="rounded-md bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm hover:bg-slate-100">View cart</Link>
                </div>
              </div>
              <div className="rounded-lg bg-white/10 p-3 ring-1 ring-white/20">
                <div className="aspect-square rounded-md bg-white/10 bg-cover bg-center" style={featuredProduct?.image_url ? { backgroundImage: `url(${featuredProduct.image_url})` } : undefined} />
                <p className="mt-3 truncate text-sm font-black">{featuredProduct?.name || "Fresh products"}</p>
                <p className="text-xs font-semibold text-emerald-100">{featuredProduct ? formatNaira(featuredProduct.price) : "Ready for customers"}</p>
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
            <button key={category} onClick={() => setSearchTerm(category)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 shadow-sm hover:border-orange-300 hover:text-orange-700">{category}</button>
          ))}
          {searchTerm ? <button onClick={() => setSearchTerm("")} className="rounded-full px-3 py-1.5 text-xs font-black text-emerald-700">Clear search</button> : null}
        </div>
        <SectionTitle
          eyebrow="Latest deals"
          title="Products you can order now"
          action={<Link href={storeCartHref} className="rounded-md border border-slate-400 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-orange-50">Cart · {cartCount}</Link>}
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
            return (
              <article key={product.id} className="group overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-orange-300 hover:shadow-xl">
                <div className="relative bg-slate-100 p-2">
                  <div
                    className="h-32 rounded-md bg-[linear-gradient(135deg,#f8fafc,#cbd5e1)] bg-cover bg-center shadow-inner transition duration-300 group-hover:scale-[1.02] sm:h-48 lg:h-44 xl:h-48"
                    style={product.image_url ? { backgroundImage: `url(${product.image_url})` } : undefined}
                  />
                  <span className={`absolute right-5 top-5 rounded-full px-2 py-1 text-[10px] font-black shadow-sm sm:px-3 sm:text-xs ${product.stock <= 3 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                    {product.stock} left
                  </span>
                </div>
                <div className="p-3 sm:p-4">
                  <div className="grid gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 sm:text-xs">{product.category}</span>
                        <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700 ring-1 ring-amber-100">
                          {"★".repeat(rating.stars)}{"☆".repeat(5 - rating.stars)}
                        </span>
                      </div>
                      <h3 className="mt-2 line-clamp-2 text-base font-black leading-tight text-slate-950 sm:text-lg">{product.name}</h3>
                      <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:text-xs">{product.sku}</p>
                      <p className="mt-2 text-xs font-black text-emerald-700">{rating.label}</p>
                      {product.variant_options ? <p className="mt-2 line-clamp-2 text-xs font-semibold text-slate-500">{product.variant_options}</p> : null}
                    </div>
                    <div className="flex items-end justify-between gap-2"><p className="text-lg font-black text-orange-600 sm:text-xl">{formatNaira(product.price)}</p><span className="text-[10px] font-bold uppercase text-slate-400">In stock</span></div>
                  </div>
                  <button onClick={() => handleAddToCart(product)} className="mt-4 w-full rounded-md bg-orange-500 px-3 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-orange-600 sm:text-sm">
                    Add to cart
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
            <Link href={storeCartHref} className="shrink-0 rounded-md bg-orange-500 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-orange-600">
              View cart
            </Link>
          </div>
        </div>
      ) : null}
      <PublicFooter sellerName={brandName} sellerLogoUrl={logoUrl} storeHref={`/store/${slug}`} />
    </main>
  );
}




