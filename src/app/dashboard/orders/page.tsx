"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, SectionTitle, StatCard } from "@/components/ui";
import { useAuth } from "@/components/auth";
import { formatNaira } from "@/lib/data";
import { supabase } from "@/lib/supabase";

type OrderItem = {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type Order = {
  id: string;
  customer_name: string;
  customer_phone: string;
  city: string;
  delivery_address: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  status: string;
  payment_status: string;
  created_at: string;
  order_items?: OrderItem[];
};

const orderStatuses = ["New", "Confirmed", "Packing", "Dispatched", "Delivered", "Cancelled"];
const paymentStatuses = ["Pending", "Paid", "Failed", "Refunded"];

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");

  const loadOrders = useCallback(async () => {
    const userId = user?.id;
    if (!userId) {
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("id,customer_name,customer_phone,city,delivery_address,subtotal,delivery_fee,total,status,payment_status,created_at,order_items(id,product_name,quantity,unit_price,line_total)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
    } else {
      setOrders((data ?? []) as Order[]);
      setMessage("");
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadOrders();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadOrders]);

  const stats = useMemo(() => {
    const openOrders = orders.filter((order) => !["Delivered", "Cancelled"].includes(order.status));
    const pendingPayment = orders.filter((order) => order.payment_status === "Pending");
    const paidTotal = orders.filter((order) => order.payment_status === "Paid").reduce((sum, order) => sum + order.total, 0);

    return [
      { label: "Open orders", value: String(openOrders.length), change: "Needs action", tone: openOrders.length > 0 ? "amber" : "green" },
      { label: "Pending payment", value: String(pendingPayment.length), change: "Follow up", tone: pendingPayment.length > 0 ? "red" : "green" },
      { label: "Paid revenue", value: formatNaira(paidTotal), change: "Confirmed", tone: "green" },
    ];
  }, [orders]);

  async function updateOrder(orderId: string, field: "status" | "payment_status", value: string) {
    setSavingId(`${orderId}-${field}`);
    setMessage("");

    const { error } = await supabase.from("orders").update({ [field]: value }).eq("id", orderId).eq("user_id", user?.id);
    if (error) {
      setMessage(error.message);
    } else {
      setOrders((current) => current.map((order) => (order.id === orderId ? { ...order, [field]: value } : order)));
    }

    setSavingId("");
  }

  return (
    <>
      <SectionTitle eyebrow="Fulfilment" title="Orders" />
      {message ? <p className="mb-4 rounded-md bg-rose-50 p-4 text-sm font-semibold text-rose-700">{message}</p> : null}

      <section className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-5 bg-[linear-gradient(135deg,#F8FAFC_0%,#ECFDF5_62%,#FFF7ED_100%)] p-5 lg:grid-cols-[1fr_320px] lg:items-center lg:p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Order control center</p>
            <h2 className="mt-3 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">Track every customer order from payment to delivery.</h2>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
              Use the status controls to confirm payment, prepare items, dispatch delivery, and keep the customer order record up to date.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-black text-slate-950">Today focus</p>
            <div className="mt-3 grid gap-2 text-sm font-semibold text-slate-600">
              <div className="flex justify-between rounded-md bg-amber-50 px-3 py-2 text-amber-900"><span>Open orders</span><strong>{stats[0].value}</strong></div>
              <div className="flex justify-between rounded-md bg-rose-50 px-3 py-2 text-rose-900"><span>Pending payment</span><strong>{stats[1].value}</strong></div>
              <div className="flex justify-between rounded-md bg-emerald-50 px-3 py-2 text-emerald-900"><span>Paid revenue</span><strong>{stats[2].value}</strong></div>
            </div>
          </div>
        </div>
      </section>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </div>

      {loading ? (
        <div className="sellmate-card rounded-lg p-8 text-center">
          <p className="font-bold text-slate-600">Loading orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="sellmate-card rounded-lg p-8 text-center">
          <p className="font-bold text-slate-700">No orders yet.</p>
          <p className="mt-2 text-sm text-slate-500">Orders will appear here after customers checkout from your store.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => (
            <article key={order.id} className="sellmate-card overflow-hidden rounded-lg">
              <div className="flex flex-col gap-4 border-b border-slate-100 bg-white p-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Order {order.id.slice(0, 8).toUpperCase()}</p>
                  <h2 className="mt-2 text-xl font-black text-slate-950">{order.customer_name}</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-600">{order.customer_phone} - {order.city}</p>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{order.delivery_address}</p>
                </div>
                <div className="grid gap-2 text-left lg:text-right">
                  <p className="text-2xl font-black text-slate-950">{formatNaira(order.total)}</p>
                  <p className="text-xs font-semibold text-slate-500">{new Date(order.created_at).toLocaleString()}</p>
                  <div className="flex gap-2 lg:justify-end">
                    <Badge tone={orderTone(order.status)}>{order.status}</Badge>
                    <Badge tone={order.payment_status === "Paid" ? "green" : "amber"}>{order.payment_status}</Badge>
                  </div>
                </div>
              </div>

              <div className="grid gap-5 p-5 lg:grid-cols-[1fr_300px]">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-black text-slate-950">Items ordered</h3>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{order.order_items?.length ?? 0} line(s)</span>
                  </div>
                  <div className="mt-3 divide-y divide-slate-100 rounded-md border border-slate-100">
                    {(order.order_items ?? []).length === 0 ? (
                      <p className="p-4 text-sm font-semibold text-slate-500">No item details saved for this order.</p>
                    ) : (
                      order.order_items?.map((item) => (
                        <div key={item.id} className="grid gap-2 p-4 text-sm text-slate-600 sm:grid-cols-[1fr_auto]">
                          <div>
                            <p className="font-bold text-slate-950">{item.product_name}</p>
                            <p>{item.quantity} x {formatNaira(item.unit_price)}</p>
                          </div>
                          <p className="font-black text-slate-950">{formatNaira(item.line_total)}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-black text-slate-950">Manage order</h3>
                  <label className="mt-4 grid gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Order status
                    <select
                      value={order.status}
                      disabled={savingId === `${order.id}-status`}
                      onChange={(event) => updateOrder(order.id, "status", event.target.value)}
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold normal-case tracking-normal text-slate-700 outline-none focus:border-emerald-600"
                    >
                      {orderStatuses.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </label>
                  <label className="mt-4 grid gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Payment
                    <select
                      value={order.payment_status}
                      disabled={savingId === `${order.id}-payment_status`}
                      onChange={(event) => updateOrder(order.id, "payment_status", event.target.value)}
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold normal-case tracking-normal text-slate-700 outline-none focus:border-emerald-600"
                    >
                      {paymentStatuses.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </label>
                  <div className="mt-4 rounded-md bg-white p-3 text-sm text-slate-600 ring-1 ring-slate-200">
                    <div className="flex justify-between"><span>Subtotal</span><strong className="text-slate-950">{formatNaira(order.subtotal)}</strong></div>
                    <div className="mt-2 flex justify-between"><span>Delivery</span><strong className="text-slate-950">{formatNaira(order.delivery_fee)}</strong></div>
                    <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-base font-black text-slate-950"><span>Total</span><strong>{formatNaira(order.total)}</strong></div>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function orderTone(status: string) {
  if (status === "Cancelled") {
    return "red";
  }
  if (["New", "Confirmed", "Packing"].includes(status)) {
    return "amber";
  }
  return "green";
}
