"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const openChatRef = searchParams.get("chat") ?? "";
  const { ready, user } = useAuth();
  const userId = user?.id ?? "";
  const [messages, setMessages] = useState<CustomerMessage[]>([]);
  const [filter, setFilter] = useState<"All" | CustomerMessage["status"]>("All");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [sessionNotice, setSessionNotice] = useState(false);
  const [savingId, setSavingId] = useState("");
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
  const openConversation = useMemo(() => {
    if (!openChatRef) return null;
    return buildConversations(messages).find((conversation) => conversation.latest.id === openChatRef || conversation.messages.some((message) => message.id === openChatRef)) ?? null;
  }, [messages, openChatRef]);
  const newMessages = messages.filter((message) => message.status === "New").length;
  const repliedMessages = messages.filter((message) => message.status === "Replied").length;

  async function sendReply(event: React.FormEvent<HTMLFormElement>, message: CustomerMessage) {
    event.preventDefault();
    const reply = (replyDrafts[message.id] ?? "").trim();
    if (!reply) {
      setNotice("Write a reply before sending.");
      return;
    }

    setSavingId(message.id);
    setNotice("");
    const response = await saveMessageUpdate(userId, { id: message.id, status: "Replied", sellerReply: reply });
    if (!response.ok) {
      setNotice(formatMessagesError(response.message));
      setSavingId("");
      return;
    }

    const repliedAt = new Date().toISOString();
    setMessages((current) => current.map((item) => (item.id === message.id ? { ...item, status: "Replied", seller_reply: reply, replied_at: repliedAt } : item)));
    setReplyDrafts((current) => ({ ...current, [message.id]: "" }));
    setSavingId("");
  }

  if (openConversation) {
    return (
      <section className="flex h-[calc(100dvh-9rem)] min-h-[34rem] flex-col overflow-hidden border-y border-slate-200 bg-white shadow-sm sm:h-[calc(100dvh-8rem)] lg:h-[calc(100dvh-6rem)] lg:border-x">
        {notice ? <p className="m-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-700">{notice}</p> : null}
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-white p-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-950 text-sm font-black text-white">{openConversation.customer_name.slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-black text-slate-950">{openConversation.customer_name}</h2>
                <p className="truncate text-sm font-semibold text-slate-500">{openConversation.customer_phone}</p>
              </div>
            </div>
            <Link href="/dashboard/messages" className="shrink-0 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700">
              Back
            </Link>
          </div>

          <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto bg-slate-50 p-4">
            {openConversation.messages.slice().reverse().map((message) => (
              <div key={message.id} className="grid gap-3">
                <div className="mr-auto max-w-[88%] rounded-2xl rounded-bl-md bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-700 ring-1 ring-slate-200">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">{message.product_name}</p>
                  <p className="mt-2 whitespace-pre-wrap">{message.message}</p>
                  <p className="mt-2 text-[11px] font-bold text-slate-400">{new Date(message.created_at).toLocaleString()}</p>
                </div>
                {message.seller_reply ? (
                  <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-[#16A34A] px-4 py-3 text-sm font-semibold leading-6 text-white">
                    <p className="whitespace-pre-wrap">{message.seller_reply}</p>
                    {message.replied_at ? <p className="mt-2 text-[11px] font-bold text-white/75">{new Date(message.replied_at).toLocaleString()}</p> : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <form onSubmit={(event) => sendReply(event, openConversation.latest)} className="sticky bottom-0 border-t border-slate-100 bg-white p-3 shadow-[0_-10px_24px_rgba(15,23,42,0.06)] sm:p-4">
            <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">Replying about {openConversation.latest.product_name}</p>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
              <textarea
                value={replyDrafts[openConversation.latest.id] ?? ""}
                onChange={(event) => setReplyDrafts((current) => ({ ...current, [openConversation.latest.id]: event.target.value }))}
                maxLength={800}
                rows={2}
                placeholder={`Reply to ${openConversation.customer_name}...`}
                className="max-h-28 min-h-12 resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none focus:border-emerald-600"
              />
              <button disabled={savingId === openConversation.latest.id} className="min-h-12 rounded-full bg-[#16A34A] px-5 py-3 text-sm font-black text-white transition hover:bg-[#15803D] disabled:bg-slate-400">
                {savingId === openConversation.latest.id ? "..." : "Send"}
              </button>
            </div>
          </form>
      </section>
    );
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
      <>
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
                  href={`/dashboard/messages?chat=${encodeURIComponent(conversation.latest.id)}`}
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

async function saveMessageUpdate(userId: string, payload: { id: string; status: CustomerMessage["status"]; sellerReply?: string }) {
  const token = await getAccessToken();
  if (token) {
    const response = await fetch("/api/customer-messages", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (response.ok) {
      return { ok: true };
    }
    if (response.status !== 401) {
      return { ok: false, message: data.message };
    }
  }

  const updatePayload: { status: CustomerMessage["status"]; seller_reply?: string; replied_at?: string } = { status: payload.status };
  if (payload.sellerReply) {
    updatePayload.status = "Replied";
    updatePayload.seller_reply = payload.sellerReply;
    updatePayload.replied_at = new Date().toISOString();
  }
  const { error } = await supabase.from("customer_messages").update(updatePayload).eq("id", payload.id).eq("seller_id", userId);
  return error ? { ok: false, message: error.message } : { ok: true };
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
