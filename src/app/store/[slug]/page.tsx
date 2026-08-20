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
  const filteredProducts = products.filter((product) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return true;
    }

    return [product.name, product.category, product.sku, product.variant_options ?? ""].some((value) => value.toLowerCase().includes(query));
  });

  if (loading && !profile) {
    return (
      <main className="grid min-h-screen place-items-center bg-[linear-gradient(180deg,#f8fafc_0%,#e2e8f0_42%,#f8fafc_100%)] px-5">
        <div className="rounded-lg border border-slate-300 bg-white/90 p-6 text-center shadow-lg">
          <p className="text-sm font-black text-slate-950">Loading store...</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">Opening the correct seller shop.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#e2e8f0_42%,#f8fafc_100%)] sm:pt-20">
      <header className="relative z-50 border-b border-slate-300 bg-white/95 shadow-sm backdrop-blur sm:fixed sm:inset-x-0 sm:top-0">
        <nav className="mx-auto grid min-h-16 max-w-7xl gap-2 px-4 py-2 sm:min-h-20 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-3 sm:px-5 sm:py-3">
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
            <Link href="/cart" className="relative rounded-md bg-slate-950 px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-emerald-700 sm:px-4 sm:text-sm">
              Cart
              <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs text-slate-950">{cartCount}</span>
            </Link>
          </div>
        </nav>
        {cartNotice ? (
          <div className="absolute right-5 top-[4.2rem] w-[min(22rem,calc(100vw-2.5rem))] rounded-md border border-slate-400 bg-slate-200 p-4 shadow-xl sm:top-[4.9rem]">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Cart updated</p>
            <p className="mt-1 text-sm font-bold text-slate-950">{cartNotice}</p>
            <Link href="/cart" className="mt-3 inline-block rounded-md bg-slate-950 px-4 py-2 text-xs font-black text-white">View cart</Link>
          </div>
        ) : null}
      </header>
      <section className="border-b border-slate-300 bg-[linear-gradient(135deg,#e2e8f0_0%,#f8fafc_48%,#d1fae5_100%)]">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[1fr_0.72fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">{city} storefront</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-black capitalize leading-[1.02] text-slate-950 sm:text-5xl lg:text-6xl">
              {businessName} product shop
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
              Browse available goods, search what you need, add items to cart, and checkout securely with delivery details.
            </p>
            {profile?.whatsapp_phone ? <p className="mt-4 text-sm font-bold text-slate-700">WhatsApp: {profile.whatsapp_phone}</p> : null}
          </div>
          <div className="rounded-lg border border-slate-300 bg-white/95 p-5 shadow-lg">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md bg-slate-100 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Products</p>
                <p className="mt-2 text-3xl font-black text-slate-950">{products.length}</p>
              </div>
              <div className="rounded-md bg-emerald-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Cart</p>
                <p className="mt-2 text-3xl font-black text-slate-950">{cartCount}</p>
              </div>
            </div>
            <Link href="/cart" className="mt-4 block rounded-md bg-slate-950 px-4 py-3 text-center text-sm font-black text-white hover:bg-emerald-700">Open cart</Link>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-12">
        <SectionTitle
          eyebrow="Shop"
          title="Latest products"
          action={<Link href="/cart" className="rounded-md border border-slate-400 bg-slate-200 px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-white">Cart · {cartCount}</Link>}
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
              <article key={product.id} className="group overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-xl">
                <div className="relative bg-slate-200 p-3">
                  <div
                    className="h-36 rounded-md bg-[linear-gradient(135deg,#334155,#94a3b8_55%,#475569)] bg-cover bg-center shadow-inner transition duration-300 group-hover:scale-[1.02] sm:h-52 lg:h-44 xl:h-52"
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
                    <p className="text-base font-black text-emerald-700 sm:text-lg">{formatNaira(product.price)}</p>
                  </div>
                  <button onClick={() => handleAddToCart(product)} className="mt-4 w-full rounded-md bg-slate-950 px-3 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 sm:text-sm">
                    Add to cart
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
          <PublicFooter sellerName={brandName} sellerLogoUrl={logoUrl} storeHref={`/store/${slug}`} />
    </main>
  );
}


