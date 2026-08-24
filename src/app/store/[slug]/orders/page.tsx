"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PublicFooter, StoreHeader } from "@/components/ui";
import { readCart, writeCurrentStoreHref } from "@/lib/cart";
import { readCustomerOrders, type CustomerOrderRecord } from "@/lib/customer-orders";
import { formatNaira } from "@/lib/data";
import { loadStoreBySlug, type StoreProfile } from "@/lib/storefront";

export default function CustomerOrdersPage() {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<StoreProfile | null>(null);
  const [orders, setOrders] = useState<CustomerOrderRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [cartCount, setCartCount] = useState(0);
  const storeHref = `/store/${slug}`;
  const cartHref = `/cart?store=${encodeURIComponent(slug)}`;

  useEffect(() => {
    async function load() {
      setOrders(readCustomerOrders(slug));
      setCartCount(readCart().filter((item) => item.store_slug === slug).reduce((sum, item) => sum + item.qty, 0));
      writeCurrentStoreHref(storeHref);
      setProfile(await loadStoreBySlug(slug));
    }
    load();
  }, [slug, storeHref]);

  const sellerName = profile?.business_name ?? "Store";

  return (
    <main className="min-h-screen bg-[#f2f6fb]">
      <StoreHeader sellerName={sellerName} storeHref={storeHref} cartHref={cartHref} cartCount={cartCount} searchTerm={searchTerm} onSearchChange={setSearchTerm} whatsappPhone={profile?.whatsapp_phone} />
      <section className="mx-auto max-w-5xl px-5 py-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#16A34A]">My orders</p>
        <h1 className="mt-2 text-4xl font-black text-[#0F172A] sm:text-6xl">Customer order history</h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">Orders shown here are saved on this customer browser for this seller store only.</p>
        <div className="mt-8 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
          {orders.map((order) => (
            <Link key={order.id} href={`${storeHref}/orders/${order.id}`} className="grid gap-3 border-b border-slate-100 p-4 transition hover:bg-[#F3F4F6] sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <div>
                <p className="font-black text-[#111827]">Order {order.id.slice(0, 8).toUpperCase()}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">{order.items.length} item{order.items.length === 1 ? "" : "s"} • {new Date(order.created_at).toLocaleDateString()}</p>
              </div>
              <span className="rounded-full bg-[#DCFCE7] px-3 py-1 text-xs font-black text-[#166534]">{order.payment_status}</span>
              <strong className="text-lg text-[#0F172A]">{formatNaira(order.total)}</strong>
            </Link>
          ))}
          {orders.length === 0 ? <p className="p-5 text-sm font-bold text-slate-600">No order yet. When you checkout from this store, your order will appear here.</p> : null}
        </div>
      </section>
      <PublicFooter sellerName={sellerName} storeHref={storeHref} />
    </main>
  );
}
