"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { LoadingScreen } from "@/components/loading-screen";
import { IconGlyph, PublicFooter, StoreHeader } from "@/components/ui";
import { readCart, writeCurrentStoreHref } from "@/lib/cart";
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

type SellerReply = {
  id: string;
  product_name: string;
  message: string;
  seller_reply: string;
  replied_at?: string | null;
  created_at: string;
};

const CUSTOMER_CHAT_KEY = "sellmate-ng-customer-chat";
const CUSTOMER_MESSAGE_KEY = "sellmate-ng-customer-messages";

export default function CustomerChatPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const slug = params.slug;
  const selectedProductId = searchParams.get("product") ?? "";
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
    async function loadReplies() {
      const ids = readCustomerMessageIds(slug);
      if (ids.length === 0) {
        setSellerReplies([]);
        return;
      }

      const response = await fetch(`/api/customer-messages?store=${encodeURIComponent(slug)}&ids=${encodeURIComponent(ids.join(","))}`);
      const data = await response.json();
      if (response.ok) {
        setSellerReplies(data.messages ?? []);
      }
    }

    loadReplies();
    window.addEventListener("sellmate-customer-messages-updated", loadReplies);
    return () => window.removeEventListener("sellmate-customer-messages-updated", loadReplies);
  }, [slug]);

  const selectedProduct = products.find((product) => product.id === selectedId) ?? products[0];
  const categories = useMemo(() => Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort(), [products]);
  const visibleProducts = searchTerm
    ? products.filter((product) => `${product.name} ${product.category} ${product.variant_options ?? ""}`.toLowerCase().includes(searchTerm.toLowerCase()))
    : products;
  const productMessages = selectedProduct ? localMessages.filter((message) => message.product_id === selectedProduct.id) : [];
  const productReplies = selectedProduct ? sellerReplies.filter((reply) => productMessages.some((message) => message.id === reply.id)) : [];

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !selectedProduct) return;

    setSending(true);
    setNotice("");
    const formData = new FormData(event.currentTarget);
    const customerName = String(formData.get("customer_name") ?? "").trim();
    const customerPhone = String(formData.get("customer_phone") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim();

    const response = await fetch("/api/customer-messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sellerId: profile.user_id,
        storeSlug: slug,
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        customerName,
        customerPhone,
        message,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setNotice(data.message ?? "Could not send your message.");
      setSending(false);
      return;
    }

    const savedMessage = {
      id: data.id,
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      customer_name: customerName,
      customer_phone: customerPhone,
      message,
      created_at: new Date().toISOString(),
    };
    saveCustomerMessageId(slug, data.id);
    saveLocalChat(slug, savedMessage);
    setLocalMessages(readLocalChat(slug));
    window.dispatchEvent(new Event("sellmate-customer-messages-updated"));
    event.currentTarget.reset();
    setSending(false);
  }

  if (loading) return <LoadingScreen label="Opening chat..." />;

  const storeHref = `/store/${slug}`;

  return (
    <main className="min-h-screen bg-[#F5F7FB] pt-[9.5rem] sm:pt-[7.25rem] lg:pt-[10rem]">
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

      <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 pb-10 sm:px-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Choose product</p>
            <h1 className="mt-1 text-xl font-black text-slate-950">Chat with {profile?.business_name ?? "seller"}</h1>
          </div>
          <div className="flex gap-2 overflow-x-auto border-b border-slate-100 p-3 lg:flex-wrap lg:overflow-visible">
            {categories.map((category) => (
              <Link key={category} href={`${storeHref}/products?category=${encodeURIComponent(category)}`} className="shrink-0 rounded-full border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:border-emerald-300 hover:text-emerald-700">
                {category}
              </Link>
            ))}
          </div>
          <div className="max-h-[32rem] overflow-y-auto p-3">
            {visibleProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => setSelectedId(product.id)}
                className={`mb-2 flex w-full items-center gap-3 rounded-lg border p-2 text-left transition ${selectedProduct?.id === product.id ? "border-emerald-300 bg-emerald-50" : "border-slate-100 bg-white hover:border-emerald-200"}`}
              >
                <span className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-slate-100">
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

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 bg-white p-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
              {selectedProduct?.image_url ? <img src={selectedProduct.image_url} alt="" className="h-full w-full object-cover" /> : null}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-black text-slate-950">{selectedProduct?.name ?? "Select a product"}</p>
              <p className="text-sm font-bold text-emerald-700">{selectedProduct ? formatNaira(selectedProduct.price) : ""}</p>
            </div>
          </div>

          <div className="min-h-[22rem] bg-slate-50 p-4">
            {productMessages.length === 0 ? (
              <div className="grid min-h-[16rem] place-items-center text-center">
                <div>
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                    <IconGlyph name="messages" className="h-6 w-6" />
                  </div>
                  <p className="mt-3 text-lg font-black text-slate-950">Start a product chat</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm font-semibold leading-6 text-slate-500">Ask about size, color, delivery, stock, or pickup before you buy.</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                {productMessages.map((message) => {
                  const reply = productReplies.find((item) => item.id === message.id);
                  return (
                    <div key={message.id} className="grid gap-3">
                      <div className="ml-auto max-w-[82%] rounded-2xl rounded-br-md bg-[#16A34A] px-4 py-3 text-white">
                        <p className="text-sm font-semibold leading-6">{message.message}</p>
                        <p className="mt-2 text-[11px] font-bold text-white/75">{new Date(message.created_at).toLocaleString()}</p>
                      </div>
                      {reply?.seller_reply ? (
                        <div className="mr-auto max-w-[82%] rounded-2xl rounded-bl-md bg-white px-4 py-3 text-slate-800 ring-1 ring-slate-200">
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Seller replied</p>
                          <p className="mt-2 text-sm font-semibold leading-6">{reply.seller_reply}</p>
                          {reply.replied_at ? <p className="mt-2 text-[11px] font-bold text-slate-400">{new Date(reply.replied_at).toLocaleString()}</p> : null}
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

          {notice ? <p className="mx-4 mt-4 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-700">{notice}</p> : null}
          <form onSubmit={sendMessage} className="grid gap-3 border-t border-slate-100 p-4 sm:grid-cols-2">
            <input name="customer_name" required placeholder="Your name" className="rounded-md border border-slate-300 px-3 py-3 text-base font-semibold outline-none focus:border-emerald-600" />
            <input name="customer_phone" required placeholder="Phone number" className="rounded-md border border-slate-300 px-3 py-3 text-base font-semibold outline-none focus:border-emerald-600" />
            <textarea name="message" required maxLength={500} rows={3} placeholder="Type your message..." className="resize-none rounded-md border border-slate-300 px-3 py-3 text-base font-semibold outline-none focus:border-emerald-600 sm:col-span-2" />
            <button disabled={sending || !selectedProduct} className="rounded-md bg-[#16A34A] px-5 py-3 text-sm font-black text-white transition hover:bg-[#15803D] disabled:cursor-not-allowed disabled:bg-slate-400 sm:col-span-2">
              {sending ? "Sending..." : "Send message"}
            </button>
          </form>
        </section>
      </section>

      <PublicFooter sellerName={profile?.business_name} sellerLogoUrl={profile?.logo_url} storeHref={storeHref} />
    </main>
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

function readLocalChat(storeSlug: string) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CUSTOMER_CHAT_KEY) || "{}") as Record<string, LocalChatMessage[]>;
    return Array.isArray(parsed[storeSlug]) ? parsed[storeSlug] : [];
  } catch {
    return [];
  }
}

function saveLocalChat(storeSlug: string, message: LocalChatMessage) {
  const parsed = JSON.parse(window.localStorage.getItem(CUSTOMER_CHAT_KEY) || "{}") as Record<string, LocalChatMessage[]>;
  const current = Array.isArray(parsed[storeSlug]) ? parsed[storeSlug] : [];
  parsed[storeSlug] = [message, ...current].slice(0, 40);
  window.localStorage.setItem(CUSTOMER_CHAT_KEY, JSON.stringify(parsed));
}
