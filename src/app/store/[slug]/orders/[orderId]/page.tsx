"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PublicFooter, StoreHeader } from "@/components/ui";
import { readCart, writeCurrentStoreHref } from "@/lib/cart";
import { readCustomerOrder, type CustomerOrderRecord } from "@/lib/customer-orders";
import { formatNaira } from "@/lib/data";
import { loadStoreBySlug, type StoreProfile } from "@/lib/storefront";

export default function CustomerOrderDetailsPage() {
  const { slug, orderId } = useParams<{ slug: string; orderId: string }>();
  const [profile, setProfile] = useState<StoreProfile | null>(null);
  const [order, setOrder] = useState<CustomerOrderRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [cartCount, setCartCount] = useState(0);
  const storeHref = `/store/${slug}`;
  const cartHref = `/cart?store=${encodeURIComponent(slug)}`;

  useEffect(() => {
    async function load() {
      setProfile(await loadStoreBySlug(slug));
      setOrder(readCustomerOrder(orderId, slug));
      setCartCount(readCart().filter((item) => item.store_slug === slug).reduce((sum, item) => sum + item.qty, 0));
      writeCurrentStoreHref(storeHref);
    }
    load();
  }, [orderId, slug, storeHref]);

  const sellerName = profile?.business_name ?? "Store";

  return (
    <main className="min-h-screen bg-[#f2f6fb]">
      <StoreHeader sellerName={sellerName} storeHref={storeHref} cartHref={cartHref} cartCount={cartCount} searchTerm={searchTerm} onSearchChange={setSearchTerm} whatsappPhone={profile?.whatsapp_phone} />
      <section className="mx-auto max-w-4xl px-5 py-8">
        <Link href={`${storeHref}/orders`} className="text-sm font-black text-[#16A34A]">Back to my orders</Link>
        <h1 className="mt-3 text-4xl font-black text-[#0F172A] sm:text-6xl">Order details</h1>
        {!order ? (
          <p className="mt-8 rounded-lg bg-white p-5 text-sm font-bold text-slate-600 shadow-sm">This order is not saved on this browser.</p>
        ) : (
          <div className="mt-8 rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <p className="text-sm font-bold text-slate-500">Order number</p>
                <p className="mt-1 text-2xl font-black text-[#111827]">{order.id.slice(0, 8).toUpperCase()}</p>
              </div>
              <span className="rounded-full bg-[#DCFCE7] px-3 py-1 text-xs font-black text-[#166534]">{order.payment_status}</span>
            </div>
            <div className="mt-5 grid gap-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between gap-4 rounded-lg bg-[#F3F4F6] p-4 text-sm font-bold">
                  <span>{item.name} x {item.qty}</span>
                  <span>{formatNaira(item.price * item.qty)}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-2 text-sm font-semibold text-slate-700">
              <p><strong>Name:</strong> {order.customer_name}</p>
              <p><strong>Email:</strong> {order.customer_email}</p>
              <p><strong>Phone:</strong> {order.customer_phone}</p>
              <p><strong>Delivery:</strong> {order.delivery_address}, {order.city}</p>
            </div>
            <div className="mt-5 flex justify-between border-t border-slate-200 pt-5 text-2xl font-black text-[#0F172A]">
              <span>Total</span>
              <span>{formatNaira(order.total)}</span>
            </div>
          </div>
        )}
      </section>
      <PublicFooter sellerName={sellerName} storeHref={storeHref} />
    </main>
  );
}
