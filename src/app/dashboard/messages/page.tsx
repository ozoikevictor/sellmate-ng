"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, IconGlyph, SectionTitle } from "@/components/ui";
import { useAuth } from "@/components/auth";
import { encodeChatOffer, parseChatOffer } from "@/lib/cart";
import { formatNaira } from "@/lib/data";
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
  const [offerDrafts, setOfferDrafts] = useState<Record<string, { price: string; delivery: string }>>({});
  const [replyingToMessageId, setReplyingToMessageId] = useState("");
  const [swipeStart, setSwipeStart] = useState<number | null>(null);
  const [swipeMessageId, setSwipeMessageId] = useState("");
  const [swipeDelta, setSwipeDelta] = useState(0);

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
    const plainReply = (replyDrafts[message.id] ?? "").trim();
    const offerDraft = offerDrafts[message.id];
    const agreedPrice = Number(offerDraft?.price || 0);
    const agreedDelivery = Number(offerDraft?.delivery || 0);
    const hasOffer = agreedPrice > 0 || agreedDelivery > 0;
    const reply = hasOffer
      ? encodeChatOffer({
          seller_id: userId,
          store_slug: message.store_slug,
          product_id: message.product_id,
          product_name: message.product_name,
          agreed_price: agreedPrice > 0 ? agreedPrice : undefined,
          delivery_fee: agreedDelivery > 0 ? agreedDelivery : undefined,
          note: plainReply,
        })
      : plainReply;
    if (!reply || (hasOffer && agreedPrice <= 0 && agreedDelivery <= 0)) {
      setNotice("Write a reply or add a deal price before sending.");
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
    setOfferDrafts((current) => ({ ...current, [message.id]: { price: "", delivery: "" } }));
    setSavingId("");
  }

  function beginMessageSwipe(messageId: string, clientX: number | null) {
    setSwipeMessageId(messageId);
    setSwipeStart(clientX);
    setSwipeDelta(0);
  }

  function moveMessageSwipe(clientX: number) {
    if (swipeStart === null) return;
    setSwipeDelta(Math.max(-92, Math.min(92, clientX - swipeStart)));
  }

  function endMessageSwipe(clientX: number, messageId: string) {
    if (swipeStart === null) return;
    const delta = clientX - swipeStart;
    if (Math.abs(delta) > 38) {
      setReplyingToMessageId(messageId);
    }
    setSwipeStart(null);
    setSwipeMessageId("");
    setSwipeDelta(0);
  }

  function messageSwipeStyle(messageId: string) {
    if (swipeMessageId === messageId && swipeStart !== null) return `translateX(${swipeDelta}px)`;
    return "translateX(0)";
  }

  if (openConversation) {
    const replyTarget = openConversation.messages.find((message) => message.id === replyingToMessageId) ?? openConversation.latest;
    const offerDraft = offerDrafts[replyTarget.id] ?? { price: "", delivery: "" };

    return (
      <section className="flex h-[100svh] min-h-0 flex-col overflow-hidden bg-white shadow-sm">
        {notice ? <p className="m-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-700">{notice}</p> : null}
          <div className="shrink-0 flex items-center gap-3 border-b border-slate-100 bg-white px-3 py-3 sm:px-4">
            <Link href="/dashboard/messages" aria-label="Back to messages" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-lg font-black text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-5 w-5" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-950 text-sm font-black text-white">{openConversation.customer_name.slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-black text-slate-950">{openConversation.customer_name}</h2>
                <p className="truncate text-sm font-semibold text-slate-500">{openConversation.customer_phone}</p>
              </div>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto overscroll-contain bg-slate-50 p-4">
            {openConversation.messages.slice().reverse().map((message) => (
              <div key={message.id} className="grid gap-3">
                <div className="mr-auto max-w-[88%]">
                  <div className="relative overflow-hidden rounded-2xl rounded-bl-md">
                    <span className={`absolute inset-y-0 left-0 my-auto grid h-9 w-12 place-items-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700 transition ${swipeMessageId === message.id && Math.abs(swipeDelta) > 18 ? "opacity-100" : "opacity-0"}`}>Reply</span>
                    <button
                      type="button"
                      onClick={() => setReplyingToMessageId(message.id)}
                      onTouchStart={(event) => beginMessageSwipe(message.id, event.touches[0]?.clientX ?? null)}
                      onTouchMove={(event) => moveMessageSwipe(event.touches[0]?.clientX ?? 0)}
                      onTouchEnd={(event) => endMessageSwipe(event.changedTouches[0]?.clientX ?? 0, message.id)}
                      onMouseDown={(event) => beginMessageSwipe(message.id, event.clientX)}
                      onMouseMove={(event) => moveMessageSwipe(event.clientX)}
                      onMouseUp={(event) => endMessageSwipe(event.clientX, message.id)}
                      onMouseLeave={(event) => endMessageSwipe(event.clientX, message.id)}
                      style={{ transform: messageSwipeStyle(message.id) }}
                      className={`relative z-10 w-full touch-pan-y rounded-2xl rounded-bl-md bg-white px-4 py-3 text-left text-sm font-semibold leading-6 text-slate-700 shadow-sm ring-1 transition ${replyingToMessageId === message.id ? "ring-emerald-300" : "ring-slate-200"}`}
                    >
                      <span className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">{message.product_name}</span>
                      <span className="mt-2 block whitespace-pre-wrap">{message.message}</span>
                      <span className="mt-2 block text-[11px] font-bold text-slate-400">{new Date(message.created_at).toLocaleString()}</span>
                    </button>
                  </div>
                </div>
                {message.seller_reply ? (
                  <div className="ml-auto max-w-[88%]">
                    <button
                      type="button"
                      onClick={() => setReplyingToMessageId(message.id)}
                      onTouchStart={(event) => beginMessageSwipe(message.id, event.touches[0]?.clientX ?? null)}
                      onTouchMove={(event) => moveMessageSwipe(event.touches[0]?.clientX ?? 0)}
                      onTouchEnd={(event) => endMessageSwipe(event.changedTouches[0]?.clientX ?? 0, message.id)}
                      onMouseDown={(event) => beginMessageSwipe(message.id, event.clientX)}
                      onMouseMove={(event) => moveMessageSwipe(event.clientX)}
                      onMouseUp={(event) => endMessageSwipe(event.clientX, message.id)}
                      onMouseLeave={(event) => endMessageSwipe(event.clientX, message.id)}
                      style={{ transform: messageSwipeStyle(message.id) }}
                      className={`w-full touch-pan-y rounded-2xl rounded-br-md bg-[#16A34A] px-4 py-3 text-left text-sm font-semibold leading-6 text-white transition ${replyingToMessageId === message.id ? "ring-2 ring-emerald-200" : ""}`}
                    >
                      {parseChatOffer(message.seller_reply, message.id) ? (
                        <OfferBubble offer={parseChatOffer(message.seller_reply, message.id)!} />
                      ) : (
                        <span className="block whitespace-pre-wrap">{message.seller_reply}</span>
                      )}
                      {message.replied_at ? <span className="mt-2 block text-[11px] font-bold text-white/75">{new Date(message.replied_at).toLocaleString()}</span> : null}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <form onSubmit={(event) => sendReply(event, replyTarget)} className="shrink-0 border-t border-slate-100 bg-white p-3 shadow-[0_-10px_24px_rgba(15,23,42,0.06)] sm:p-4">
            <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <p className="min-w-0 truncate text-xs font-black uppercase tracking-[0.14em] text-slate-500">Replying about {replyTarget.product_name}</p>
              {replyingToMessageId ? (
                <button type="button" onClick={() => setReplyingToMessageId("")} className="shrink-0 text-xs font-black text-slate-500 hover:text-rose-600">
                  Cancel
                </button>
              ) : null}
            </div>
            <div className="mb-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-800">Close the bargain</p>
                  <p className="mt-1 text-xs font-bold text-emerald-700">Add the agreed item price and delivery when the customer accepts your last price.</p>
                </div>
                <p className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-bold text-emerald-700">Optional</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
              <label className="grid gap-1 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-800">
                Agreed item price
                <input
                  type="number"
                  min="0"
                  value={offerDraft.price}
                  onChange={(event) => setOfferDrafts((current) => ({ ...current, [replyTarget.id]: { ...(current[replyTarget.id] ?? { price: "", delivery: "" }), price: event.target.value } }))}
                  placeholder="Example 8000"
                  className="rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm font-black text-slate-950 outline-none focus:border-emerald-600"
                />
              </label>
              <label className="grid gap-1 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-800">
                Delivery fee
                <input
                  type="number"
                  min="0"
                  value={offerDraft.delivery}
                  onChange={(event) => setOfferDrafts((current) => ({ ...current, [replyTarget.id]: { ...(current[replyTarget.id] ?? { price: "", delivery: "" }), delivery: event.target.value } }))}
                  placeholder="Example 10000"
                  className="rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm font-black text-slate-950 outline-none focus:border-emerald-600"
                />
              </label>
              </div>
              {(Number(offerDraft.price || 0) > 0 || Number(offerDraft.delivery || 0) > 0) ? (
                <div className="mt-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-700">
                  Customer checkout total: {formatNaira(Number(offerDraft.price || 0) + Number(offerDraft.delivery || 0))}
                </div>
              ) : null}
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
              <textarea
                value={replyDrafts[replyTarget.id] ?? ""}
                onChange={(event) => setReplyDrafts((current) => ({ ...current, [replyTarget.id]: event.target.value }))}
                maxLength={800}
                rows={2}
                placeholder={`Reply to ${openConversation.customer_name}...`}
                className="max-h-28 min-h-12 resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none focus:border-emerald-600"
              />
              <button disabled={savingId === replyTarget.id} aria-label="Send reply" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#16A34A] text-lg font-black text-white transition hover:bg-[#15803D] disabled:bg-slate-400">
                {savingId === replyTarget.id ? "..." : "➤"}
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

function OfferBubble({ offer }: { offer: NonNullable<ReturnType<typeof parseChatOffer>> }) {
  const offerTotal = Number(offer.agreed_price ?? 0) + Number(offer.delivery_fee ?? 0);

  return (
    <span className="block rounded-xl bg-white/15 p-3">
      <span className="block text-xs font-black uppercase tracking-[0.14em] text-white/80">Deal sent to customer</span>
      <span className="mt-2 block text-sm font-black">{offer.product_name}</span>
      <span className="mt-3 grid gap-1.5 text-sm font-bold">
        {offer.agreed_price ? (
          <span className="flex items-center justify-between gap-3">
            <span>Agreed price</span>
            <strong>{formatNaira(offer.agreed_price)}</strong>
          </span>
        ) : null}
        {offer.delivery_fee !== undefined ? (
          <span className="flex items-center justify-between gap-3">
            <span>Delivery</span>
            <strong>{formatNaira(offer.delivery_fee)}</strong>
          </span>
        ) : null}
        {offerTotal > 0 ? (
          <span className="flex items-center justify-between gap-3 border-t border-white/20 pt-2">
            <span>Total</span>
            <strong>{formatNaira(offerTotal)}</strong>
          </span>
        ) : null}
      </span>
      {offer.note ? <span className="mt-2 block whitespace-pre-wrap rounded-lg bg-white/10 px-2 py-1.5 text-sm font-semibold">{offer.note}</span> : null}
    </span>
  );
}
