"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PublicFooter, SectionTitle, SellerLogo } from "@/components/ui";
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

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setMounted(true);
      const cartItems = readCart();
      setStoreHref(cartItems[0]?.store_slug ? `/store/${cartItems[0].store_slug}` : readCurrentStoreHref());
      const nextItems = await syncCartWithProducts(cartItems, setItems, setMessage);
      await loadSellerDetails(nextItems, setDelivery, setSellerName, setSellerLogoUrl, setStoreHref);
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

    const validatedItems = await syncCartWithProducts(items, setItems, setMessage);
    if (validatedItems.length === 0 || validatedItems.length !== items.length) {
      setSaving(false);
      return;
    }

    const orderPayload = {
      user_id: sellerId,
      customer_name: customerName,
      customer_phone: customerPhone,
      city,
      delivery_address: deliveryAddress,
      subtotal,
      delivery_fee: delivery,
      total,
      status: "New",
      payment_status: "Pending",
    };

    const { data: order, error: orderError } = await supabase.from("orders").insert(orderPayload).select("id").single();
    if (orderError || !order) {
      setMessage(orderError?.message ?? "Could not create order.");
      setSaving(false);
      return;
    }

    const orderItems = validatedItems.map((item) => ({
      order_id: order.id,
      product_id: item.id,
      product_name: item.name,
      quantity: item.qty,
      unit_price: item.price,
      line_total: item.price * item.qty,
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
    if (itemsError) {
      setMessage(formatCheckoutError(itemsError.message));
      setSaving(false);
      return;
    }

    const { data: sellerProfile } = await supabase
      .from("seller_profiles")
      .select("business_name,whatsapp_phone")
      .eq("user_id", sellerId)
      .maybeSingle();

    savePendingWhatsAppOrder({
      orderId: order.id,
      sellerName: sellerProfile?.business_name ?? "the seller",
      sellerPhone: sellerProfile?.whatsapp_phone ?? "",
      customerName,
      customerPhone,
      city,
      deliveryAddress,
      total,
      items: validatedItems,
    });

    const paymentResult = await fetch("/api/paystack/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order.id,
        email: customerEmail,
        amount: total,
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
      <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,#e0f2fe_0,#eef5fb_34%,#f8fafc_68%)] px-5">
        <div className="rounded-lg border border-slate-300 bg-white/90 p-6 text-center shadow-lg">
          <p className="text-sm font-black text-slate-950">Loading checkout...</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">Getting your cart and seller details first.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#e0f2fe_0,#eef5fb_34%,#f8fafc_68%)] pt-20">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-300 bg-slate-200/95 shadow-sm backdrop-blur">
        <nav className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-4 px-5">
          <div className="flex min-w-0 items-center gap-3">
            <SellerLogo name={sellerName} logoUrl={sellerLogoUrl} />
            <div className="min-w-0">
              <p className="truncate text-lg font-black capitalize leading-tight text-slate-950 sm:text-2xl">{sellerName}</p>
              <p className="hidden text-xs font-semibold text-slate-500 sm:block">Secure Paystack checkout</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/cart" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-800 shadow-sm hover:bg-slate-50 sm:px-4 sm:text-sm">Cart</Link>
            <Link href={storeHref} className="rounded-md bg-slate-950 px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-slate-800 sm:px-4 sm:text-sm">Shop products</Link>
          </div>
        </nav>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-10 lg:grid-cols-[1fr_380px]">
        <section>
          <SectionTitle eyebrow="Checkout" title="Delivery and payment" />
          <form onSubmit={placeOrder} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            {message ? <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{message}</div> : null}
            <div className="grid gap-4 md:grid-cols-2">
              <CheckoutField label="Full name" name="customer_name" placeholder="Muna Okafor" />
              <CheckoutField label="Email for payment receipt" name="customer_email" placeholder="customer@example.com" type="email" />
              <CheckoutField label="Phone number" name="customer_phone" placeholder="+234 801 234 5678" />
              <CheckoutField label="City" name="city" placeholder="Lagos" />
              <CheckoutField label="Delivery address" name="delivery_address" placeholder="12 Admiralty Way, Lekki" />
            </div>
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Payment is processed securely through Paystack. Delivery fee is set by this seller in their dashboard.
            </div>
            <label className="mt-5 flex cursor-pointer gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={securityAccepted}
                onChange={(event) => setSecurityAccepted(event.target.checked)}
                className="mt-1 h-4 w-4 accent-emerald-700"
              />
              <span>
                I confirm my delivery details are correct and I understand this payment is processed securely through Paystack.
              </span>
            </label>
            <button disabled={!mounted || items.length === 0 || saving || !securityAccepted} className="mt-5 w-full rounded-md bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-400">{saving ? "Opening payment..." : "Pay now"}</button>
          </form>
        </section>
        <aside className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Order summary</h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-600">
            {mounted && items.length === 0 ? <p>No item to checkout yet. Go back to the store and add products first.</p> : null}
            {items.map((item) => (
              <div key={item.id} className="flex justify-between gap-4">
                <span>{item.name} x {item.qty}</span>
                <strong className="text-slate-950">{formatNaira(item.price * item.qty)}</strong>
              </div>
            ))}
            {items.length > 0 ? <div className="flex justify-between gap-4">
              <span>Delivery</span>
              <strong className="text-slate-950">{formatNaira(delivery)}</strong>
            </div> : null}
          </div>
          <div className="mt-5 flex justify-between border-t border-slate-200 pt-5 text-xl font-black text-slate-950">
            <span>Total</span>
            <span>{formatNaira(total)}</span>
          </div>
          <Link href={storeHref} className="mt-5 block text-center text-sm font-bold text-emerald-700">Back to store</Link>
        </aside>
      </div>
          <PublicFooter sellerName={sellerName} sellerLogoUrl={sellerLogoUrl} storeHref={storeHref} />
    </main>
  );
}

async function loadSellerDetails(
  items: CartItem[],
  setDelivery: (fee: number) => void,
  setSellerName: (name: string) => void,
  setSellerLogoUrl: (url: string) => void,
  setStoreHref: (href: string) => void,
) {
  const sellerId = items[0]?.user_id;
  if (!sellerId) {
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

function CheckoutField({ label, name, placeholder, type = "text" }: { label: string; name: string; placeholder: string; type?: string }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      {label}
      <input name={name} type={type} required className="rounded-md border border-slate-300 px-3 py-3 font-normal outline-none focus:border-emerald-600" placeholder={placeholder} />
    </label>
  );
}


