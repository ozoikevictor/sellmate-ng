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

  return (
    <>
      <SectionTitle eyebrow="CRM" title="Customers" />
      {message ? <p className="mb-4 rounded-md bg-rose-50 p-4 text-sm font-semibold text-rose-700">{message}</p> : null}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Customers" value={loading ? "..." : String(customers.length)} change="From orders" tone="blue" />
        <StatCard label="Repeat customers" value={loading ? "..." : String(repeatCustomers)} change="2+ orders" tone="green" />
        <StatCard label="Customer revenue" value={loading ? "..." : formatNaira(totalSpend)} change="Lifetime" tone="amber" />
      </div>
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
    </>
  );
}
