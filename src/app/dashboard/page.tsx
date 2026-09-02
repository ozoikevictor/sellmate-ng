"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge, MenuIcon } from "@/components/ui";
import { useAuth } from "@/components/auth";
import { formatNaira } from "@/lib/data";
import { supabase } from "@/lib/supabase";

type DashboardOrderItem = {
  product_name: string;
  quantity: number;
  line_total: number;
};

type DashboardOrder = {
  id: string;
  customer_name: string;
  city: string;
  total: number;
  status: string;
  payment_status?: string | null;
  created_at: string;
  order_items?: DashboardOrderItem[];
};

type DashboardProduct = {
  id: string;
  name: string;
  sku: string;
  stock: number;
  status: string;
  price?: number | null;
  category?: string | null;
};

type DashboardProfile = {
  owner_name?: string | null;
  business_name?: string | null;
  logo_text?: string | null;
};

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function DashboardPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [recentOrders, setRecentOrders] = useState<DashboardOrder[]>([]);
  const [products, setProducts] = useState<DashboardProduct[]>([]);
  const [profileName, setProfileName] = useState("");
  const [greeting, setGreeting] = useState("Hello");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadDashboard = useCallback(async () => {
    const userId = user?.id;
    if (!userId) return;

    setLoading(true);
    const [
      { data: orderData, error: orderError },
      { data: recentOrderData, error: recentOrderError },
      { data: productData, error: productError },
      { data: profileData, error: profileError },
    ] = await Promise.all([
      supabase
        .from("orders")
        .select("id,customer_name,city,total,status,payment_status,created_at,order_items(product_name,quantity,line_total)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select("id,customer_name,city,total,status,payment_status,created_at,order_items(product_name,quantity,line_total)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("products")
        .select("id,name,sku,stock,status,price,category")
        .eq("user_id", userId)
        .order("stock", { ascending: true }),
      supabase
        .from("seller_profiles")
        .select("owner_name,business_name,logo_text")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    if (orderError || recentOrderError || productError || profileError) {
      setMessage(orderError?.message ?? recentOrderError?.message ?? productError?.message ?? profileError?.message ?? "Could not load dashboard.");
    } else {
      setOrders((orderData ?? []) as DashboardOrder[]);
      setRecentOrders((recentOrderData ?? []) as DashboardOrder[]);
      setProducts((productData ?? []) as DashboardProduct[]);
      const savedProfile = profileData as DashboardProfile | null;
      setProfileName(savedProfile?.logo_text || savedProfile?.business_name || savedProfile?.owner_name || "");
      setMessage("");
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadDashboard();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  useEffect(() => {
    function updateGreeting() {
      const hour = new Date().getHours();
      if (hour < 12) setGreeting("Good morning");
      else if (hour < 17) setGreeting("Good afternoon");
      else if (hour < 21) setGreeting("Good evening");
      else setGreeting("Good night");
    }

    updateGreeting();
    const interval = window.setInterval(updateGreeting, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const summary = useMemo(() => {
    const revenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const pendingOrders = orders.filter((order) => !["completed", "paid", "delivered"].includes(order.status.toLowerCase())).length;
    const customers = new Set(orders.map((order) => order.customer_name.trim().toLowerCase()).filter(Boolean));
    const lowStock = products.filter((product) => product.stock <= 5 || product.status === "Low stock" || product.status === "Sold out");
    const paidOrders = orders.filter((order) => order.payment_status?.toLowerCase() === "paid" || order.status.toLowerCase() === "paid").length;
    const averageOrder = orders.length ? Math.round(revenue / orders.length) : 0;

    const dailyRevenue = dayLabels.map((label, index) => {
      const matching = orders.filter((order) => new Date(order.created_at).getDay() === ((index + 1) % 7));
      return { label, value: matching.reduce((sum, order) => sum + Number(order.total || 0), 0) };
    });

    const itemMap = new Map<string, { name: string; sold: number; revenue: number }>();
    orders.forEach((order) => {
      order.order_items?.forEach((item) => {
        const current = itemMap.get(item.product_name) ?? { name: item.product_name, sold: 0, revenue: 0 };
        current.sold += Number(item.quantity || 0);
        current.revenue += Number(item.line_total || 0);
        itemMap.set(item.product_name, current);
      });
    });

    const topProducts = Array.from(itemMap.values()).sort((first, second) => second.revenue - first.revenue).slice(0, 5);

    return {
      revenue,
      orderCount: orders.length,
      customerCount: customers.size,
      productCount: products.length,
      pendingOrders,
      lowStock,
      paidOrders,
      averageOrder,
      dailyRevenue,
      topProducts,
    };
  }, [orders, products]);

  const displayName = profileName || user?.business || user?.name || "Seller";
  const maxChartValue = Math.max(...summary.dailyRevenue.map((item) => item.value), 1);
  const liveProducts = products.filter((product) => product.status.toLowerCase() === "live").length;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-6 bg-[radial-gradient(circle_at_top_right,rgba(22,163,74,0.16),transparent_32%),linear-gradient(135deg,#FFFFFF,#F8FAFC)] p-5 sm:p-7 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#16A34A]">Overview</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-black leading-tight text-[#0F172A] sm:text-5xl">
              {greeting}, {displayName}
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-slate-600 sm:text-base">
              Track revenue, orders, customers, products, payments and store activity from your VENDORAQ seller workspace.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/dashboard/products" className="rounded-full bg-[#16A34A] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#15803D]">
                Add product
              </Link>
              <Link href="/dashboard/orders" className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-black text-[#0F172A] shadow-sm transition hover:border-[#16A34A] hover:text-[#16A34A]">
                View orders
              </Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <MiniStatus label="Store status" value="Live" tone="green" />
            <MiniStatus label="Live products" value={loading ? "..." : String(liveProducts)} tone="blue" />
            <MiniStatus label="Paid orders" value={loading ? "..." : String(summary.paidOrders)} tone="green" />
            <MiniStatus label="Low stock" value={loading ? "..." : String(summary.lowStock.length)} tone="red" />
          </div>
        </div>
      </section>

      {message ? <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{message}</p> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <OverviewMetric title="Total Revenue" value={loading ? "..." : formatNaira(summary.revenue)} note={`${summary.orderCount} orders`} icon="billing" />
        <OverviewMetric title="Total Orders" value={loading ? "..." : String(summary.orderCount)} note={`${summary.pendingOrders} pending`} icon="orders" />
        <OverviewMetric title="Total Customers" value={loading ? "..." : String(summary.customerCount)} note="Unique buyers" icon="customers" />
        <OverviewMetric title="Total Products" value={loading ? "..." : String(summary.productCount)} note={`${liveProducts} live`} icon="products" />
        <OverviewMetric title="Pending Orders" value={loading ? "..." : String(summary.pendingOrders)} note="Needs action" icon="inventory" urgent />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#16A34A]">Sales overview</p>
              <h2 className="mt-2 text-xl font-black text-[#0F172A]">Weekly revenue</h2>
            </div>
            <Badge tone="green">{formatNaira(summary.revenue)}</Badge>
          </div>
          <div className="mt-6 flex h-72 items-end gap-3 rounded-2xl bg-[#F8FAFC] p-4">
            {summary.dailyRevenue.map((item) => {
              const height = Math.max((item.value / maxChartValue) * 100, item.value > 0 ? 10 : 4);
              return (
                <div key={item.label} className="flex flex-1 flex-col items-center gap-3">
                  <div className="flex h-52 w-full items-end rounded-full bg-white p-1 ring-1 ring-slate-100">
                    <div className="w-full rounded-full bg-gradient-to-t from-[#16A34A] to-emerald-300 shadow-sm" style={{ height: `${height}%` }} title={formatNaira(item.value)} />
                  </div>
                  <span className="text-xs font-black text-slate-500">{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[1.35rem] border border-slate-200 bg-[#0F172A] p-5 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#16A34A]">Revenue summary</p>
          <h2 className="mt-2 text-2xl font-black">{loading ? "..." : formatNaira(summary.revenue)}</h2>
          <div className="mt-6 grid gap-3">
            <SummaryRow label="Average order" value={formatNaira(summary.averageOrder)} />
            <SummaryRow label="Paid orders" value={String(summary.paidOrders)} />
            <SummaryRow label="Pending orders" value={String(summary.pendingOrders)} />
            <SummaryRow label="Low stock products" value={String(summary.lowStock.length)} />
          </div>
          <Link href="/dashboard/analytics" className="mt-6 block rounded-2xl bg-white px-4 py-3 text-center text-sm font-black text-[#0F172A] transition hover:bg-emerald-50">
            Open analytics
          </Link>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#16A34A]">Store activity</p>
          <h2 className="mt-2 text-xl font-black text-[#0F172A]">What needs attention</h2>
          <div className="mt-5 grid gap-3">
            <ActivityItem title="Pending orders" detail={`${summary.pendingOrders} order(s) waiting for action`} />
            <ActivityItem title="Catalog health" detail={`${liveProducts} live product(s), ${summary.lowStock.length} low stock`} />
            <ActivityItem title="Customers" detail={`${summary.customerCount} unique customer(s) from orders`} />
          </div>
        </div>

        <div className="overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 p-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#16A34A]">Recent orders</p>
              <h2 className="mt-2 text-xl font-black text-[#0F172A]">Latest customer orders</h2>
            </div>
            <Link href="/dashboard/orders" className="text-sm font-black text-[#16A34A]">View all</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#F8FAFC] text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-black">Order</th>
                  <th className="px-5 py-4 font-black">Customer</th>
                  <th className="px-5 py-4 font-black">City</th>
                  <th className="px-5 py-4 font-black">Total</th>
                  <th className="px-5 py-4 font-black">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td className="px-5 py-5 font-bold text-slate-500" colSpan={5}>Loading orders...</td></tr>
                ) : recentOrders.length === 0 ? (
                  <tr><td className="px-5 py-5 font-bold text-slate-500" colSpan={5}>No orders yet.</td></tr>
                ) : (
                  recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-emerald-50/40">
                      <td className="px-5 py-4 font-black text-[#0F172A]">{order.id.slice(0, 8).toUpperCase()}</td>
                      <td className="px-5 py-4 font-bold text-slate-700">{order.customer_name}</td>
                      <td className="px-5 py-4 font-semibold text-slate-500">{order.city || "Not set"}</td>
                      <td className="px-5 py-4 font-black text-[#0F172A]">{formatNaira(order.total)}</td>
                      <td className="px-5 py-4"><Badge tone={order.status.toLowerCase() === "completed" ? "green" : "amber"}>{order.status}</Badge></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#16A34A]">Top selling products</p>
          <h2 className="mt-2 text-xl font-black text-[#0F172A]">Best performers</h2>
          <div className="mt-5 grid gap-3">
            {loading ? <p className="text-sm font-bold text-slate-500">Loading products...</p> : null}
            {!loading && summary.topProducts.length === 0 ? <p className="text-sm font-bold text-slate-500">No product sales yet.</p> : null}
            {summary.topProducts.map((product, index) => (
              <div key={product.name} className="rounded-2xl border border-slate-100 bg-[#F8FAFC] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-black text-[#0F172A]">{index + 1}. {product.name}</p>
                    <p className="text-sm font-semibold text-slate-500">{product.sold} sold</p>
                  </div>
                  <p className="font-black text-[#16A34A]">{formatNaira(product.revenue)}</p>
                </div>
                <div className="mt-3 h-2 rounded-full bg-slate-200">
                  <div className="h-2 rounded-full bg-[#16A34A]" style={{ width: `${Math.min((product.revenue / Math.max(summary.topProducts[0]?.revenue || 1, 1)) * 100, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#16A34A]">Inventory focus</p>
          <h2 className="mt-2 text-xl font-black text-[#0F172A]">Low stock products</h2>
          <div className="mt-5 grid gap-3">
            {loading ? <p className="text-sm font-bold text-slate-500">Loading stock...</p> : null}
            {!loading && summary.lowStock.length === 0 ? <p className="text-sm font-bold text-slate-500">No low stock products.</p> : null}
            {summary.lowStock.slice(0, 5).map((product) => (
              <div key={product.id} className="flex items-center justify-between gap-4 rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
                <div>
                  <p className="font-black text-[#0F172A]">{product.name}</p>
                  <p className="text-sm font-semibold text-slate-500">{product.sku}</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-rose-700 ring-1 ring-rose-200">{product.stock} left</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function OverviewMetric({ title, value, note, icon, urgent = false }: { title: string; value: string; note: string; icon: string; urgent?: boolean }) {
  return (
    <div className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between gap-4">
        <span className={`grid h-11 w-11 place-items-center rounded-2xl ${urgent ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-[#16A34A]"}`}>
          <MenuIcon name={icon} />
        </span>
        <span className={`h-2.5 w-2.5 rounded-full ${urgent ? "bg-rose-500" : "bg-[#16A34A]"}`} />
      </div>
      <p className="mt-5 text-sm font-bold text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-black text-[#0F172A]">{value}</p>
      <p className="mt-2 text-xs font-black uppercase tracking-wide text-slate-400">{note}</p>
    </div>
  );
}

function MiniStatus({ label, value, tone }: { label: string; value: string; tone: "green" | "blue" | "red" }) {
  const toneClass = tone === "green" ? "text-[#16A34A] bg-emerald-50" : tone === "blue" ? "text-sky-700 bg-sky-50" : "text-rose-700 bg-rose-50";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-2xl font-black text-[#0F172A]">{value}</p>
        <span className={`rounded-full px-3 py-1 text-xs font-black ${toneClass}`}>Ready</span>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <span className="text-sm font-bold text-slate-300">{label}</span>
      <span className="text-sm font-black text-white">{value}</span>
    </div>
  );
}

function ActivityItem({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-slate-100 bg-[#F8FAFC] p-4">
      <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-[#16A34A] shadow-[0_0_0_6px_rgba(22,163,74,0.12)]" />
      <div>
        <p className="font-black text-[#0F172A]">{title}</p>
        <p className="mt-1 text-sm font-semibold text-slate-500">{detail}</p>
      </div>
    </div>
  );
}
