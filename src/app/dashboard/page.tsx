"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, SectionTitle, StatCard } from "@/components/ui";
import { useAuth } from "@/components/auth";
import { formatNaira } from "@/lib/data";
import { supabase } from "@/lib/supabase";

type DashboardOrder = {
  id: string;
  customer_name: string;
  city: string;
  total: number;
  status: string;
  created_at: string;
};

type DashboardProduct = {
  id: string;
  name: string;
  sku: string;
  stock: number;
  status: string;
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [recentOrders, setRecentOrders] = useState<DashboardOrder[]>([]);
  const [products, setProducts] = useState<DashboardProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadDashboard = useCallback(async () => {
    const userId = user?.id;
    if (!userId) {
      return;
    }

    setLoading(true);
    const [
      { data: orderData, error: orderError },
      { data: recentOrderData, error: recentOrderError },
      { data: productData, error: productError },
    ] = await Promise.all([
      supabase
        .from("orders")
        .select("id,customer_name,city,total,status,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select("id,customer_name,city,total,status,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("products")
        .select("id,name,sku,stock,status")
        .eq("user_id", userId)
        .order("stock", { ascending: true }),
    ]);

    if (orderError || recentOrderError || productError) {
      setMessage(orderError?.message ?? recentOrderError?.message ?? productError?.message ?? "Could not load dashboard.");
    } else {
      setOrders(orderData ?? []);
      setRecentOrders(recentOrderData ?? []);
      setProducts(productData ?? []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadDashboard();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  const summary = useMemo(() => {
    const revenue = orders.reduce((sum, order) => sum + order.total, 0);
    const lowStock = products.filter((product) => product.stock <= 5 || product.status === "Low stock" || product.status === "Sold out");
    return {
      revenue,
      openOrders: orders.filter((order) => order.status !== "Completed").length,
      orderCount: orders.length,
      lowStock,
    };
  }, [orders, products]);

  const displayName = user?.name?.split(" ")[0] || "Seller";

  return (
    <>
      <SectionTitle eyebrow="Seller dashboard" title={`Good morning, ${displayName}`} />
      {message ? <p className="mb-4 rounded-md bg-rose-50 p-4 text-sm font-semibold text-rose-700">{message}</p> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue" value={loading ? "..." : formatNaira(summary.revenue)} change={`${summary.orderCount} orders`} tone="green" />
        <StatCard label="Open orders" value={loading ? "..." : String(summary.openOrders)} change="Needs action" tone="amber" />
        <StatCard label="Products" value={loading ? "..." : String(products.length)} change="Live catalog" tone="blue" />
        <StatCard label="Low stock SKUs" value={loading ? "..." : String(summary.lowStock.length)} change="Restock soon" tone="red" />
      </div>
      <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <DataTable
          headers={["Order", "Customer", "City", "Total", "Status"]}
          rows={
            loading
              ? [["Loading orders...", "", "", "", ""]]
              : recentOrders.length === 0
                ? [["No orders yet.", "", "", "", ""]]
                : recentOrders.map((order) => [
                    order.id.slice(0, 8).toUpperCase(),
                    order.customer_name,
                    order.city,
                    formatNaira(order.total),
                    order.status,
                  ])
          }
        />
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Restock focus</h2>
          <div className="mt-5 grid gap-4">
            {loading ? <p className="text-sm font-semibold text-slate-500">Loading stock...</p> : null}
            {!loading && summary.lowStock.length === 0 ? <p className="text-sm font-semibold text-slate-500">No low stock products.</p> : null}
            {summary.lowStock.map((product) => (
              <div key={product.id} className="flex items-center justify-between rounded-md bg-slate-50 p-4">
                <div>
                  <p className="font-bold text-slate-900">{product.name}</p>
                  <p className="text-sm text-slate-500">{product.sku}</p>
                </div>
                <p className="text-sm font-black text-rose-700">{product.stock} left</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
