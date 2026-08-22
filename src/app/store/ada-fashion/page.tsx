"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CartIconLink, PublicFooter, SectionTitle, StoreHeader } from "@/components/ui";
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
          {filteredProducts.map((product) => (
            <article key={product.id} className="group sellmate-card overflow-hidden rounded-lg transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-xl">
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
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 sm:text-xs">{product.category}</span>
                    <h3 className="mt-2 line-clamp-2 text-base font-black leading-tight text-slate-950 sm:text-lg">{product.name}</h3>
                    <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:text-xs">{product.sku}</p>
                    {product.variant_options ? <p className="mt-2 line-clamp-2 text-xs font-semibold text-slate-500">{product.variant_options}</p> : null}
                  </div>
                  <p className="text-base font-black text-emerald-700 sm:text-lg">{formatNaira(product.price)}</p>
                </div>
                <button onClick={() => handleAddToCart(product)} className="mt-4 w-full rounded-md bg-slate-950 px-3 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 sm:text-sm">
                  Add to cart
                </button>
              </div>
            </article>
          ))}
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








