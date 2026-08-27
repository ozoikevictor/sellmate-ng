"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SectionTitle, StatCard } from "@/components/ui";
import { useAuth } from "@/components/auth";
import { formatNaira } from "@/lib/data";
import { supabase } from "@/lib/supabase";

type Order = {
  id: string;
  total: number;
  payment_status: string;
  created_at: string;
};

type OrderItem = {
  product_name: string;
  quantity: number;
  line_total: number;
};

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadAnalytics = useCallback(async () => {
    const userId = user?.id;
    if (!userId) {
      return;
    }

    setLoading(true);
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("id,total,payment_status,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (orderError) {
      setMessage(orderError.message);
      setLoading(false);
      return;
    }

    const orderIds = (orderData ?? []).map((order) => order.id);
    if (orderIds.length === 0) {
      setOrders([]);
      setItems([]);
      setLoading(false);
      return;
    }

    const { data: itemData, error: itemError } = await supabase
      .from("order_items")
      .select("product_name,quantity,line_total,order_id")
      .in("order_id", orderIds);

    if (itemError) {
      setMessage(itemError.message);
    } else {
      setOrders(orderData ?? []);
      setItems(itemData ?? []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadAnalytics();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAnalytics]);

  const analytics = useMemo(() => {
    const revenue = orders.reduce((sum, order) => sum + order.total, 0);
    const averageOrder = orders.length > 0 ? Math.round(revenue / orders.length) : 0;
    const paidOrders = orders.filter((order) => order.payment_status === "Paid").length;
    const unpaid = orders.filter((order) => order.payment_status !== "Paid").length;
    const productMap = new Map<string, { quantity: number; revenue: number }>();

    for (const item of items) {
      const current = productMap.get(item.product_name) ?? { quantity: 0, revenue: 0 };
      productMap.set(item.product_name, {
        quantity: current.quantity + item.quantity,
        revenue: current.revenue + item.line_total,
      });
    }

    const topProducts = [...productMap.entries()]
      .map(([name, value]) => ({ name, ...value }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return { revenue, averageOrder, paidOrders, unpaid, topProducts };
  }, [items, orders]);

  return (
    <>
      <SectionTitle eyebrow="Insights" title="Analytics" />
      {message ? <p className="mb-4 rounded-md bg-rose-50 p-4 text-sm font-semibold text-rose-700">{message}</p> : null}

      <section className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-5 bg-[linear-gradient(135deg,#0F172A_0%,#164E63_52%,#16A34A_100%)] p-5 text-white lg:grid-cols-[1fr_320px] lg:items-center lg:p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-100">Business performance</p>
            <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">See what buyers are ordering and where money is coming from.</h2>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-100">
              Track revenue, order volume, average order value, payment status, and the products bringing in the most sales.
            </p>
          </div>
          <div className="rounded-lg border border-white/15 bg-white p-5 text-slate-950 shadow-xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Revenue snapshot</p>
            <p className="mt-2 text-4xl font-black">{loading ? "..." : formatNaira(analytics.revenue)}</p>
            <p className="mt-2 text-sm font-semibold text-slate-500">{analytics.paidOrders} paid order(s), {analytics.unpaid} needing follow-up</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total revenue" value={loading ? "..." : formatNaira(analytics.revenue)} change={`${orders.length} orders`} tone="green" />
        <StatCard label="Orders" value={loading ? "..." : String(orders.length)} change="Storefront" tone="blue" />
        <StatCard label="Average order" value={loading ? "..." : formatNaira(analytics.averageOrder)} change="Per checkout" tone="amber" />
        <StatCard label="Needs follow-up" value={loading ? "..." : String(analytics.unpaid)} change="Not paid yet" tone="red" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="sellmate-card rounded-lg p-6">
          <h2 className="text-lg font-black text-slate-950">Top products</h2>
          <div className="mt-6 grid gap-4">
            {loading ? <p className="text-sm font-semibold text-slate-500">Loading analytics...</p> : null}
            {!loading && analytics.topProducts.length === 0 ? <p className="text-sm font-semibold text-slate-500">No product sales yet.</p> : null}
            {analytics.topProducts.map((product) => {
              const percent = analytics.revenue > 0 ? Math.max(8, Math.round((product.revenue / analytics.revenue) * 100)) : 0;
              return (
                <div key={product.name} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <div className="mb-2 flex justify-between gap-4 text-sm font-bold text-slate-700">
                    <span className="break-words">{product.name} - {product.quantity} sold</span>
                    <span className="shrink-0">{formatNaira(product.revenue)}</span>
                  </div>
                  <div className="h-3 rounded-full bg-white">
                    <div className="h-3 rounded-full bg-emerald-600" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="sellmate-card h-fit rounded-lg p-6">
          <h2 className="text-lg font-black text-slate-950">What to watch</h2>
          <div className="mt-5 grid gap-3 text-sm font-semibold leading-6 text-slate-600">
            <p className="rounded-lg bg-emerald-50 p-4 text-emerald-900">Paid orders show confirmed money from checkout.</p>
            <p className="rounded-lg bg-amber-50 p-4 text-amber-900">Average order value helps you know if buyers are adding enough items.</p>
            <p className="rounded-lg bg-rose-50 p-4 text-rose-900">Follow up unpaid orders before preparing delivery.</p>
          </div>
        </aside>
      </div>
    </>
  );
}
