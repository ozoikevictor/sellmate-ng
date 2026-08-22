"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckoutHeader, PublicFooter } from "@/components/ui";
import { CartItem, cartTotal, readCart, readCurrentStoreHref, writeCart, writeCurrentStoreHref } from "@/lib/cart";
import { formatNaira } from "@/lib/data";
import { supabase } from "@/lib/supabase";

function makeStoreSlug(businessName: string, userId: string) {
  const baseSlug = businessName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${baseSlug || "store"}-${userId.slice(0, 6)}`;
}

type ProductCheck = {
  id: string;
  user_id: string;
  name: string;
  category: string;
  variant_options: string | null;
  price: number;
  stock: number;
  status: string;
};

export default function CheckoutPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [securityAccepted, setSecurityAccepted] = useState(false);
  const [delivery, setDelivery] = useState(0);
  const [sellerName, setSellerName] = useState("Store");
  const [sellerLogoUrl, setSellerLogoUrl] = useState("");
  const [storeHref, setStoreHref] = useState("/");
  const subtotal = cartTotal(items);
  const total = items.length > 0 ? subtotal + delivery : 0;
  const itemCount = items.reduce((sum, item) => sum + item.qty, 0);
  const storeSlug = storeHref.startsWith("/store/") ? storeHref.replace("/store/", "").split(/[?#]/)[0] : "";
  const cartHref = storeSlug ? `/cart?store=${encodeURIComponent(storeSlug)}` : "/cart";

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const allCartItems = readCart();
      const storeSlugFromUrl = new URLSearchParams(window.location.search).get("store");
      const cartItems = storeSlugFromUrl ? allCartItems.filter((item) => item.store_slug === storeSlugFromUrl) : allCartItems;
      const preferredStoreHref = storeSlugFromUrl ? `/store/${storeSlugFromUrl}` : cartItems[0]?.store_slug ? `/store/${cartItems[0].store_slug}` : readCurrentStoreHref();
      setStoreHref(preferredStoreHref);
      const nextItems = await syncCartWithProducts(cartItems, setItems, setMessage);
      await loadSellerDetails(nextItems, setDelivery, setSellerName, setSellerLogoUrl, setStoreHref, preferredStoreHref);
      setMounted(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function placeOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (items.length === 0) {
      return;
    }
    if (!securityAccepted) {
      setMessage("Please confirm the security check before continuing to payment.");
      return;
    }

    const sellerId = items[0]?.user_id;
    if (!sellerId) {
      setMessage("This cart is missing seller information. Go back to the store and add the product again.");
      return;
    }

    setSaving(true);
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const customerName = String(formData.get("customer_name") ?? "").trim();
    const customerEmail = String(formData.get("customer_email") ?? "").trim();
    const customerPhone = String(formData.get("customer_phone") ?? "").trim();
    const city = String(formData.get("city") ?? "").trim();
    const deliveryAddress = String(formData.get("delivery_address") ?? "").trim();

    if (!isValidEmail(customerEmail)) {
      setMessage("Email not correct. Please enter a valid email address for your payment receipt.");
      setSaving(false);
      return;
    }

    const validatedItems = await syncCartWithProducts(items, setItems, setMessage);
    if (validatedItems.length === 0 || validatedItems.length !== items.length) {
      setSaving(false);
      return;
    }

    const orderResult = await fetch("/api/checkout/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sellerId,
        customerName,
        customerPhone,
        city,
        deliveryAddress,
        items: validatedItems.map((item) => ({
          id: item.id,
          qty: item.qty,
        })),
      }),
    });
    const orderData = await orderResult.json();

    if (!orderResult.ok || !orderData.orderId) {
      setMessage(formatCheckoutError(orderData.message ?? "Could not create order."));
      setSaving(false);
      return;
    }

    const { data: sellerProfile } = await supabase
      .from("seller_profiles")
      .select("business_name,whatsapp_phone")
      .eq("user_id", sellerId)
      .maybeSingle();

    savePendingWhatsAppOrder({
      orderId: orderData.orderId,
      sellerName: sellerProfile?.business_name ?? "the seller",
      sellerPhone: sellerProfile?.whatsapp_phone ?? "",
      customerName,
      customerPhone,
      city,
      deliveryAddress,
      total: Number(orderData.total ?? total),
      items: validatedItems,
    });

    const paymentResult = await fetch("/api/paystack/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: orderData.orderId,
        email: customerEmail,
        amount: Number(orderData.total ?? total),
        customerName,
      }),
    });
    const paymentData = await paymentResult.json();

    if (!paymentResult.ok || !paymentData.authorizationUrl) {
      setMessage(paymentData.message ?? "Could not start payment. Please try again.");
      setSaving(false);
      return;
    }

    window.location.href = paymentData.authorizationUrl;
  }

  if (!mounted) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f2f6fb] px-5">
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-xl">
          <p className="text-sm font-black text-slate-950">Loading checkout...</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">Getting your cart and seller details first.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f2f6fb] pt-[72px]">
      <CheckoutHeader sellerName={sellerName} sellerLogoUrl={sellerLogoUrl} storeHref={storeHref} cartHref={cartHref} cartCount={itemCount} mode="checkout" />

      <section className="border-b border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#e7f8ef_55%,#fff4df_100%)]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_420px] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-700">Checkout</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-black leading-tight text-slate-950 sm:text-6xl">Delivery and payment.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">Add your delivery details, confirm the security check, then pay securely through Paystack.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
            <div className="grid gap-3">
              <CheckoutStep number="1" title="Delivery details" text="Name, phone, city, and address." />
              <CheckoutStep number="2" title="Security check" text="Confirm details before payment." />
              <CheckoutStep number="3" title="Paystack payment" text="Pay online and send WhatsApp receipt." />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_390px]">
        <section>
          <form onSubmit={placeOrder} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
            <div className="border-b border-slate-100 bg-white p-5">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-600">Customer details</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Where should the seller deliver?</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Use the correct email because the payment receipt and order update depend on it.</p>
            </div>
            <div className="p-5">
              {message ? <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{message}</div> : null}
              <div className="grid gap-4 md:grid-cols-2">
                <CheckoutField label="Full name" name="customer_name" placeholder="Muna Okafor" />
                <CheckoutField label="Email for payment receipt" name="customer_email" placeholder="customer@example.com" type="email" />
                <CheckoutField label="Phone number" name="customer_phone" placeholder="+234 801 234 5678" />
                <CheckoutField label="City" name="city" placeholder="Lagos" />
                <CheckoutField label="Delivery address" name="delivery_address" placeholder="12 Admiralty Way, Lekki" wide />
              </div>
              <div className="mt-5 rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm font-semibold leading-6 text-orange-900">
                Payment is processed securely through Paystack. Delivery fee is set by this seller in their dashboard.
              </div>
              <label className="mt-5 flex cursor-pointer gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-slate-800">
                <input
                  type="checkbox"
                  checked={securityAccepted}
                  onChange={(event) => setSecurityAccepted(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-emerald-700"
                />
                <span>I confirm my delivery details are correct and I understand this payment is processed securely through Paystack.</span>
              </label>
              <button disabled={!mounted || items.length === 0 || saving || !securityAccepted} className="mt-5 w-full rounded-md bg-orange-500 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-400">{saving ? "Opening payment..." : "Pay with Paystack"}</button>
            </div>
          </form>
        </section>

        <aside className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-lg lg:sticky lg:top-24">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Order summary</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">Payment total</h2>
          <div className="mt-5 grid gap-3 text-sm text-slate-600">
            {mounted && items.length === 0 ? <p>No item to checkout yet. Go back to the store and add products first.</p> : null}
            {items.map((item) => (
              <div key={item.id} className="flex justify-between gap-4">
                <span>{item.name} x {item.qty}</span>
                <strong className="text-slate-950">{formatNaira(item.price * item.qty)}</strong>
              </div>
            ))}
            {items.length > 0 ? (
              <>
                <div className="flex justify-between gap-4 border-t border-slate-100 pt-3">
                  <span>Delivery</span>
                  <strong className="text-slate-950">{formatNaira(delivery)}</strong>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-xs font-semibold leading-5 text-slate-500">After payment, SellMate prepares a neat WhatsApp receipt for the seller.</div>
              </>
            ) : null}
          </div>
          <div className="mt-5 flex justify-between border-t border-slate-200 pt-5 text-2xl font-black text-slate-950">
            <span>Total</span>
            <span className="text-orange-600">{formatNaira(total)}</span>
          </div>
          <Link href={storeHref} className="mt-5 block rounded-md border border-slate-300 bg-white px-5 py-3 text-center text-sm font-black text-slate-800 hover:border-orange-300 hover:bg-orange-50">Back to store</Link>
        </aside>
      </div>
      <PublicFooter sellerName={sellerName} sellerLogoUrl={sellerLogoUrl} storeHref={storeHref} />
    </main>
  );
}

function CheckoutStep({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-lg bg-slate-50 p-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-orange-500 text-sm font-black text-white">{number}</span>
      <span>
        <span className="block text-sm font-black text-slate-950">{title}</span>
        <span className="block text-xs font-semibold leading-5 text-slate-500">{text}</span>
      </span>
    </div>
  );
}

async function loadSellerDetails(
  items: CartItem[],
  setDelivery: (fee: number) => void,
  setSellerName: (name: string) => void,
  setSellerLogoUrl: (url: string) => void,
  setStoreHref: (href: string) => void,
  preferredStoreHref: string,
) {
  const sellerId = items[0]?.user_id;
  if (!sellerId) {
    const preferredSlug = preferredStoreHref.startsWith("/store/") ? preferredStoreHref.replace("/store/", "").split(/[?#]/)[0] : "";
    if (preferredSlug === "ada-fashion") {
      setDelivery(0);
      setSellerName("Demo Store");
      setSellerLogoUrl("");
      setStoreHref("/store/ada-fashion");
      writeCurrentStoreHref("/store/ada-fashion");
      return;
    }
    if (preferredSlug) {
      const { data } = await supabase
        .from("seller_profiles")
        .select("business_name,logo_url,logo_text,delivery_fee,store_slug")
        .eq("store_slug", preferredSlug)
        .maybeSingle();

      if (data) {
        const nextStoreHref = `/store/${data.store_slug || preferredSlug}`;
        setDelivery(Number(data.delivery_fee ?? 0));
        setSellerName(data.logo_text || data.business_name || "Store");
        setSellerLogoUrl(data.logo_url || "");
        setStoreHref(nextStoreHref);
        writeCurrentStoreHref(nextStoreHref);
        return;
      }
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const loggedInSellerId = sessionData.session?.user.id;
    if (loggedInSellerId) {
      const { data } = await supabase
        .from("seller_profiles")
        .select("business_name,logo_url,logo_text,delivery_fee,store_slug")
        .eq("user_id", loggedInSellerId)
        .maybeSingle();

      const businessName = data?.business_name || "Your store";
      const nextStoreHref = `/store/${data?.store_slug || makeStoreSlug(businessName, loggedInSellerId)}`;
      setDelivery(Number(data?.delivery_fee ?? 0));
      setSellerName(data?.logo_text || businessName);
      setSellerLogoUrl(data?.logo_url || "");
      setStoreHref(nextStoreHref);
      writeCurrentStoreHref(nextStoreHref);
      return;
    }

    const rememberedStoreHref = readCurrentStoreHref();
    setDelivery(0);
    setSellerName("Store");
    setSellerLogoUrl("");
    setStoreHref(rememberedStoreHref);
    return;
  }

  const { data } = await supabase
    .from("seller_profiles")
    .select("business_name,logo_url,logo_text,delivery_fee,store_slug")
    .eq("user_id", sellerId)
    .maybeSingle();

  setDelivery(Number(data?.delivery_fee ?? 0));
  setSellerName(data?.logo_text || data?.business_name || "Store");
  setSellerLogoUrl(data?.logo_url || "");
  const nextStoreHref = data?.store_slug || items[0]?.store_slug ? `/store/${data?.store_slug || items[0]?.store_slug}` : readCurrentStoreHref();
  setStoreHref(nextStoreHref);
  writeCurrentStoreHref(nextStoreHref);
}

async function syncCartWithProducts(
  currentItems: CartItem[],
  setItems: (items: CartItem[]) => void,
  setMessage: (message: string) => void,
) {
  if (currentItems.length === 0) {
    setItems([]);
    return [];
  }

  const ids = currentItems.map((item) => item.id);
  const { data, error } = await supabase
    .from("products")
    .select("id,user_id,name,category,variant_options,price,stock,status")
    .in("id", ids);

  if (error) {
    setItems(currentItems);
    setMessage(error.message);
    return currentItems;
  }

  const productsById = new Map((data ?? []).map((product: ProductCheck) => [product.id, product]));
  const nextItems: CartItem[] = [];
  currentItems.forEach((item) => {
    const product = productsById.get(item.id);
    if (!product || product.status !== "Live" || product.stock <= 0) {
      return;
    }

    nextItems.push({
      ...item,
      user_id: product.user_id,
      name: product.name,
      category: product.category,
      variant_options: product.variant_options,
      price: product.price,
      stock: product.stock,
      qty: Math.min(item.qty, product.stock),
    });
  });

  if (nextItems.length !== currentItems.length) {
    setMessage("One unavailable item was removed from your cart. Please review your order and place it again.");
  }

  writeCart(nextItems);
  setItems(nextItems);
  return nextItems;
}

function formatCheckoutError(message: string) {
  if (message.toLowerCase().includes("order_items_product_id_fkey")) {
    return "One item in your cart is no longer available. Remove it from the cart, add the product again from the store, then place the order.";
  }
  return message;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function savePendingWhatsAppOrder({
  orderId,
  sellerName,
  sellerPhone,
  customerName,
  customerPhone,
  city,
  deliveryAddress,
  total,
  items,
}: {
  orderId: string;
  sellerName: string;
  sellerPhone: string;
  customerName: string;
  customerPhone: string;
  city: string;
  deliveryAddress: string;
  total: number;
  items: CartItem[];
}) {
  const itemLines = items
    .map((item, index) => `${index + 1}. ${item.name}\n   Qty: ${item.qty}\n   Amount: ${formatNaira(item.price * item.qty)}`)
    .join("\n\n");
  const receiptDate = new Date().toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const text = [
    "PAYMENT RECEIPT",
    "------------------------------",
    `Store: ${sellerName}`,
    `Order No: ${orderId}`,
    "Payment Status: PAID",
    `Date: ${receiptDate}`,
    "",
    "CUSTOMER DETAILS",
    `Name: ${customerName}`,
    `Phone: ${customerPhone}`,
    `Delivery: ${deliveryAddress}, ${city}`,
    "",
    "ORDER ITEMS",
    itemLines,
    "",
    "------------------------------",
    `TOTAL PAID: ${formatNaira(total)}`,
    "------------------------------",
    "",
    "Please confirm my order and delivery details.",
    "Thank you.",
  ].join("\n");

  window.localStorage.setItem(
    "sellmate_pending_whatsapp",
    JSON.stringify({
      sellerPhone,
      text,
    }),
  );
}

function CheckoutField({ label, name, placeholder, type = "text", wide = false }: { label: string; name: string; placeholder: string; type?: string; wide?: boolean }) {
  return (
    <label className={`grid gap-2 text-sm font-bold text-slate-700 ${wide ? "md:col-span-2" : ""}`}>
      {label}
      <input name={name} type={type} required className="rounded-md border border-slate-300 bg-slate-50 px-3 py-3 font-normal outline-none transition focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-100" placeholder={placeholder} />
    </label>
  );
}


