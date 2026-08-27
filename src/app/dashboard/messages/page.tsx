"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, IconGlyph, SectionTitle, StatCard } from "@/components/ui";
import { useAuth } from "@/components/auth";

type CustomerMessage = {
  id: string;
  store_slug: string;
  product_id: string;
  product_name: string;
  customer_name: string;
  customer_phone: string;
  message: string;
  status: "New" | "Read" | "Replied";
  created_at: string;
};

const statuses: CustomerMessage["status"][] = ["New", "Read", "Replied"];

export default function MessagesPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<CustomerMessage[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState<"All" | CustomerMessage["status"]>("All");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [notice, setNotice] = useState("");

  const loadMessages = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    setLoading(true);
    setNotice("");
    const token = await getAccessToken();
    if (!token) {
      setNotice("Log in again to view customer messages.");
      setLoading(false);
      return;
    }

    const response = await fetch("/api/customer-messages", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) {
      setNotice(data.message ?? "Could not load customer messages.");
      setLoading(false);
      return;
    }

    const nextMessages = (data.messages ?? []) as CustomerMessage[];
    setMessages(nextMessages);
    setSelectedId((current) => current || nextMessages[0]?.id || "");
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadMessages();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadMessages]);

  const filteredMessages = useMemo(() => {
    return filter === "All" ? messages : messages.filter((message) => message.status === filter);
  }, [filter, messages]);
  const selectedMessage = messages.find((message) => message.id === selectedId) ?? filteredMessages[0] ?? messages[0];
  const newMessages = messages.filter((message) => message.status === "New").length;
  const repliedMessages = messages.filter((message) => message.status === "Replied").length;

  async function updateStatus(messageId: string, status: CustomerMessage["status"]) {
    setSavingId(messageId);
    setNotice("");
    const token = await getAccessToken();
    if (!token) {
      setNotice("Log in again before updating messages.");
      setSavingId("");
      return;
    }

    const response = await fetch("/api/customer-messages", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id: messageId, status }),
    });
    const data = await response.json();
    if (!response.ok) {
      setNotice(data.message ?? "Could not update this message.");
      setSavingId("");
      return;
    }

    setMessages((current) => current.map((message) => (message.id === messageId ? { ...message, status } : message)));
    setSavingId("");
  }

  return (
    <>
      <SectionTitle eyebrow="Inbox" title="Messages" />
      {notice ? <p className="mb-4 rounded-md bg-rose-50 p-4 text-sm font-semibold text-rose-700">{notice}</p> : null}

      <section className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-5 bg-[linear-gradient(135deg,#F8FAFC_0%,#ECFDF5_58%,#EFF6FF_100%)] p-5 lg:grid-cols-[1fr_330px] lg:items-center lg:p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Customer message center</p>
            <h2 className="mt-3 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">Reply to product questions before customers buy.</h2>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
              Messages sent from product details appear here with the customer phone number and product reference.
            </p>
          </div>
          <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <StatCard label="All messages" value={loading ? "..." : String(messages.length)} change="Product questions" tone="blue" />
            <StatCard label="New" value={loading ? "..." : String(newMessages)} change="Needs reply" tone={newMessages ? "amber" : "green"} />
            <StatCard label="Replied" value={loading ? "..." : String(repliedMessages)} change="Closed chats" tone="green" />
          </div>
        </div>
      </section>

      <div className="mb-5 flex flex-wrap gap-2">
        {(["All", ...statuses] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            className={`rounded-full border px-4 py-2 text-xs font-black transition ${filter === status ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:text-emerald-700"}`}
          >
            {status}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="sellmate-card rounded-lg p-8 text-center">
          <p className="font-bold text-slate-600">Loading messages...</p>
        </div>
      ) : messages.length === 0 ? (
        <div className="sellmate-card rounded-lg p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-700">
            <IconGlyph name="messages" className="h-6 w-6" />
          </div>
          <p className="mt-4 text-xl font-black text-slate-950">No customer messages yet.</p>
          <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-500">When a customer opens a product and sends a question, it will appear here.</p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section className="sellmate-card overflow-hidden rounded-lg">
            <div className="border-b border-slate-100 p-4">
              <p className="text-sm font-black text-slate-950">Inbox</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{filteredMessages.length} message(s) showing</p>
            </div>
            <div className="max-h-[680px] overflow-y-auto">
              {filteredMessages.map((message) => (
                <button
                  key={message.id}
                  type="button"
                  onClick={() => setSelectedId(message.id)}
                  className={`block w-full border-b border-slate-100 p-4 text-left transition hover:bg-emerald-50/60 ${selectedMessage?.id === message.id ? "bg-emerald-50" : "bg-white"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950">{message.customer_name}</p>
                      <p className="mt-1 truncate text-xs font-semibold text-slate-500">{message.product_name}</p>
                    </div>
                    <Badge tone={message.status === "New" ? "amber" : message.status === "Replied" ? "green" : "blue"}>{message.status}</Badge>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm font-semibold leading-6 text-slate-600">{message.message}</p>
                  <p className="mt-2 text-xs font-bold text-slate-400">{new Date(message.created_at).toLocaleString()}</p>
                </button>
              ))}
            </div>
          </section>

          {selectedMessage ? (
            <section className="sellmate-card rounded-lg p-5">
              <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Customer message</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">{selectedMessage.customer_name}</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{selectedMessage.customer_phone}</p>
                </div>
                <Badge tone={selectedMessage.status === "New" ? "amber" : selectedMessage.status === "Replied" ? "green" : "blue"}>{selectedMessage.status}</Badge>
              </div>

              <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Product</p>
                    <p className="mt-1 font-black text-slate-950">{selectedMessage.product_name}</p>
                  </div>
                  <Link href={`/store/${selectedMessage.store_slug}/products`} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700">
                    View store products
                  </Link>
                </div>
              </div>

              <div className="mt-5 rounded-lg bg-white p-5 ring-1 ring-slate-200">
                <p className="text-sm font-black text-slate-950">Message</p>
                <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-7 text-slate-600">{selectedMessage.message}</p>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {statuses.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => updateStatus(selectedMessage.id, status)}
                    disabled={savingId === selectedMessage.id || selectedMessage.status === status}
                    className="rounded-md border border-slate-300 bg-white px-4 py-3 text-xs font-black text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {selectedMessage.status === status ? status : `Mark ${status}`}
                  </button>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <a href={buildWhatsAppHref(selectedMessage)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md bg-[#16A34A] px-5 py-3 text-sm font-black text-white transition hover:bg-[#15803D]">
                  <IconGlyph name="messages" className="h-4 w-4" />
                  Open WhatsApp
                </a>
              </div>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}

async function getAccessToken() {
  const { supabase } = await import("@/lib/supabase");
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function buildWhatsAppHref(message: CustomerMessage) {
  const phone = normalizePhone(message.customer_phone);
  const text = `Hello ${message.customer_name}, I saw your message about ${message.product_name}.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0")) return `234${digits.slice(1)}`;
  return digits;
}
