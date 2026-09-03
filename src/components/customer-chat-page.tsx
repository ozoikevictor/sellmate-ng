"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { LoadingScreen } from "@/components/loading-screen";
import { IconGlyph, PublicFooter, StoreHeader } from "@/components/ui";
import { applyOfferToCart, parseChatOffer, readAcceptedOffers, readCart, writeCurrentStoreHref } from "@/lib/cart";
import { formatNaira } from "@/lib/data";
import { supabase } from "@/lib/supabase";

type StoreProfile = {
  user_id: string;
  business_name: string;
  whatsapp_phone: string;
  city: string;
  store_slug: string;
  logo_url: string | null;
  logo_text: string | null;
};

type StoreProduct = {
  id: string;
  user_id: string;
  name: string;
  sku: string;
  category: string;
  variant_options: string | null;
  price: number;
  stock: number;
  status: string;
  image_url: string | null;
};

type LocalChatMessage = {
  id: string;
  product_id: string;
  product_name: string;
  customer_name: string;
  customer_phone: string;
  message: string;
  created_at: string;
};

type CustomerChatIdentity = {
  customer_name: string;
  customer_phone: string;
};

type SellerReply = {
  id: string;
  product_id?: string | null;
  product_name: string;
  message: string;
  seller_reply: string;
  replied_at?: string | null;
  created_at: string;
};

const CUSTOMER_CHAT_KEY = "sellmate-ng-customer-chat";
const CUSTOMER_MESSAGE_KEY = "sellmate-ng-customer-messages";
const CUSTOMER_READ_REPLIES_KEY = "sellmate-ng-read-replies";
const CUSTOMER_CHAT_IDENTITY_KEY = "sellmate-ng-customer-chat-identity";

export default function CustomerChatPage() {
  const params = useParams<{ slug: string; productId?: string }>();
  const searchParams = useSearchParams();
  const slug = params.slug;
  const selectedProductId = searchParams.get("product") ?? params.productId ?? "";
  const selectedMessageId = searchParams.get("message") ?? "";
  const [profile, setProfile] = useState<StoreProfile | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [selectedId, setSelectedId] = useState(selectedProductId);
  const [cartCount, setCartCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [localMessages, setLocalMessages] = useState<LocalChatMessage[]>(() => (typeof window === "undefined" ? [] : readLocalChat(slug)));
  const [sellerReplies, setSellerReplies] = useState<SellerReply[]>([]);
  const [acceptedOfferIds, setAcceptedOfferIds] = useState<string[]>(() => (typeof window === "undefined" ? [] : readAcceptedOffers(slug).map((offer) => offer.message_id)));
  const [customerIdentity, setCustomerIdentity] = useState<CustomerChatIdentity | null>(() => (typeof window === "undefined" ? null : readCustomerChatIdentity(slug)));
  const [messageDraft, setMessageDraft] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(() => (selectedProductId ? [selectedProductId] : []));
  const [replyingToId, setReplyingToId] = useState("");
  const [replySwipeStart, setReplySwipeStart] = useState<number | null>(null);
  const [replySwipeDelta, setReplySwipeDelta] = useState(0);
  const [replySwipeWasDragged, setReplySwipeWasDragged] = useState(false);
  const chatPanelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let active = true;

    async function loadStore() {
      setLoading(true);
      const { data: profileData, error: profileError } = await supabase
        .from("seller_profiles")
        .select("user_id,business_name,whatsapp_phone,city,store_slug,logo_url,logo_text")
        .eq("store_slug", slug)
        .maybeSingle();

      if (!active) return;
      if (profileError || !profileData) {
        setNotice(profileError?.message ?? "Store not found.");
        setLoading(false);
        return;
      }

      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("id,user_id,name,sku,category,variant_options,price,stock,status,image_url")
        .eq("user_id", profileData.user_id)
        .eq("status", "Live")
        .order("created_at", { ascending: false });

      if (!active) return;
      setProfile(profileData);
      setProducts(productData ?? []);
      setSelectedId((current) => current || selectedProductId || productData?.[0]?.id || "");
      setNotice(productError?.message ?? "");
      setLoading(false);
    }

    loadStore();
    writeCurrentStoreHref(`/store/${slug}`);
    window.setTimeout(() => {
      const savedMessages = readLocalChat(slug);
      const savedIdentity = readCustomerChatIdentity(slug) ?? identityFromMessages(savedMessages);
      setLocalMessages(savedMessages);
      setCustomerIdentity(savedIdentity);
      if (savedIdentity) {
        saveCustomerChatIdentity(slug, savedIdentity);
      }
    }, 0);

    function syncCartCount() {
      setCartCount(readCart().filter((item) => item.store_slug === slug).reduce((sum, item) => sum + item.qty, 0));
    }

    syncCartCount();
    window.addEventListener("sellmate-cart-updated", syncCartCount);
    window.addEventListener("storage", syncCartCount);
    return () => {
      active = false;
      window.removeEventListener("sellmate-cart-updated", syncCartCount);
      window.removeEventListener("storage", syncCartCount);
    };
  }, [slug, selectedProductId]);

  useEffect(() => {
    if (!selectedProductId) return;
    setSelectedId(selectedProductId);
    setSelectedProductIds([selectedProductId]);
    window.setTimeout(() => {
      chatPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }, [selectedProductId]);

  useEffect(() => {
    async function loadReplies() {
      try {
        const ids = readCustomerMessageIds(slug);
        if (ids.length === 0) {
          setSellerReplies([]);
          return;
        }

        const response = await fetch(`/api/customer-messages?store=${encodeURIComponent(slug)}&ids=${encodeURIComponent(ids.join(","))}`);
        const data = await safeJson(response);
        if (response.ok) {
          setSellerReplies(Array.isArray(data.messages) ? data.messages : []);
        }
      } catch {
        setSellerReplies([]);
      }
    }

    loadReplies();
    window.addEventListener("sellmate-customer-messages-updated", loadReplies);
    return () => window.removeEventListener("sellmate-customer-messages-updated", loadReplies);
  }, [slug]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`customer-chat-${slug}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "customer_messages", filter: `store_slug=eq.${slug}` }, () => {
          window.dispatchEvent(new Event("sellmate-customer-messages-updated"));
        })
        .subscribe();
    } catch {
      channel = null;
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [slug]);

  useEffect(() => {
    if (!selectedMessageId) return;

    const localMessage = readLocalChat(slug).find((message) => message.id === selectedMessageId);
    const nextProductId = selectedProductId || localMessage?.product_id || sellerReplies.find((reply) => reply.id === selectedMessageId)?.product_id || "";
    markCustomerReplyRead(slug, selectedMessageId);
    window.dispatchEvent(new Event("sellmate-customer-messages-updated"));
    window.setTimeout(() => {
      if (nextProductId) {
        setSelectedId(nextProductId);
      }
      chatPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }, [selectedMessageId, selectedProductId, sellerReplies, slug]);

  const selectedProduct = products.find((product) => product.id === selectedId) ?? products[0];
  const selectedChatProducts = products.filter((product) => selectedProductIds.includes(product.id));
  const isFocusedProductChat = Boolean(selectedProductId);
  const isGeneralSellerChat = !selectedProductId && !selectedMessageId;
  const categories = useMemo(() => Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort(), [products]);
  const visibleProducts = searchTerm
    ? products.filter((product) => `${product.name} ${product.category} ${product.variant_options ?? ""}`.toLowerCase().includes(searchTerm.toLowerCase()))
    : products;
  const conversationMessages = useMemo(() => localMessages.slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()), [localMessages]);

  function chooseProduct(productId: string) {
    setSelectedId(productId);
    setSelectedProductIds((current) => (current.includes(productId) ? current : [...current, productId]));
    window.setTimeout(() => {
      chatPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function toggleChatProduct(productId: string) {
    setSelectedId(productId);
    setSelectedProductIds((current) => {
      if (current.includes(productId)) {
        const next = current.filter((id) => id !== productId);
        return next.length > 0 ? next : [productId];
      }
      return [...current, productId].slice(0, 6);
    });
  }

  function replyToSellerMessage(reply: SellerReply) {
    const offer = parseChatOffer(reply.seller_reply, reply.id);
    if (offer) {
      setMessageDraft(`About the deal price for ${offer.product_name}: `);
      setReplyingToId("");
      return;
    }
    const shortReply = reply.seller_reply.length > 58 ? `${reply.seller_reply.slice(0, 58)}...` : reply.seller_reply;
    setMessageDraft(`Replying to seller: "${shortReply}" `);
    setReplyingToId("");
  }

  function acceptSellerOffer(reply: SellerReply) {
    const offer = parseChatOffer(reply.seller_reply, reply.id);
    if (!offer) return;
    const product = products.find((item) => item.id === offer.product_id) ?? selectedProduct;
    if (!product) {
      setNotice("This deal product is no longer available.");
      return;
    }

    const nextCart = applyOfferToCart(
      {
        id: product.id,
        user_id: product.user_id,
        store_slug: slug,
        name: product.name,
        category: product.category,
        variant_options: product.variant_options,
        price: product.price,
        stock: product.stock,
        image_url: product.image_url,
        agreed_price: offer.agreed_price,
        agreed_delivery_fee: offer.delivery_fee,
        bargain_message_id: offer.message_id,
      },
      offer,
    );
    setAcceptedOfferIds(readAcceptedOffers(slug).map((item) => item.message_id));
    setCartCount(nextCart.filter((item) => item.store_slug === slug).reduce((sum, item) => sum + item.qty, 0));
    setNotice("Deal accepted. Opening checkout with your agreed price...");
    window.setTimeout(() => {
      window.location.href = `/checkout?store=${encodeURIComponent(slug)}`;
    }, 450);
  }

  function handleReplySwipeEnd(clientX: number, reply: SellerReply) {
    if (replySwipeStart === null) return;
    const delta = clientX - replySwipeStart;
    if (Math.abs(delta) > 42) {
      setReplyingToId(reply.id);
      setReplySwipeWasDragged(true);
    }
    setReplySwipeStart(null);
    setReplySwipeDelta(0);
  }

  function handleReplySwipeMove(clientX: number) {
    if (replySwipeStart === null) return;
    const delta = Math.max(-88, Math.min(88, clientX - replySwipeStart));
    if (Math.abs(delta) > 8) {
      setReplySwipeWasDragged(true);
    }
    setReplySwipeDelta(delta);
  }

  function toggleSellerReply(replyId: string) {
    if (replySwipeWasDragged) {
      setReplySwipeWasDragged(false);
      return;
    }
    setReplyingToId(replyingToId === replyId ? "" : replyId);
  }

  function replyMessageTransform(replyId: string) {
    if (replyingToId === replyId) return "translateX(-5rem)";
    if (replySwipeStart !== null) return `translateX(${replySwipeDelta}px)`;
    return "translateX(0)";
  }

  function startCustomerChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const customerName = String(formData.get("customer_name") ?? "").trim();
    const customerPhone = String(formData.get("customer_phone") ?? "").trim();

    if (!customerName || !customerPhone) {
      setNotice("Enter your name and phone number to start chatting.");
      return;
    }

    const nextIdentity = { customer_name: customerName, customer_phone: customerPhone };
    saveCustomerChatIdentity(slug, nextIdentity);
    setCustomerIdentity(nextIdentity);
    setNotice("");
    window.setTimeout(() => {
      chatPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!profile?.user_id || !selectedProduct?.id) {
      setNotice("This store is still loading. Wait a moment, then send your message again.");
      return;
    }

    setSending(true);
    setNotice("");
    const customerName = customerIdentity?.customer_name ?? "";
    const customerPhone = customerIdentity?.customer_phone ?? "";
    const message = messageDraft.trim();
    if (!customerName || !customerPhone) {
      setNotice("Start the chat with your name and phone number first.");
      setSending(false);
      return;
    }

    let response: Response;
    let data: { message?: string; id?: string };
    try {
      response = await fetch("/api/customer-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerId: profile.user_id,
          storeSlug: slug,
          productId: selectedProduct.id,
          productName: selectedChatProducts.length > 1 ? selectedChatProducts.map((product) => product.name).join(", ") : selectedProduct.name,
          customerName,
          customerPhone,
          message,
        }),
      });
      data = await safeJson(response);
    } catch {
      setNotice("Could not connect to customer chat. Refresh the page and try again.");
      setSending(false);
      return;
    }

    if (!response.ok) {
      setNotice(formatChatError(data.message));
      setSending(false);
      return;
    }

    if (!data.id) {
      setNotice("Customer chat did not return a message ID. Please try again.");
      setSending(false);
      return;
    }

    const savedMessage = {
      id: data.id,
      product_id: selectedProduct.id,
      product_name: selectedChatProducts.length > 1 ? selectedChatProducts.map((product) => product.name).join(", ") : selectedProduct.name,
      customer_name: customerName,
      customer_phone: customerPhone,
      message,
      created_at: new Date().toISOString(),
    };
    const nextIdentity = { customer_name: customerName, customer_phone: customerPhone };
    saveCustomerChatIdentity(slug, nextIdentity);
    setCustomerIdentity(nextIdentity);
    saveCustomerMessageId(slug, data.id);
    saveLocalChat(slug, savedMessage);
    setLocalMessages(readLocalChat(slug));
    window.dispatchEvent(new Event("sellmate-customer-messages-updated"));
    form.reset();
    setMessageDraft("");
    setSending(false);
  }

  if (loading) return <LoadingScreen label="Opening chat..." />;

  const storeHref = `/store/${slug}`;

  if (customerIdentity) {
    return (
      <main className="flex h-[100dvh] overflow-hidden bg-[#EEF2F7]">
        {!isFocusedProductChat && !isGeneralSellerChat ? (
          <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
            <div className="border-b border-slate-100 p-4">
              <Link href={storeHref} className="inline-flex items-center gap-2 text-sm font-black text-slate-600 hover:text-emerald-700">
                <span aria-hidden="true">←</span>
                Back to store
              </Link>
              <h1 className="mt-4 text-xl font-black text-slate-950">Messages</h1>
              <p className="mt-1 text-sm font-semibold text-slate-500">Choose a product to chat about.</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {visibleProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => chooseProduct(product.id)}
                  className={`mb-2 flex w-full min-w-0 items-center gap-3 rounded-lg border p-2 text-left transition ${selectedProduct?.id === product.id ? "border-emerald-300 bg-emerald-50" : "border-slate-100 bg-white hover:border-emerald-200"}`}
                >
                  <span className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-slate-100">
                    {product.image_url ? <img src={product.image_url} alt="" className="h-full w-full object-cover" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-slate-950">{product.name}</span>
                    <span className="block text-xs font-bold text-emerald-700">{formatNaira(product.price)}</span>
                  </span>
                </button>
              ))}
            </div>
          </aside>
        ) : null}

        <section ref={chatPanelRef} className="flex min-w-0 flex-1 flex-col bg-white">
          <header className="flex min-h-[4.25rem] shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <Link href={storeHref} aria-label="Back to store" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xl font-black text-slate-600 hover:bg-slate-100">
                ←
              </Link>
              <SellerAvatar name={profile?.business_name ?? "Seller"} imageUrl={profile?.logo_url} />
              <div className="min-w-0">
                <p className="truncate text-base font-black text-slate-950">{profile?.business_name ?? "Seller"}</p>
                <p className="text-xs font-bold text-emerald-700">Online now</p>
              </div>
            </div>
            <Link href={`/cart?store=${encodeURIComponent(slug)}`} aria-label="Open cart" className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-950 hover:bg-slate-100">
              <IconGlyph name="cart" className="h-5 w-5" />
              {cartCount > 0 ? <span className="absolute right-0 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-[#16A34A] px-1 text-[10px] font-black text-white">{cartCount}</span> : null}
            </Link>
          </header>

          {!isGeneralSellerChat ? <div className="shrink-0 border-b border-slate-100 bg-white px-3 py-2 sm:px-5">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {visibleProducts.map((product) => {
                const isSelected = selectedProductIds.includes(product.id);
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => toggleChatProduct(product.id)}
                    className={`flex min-w-[8rem] items-center gap-2 rounded-lg border p-2 text-left transition ${isSelected ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-200"}`}
                  >
                    <span className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-slate-100">
                      {product.image_url ? <img src={product.image_url} alt="" className="h-full w-full object-cover" /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-black text-slate-950">{product.name}</span>
                      <span className="block text-[11px] font-bold text-emerald-700">{formatNaira(product.price)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div> : null}

          <div className="min-h-0 flex-1 overflow-y-auto bg-[#F5F7FB] px-3 py-4 sm:px-5">
            {selectedProduct ? (
              <div className="mb-4 mr-auto max-w-[92%] sm:max-w-lg">
                <div className="flex gap-3 rounded-2xl rounded-bl-md bg-white p-3 shadow-sm ring-1 ring-slate-200">
                  <span className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {selectedProduct.image_url ? <img src={selectedProduct.image_url} alt="" className="h-full w-full object-cover" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">Product you selected</span>
                    <span className="mt-1 block truncate text-sm font-black text-slate-950">{selectedProduct.name}</span>
                    <span className="block text-sm font-black text-emerald-700">{formatNaira(selectedProduct.price)}</span>
                    {selectedProduct.variant_options ? <span className="mt-1 line-clamp-2 text-xs font-semibold text-slate-500">{selectedProduct.variant_options}</span> : null}
                  </span>
                </div>
              </div>
            ) : null}

            {conversationMessages.length === 0 ? (
              <div className="grid min-h-[18rem] place-items-center text-center">
                <div>
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                    <IconGlyph name="messages" className="h-5 w-5" />
                  </div>
                  <p className="mt-3 text-base font-black text-slate-950">You are now in the chat</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm font-semibold leading-6 text-slate-500">Type your message below. The seller will see your name and phone number.</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                {conversationMessages.map((message) => {
                  const reply = sellerReplies.find((item) => item.id === message.id);
                  return (
                    <div key={message.id} className="grid gap-3">
                      <div className="ml-auto max-w-[86%] rounded-2xl rounded-br-md bg-[#16A34A] px-3.5 py-2.5 text-white sm:max-w-xl">
                        <p className="mb-2 rounded-full bg-white/15 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white/85">{message.product_name}</p>
                        <p className="text-sm font-semibold leading-6">{message.message}</p>
                        <p className="mt-2 text-[11px] font-bold text-white/75">{new Date(message.created_at).toLocaleString()}</p>
                      </div>
                      {reply?.seller_reply ? (
                        <div className="mr-auto max-w-[86%] sm:max-w-xl">
                          <div className="relative overflow-hidden rounded-2xl rounded-bl-md bg-emerald-50 ring-1 ring-emerald-100">
                            <button
                              type="button"
                              onClick={() => replyToSellerMessage(reply)}
                              className={`absolute inset-y-0 right-3 my-auto h-10 rounded-full bg-[#16A34A] px-4 text-sm font-black text-white shadow-sm transition ${replyingToId === reply.id ? "translate-x-0 opacity-100" : "translate-x-5 opacity-0 pointer-events-none"}`}
                            >
                              Reply
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleSellerReply(reply.id)}
                              onTouchStart={(event) => {
                                setReplySwipeStart(event.touches[0]?.clientX ?? null);
                                setReplySwipeDelta(0);
                                setReplySwipeWasDragged(false);
                              }}
                              onTouchMove={(event) => handleReplySwipeMove(event.touches[0]?.clientX ?? 0)}
                              onTouchEnd={(event) => handleReplySwipeEnd(event.changedTouches[0]?.clientX ?? 0, reply)}
                              onMouseDown={(event) => {
                                setReplySwipeStart(event.clientX);
                                setReplySwipeDelta(0);
                                setReplySwipeWasDragged(false);
                              }}
                              onMouseMove={(event) => handleReplySwipeMove(event.clientX)}
                              onMouseUp={(event) => handleReplySwipeEnd(event.clientX, reply)}
                              onMouseLeave={(event) => handleReplySwipeEnd(event.clientX, reply)}
                              style={{ transform: replyMessageTransform(reply.id) }}
                              className="relative z-10 w-full touch-pan-y rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-left text-slate-800 shadow-sm ring-1 ring-slate-200 transition-transform"
                            >
                              <span className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Seller replied</span>
                              {parseChatOffer(reply.seller_reply, reply.id) ? (
                                <CustomerOfferCard offer={parseChatOffer(reply.seller_reply, reply.id)!} accepted={acceptedOfferIds.includes(reply.id)} onAccept={() => acceptSellerOffer(reply)} />
                              ) : (
                                <span className="mt-2 block text-sm font-semibold leading-6">{reply.seller_reply}</span>
                              )}
                              {reply.replied_at ? <span className="mt-2 block text-[11px] font-bold text-slate-400">{new Date(reply.replied_at).toLocaleString()}</span> : null}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="ml-auto rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500 ring-1 ring-slate-200">Sent to seller</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {notice ? <p className="mx-3 mt-2 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-700 sm:mx-5">{notice}</p> : null}
          <form onSubmit={sendMessage} className="shrink-0 border-t border-slate-200 bg-white p-3 sm:px-5">
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
              {["Is this available?", "What colors do you have?", "How much is delivery?"].map((text) => (
                <button key={text} type="button" onClick={() => setMessageDraft(text)} className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700">
                  {text}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_3rem] items-end gap-2">
              <textarea name="message" required value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} maxLength={500} rows={1} placeholder="Type a message..." className="max-h-28 resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-950 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100" />
              <button disabled={sending || !profile?.user_id || !selectedProduct?.id} aria-label="Send message" className="grid h-12 w-12 place-items-center rounded-full bg-[#16A34A] text-lg font-black text-white transition hover:bg-[#15803D] disabled:cursor-not-allowed disabled:bg-slate-400">
                {sending ? "..." : "➤"}
              </button>
            </div>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="h-[100dvh] overflow-hidden bg-[#F5F7FB] pt-[10rem]">
      <StoreHeader
        sellerName={profile?.business_name ?? "Store"}
        sellerLogoUrl={profile?.logo_url}
        storeHref={storeHref}
        cartHref={`/cart?store=${encodeURIComponent(slug)}`}
        cartCount={cartCount}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        whatsappPhone={profile?.whatsapp_phone}
      />

      <section className={`mx-auto grid h-[calc(100dvh-10rem)] w-full max-w-6xl gap-3 px-3 pb-3 sm:px-5 ${isFocusedProductChat || isGeneralSellerChat ? "" : "md:grid-cols-[17rem_minmax(0,1fr)]"}`}>
        {!isFocusedProductChat && !isGeneralSellerChat ? <aside className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-3">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Choose product</p>
            <h1 className="mt-1 text-lg font-black text-slate-950">Chat with {profile?.business_name ?? "seller"}</h1>
          </div>
          <div className="flex flex-wrap gap-2 border-b border-slate-100 p-2">
            {categories.map((category) => (
              <Link key={category} href={`${storeHref}/products?category=${encodeURIComponent(category)}`} className="shrink-0 rounded-full border border-slate-200 px-2.5 py-1.5 text-[11px] font-black text-slate-600 hover:border-emerald-300 hover:text-emerald-700">
                {category}
              </Link>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 p-2 md:block md:max-h-[28rem] md:overflow-y-auto">
            {visibleProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => chooseProduct(product.id)}
                className={`flex min-w-0 flex-col gap-2 rounded-lg border p-2 text-left transition md:mb-2 md:flex-row md:items-center md:gap-2.5 ${selectedProduct?.id === product.id ? "border-emerald-300 bg-emerald-50" : "border-slate-100 bg-white hover:border-emerald-200"}`}
              >
                <span className="aspect-square w-full shrink-0 overflow-hidden rounded-md bg-slate-100 md:h-12 md:w-12">
                  {product.image_url ? <img src={product.image_url} alt="" className="h-full w-full object-cover" /> : null}
                </span>
                <span className="min-w-0">
                  <span className="line-clamp-2 block text-sm font-black leading-tight text-slate-950 md:truncate">{product.name}</span>
                  <span className="block text-xs font-bold text-emerald-700">{formatNaira(product.price)}</span>
                </span>
              </button>
            ))}
          </div>
        </aside> : null}

        <section ref={chatPanelRef} className="flex min-h-0 scroll-mt-[8.5rem] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-white p-3">
            <div className="flex min-w-0 items-center gap-3">
              <SellerAvatar name={profile?.business_name ?? "Seller"} imageUrl={profile?.logo_url} />
              <div className="min-w-0">
                <p className="truncate text-base font-black text-slate-950">{profile?.business_name ?? "Seller"}</p>
                <p className="text-xs font-bold text-emerald-700">Online store chat</p>
              </div>
            </div>
            <div className="hidden shrink-0 items-center gap-2 rounded-full bg-slate-50 px-3 py-2 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-black text-slate-600">{conversationMessages.length} message(s)</span>
            </div>
          </div>

          {!isGeneralSellerChat ? <div className="border-b border-slate-100 bg-white p-3">
            <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50 p-2.5">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-white ring-1 ring-emerald-100">
                {selectedProduct?.image_url ? <img src={selectedProduct.image_url} alt="" className="h-full w-full object-contain p-1" /> : null}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">Current product</p>
                <p className="truncate text-sm font-black text-slate-950">{selectedProduct?.name ?? "Select a product"}</p>
                <p className="mt-1 text-base font-black text-emerald-700">{selectedProduct ? formatNaira(selectedProduct.price) : ""}</p>
                {selectedProduct ? (
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-bold text-slate-600">
                    <span className="rounded bg-white px-2 py-1">{selectedProduct.category}</span>
                    <span className="rounded bg-white px-2 py-1">{selectedProduct.stock} available</span>
                    {selectedProduct.variant_options ? <span className="max-w-full truncate rounded bg-white px-2 py-1">{selectedProduct.variant_options}</span> : null}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {visibleProducts.map((product) => {
                const isSelected = selectedProductIds.includes(product.id);
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => toggleChatProduct(product.id)}
                    className={`flex min-w-[8.5rem] items-center gap-2 rounded-lg border p-2 text-left transition ${isSelected ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-200"}`}
                  >
                    <span className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-slate-100">
                      {product.image_url ? <img src={product.image_url} alt="" className="h-full w-full object-cover" /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-black text-slate-950">{product.name}</span>
                      <span className="block text-[11px] font-bold text-emerald-700">{formatNaira(product.price)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div> : null}

          {!customerIdentity ? (
            <div className="grid min-h-0 flex-1 place-items-center overflow-y-auto bg-slate-50 p-4">
              <form onSubmit={startCustomerChat} className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                  <IconGlyph name="messages" className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-center text-xl font-black text-slate-950">Start chat with seller</h2>
                <p className="mx-auto mt-2 max-w-sm text-center text-sm font-semibold leading-6 text-slate-500">Enter your details once. After this, you will enter the chat room and only type messages.</p>
                <div className="mt-5 grid gap-3">
                  <input name="customer_name" required placeholder="Your name" className="rounded-md border border-slate-300 bg-white px-3 py-3 text-base font-semibold text-slate-950 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100" />
                  <input name="customer_phone" required placeholder="Phone number" className="rounded-md border border-slate-300 bg-white px-3 py-3 text-base font-semibold text-slate-950 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100" />
                  <button className="rounded-md bg-[#16A34A] px-5 py-3 text-sm font-black text-white transition hover:bg-[#15803D]">Enter chat</button>
                </div>
              </form>
            </div>
          ) : (
          <>
          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-3">
            {conversationMessages.length === 0 ? (
              <div className="grid min-h-[18rem] place-items-center text-center">
                <div>
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                    <IconGlyph name="messages" className="h-5 w-5" />
                  </div>
                  <p className="mt-3 text-base font-black text-slate-950">Start chatting with the seller</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm font-semibold leading-6 text-slate-500">Pick a product, ask your question, then continue here like one normal conversation.</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                {conversationMessages.map((message) => {
                  const reply = sellerReplies.find((item) => item.id === message.id);
                  return (
                    <div key={message.id} className="grid gap-3">
                      <div className="ml-auto max-w-[82%] rounded-2xl rounded-br-md bg-[#16A34A] px-3.5 py-2.5 text-white">
                        <p className="mb-2 rounded-full bg-white/15 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white/85">{message.product_name}</p>
                        <p className="text-sm font-semibold leading-6">{message.message}</p>
                        <p className="mt-2 text-[11px] font-bold text-white/75">{new Date(message.created_at).toLocaleString()}</p>
                      </div>
                      {reply?.seller_reply ? (
                        <div className="mr-auto max-w-[82%]">
                          <div className="relative overflow-hidden rounded-2xl rounded-bl-md bg-emerald-50 ring-1 ring-emerald-100">
                            <button
                              type="button"
                              onClick={() => replyToSellerMessage(reply)}
                              className={`absolute inset-y-0 right-3 my-auto h-10 rounded-full bg-[#16A34A] px-4 text-sm font-black text-white shadow-sm transition ${replyingToId === reply.id ? "translate-x-0 opacity-100" : "translate-x-5 opacity-0 pointer-events-none"}`}
                            >
                              Reply
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleSellerReply(reply.id)}
                              onTouchStart={(event) => {
                                setReplySwipeStart(event.touches[0]?.clientX ?? null);
                                setReplySwipeDelta(0);
                                setReplySwipeWasDragged(false);
                              }}
                              onTouchMove={(event) => handleReplySwipeMove(event.touches[0]?.clientX ?? 0)}
                              onTouchEnd={(event) => handleReplySwipeEnd(event.changedTouches[0]?.clientX ?? 0, reply)}
                              onMouseDown={(event) => {
                                setReplySwipeStart(event.clientX);
                                setReplySwipeDelta(0);
                                setReplySwipeWasDragged(false);
                              }}
                              onMouseMove={(event) => handleReplySwipeMove(event.clientX)}
                              onMouseUp={(event) => handleReplySwipeEnd(event.clientX, reply)}
                              onMouseLeave={(event) => handleReplySwipeEnd(event.clientX, reply)}
                              style={{ transform: replyMessageTransform(reply.id) }}
                              className="relative z-10 w-full touch-pan-y rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-left text-slate-800 shadow-sm ring-1 ring-slate-200 transition-transform"
                            >
                              <span className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Seller replied</span>
                              {parseChatOffer(reply.seller_reply, reply.id) ? (
                                <CustomerOfferCard offer={parseChatOffer(reply.seller_reply, reply.id)!} accepted={acceptedOfferIds.includes(reply.id)} onAccept={() => acceptSellerOffer(reply)} />
                              ) : (
                                <span className="mt-2 block text-sm font-semibold leading-6">{reply.seller_reply}</span>
                              )}
                              {reply.replied_at ? <span className="mt-2 block text-[11px] font-bold text-slate-400">{new Date(reply.replied_at).toLocaleString()}</span> : null}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="ml-auto rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500 ring-1 ring-slate-200">Sent to seller</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {notice ? <p className="mx-3 mt-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-700">{notice}</p> : null}
          <form onSubmit={sendMessage} className="sticky bottom-0 border-t border-slate-100 bg-white p-3">
            <div className="mb-2 flex flex-wrap gap-2">
              {["Is this available?", "What colors do you have?", "How much is delivery?"].map((text) => (
                <button key={text} type="button" onClick={() => setMessageDraft(text)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700">
                  {text}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_3rem] items-end gap-2">
              <button type="button" aria-label="Add attachment" className="grid h-11 w-10 place-items-center rounded-full border border-slate-200 bg-slate-50 text-xl font-black text-slate-500">+</button>
              <textarea name="message" required value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} maxLength={500} rows={1} placeholder="Type a message..." className="max-h-28 resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-950 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100" />
              <button disabled={sending || !profile?.user_id || !selectedProduct?.id} aria-label="Send message" className="grid h-11 w-11 place-items-center rounded-full bg-[#16A34A] text-lg font-black text-white transition hover:bg-[#15803D] disabled:cursor-not-allowed disabled:bg-slate-400">
                {sending ? "..." : "➤"}
              </button>
            </div>
          </form>
          </>
          )}
        </section>
      </section>

      <PublicFooter sellerName={profile?.business_name} sellerLogoUrl={profile?.logo_url} storeHref={storeHref} />
    </main>
  );
}

function formatChatError(message?: string) {
  const text = message ?? "";
  if (text.toLowerCase().includes("customer_messages") || text.toLowerCase().includes("schema cache")) {
    return "Customer chat is not fully connected yet. Add the customer_messages table in Supabase first.";
  }
  return text || "Could not send your message.";
}

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function SellerAvatar({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-950 text-sm font-black text-white ring-2 ring-emerald-100">
      {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function CustomerOfferCard({ offer, accepted, onAccept }: { offer: NonNullable<ReturnType<typeof parseChatOffer>>; accepted: boolean; onAccept: () => void }) {
  const offerTotal = Number(offer.agreed_price ?? 0) + Number(offer.delivery_fee ?? 0);

  return (
    <span className="mt-2 block overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
      <span className="block bg-emerald-50 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Seller deal</span>
      <span className="block p-3">
        <span className="block text-sm font-black text-slate-950">{offer.product_name}</span>
        <span className="mt-3 grid gap-2 text-sm font-bold text-slate-700">
          {offer.agreed_price ? (
            <span className="flex items-center justify-between gap-3">
              <span>Agreed item price</span>
              <strong className="text-slate-950">{formatNaira(offer.agreed_price)}</strong>
            </span>
          ) : null}
          {offer.delivery_fee !== undefined ? (
            <span className="flex items-center justify-between gap-3">
              <span>Delivery fee</span>
              <strong className="text-slate-950">{formatNaira(offer.delivery_fee)}</strong>
            </span>
          ) : null}
          {offerTotal > 0 ? (
            <span className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2 text-base">
              <span>Total to pay</span>
              <strong className="text-emerald-700">{formatNaira(offerTotal)}</strong>
            </span>
          ) : null}
        </span>
        {offer.note ? <span className="mt-3 block whitespace-pre-wrap rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold leading-6 text-slate-700">{offer.note}</span> : null}
        <span className="mt-3 block rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold leading-5 text-emerald-800">
          Accepting this only changes your own checkout. The seller's public product price stays the same.
        </span>
        <button
          type="button"
          onClick={onAccept}
          disabled={accepted}
          className="mt-3 w-full rounded-full bg-[#16A34A] px-4 py-3 text-xs font-black text-white transition hover:bg-[#15803D] disabled:bg-slate-400"
        >
          {accepted ? "Deal added to checkout" : "Accept deal and checkout"}
        </button>
      </span>
    </span>
  );
}

function readCustomerMessageIds(storeSlug: string) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CUSTOMER_MESSAGE_KEY) || "{}") as Record<string, string[]>;
    return Array.isArray(parsed[storeSlug]) ? parsed[storeSlug] : [];
  } catch {
    return [];
  }
}

function saveCustomerMessageId(storeSlug: string, messageId: string) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CUSTOMER_MESSAGE_KEY) || "{}") as Record<string, string[]>;
    const current = Array.isArray(parsed[storeSlug]) ? parsed[storeSlug] : [];
    parsed[storeSlug] = [messageId, ...current.filter((id) => id !== messageId)].slice(0, 20);
    window.localStorage.setItem(CUSTOMER_MESSAGE_KEY, JSON.stringify(parsed));
  } catch {
    window.localStorage.setItem(CUSTOMER_MESSAGE_KEY, JSON.stringify({ [storeSlug]: [messageId] }));
  }
}

function markCustomerReplyRead(storeSlug: string, messageId: string) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CUSTOMER_READ_REPLIES_KEY) || "{}") as Record<string, string[]>;
    const current = Array.isArray(parsed[storeSlug]) ? parsed[storeSlug] : [];
    parsed[storeSlug] = [messageId, ...current.filter((id) => id !== messageId)].slice(0, 50);
    window.localStorage.setItem(CUSTOMER_READ_REPLIES_KEY, JSON.stringify(parsed));
  } catch {
    window.localStorage.setItem(CUSTOMER_READ_REPLIES_KEY, JSON.stringify({ [storeSlug]: [messageId] }));
  }
}

function readCustomerChatIdentity(storeSlug: string): CustomerChatIdentity | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CUSTOMER_CHAT_IDENTITY_KEY) || "{}") as Record<string, CustomerChatIdentity>;
    const identity = parsed[storeSlug];
    if (identity?.customer_name && identity?.customer_phone) {
      return identity;
    }
  } catch {
    return null;
  }
  return null;
}

function identityFromMessages(messages: LocalChatMessage[]): CustomerChatIdentity | null {
  const messageWithIdentity = messages.find((message) => message.customer_name && message.customer_phone);
  if (!messageWithIdentity) return null;
  return {
    customer_name: messageWithIdentity.customer_name,
    customer_phone: messageWithIdentity.customer_phone,
  };
}

function saveCustomerChatIdentity(storeSlug: string, identity: CustomerChatIdentity) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CUSTOMER_CHAT_IDENTITY_KEY) || "{}") as Record<string, CustomerChatIdentity>;
    parsed[storeSlug] = identity;
    window.localStorage.setItem(CUSTOMER_CHAT_IDENTITY_KEY, JSON.stringify(parsed));
  } catch {
    window.localStorage.setItem(CUSTOMER_CHAT_IDENTITY_KEY, JSON.stringify({ [storeSlug]: identity }));
  }
}

function readLocalChat(storeSlug: string) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CUSTOMER_CHAT_KEY) || "{}") as Record<string, LocalChatMessage[]>;
    return Array.isArray(parsed[storeSlug]) ? parsed[storeSlug] : [];
  } catch {
    return [];
  }
}

function saveLocalChat(storeSlug: string, message: LocalChatMessage) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CUSTOMER_CHAT_KEY) || "{}") as Record<string, LocalChatMessage[]>;
    const current = Array.isArray(parsed[storeSlug]) ? parsed[storeSlug] : [];
    parsed[storeSlug] = [message, ...current].slice(0, 40);
    window.localStorage.setItem(CUSTOMER_CHAT_KEY, JSON.stringify(parsed));
  } catch {
    window.localStorage.setItem(CUSTOMER_CHAT_KEY, JSON.stringify({ [storeSlug]: [message] }));
  }
}
