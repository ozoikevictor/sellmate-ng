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
    const unpaid = orders.filter((order) => order.payment_status.toLowerCase().includes("unpaid")).length;
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

    return { revenue, averageOrder, unpaid, topProducts };
  }, [items, orders]);

  return (
    <>
      <SectionTitle eyebrow="Insights" title="Analytics" />
      {message ? <p className="mb-4 rounded-md bg-rose-50 p-4 text-sm font-semibold text-rose-700">{message}</p> : null}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total revenue" value={loading ? "..." : formatNaira(analytics.revenue)} change={`${orders.length} orders`} tone="green" />
        <StatCard label="Orders" value={loading ? "..." : String(orders.length)} change="Storefront" tone="blue" />
        <StatCard label="Average order" value={loading ? "..." : formatNaira(analytics.averageOrder)} change="Per checkout" tone="amber" />
        <StatCard label="Unpaid demo orders" value={loading ? "..." : String(analytics.unpaid)} change="Paystack next" tone="red" />
      </div>
      <div className="sellmate-card mt-8 rounded-lg p-6">
        <h2 className="text-lg font-black text-slate-950">Top products</h2>
        <div className="mt-6 grid gap-4">
          {loading ? <p className="text-sm font-semibold text-slate-500">Loading analytics...</p> : null}
          {!loading && analytics.topProducts.length === 0 ? <p className="text-sm font-semibold text-slate-500">No product sales yet.</p> : null}
          {analytics.topProducts.map((product) => {
            const percent = analytics.revenue > 0 ? Math.max(8, Math.round((product.revenue / analytics.revenue) * 100)) : 0;
            return (
              <div key={product.name}>
                <div className="mb-2 flex justify-between gap-4 text-sm font-bold text-slate-700">
                  <span>{product.name} · {product.quantity} sold</span>
                  <span>{formatNaira(product.revenue)}</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100">
                  <div className="h-3 rounded-full bg-emerald-600" style={{ width: `${percent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
