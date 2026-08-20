"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PublicFooter, SectionTitle, SellerLogo } from "@/components/ui";
import { CartItem, cartTotal, readCart, readCurrentStoreHref, updateCartQty, writeCurrentStoreHref } from "@/lib/cart";
import { formatNaira } from "@/lib/data";
import { supabase } from "@/lib/supabase";

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [delivery, setDelivery] = useState(0);
  const [sellerName, setSellerName] = useState("Store");
  const [sellerLogoUrl, setSellerLogoUrl] = useState("");
  const [storeHref, setStoreHref] = useState("/store/ada-fashion");
  const subtotal = cartTotal(items);
  const total = items.length > 0 ? subtotal + delivery : 0;
  const itemCount = items.reduce((sum, item) => sum + item.qty, 0);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setMounted(true);
      const cartItems = readCart();
      setItems(cartItems);
      setStoreHref(cartItems[0]?.store_slug ? `/store/${cartItems[0].store_slug}` : readCurrentStoreHref());
      await loadSellerDetails(cartItems, setDelivery, setSellerName, setSellerLogoUrl, setStoreHref);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function changeQty(id: string, qty: number) {
    setItems(updateCartQty(id, qty));
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#e0f2fe_0,#eef5fb_34%,#f8fafc_68%)] pt-20">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-300 bg-slate-200/95 shadow-sm backdrop-blur">
        <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-5">
          <div className="flex min-w-0 items-center gap-3">
            <SellerLogo name={sellerName} logoUrl={sellerLogoUrl} />
            <div className="min-w-0">
              <p className="truncate text-lg font-black capitalize leading-tight text-slate-950 sm:text-2xl">{sellerName}</p>
            <p className="hidden text-xs font-semibold text-slate-500 sm:block">Secure shopping cart</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href={storeHref} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-800 shadow-sm hover:bg-slate-50 sm:px-4 sm:text-sm">Shop products</Link>
            <Link href="/checkout" className="rounded-md bg-slate-950 px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-emerald-700 sm:px-4 sm:text-sm">Checkout</Link>
          </div>
        </nav>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-10">
        <SectionTitle eyebrow="Shopping cart" title="Review your order" action={<Link href={storeHref} className="text-sm font-bold text-emerald-700">Back to store</Link>} />

        {!mounted ? (
          <div className="rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
            <p className="font-bold text-slate-700">Loading cart...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
            <p className="text-xl font-black text-slate-950">Nothing in cart yet.</p>
            <p className="mt-2 text-sm text-slate-500">Your cart is connected to this store. Add products before checkout.</p>
            <Link href={storeHref} className="mt-5 inline-block rounded-md bg-slate-950 px-5 py-3 text-sm font-black text-white">Shop products</Link>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-5">
                <p className="text-sm font-bold text-slate-500">{itemCount} item{itemCount === 1 ? "" : "s"} in cart</p>
              </div>
              <div className="divide-y divide-slate-100">
                {items.map((item) => (
                  <article key={item.id} className="grid gap-4 p-5 sm:grid-cols-[112px_1fr]">
                    <div
                      className="h-28 rounded-md border border-slate-200 bg-slate-200 bg-cover bg-center"
                      style={item.image_url ? { backgroundImage: `url(${item.image_url})` } : undefined}
                    />
                    <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
                      <div>
                        <p className="text-lg font-black text-slate-950">{item.name}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-500">{item.category} · {formatNaira(item.price)} each</p>
                        {item.variant_options ? <p className="mt-1 text-xs font-semibold text-slate-500">{item.variant_options}</p> : null}
                        <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400">{item.stock} available</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 md:justify-end">
                        <div className="flex items-center overflow-hidden rounded-md border border-slate-300 bg-white">
                          <button onClick={() => changeQty(item.id, item.qty - 1)} className="px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-100" aria-label="Reduce quantity">-</button>
                          <span className="min-w-10 border-x border-slate-200 px-3 py-2 text-center text-sm font-black text-slate-950">{item.qty}</span>
                          <button onClick={() => changeQty(item.id, Math.min(item.stock, item.qty + 1))} className="px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-100" aria-label="Increase quantity">+</button>
                        </div>
                        <p className="w-28 text-right text-lg font-black text-slate-950">{formatNaira(item.price * item.qty)}</p>
                        <button onClick={() => changeQty(item.id, 0)} className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">Remove</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <aside className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black text-slate-950">Order summary</h2>
              <div className="mt-5 grid gap-3 text-sm text-slate-600">
                <div className="flex justify-between"><span>Subtotal</span><strong className="text-slate-950">{formatNaira(subtotal)}</strong></div>
                <div className="flex justify-between"><span>Delivery</span><strong className="text-slate-950">{formatNaira(delivery)}</strong></div>
              </div>
              <div className="mt-5 flex justify-between border-t border-slate-200 pt-5 text-xl font-black text-slate-950">
                <span>Total</span>
                <span>{formatNaira(total)}</span>
              </div>
              <Link href="/checkout" className="mt-6 block rounded-md bg-slate-950 px-5 py-3 text-center text-sm font-black text-white hover:bg-slate-800">Continue to checkout</Link>
              <p className="mt-3 text-xs leading-5 text-slate-500">Delivery fee is controlled by the seller from the dashboard settings. Payment is completed securely through Paystack.</p>
            </aside>
          </div>
        )}
      </div>
          <PublicFooter sellerName={sellerName} sellerLogoUrl={sellerLogoUrl} storeHref={storeHref} />
    </main>
  );
}

async function loadSellerDetails(
  items: CartItem[],
  setDelivery: (fee: number) => void,
  setSellerName: (name: string) => void,
  setSellerLogoUrl: (url: string) => void,
  setStoreHref: (href: string) => void,
) {
  const sellerId = items[0]?.user_id;
  if (!sellerId) {
    setDelivery(0);
    setSellerName("Store");
    setSellerLogoUrl("");
    setStoreHref("/store/ada-fashion");
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
  const nextStoreHref = `/store/${data?.store_slug || items[0]?.store_slug || "ada-fashion"}`;
  setStoreHref(nextStoreHref);
  writeCurrentStoreHref(nextStoreHref);
}
