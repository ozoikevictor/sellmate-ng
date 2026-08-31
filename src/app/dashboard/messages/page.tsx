"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, IconGlyph, SectionTitle } from "@/components/ui";
import { useAuth } from "@/components/auth";
import { supabase } from "@/lib/supabase";

type CustomerMessage = {
  id: string;
  store_slug: string;
  product_id: string;
  product_name: string;
  customer_name: string;
  customer_phone: string;
  message: string;
  status: "New" | "Read" | "Replied";
  seller_reply?: string | null;
  replied_at?: string | null;
  created_at: string;
};

type CustomerConversation = {
  key: string;
  customer_name: string;
  customer_phone: string;
  latest: CustomerMessage;
  messages: CustomerMessage[];
  newCount: number;
};

const statuses: CustomerMessage["status"][] = ["New", "Read", "Replied"];

export default function MessagesPage() {
  const { ready, user } = useAuth();
  const userId = user?.id ?? "";
  const [messages, setMessages] = useState<CustomerMessage[]>([]);
  const [filter, setFilter] = useState<"All" | CustomerMessage["status"]>("All");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [sessionNotice, setSessionNotice] = useState(false);

  const loadMessages = useCallback(async () => {
    if (!ready) {
      return;
    }

    if (!userId) {
      setNotice("Open the login page again before viewing customer messages.");
      setSessionNotice(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setNotice("");
    setSessionNotice(false);
    const token = await getAccessToken();
    if (!token) {
      setNotice("Your dashboard is open, but the private message connection needs a fresh session.");
      setSessionNotice(true);
      setLoading(false);
      return;
    }

    const response = await fetch("/api/customer-messages", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        const fallback = await loadMessagesFromSupabase(userId);
        if (fallback.ok) {
          setMessages(fallback.messages);
          setLoading(false);
          return;
        }
        setNotice(formatMessagesError(fallback.message));
        setSessionNotice(false);
        setLoading(false);
        return;
      }
      setNotice(response.status === 401 ? "Your dashboard is open, but the private message connection needs a fresh session." : formatMessagesError(data.message));
      setSessionNotice(response.status === 401);
      setLoading(false);
      return;
    }

    const nextMessages = (data.messages ?? []) as CustomerMessage[];
    setMessages(nextMessages);
    setLoading(false);
  }, [ready, userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadMessages();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadMessages]);

  const filteredMessages = useMemo(() => {
    return filter === "All" ? messages : messages.filter((message) => message.status === filter);
  }, [filter, messages]);
  const conversations = useMemo(() => buildConversations(filteredMessages), [filteredMessages]);
  const newMessages = messages.filter((message) => message.status === "New").length;
  const repliedMessages = messages.filter((message) => message.status === "Replied").length;

  return (
    <>
      <SectionTitle eyebrow="Inbox" title="Messages" />
      {notice ? <p className="mb-4 rounded-md bg-rose-50 p-4 text-sm font-semibold text-rose-700">{notice}</p> : null}
      {sessionNotice ? (
        <button type="button" onClick={loadMessages} className="mb-5 inline-flex rounded-md bg-[#16A34A] px-5 py-3 text-sm font-black text-white transition hover:bg-[#15803D]">
          Refresh messages
        </button>
      ) : null}

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">All messages</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{loading ? "..." : messages.length}</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">Unread</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{loading ? "..." : newMessages}</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Replied</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{loading ? "..." : repliedMessages}</p>
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
        <section className="sellmate-card overflow-hidden rounded-lg">
            <div className="border-b border-slate-100 p-4">
              <p className="text-sm font-black text-slate-950">Inbox</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{conversations.length} customer conversation(s)</p>
            </div>
            <div>
              {conversations.map((conversation) => (
                <Link
                  key={conversation.key}
                  href={`/dashboard/messages/${encodeURIComponent(conversation.latest.id)}`}
                  className="block w-full border-b border-slate-100 bg-white p-4 text-left transition hover:bg-emerald-50/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-950 text-sm font-black text-white">
                        {conversation.customer_name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black text-slate-950">{conversation.customer_name}</span>
                        <span className="mt-1 block truncate text-xs font-semibold text-slate-500">{conversation.latest.product_name}</span>
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {conversation.newCount > 0 ? <Badge tone="amber">{conversation.newCount} new</Badge> : <Badge tone="green">Open</Badge>}
                      <span className="text-lg font-black text-slate-300">›</span>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm font-semibold leading-6 text-slate-600">{conversation.latest.message}</p>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-400">
                    <span>{conversation.customer_phone}</span>
                    <span>{new Date(conversation.latest.created_at).toLocaleString()}</span>
                  </div>
                </Link>
              ))}
            </div>
        </section>
      )}
    </>
  );
}

async function loadMessagesFromSupabase(userId: string) {
  const { data, error } = await supabase
    .from("customer_messages")
    .select("id,store_slug,product_id,product_name,customer_name,customer_phone,message,status,seller_reply,replied_at,created_at")
    .eq("seller_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return { ok: false, messages: [] as CustomerMessage[], message: error.message };
  }

  return { ok: true, messages: (data ?? []) as CustomerMessage[] };
}

function formatMessagesError(message?: string) {
  const text = message ?? "";
  if (text.toLowerCase().includes("customer_messages") || text.toLowerCase().includes("schema cache")) {
    return "Customer messages are not fully connected yet. Add the customer_messages table in Supabase first.";
  }
  return text || "Could not load customer messages.";
}

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) {
    return data.session.access_token;
  }
  const refreshed = await supabase.auth.refreshSession();
  return refreshed.data.session?.access_token ?? "";
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0")) return `234${digits.slice(1)}`;
  return digits;
}

function buildConversations(messages: CustomerMessage[]) {
  const grouped = new Map<string, CustomerConversation>();

  messages.forEach((message) => {
    const phoneKey = normalizePhone(message.customer_phone);
    const key = phoneKey || message.customer_name.trim().toLowerCase() || message.id;
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, {
        key,
        customer_name: message.customer_name || "Customer",
        customer_phone: message.customer_phone,
        latest: message,
        messages: [message],
        newCount: message.status === "New" ? 1 : 0,
      });
      return;
    }

    current.messages.push(message);
    current.newCount += message.status === "New" ? 1 : 0;
    if (new Date(message.created_at).getTime() > new Date(current.latest.created_at).getTime()) {
      current.latest = message;
    }
  });

  return Array.from(grouped.values())
    .map((conversation) => ({
      ...conversation,
      messages: conversation.messages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    }))
    .sort((a, b) => new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime());
}
