"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CartIconLink, IconGlyph, PublicFooter, SectionTitle, StoreHeader } from "@/components/ui";
import { addToCart, readCart, writeCurrentStoreHref } from "@/lib/cart";
import { formatNaira } from "@/lib/data";

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

type StoreProfile = {
  user_id: string;
  business_name: string;
  whatsapp_phone: string;
  city: string;
  store_slug: string;
  logo_url: string | null;
  logo_text: string | null;
};

const demoProfile: StoreProfile = {
  user_id: "demo-store",
  business_name: "Demo Store",
  whatsapp_phone: "",
  city: "Sample",
  store_slug: "ada-fashion",
  logo_url: null,
  logo_text: "Demo Store",
};

export default function StorefrontPage() {
  const [profile] = useState<StoreProfile>(demoProfile);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [cartNotice, setCartNotice] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  useEffect(() => {
    function loadProducts() {
      setLoading(true);
      setProducts([]);
      setMessage("");
      setLoading(false);
    }

    loadProducts();
    writeCurrentStoreHref("/store/ada-fashion");
    const timer = window.setTimeout(() => {
      setCartCount(readCart().filter((item) => item.store_slug === "ada-fashion").reduce((sum, item) => sum + item.qty, 0));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function handleAddToCart(product: StoreProduct) {
    const nextCart = addToCart({
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
    setCartCount(nextCart.filter((item) => item.store_slug === profile.store_slug).reduce((sum, item) => sum + item.qty, 0));
    setCartNotice(`${product.name} added to cart`);
    window.setTimeout(() => setCartNotice(""), 2600);
  }

  function toggleFavorite(productId: string) {
    setFavoriteIds((current) =>
      current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId],
    );
  }

  const businessName = profile.business_name;
  const brandName = profile.logo_text || businessName;
  const logoUrl = profile.logo_url || "";
  const city = profile.city;
  const filteredProducts = products.filter((product) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return true;
    }

    return [product.name, product.category, product.sku, product.variant_options ?? ""].some((value) => value.toLowerCase().includes(query));
  });

  return (
    <main className="min-h-screen sellmate-page-bg sm:pt-20">
      <StoreHeader
        sellerName={brandName}
        sellerLogoUrl={logoUrl}
        storeHref="/store/ada-fashion"
        cartHref="/cart?store=ada-fashion"
        cartCount={cartCount}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        whatsappPhone={profile.whatsapp_phone}
      />
      <section className="border-b border-slate-300 sellmate-hero-bg">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[1fr_0.72fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">{city} storefront</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-black capitalize leading-[1.02] text-slate-950 sm:text-5xl lg:text-6xl">
              {businessName} product shop
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
              Browse available goods, search what you need, add items to cart, and checkout securely with delivery details.
            </p>
            <p className="mt-4 text-sm font-bold text-slate-700">This is a public sample store. Real seller products appear only on that seller&apos;s own store link.</p>
          </div>
          <div className="sellmate-card rounded-lg p-5">
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
            <Link href="/cart?store=ada-fashion" className="mt-4 block rounded-md bg-slate-950 px-4 py-3 text-center text-sm font-black text-white hover:bg-emerald-700">Open cart</Link>
          </div>
        </div>
      </section>
      <section id="products" className="mx-auto max-w-7xl px-5 py-12">
        <SectionTitle
          eyebrow="Shop"
          title="Latest products"
          action={<CartIconLink href="/cart?store=ada-fashion" count={cartCount} />}
        />
        {message ? <p className="rounded-md bg-rose-50 p-4 text-sm font-semibold text-rose-700">{message}</p> : null}
        {loading ? <p className="rounded-md bg-slate-200 p-4 text-sm font-semibold text-slate-600">Loading products...</p> : null}
        {!loading && products.length === 0 ? (
          <p className="rounded-md bg-amber-50 p-4 text-sm font-semibold text-amber-800">No demo products are connected here. Sellers can log in, add products, then share their own store link.</p>
        ) : null}
        {!loading && products.length > 0 && filteredProducts.length === 0 ? (
          <p className="rounded-md bg-slate-200 p-4 text-sm font-semibold text-slate-600">No products match your search.</p>
        ) : null}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {filteredProducts.map((product) => {
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
                    onClick={() => toggleFavorite(product.id)}
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
                  <div className="flex items-center justify-end">
                    <span className="text-[10px] font-bold uppercase text-[#6B7280]">{product.stock} available</span>
                  </div>
                  <h3 className="mt-3 line-clamp-2 text-base font-black leading-tight text-[#111827] sm:text-lg">{product.name}</h3>
                  <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-xs font-semibold leading-5 text-[#6B7280] sm:text-sm">
                    {product.variant_options || `SKU: ${product.sku}`}
                  </p>
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
            <Link href="/cart?store=ada-fashion" className="shrink-0 rounded-md bg-slate-950 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-emerald-700">
              View cart
            </Link>
          </div>
        </div>
      ) : null}
      <PublicFooter sellerName={brandName} sellerLogoUrl={logoUrl} storeHref="/store/ada-fashion" />
    </main>
  );
}








