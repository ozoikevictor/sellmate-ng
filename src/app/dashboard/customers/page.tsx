"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, DataTable, SectionTitle, StatCard } from "@/components/ui";
import { useAuth } from "@/components/auth";
import { formatNaira } from "@/lib/data";
import { supabase } from "@/lib/supabase";

type CustomerOrder = {
  customer_name: string;
  customer_phone: string;
  city: string;
  total: number;
  created_at: string;
};

type CustomerSummary = {
  name: string;
  phone: string;
  city: string;
  orders: number;
  spent: number;
  lastOrder: string;
  segment: "VIP" | "Repeat" | "New";
};

export default function CustomersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadCustomers = useCallback(async () => {
    const userId = user?.id;
    if (!userId) {
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("customer_name,customer_phone,city,total,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
    } else {
      setOrders(data ?? []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadCustomers();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadCustomers]);

  const customers = useMemo(() => {
    const map = new Map<string, CustomerSummary>();
    for (const order of orders) {
      const key = order.customer_phone || order.customer_name;
      const current = map.get(key);
      if (current) {
        current.orders += 1;
        current.spent += order.total;
        if (new Date(order.created_at) > new Date(current.lastOrder)) {
          current.name = order.customer_name;
          current.city = order.city;
          current.lastOrder = order.created_at;
        }
      } else {
        map.set(key, {
          name: order.customer_name,
          phone: order.customer_phone,
          city: order.city,
          orders: 1,
          spent: order.total,
          lastOrder: order.created_at,
          segment: "New",
        });
      }
    }

    return [...map.values()]
      .map((customer) => ({
        ...customer,
        segment: customer.spent >= 200000 || customer.orders >= 5 ? "VIP" : customer.orders >= 2 ? "Repeat" : "New",
      }))
      .sort((a, b) => b.spent - a.spent);
  }, [orders]);

  const totalSpend = customers.reduce((sum, customer) => sum + customer.spent, 0);
  const repeatCustomers = customers.filter((customer) => customer.orders >= 2).length;
  const vipCustomers = customers.filter((customer) => customer.segment === "VIP").length;

  return (
    <>
      <SectionTitle eyebrow="CRM" title="Customers" />
      {message ? <p className="mb-4 rounded-md bg-rose-50 p-4 text-sm font-semibold text-rose-700">{message}</p> : null}

      <section className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-5 bg-[linear-gradient(135deg,#F8FAFC_0%,#ECFDF5_60%,#EFF6FF_100%)] p-5 lg:grid-cols-[1fr_320px] lg:items-center lg:p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Customer relationship center</p>
            <h2 className="mt-3 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">Know your buyers, repeat customers, and best spenders.</h2>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
              Customer records are built automatically from orders so sellers can follow up, reward repeat buyers, and understand who is buying most.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-black text-slate-950">Customer segments</p>
            <div className="mt-3 grid gap-2 text-sm font-semibold">
              <div className="flex justify-between rounded-md bg-emerald-50 px-3 py-2 text-emerald-900"><span>VIP buyers</span><strong>{loading ? "..." : vipCustomers}</strong></div>
              <div className="flex justify-between rounded-md bg-sky-50 px-3 py-2 text-sky-900"><span>Repeat buyers</span><strong>{loading ? "..." : repeatCustomers}</strong></div>
              <div className="flex justify-between rounded-md bg-slate-100 px-3 py-2 text-slate-900"><span>Total customers</span><strong>{loading ? "..." : customers.length}</strong></div>
            </div>
          </div>
        </div>
      </section>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Customers" value={loading ? "..." : String(customers.length)} change="From orders" tone="blue" />
        <StatCard label="Repeat customers" value={loading ? "..." : String(repeatCustomers)} change="2+ orders" tone="green" />
        <StatCard label="Customer revenue" value={loading ? "..." : formatNaira(totalSpend)} change="Lifetime" tone="amber" />
      </div>
      <div className="mb-6 grid gap-3 md:hidden">
        {loading ? <p className="rounded-lg border border-slate-200 bg-white p-5 text-center font-semibold text-slate-500">Loading customers...</p> : null}
        {!loading && customers.length === 0 ? <p className="rounded-lg border border-slate-200 bg-white p-5 text-center font-semibold text-slate-500">No customers yet. Customers appear after orders.</p> : null}
        {!loading && customers.map((customer) => (
          <article key={customer.phone || customer.name} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="break-words text-base font-black text-slate-950">{customer.name}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">{customer.phone}</p>
                <p className="mt-1 text-sm text-slate-500">{customer.city}</p>
              </div>
              <Badge tone={customer.segment === "VIP" ? "green" : customer.segment === "Repeat" ? "blue" : "slate"}>{customer.segment}</Badge>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-bold text-slate-600">
              <span className="rounded-md bg-slate-50 p-2"><strong className="block text-sm text-slate-950">{customer.orders}</strong>Orders</span>
              <span className="col-span-2 rounded-md bg-emerald-50 p-2 text-emerald-900"><strong className="block text-sm">{formatNaira(customer.spent)}</strong>Lifetime spend</span>
            </div>
          </article>
        ))}
      </div>
      <div className="hidden md:block">
        <DataTable
          headers={["Customer", "Phone", "City", "Orders", "Lifetime spend", "Last order", "Segment"]}
          rows={
            loading
              ? [["Loading customers...", "", "", "", "", "", ""]]
              : customers.length === 0
                ? [["No customers yet.", "", "", "", "", "", ""]]
                : customers.map((customer) => [
                    <strong key={customer.phone} className="text-slate-950">{customer.name}</strong>,
                    customer.phone,
                    customer.city,
                    customer.orders,
                    formatNaira(customer.spent),
                    new Date(customer.lastOrder).toLocaleDateString(),
                    <Badge key={customer.segment} tone={customer.segment === "VIP" ? "green" : customer.segment === "Repeat" ? "blue" : "slate"}>{customer.segment}</Badge>,
                  ])
          }
        />
      </div>
    </>
  );
}
