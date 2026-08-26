"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckoutHeader, PublicFooter } from "@/components/ui";
import { LoadingScreen } from "@/components/loading-screen";
import { CartItem, cartTotal, readCart, readCurrentStoreHref, updateCartQty, writeCurrentStoreHref } from "@/lib/cart";
import { formatNaira } from "@/lib/data";
import { supabase } from "@/lib/supabase";

function makeStoreSlug(businessName: string, userId: string) {
  const baseSlug = businessName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${baseSlug || "store"}-${userId.slice(0, 6)}`;
}

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [delivery, setDelivery] = useState(0);
  const [sellerName, setSellerName] = useState("Store");
  const [sellerLogoUrl, setSellerLogoUrl] = useState("");
  const [storeHref, setStoreHref] = useState("/");
  const subtotal = cartTotal(items);
  const total = items.length > 0 ? subtotal + delivery : 0;
  const itemCount = items.reduce((sum, item) => sum + item.qty, 0);
  const storeSlug = storeHref.startsWith("/store/") ? storeHref.replace("/store/", "").split(/[?#]/)[0] : "";
  const checkoutHref = storeSlug ? `/checkout?store=${encodeURIComponent(storeSlug)}` : "/checkout";

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const allCartItems = readCart();
      const storeSlugFromUrl = new URLSearchParams(window.location.search).get("store");
      const cartItems = storeSlugFromUrl ? allCartItems.filter((item) => item.store_slug === storeSlugFromUrl) : allCartItems;
      const preferredStoreHref = storeSlugFromUrl ? `/store/${storeSlugFromUrl}` : cartItems[0]?.store_slug ? `/store/${cartItems[0].store_slug}` : readCurrentStoreHref();
      setItems(cartItems);
      setStoreHref(preferredStoreHref);
      await loadSellerDetails(cartItems, setDelivery, setSellerName, setSellerLogoUrl, setStoreHref, preferredStoreHref);
      setMounted(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function changeQty(id: string, qty: number) {
    const updatedItems = updateCartQty(id, qty);
    setItems(storeSlug ? updatedItems.filter((item) => item.store_slug === storeSlug) : updatedItems);
  }

  if (!mounted) {
    return <LoadingScreen />;
  }

  return (
    <main className="min-h-screen bg-[#f2f6fb] pt-[72px]">
      <CheckoutHeader sellerName={sellerName} sellerLogoUrl={sellerLogoUrl} storeHref={storeHref} mode="cart" />

      <section className="border-b border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#e7f8ef_55%,#fff4df_100%)]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_430px] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-700">Shopping cart</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-black leading-tight text-slate-950 sm:text-6xl">Review your order before payment.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">Confirm product quantity, stock, delivery fee, and total before moving to secure Paystack checkout.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
            <div className="grid grid-cols-2 gap-3">
              <CartStat label="Items" value={`${itemCount}`} tone="slate" />
              <CartStat label="Subtotal" value={formatNaira(subtotal)} tone="green" />
              <CartStat label="Delivery" value={formatNaira(items.length > 0 ? delivery : 0)} tone="orange" />
              <CartStat label="Total" value={formatNaira(total)} tone="dark" />
            </div>
          </div>
        </div>
        <div className="border-t border-slate-200 bg-white/70">
          <div className="mx-auto grid max-w-7xl gap-3 px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-600 sm:grid-cols-3 sm:px-6">
            <span>Secure Paystack checkout</span>
            <span>Seller-managed delivery</span>
            <span>WhatsApp receipt follow-up</span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-emerald-300 bg-white p-8 text-center shadow-lg">
            <p className="text-2xl font-black text-slate-950">Nothing in cart yet.</p>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">Your cart is connected to this store. Add products first, then come back here to review your order.</p>
            <Link href={storeHref} className="mt-5 inline-block rounded-md bg-[#16A34A] px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#15803D]">Shop products</Link>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-100 bg-white p-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Order items</p>
                  <p className="mt-1 text-sm font-bold text-slate-500">{itemCount} item{itemCount === 1 ? "" : "s"} in cart</p>
                </div>
                <Link href={storeHref} className="text-sm font-black text-emerald-700 hover:text-emerald-800">Add more</Link>
              </div>
              <div className="divide-y divide-slate-100">
                {items.map((item) => (
                  <article key={item.id} className="grid gap-4 p-5 sm:grid-cols-[128px_1fr]">
                    <div
                      className="aspect-square rounded-lg border border-slate-200 bg-slate-100 bg-cover bg-center shadow-sm"
                      style={item.image_url ? { backgroundImage: `url(${item.image_url})` } : undefined}
                    />
                    <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
                      <div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{item.category}</span>
                        <p className="mt-3 text-2xl font-black text-slate-950">{item.name}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-500">{formatNaira(item.price)} each</p>
                        {item.variant_options ? <p className="mt-1 text-xs font-semibold text-slate-500">{item.variant_options}</p> : null}
                        <p className="mt-2 text-xs font-black uppercase tracking-wide text-emerald-700">{item.stock} available</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 md:justify-end">
                        <div className="flex items-center overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm">
                          <button onClick={() => changeQty(item.id, item.qty - 1)} className="px-3 py-2 text-sm font-black text-slate-700 hover:bg-emerald-50" aria-label="Reduce quantity">-</button>
                          <span className="min-w-10 border-x border-slate-200 px-3 py-2 text-center text-sm font-black text-slate-950">{item.qty}</span>
                          <button onClick={() => changeQty(item.id, Math.min(item.stock, item.qty + 1))} className="px-3 py-2 text-sm font-black text-slate-700 hover:bg-emerald-50" aria-label="Increase quantity">+</button>
                        </div>
                        <p className="w-28 text-right text-xl font-black text-slate-950">{formatNaira(item.price * item.qty)}</p>
                        <button onClick={() => changeQty(item.id, 0)} className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-100">Remove</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <aside className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-lg lg:sticky lg:top-24">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Payment summary</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Order summary</h2>
              <div className="mt-5 grid gap-3 text-sm text-slate-600">
                <div className="flex justify-between"><span>Subtotal</span><strong className="text-slate-950">{formatNaira(subtotal)}</strong></div>
                <div className="flex justify-between"><span>Delivery</span><strong className="text-slate-950">{formatNaira(delivery)}</strong></div>
              </div>
              <div className="mt-5 flex justify-between border-t border-slate-200 pt-5 text-2xl font-black text-slate-950">
                <span>Total</span>
                <span className="text-emerald-700">{formatNaira(total)}</span>
              </div>
              <Link href={checkoutHref} className="mt-6 block rounded-md bg-[#16A34A] px-5 py-3 text-center text-sm font-black text-white shadow-sm transition hover:bg-[#15803D]">Continue to checkout</Link>
              <p className="mt-3 text-xs leading-5 text-slate-500">Delivery fee is controlled by the seller from dashboard settings. Payment is completed securely through Paystack.</p>
            </aside>
          </div>
        )}
      </div>
      <PublicFooter sellerName={sellerName} sellerLogoUrl={sellerLogoUrl} storeHref={storeHref} />
    </main>
  );
}

function CartStat({ label, value, tone }: { label: string; value: string; tone: "slate" | "green" | "orange" | "dark" }) {
  const styles = {
    slate: "bg-slate-100 text-slate-950",
    green: "bg-emerald-50 text-emerald-800",
    orange: "bg-orange-50 text-orange-700",
    dark: "bg-slate-950 text-white",
  };

  return (
    <div className={`rounded-lg p-4 ${styles[tone]}`}>
      <p className="text-xs font-black uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-2 truncate text-2xl font-black">{value}</p>
    </div>
  );
}

async function loadSellerDetails(
  items: CartItem[],
  setDelivery: (fee: number) => void,
  setSellerName: (name: string) => void,
  setSellerLogoUrl: (url: string) => void,
  setStoreHref: (href: string) => void,
  preferredStoreHref: string,
) {
  const sellerId = items[0]?.user_id;
  if (!sellerId) {
    const preferredSlug = preferredStoreHref.startsWith("/store/") ? preferredStoreHref.replace("/store/", "").split(/[?#]/)[0] : "";
    if (preferredSlug === "ada-fashion") {
      setDelivery(0);
      setSellerName("Demo Store");
      setSellerLogoUrl("");
      setStoreHref("/store/ada-fashion");
      writeCurrentStoreHref("/store/ada-fashion");
      return;
    }
    if (preferredSlug) {
      const { data } = await supabase
        .from("seller_profiles")
        .select("business_name,logo_url,logo_text,delivery_fee,store_slug")
        .eq("store_slug", preferredSlug)
        .maybeSingle();

      if (data) {
        const nextStoreHref = `/store/${data.store_slug || preferredSlug}`;
        setDelivery(Number(data.delivery_fee ?? 0));
        setSellerName(data.logo_text || data.business_name || "Store");
        setSellerLogoUrl(data.logo_url || "");
        setStoreHref(nextStoreHref);
        writeCurrentStoreHref(nextStoreHref);
        return;
      }
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const loggedInSellerId = sessionData.session?.user.id;
    if (loggedInSellerId) {
      const { data } = await supabase
        .from("seller_profiles")
        .select("business_name,logo_url,logo_text,delivery_fee,store_slug")
        .eq("user_id", loggedInSellerId)
        .maybeSingle();

      const businessName = data?.business_name || "Your store";
      const nextStoreHref = `/store/${data?.store_slug || makeStoreSlug(businessName, loggedInSellerId)}`;
      setDelivery(Number(data?.delivery_fee ?? 0));
      setSellerName(data?.logo_text || businessName);
      setSellerLogoUrl(data?.logo_url || "");
      setStoreHref(nextStoreHref);
      writeCurrentStoreHref(nextStoreHref);
      return;
    }

    const rememberedStoreHref = readCurrentStoreHref();
    setDelivery(0);
    setSellerName("Store");
    setSellerLogoUrl("");
    setStoreHref(rememberedStoreHref);
    return;
  }

  const { data } = await supabase
    .from("seller_profiles")
    .select("business_name,logo_url,logo_text,delivery_fee,store_slug")
    .eq("user_id", sellerId)
    .maybeSingle();

  setDelivery(Number(data?.delivery_fee ?? 0));
  setSellerName(data?.logo_text || data?.business_name || "Store");
  setSellerLogoUrl(data?.logo_url || "");
  const nextStoreHref = data?.store_slug || items[0]?.store_slug ? `/store/${data?.store_slug || items[0]?.store_slug}` : readCurrentStoreHref();
  setStoreHref(nextStoreHref);
  writeCurrentStoreHref(nextStoreHref);
}

