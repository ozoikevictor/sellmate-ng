"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, IconGlyph, SectionTitle, StatCard } from "@/components/ui";
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
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState<"All" | CustomerMessage["status"]>("All");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [notice, setNotice] = useState("");
  const [sessionNotice, setSessionNotice] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

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
          setSelectedId((current) => current || fallback.messages[0]?.id || "");
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
    setSelectedId((current) => current || nextMessages[0]?.id || "");
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
  const selectedConversation =
    conversations.find((conversation) => conversation.messages.some((message) => message.id === selectedId)) ?? conversations[0];
  const selectedMessage =
    selectedConversation?.messages.find((message) => message.id === selectedId) ??
    selectedConversation?.messages.find((message) => !message.seller_reply) ??
    selectedConversation?.latest;
  const newMessages = messages.filter((message) => message.status === "New").length;
  const repliedMessages = messages.filter((message) => message.status === "Replied").length;
  const replyText = selectedMessage ? (replyDrafts[selectedMessage.id] ?? selectedMessage.seller_reply ?? "") : "";

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
      if (response.status === 401) {
        const { error } = await supabase.from("customer_messages").update({ status }).eq("id", messageId).eq("seller_id", userId);
        if (!error) {
          setMessages((current) => current.map((message) => (message.id === messageId ? { ...message, status } : message)));
          setSavingId("");
          return;
        }
        setNotice(formatMessagesError(error.message));
        setSavingId("");
        return;
      }
      setNotice(formatMessagesError(data.message));
      setSavingId("");
      return;
    }

    setMessages((current) => current.map((message) => (message.id === messageId ? { ...message, status } : message)));
    setSavingId("");
  }

  async function sendReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMessage) return;
    const reply = replyText.trim();
    if (!reply) {
      setNotice("Write a reply before sending.");
      return;
    }

    setSavingId(selectedMessage.id);
    setNotice("");
    const token = await getAccessToken();
    if (!token) {
      setNotice("Log in again before replying.");
      setSavingId("");
      return;
    }

    const response = await fetch("/api/customer-messages", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id: selectedMessage.id, status: "Replied", sellerReply: reply }),
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        const repliedAt = new Date().toISOString();
        const { error } = await supabase
          .from("customer_messages")
          .update({ status: "Replied", seller_reply: reply, replied_at: repliedAt })
          .eq("id", selectedMessage.id)
          .eq("seller_id", userId);
        if (!error) {
          setMessages((current) => current.map((message) => (message.id === selectedMessage.id ? { ...message, status: "Replied", seller_reply: reply, replied_at: repliedAt } : message)));
          setReplyDrafts((current) => ({ ...current, [selectedMessage.id]: reply }));
          setNotice("Reply saved. The customer will see it in their store notification.");
          setSavingId("");
          return;
        }
        setNotice(formatMessagesError(error.message));
        setSavingId("");
        return;
      }
      setNotice(formatMessagesError(data.message));
      setSavingId("");
      return;
    }

    const repliedAt = new Date().toISOString();
    setMessages((current) => current.map((message) => (message.id === selectedMessage.id ? { ...message, status: "Replied", seller_reply: reply, replied_at: repliedAt } : message)));
    setReplyDrafts((current) => ({ ...current, [selectedMessage.id]: reply }));
    setNotice("Reply saved. The customer will see it in their store notification.");
    setSavingId("");
  }

  return (
    <>
      <SectionTitle eyebrow="Inbox" title="Messages" />
      {notice ? <p className="mb-4 rounded-md bg-rose-50 p-4 text-sm font-semibold text-rose-700">{notice}</p> : null}
      {sessionNotice ? (
        <button type="button" onClick={loadMessages} className="mb-5 inline-flex rounded-md bg-[#16A34A] px-5 py-3 text-sm font-black text-white transition hover:bg-[#15803D]">
          Refresh messages
        </button>
      ) : null}

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
              <p className="mt-1 text-xs font-semibold text-slate-500">{conversations.length} customer conversation(s)</p>
            </div>
            <div className="max-h-[680px] overflow-y-auto">
              {conversations.map((conversation) => (
                <button
                  key={conversation.key}
                  type="button"
                  onClick={() => setSelectedId(conversation.latest.id)}
                  className={`block w-full border-b border-slate-100 p-4 text-left transition hover:bg-emerald-50/60 ${selectedConversation?.key === conversation.key ? "bg-emerald-50" : "bg-white"}`}
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
                    {conversation.newCount > 0 ? <Badge tone="amber">{conversation.newCount} new</Badge> : <Badge tone="green">Open</Badge>}
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm font-semibold leading-6 text-slate-600">{conversation.latest.message}</p>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-400">
                    <span>{conversation.customer_phone}</span>
                    <span>{new Date(conversation.latest.created_at).toLocaleString()}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {selectedMessage ? (
            <section className="sellmate-card rounded-lg p-5">
              <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Customer message</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">Chat with {selectedConversation?.customer_name ?? selectedMessage.customer_name}</h2>
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

              <div className="mt-5 grid max-h-[430px] gap-4 overflow-y-auto rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
                {selectedConversation?.messages.slice().reverse().map((message) => (
                  <div key={message.id} className="grid gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedId(message.id)}
                      className={`mr-auto max-w-[86%] rounded-2xl rounded-bl-md px-4 py-3 text-left text-sm font-semibold leading-6 ring-1 ${selectedMessage.id === message.id ? "bg-emerald-50 text-slate-950 ring-emerald-200" : "bg-white text-slate-700 ring-slate-200"}`}
                    >
                      <span className="block text-xs font-black uppercase tracking-[0.14em] text-emerald-700">{message.product_name}</span>
                      <span className="mt-2 block whitespace-pre-wrap">{message.message}</span>
                      <span className="mt-2 block text-[11px] font-bold text-slate-400">{new Date(message.created_at).toLocaleString()}</span>
                    </button>
                    {message.seller_reply ? (
                      <button
                        type="button"
                        onClick={() => setSelectedId(message.id)}
                        className={`ml-auto max-w-[86%] rounded-2xl rounded-br-md px-4 py-3 text-left text-sm font-semibold leading-6 ${selectedMessage.id === message.id ? "bg-[#15803D] text-white" : "bg-[#16A34A] text-white"}`}
                      >
                        <span className="block whitespace-pre-wrap">{message.seller_reply}</span>
                        {message.replied_at ? <span className="mt-2 block text-[11px] font-bold text-white/75">{new Date(message.replied_at).toLocaleString()}</span> : null}
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>

              <form onSubmit={sendReply} className="mt-5 rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                <label className="grid gap-2 text-sm font-black text-slate-950">
                  Reply for customer notification
                  <textarea
                    value={replyText}
                    onChange={(event) => setReplyDrafts((current) => ({ ...current, [selectedMessage.id]: event.target.value }))}
                    maxLength={800}
                    rows={4}
                    placeholder={`Hello ${selectedMessage.customer_name}, this product is available.`}
                    className="resize-none rounded-md border border-emerald-200 bg-white px-3 py-3 text-base font-semibold text-slate-900 outline-none focus:border-emerald-600"
                  />
                </label>
                {selectedMessage.seller_reply ? <p className="mt-2 text-xs font-bold text-emerald-800">Last reply saved{selectedMessage.replied_at ? ` ${new Date(selectedMessage.replied_at).toLocaleString()}` : ""}.</p> : null}
                <button disabled={savingId === selectedMessage.id} className="mt-3 rounded-md bg-[#16A34A] px-5 py-3 text-sm font-black text-white transition hover:bg-[#15803D] disabled:cursor-not-allowed disabled:bg-slate-400">
                  {savingId === selectedMessage.id ? "Saving..." : "Send reply"}
                </button>
              </form>

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
