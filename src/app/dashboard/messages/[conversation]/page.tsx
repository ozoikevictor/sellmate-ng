"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
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

const statuses: CustomerMessage["status"][] = ["New", "Read", "Replied"];

export default function DashboardConversationPage() {
  const params = useParams<{ conversation: string }>();
  const conversationKey = decodeURIComponent(params.conversation);
  const { ready, user } = useAuth();
  const userId = user?.id ?? "";
  const [messages, setMessages] = useState<CustomerMessage[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [notice, setNotice] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const loadMessages = useCallback(async () => {
    if (!ready) return;
    if (!userId) {
      setNotice("Open the login page again before viewing this customer chat.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setNotice("");
    const allMessages = await loadSellerMessages(userId);
    if (!allMessages.ok) {
      setNotice(formatMessagesError(allMessages.message));
      setLoading(false);
      return;
    }

    const customerMessages = allMessages.messages
      .filter((message) => getConversationKey(message) === conversationKey)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setMessages(customerMessages);
    setSelectedId((current) => current || customerMessages.find((message) => !message.seller_reply)?.id || customerMessages[0]?.id || "");
    setLoading(false);
  }, [conversationKey, ready, userId]);

  useEffect(() => {
    const timer = window.setTimeout(loadMessages, 0);
    return () => window.clearTimeout(timer);
  }, [loadMessages]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`seller-chat-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "customer_messages", filter: `seller_id=eq.${userId}` }, () => {
        loadMessages();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadMessages, userId]);

  const selectedMessage = messages.find((message) => message.id === selectedId) ?? messages.find((message) => !message.seller_reply) ?? messages[0];
  const customerName = messages[0]?.customer_name ?? "Customer";
  const customerPhone = messages[0]?.customer_phone ?? "";
  const replyText = selectedMessage ? (replyDrafts[selectedMessage.id] ?? selectedMessage.seller_reply ?? "") : "";
  const newCount = useMemo(() => messages.filter((message) => message.status === "New").length, [messages]);

  async function updateStatus(messageId: string, status: CustomerMessage["status"]) {
    setSavingId(messageId);
    setNotice("");
    const response = await saveMessageUpdate(userId, { id: messageId, status });
    if (!response.ok) {
      setNotice(formatMessagesError(response.message));
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
    const response = await saveMessageUpdate(userId, { id: selectedMessage.id, status: "Replied", sellerReply: reply });
    if (!response.ok) {
      setNotice(formatMessagesError(response.message));
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
      <SectionTitle
        eyebrow="Customer chat"
        title={customerName}
        action={
          <Link href="/dashboard/messages" className="inline-flex rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700">
            Back to inbox
          </Link>
        }
      />

      {notice ? <p className="mb-4 rounded-md bg-rose-50 p-4 text-sm font-semibold text-rose-700">{notice}</p> : null}

      {loading ? (
        <div className="sellmate-card rounded-lg p-8 text-center">
          <p className="font-bold text-slate-600">Opening customer chat...</p>
        </div>
      ) : messages.length === 0 ? (
        <div className="sellmate-card rounded-lg p-8 text-center">
          <p className="text-xl font-black text-slate-950">This customer chat was not found.</p>
          <p className="mt-2 text-sm font-semibold text-slate-500">Go back to the inbox and open the customer again.</p>
        </div>
      ) : (
        <section className="sellmate-card overflow-hidden rounded-lg">
          <div className="flex flex-col gap-4 border-b border-slate-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-slate-950 text-base font-black text-white">{customerName.slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0">
                <h2 className="truncate text-xl font-black text-slate-950">{customerName}</h2>
                <p className="text-sm font-semibold text-slate-500">{customerPhone}</p>
              </div>
            </div>
            <Badge tone={newCount ? "amber" : "green"}>{newCount ? `${newCount} new` : "Open chat"}</Badge>
          </div>

          <div className="grid max-h-[58vh] min-h-[24rem] gap-4 overflow-y-auto bg-slate-50 p-4">
            {messages.slice().reverse().map((message) => (
              <div key={message.id} className="grid gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedId(message.id)}
                  className={`mr-auto max-w-[88%] rounded-2xl rounded-bl-md px-4 py-3 text-left text-sm font-semibold leading-6 ring-1 ${selectedMessage?.id === message.id ? "bg-emerald-50 text-slate-950 ring-emerald-200" : "bg-white text-slate-700 ring-slate-200"}`}
                >
                  <span className="block text-xs font-black uppercase tracking-[0.14em] text-emerald-700">{message.product_name}</span>
                  <span className="mt-2 block whitespace-pre-wrap">{message.message}</span>
                  <span className="mt-2 block text-[11px] font-bold text-slate-400">{new Date(message.created_at).toLocaleString()}</span>
                </button>
                {message.seller_reply ? (
                  <button
                    type="button"
                    onClick={() => setSelectedId(message.id)}
                    className={`ml-auto max-w-[88%] rounded-2xl rounded-br-md px-4 py-3 text-left text-sm font-semibold leading-6 ${selectedMessage?.id === message.id ? "bg-[#15803D] text-white" : "bg-[#16A34A] text-white"}`}
                  >
                    <span className="block whitespace-pre-wrap">{message.seller_reply}</span>
                    {message.replied_at ? <span className="mt-2 block text-[11px] font-bold text-white/75">{new Date(message.replied_at).toLocaleString()}</span> : null}
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          {selectedMessage ? (
            <div className="border-t border-slate-100 bg-white p-4">
              <div className="mb-3 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Replying about</p>
                  <p className="mt-1 font-black text-slate-950">{selectedMessage.product_name}</p>
                </div>
                <Link href={`/store/${selectedMessage.store_slug}/products`} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700">
                  View product list
                </Link>
              </div>

              <form onSubmit={sendReply} className="grid gap-3">
                <textarea
                  value={replyText}
                  onChange={(event) => setReplyDrafts((current) => ({ ...current, [selectedMessage.id]: event.target.value }))}
                  maxLength={800}
                  rows={3}
                  placeholder={`Reply to ${selectedMessage.customer_name}...`}
                  className="resize-none rounded-md border border-slate-300 bg-white px-3 py-3 text-base font-semibold text-slate-900 outline-none focus:border-emerald-600"
                />
                <div className="flex flex-wrap gap-2">
                  <button disabled={savingId === selectedMessage.id} className="rounded-md bg-[#16A34A] px-5 py-3 text-sm font-black text-white transition hover:bg-[#15803D] disabled:cursor-not-allowed disabled:bg-slate-400">
                    {savingId === selectedMessage.id ? "Sending..." : "Send reply"}
                  </button>
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
                  <a href={buildWhatsAppHref(selectedMessage)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-black text-emerald-800 transition hover:bg-emerald-100">
                    <IconGlyph name="messages" className="h-4 w-4" />
                    WhatsApp
                  </a>
                </div>
              </form>
            </div>
          ) : null}
        </section>
      )}
    </>
  );
}

async function loadSellerMessages(userId: string) {
  const token = await getAccessToken();
  if (token) {
    const response = await fetch("/api/customer-messages", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (response.ok) {
      return { ok: true, messages: (data.messages ?? []) as CustomerMessage[] };
    }
  }

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

function getConversationKey(message: CustomerMessage) {
  return normalizePhone(message.customer_phone) || message.customer_name.trim().toLowerCase() || message.id;
}
