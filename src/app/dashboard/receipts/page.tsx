"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, DataTable, SectionTitle } from "@/components/ui";
import { useAuth } from "@/components/auth";
import { formatNaira } from "@/lib/data";
import { supabase } from "@/lib/supabase";

type ReceiptOrder = {
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
  order_items?: Array<{
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
};

export default function ReceiptsPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<ReceiptOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadReceipts = useCallback(async () => {
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
      setOrders(data ?? []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadReceipts();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadReceipts]);

  const latest = orders[0];

  return (
    <>
      <SectionTitle eyebrow="Records" title="Receipts" />
      {message ? <p className="mb-4 rounded-md bg-rose-50 p-4 text-sm font-semibold text-rose-700">{message}</p> : null}
      {latest ? <ReceiptPreview order={latest} /> : null}
      <DataTable
        headers={["Receipt", "Order", "Customer", "Amount", "Payment", "Issued"]}
        rows={
          loading
            ? [["Loading receipts...", "", "", "", "", ""]]
            : orders.length === 0
              ? [["No receipts yet.", "", "", "", "", ""]]
              : orders.map((order) => [
                  <strong key={order.id} className="text-slate-950">RCT-{order.id.slice(0, 8).toUpperCase()}</strong>,
                  order.id.slice(0, 8).toUpperCase(),
                  order.customer_name,
                  formatNaira(order.total),
                  <Badge key={order.payment_status} tone={order.payment_status.includes("unpaid") ? "amber" : "green"}>{order.payment_status}</Badge>,
                  new Date(order.created_at).toLocaleString(),
                ])
        }
      />
    </>
  );
}

function ReceiptPreview({ order }: { order: ReceiptOrder }) {
  return (
    <section className="mb-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Latest receipt</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">RCT-{order.id.slice(0, 8).toUpperCase()}</h2>
          <p className="mt-1 text-sm text-slate-500">{new Date(order.created_at).toLocaleString()}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="font-black text-slate-950">Ada Fashion</p>
          <p className="text-sm text-slate-500">SellMate NG receipt</p>
        </div>
      </div>
      <div className="grid gap-5 py-5 md:grid-cols-2">
        <div>
          <p className="text-sm font-bold text-slate-500">Customer</p>
          <p className="mt-1 font-black text-slate-950">{order.customer_name}</p>
          <p className="text-sm text-slate-600">{order.customer_phone}</p>
          <p className="text-sm text-slate-600">{order.city} · {order.delivery_address}</p>
        </div>
        <div className="md:text-right">
          <p className="text-sm font-bold text-slate-500">Payment</p>
          <p className="mt-1 font-black text-slate-950">{order.payment_status}</p>
          <p className="text-sm text-slate-600">Order status: {order.status}</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(order.order_items ?? []).map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 font-bold text-slate-900">{item.product_name}</td>
                <td className="px-4 py-3">{item.quantity}</td>
                <td className="px-4 py-3">{formatNaira(item.unit_price)}</td>
                <td className="px-4 py-3 text-right font-bold">{formatNaira(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-5 grid gap-2 text-sm sm:ml-auto sm:w-72">
        <div className="flex justify-between"><span>Subtotal</span><strong>{formatNaira(order.subtotal)}</strong></div>
        <div className="flex justify-between"><span>Delivery</span><strong>{formatNaira(order.delivery_fee)}</strong></div>
        <div className="flex justify-between border-t border-slate-200 pt-3 text-lg font-black"><span>Total</span><span>{formatNaira(order.total)}</span></div>
      </div>
    </section>
  );
}
