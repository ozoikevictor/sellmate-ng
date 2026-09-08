"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { LoadingScreen } from "@/components/loading-screen";
import { CheckoutHeader, PublicFooter } from "@/components/ui";
import { clearCart, readCurrentStoreHref, updateCustomerOrder, writeCurrentStoreHref } from "@/lib/cart";

type PendingWhatsAppOrder = {
  orderId?: string;
  sellerName?: string;
  sellerLogoUrl?: string;
  sellerPhone?: string;
  storeHref?: string;
  storeSlug?: string;
  text?: string;
};

function PaymentCallbackContent() {
  const params = useSearchParams();
  const reference = params.get("reference");
  const order = params.get("order");
  const initialStore = getInitialStoreContext();
  const [status, setStatus] = useState<"checking" | "success" | "error">("checking");
  const [message, setMessage] = useState("Confirming your payment...");
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [storeHref, setStoreHref] = useState(initialStore.storeHref);
  const [sellerName, setSellerName] = useState(initialStore.sellerName);
  const [sellerLogoUrl, setSellerLogoUrl] = useState(initialStore.sellerLogoUrl);
  const storeSlug = storeHref.startsWith("/store/") ? storeHref.replace("/store/", "").split(/[?#]/)[0] : "";
  const cartHref = storeSlug ? `/cart?store=${encodeURIComponent(storeSlug)}` : "/cart";

  useEffect(() => {
    async function verifyPayment() {
      const pendingOrder = readPendingWhatsAppOrder();
      const nextStoreHref = getSafeStoreHref(pendingOrder?.storeHref || readCurrentStoreHref());
      setStoreHref(nextStoreHref);
      setSellerName(pendingOrder?.sellerName || "Store");
      setSellerLogoUrl(pendingOrder?.sellerLogoUrl || "");
      if (nextStoreHref !== "/") {
        writeCurrentStoreHref(nextStoreHref);
      }

      if (!reference || !order) {
        setStatus("error");
        setMessage("Payment reference is missing. Please contact the seller.");
        return;
      }

      const response = await fetch(`/api/paystack/verify?reference=${reference}&order=${order}`);
      const data = await response.json();
      if (!response.ok) {
        setStatus("error");
        setMessage(data.message ?? "Could not verify payment.");
        return;
      }

      clearCart();
      updateCustomerOrder(order, { payment_status: "Paid", status: "Paid" });
      setStatus("success");
      setMessage("Payment received. Your order has been sent to the seller.");
      const nextWhatsappUrl = buildPendingWhatsAppUrl(pendingOrder);
      if (nextWhatsappUrl) {
        setWhatsappUrl(nextWhatsappUrl);
      }
    }

    verifyPayment();
  }, [order, reference]);

  return (
    <main className="min-h-screen bg-[#f2f6fb] pt-[160px]">
      <CheckoutHeader
        sellerName={sellerName}
        sellerLogoUrl={sellerLogoUrl}
        storeHref={storeHref}
        cartHref={cartHref}
        cartCount={0}
        mode="success"
      />
      <section className="border-b border-emerald-900/10 bg-[linear-gradient(135deg,#064E3B_0%,#0EA65A_54%,#DFFBF0_100%)] px-4 py-8 text-white sm:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-100">
            {status === "checking" ? "Checking payment" : status === "success" ? "Payment successful" : "Payment issue"}
          </p>
          <h1 className="mt-2 max-w-3xl text-3xl font-black leading-tight text-white sm:text-5xl">{status === "success" ? "Thank you for your order" : "Payment status"}</h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-emerald-50">{message}</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <div className={`rounded-2xl border bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.10)] sm:p-7 ${status === "error" ? "border-rose-200" : "border-emerald-200"}`}>
          {status === "success" ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-emerald-700">Next step</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Send receipt to seller</h2>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-emerald-900">
                Send your paid order to the seller on WhatsApp so they can confirm delivery and prepare your package.
              </p>
              {whatsappUrl ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#16A34A] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#15803D]"
                >
                  <span aria-hidden="true" className="grid h-6 w-6 place-items-center rounded-full bg-white text-[#16A34A]">☎</span>
                  Send order on WhatsApp
                </a>
              ) : (
                <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">The seller has not added a WhatsApp number yet.</p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold leading-6 text-slate-600">{message}</p>
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={storeHref} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white">Continue shopping</Link>
            <Link href={storeHref} className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-700">Store home</Link>
          </div>
        </div>
      </section>
      <PublicFooter sellerName={sellerName} sellerLogoUrl={sellerLogoUrl} storeHref={storeHref} />
    </main>
  );
}

function readPendingWhatsAppOrder() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem("sellmate_pending_whatsapp");
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as PendingWhatsAppOrder;
  } catch {
    return null;
  }
}

function getInitialStoreContext() {
  if (typeof window === "undefined") {
    return {
      storeHref: "/",
      sellerName: "Store",
      sellerLogoUrl: "",
    };
  }

  const pendingOrder = readPendingWhatsAppOrder();
  return {
    storeHref: getSafeStoreHref(pendingOrder?.storeHref || readCurrentStoreHref()),
    sellerName: pendingOrder?.sellerName || "Store",
    sellerLogoUrl: pendingOrder?.sellerLogoUrl || "",
  };
}

function buildPendingWhatsAppUrl(pendingOrder: PendingWhatsAppOrder | null) {
  if (!pendingOrder) {
    return "";
  }

  const phone = normalizeWhatsAppPhone(pendingOrder.sellerPhone ?? "");
  if (!phone || !pendingOrder.text) {
    return "";
  }
  window.localStorage.removeItem("sellmate_pending_whatsapp");
  return `https://wa.me/${phone}?text=${encodeURIComponent(pendingOrder.text)}`;
}

function getSafeStoreHref(href: string) {
  return href.startsWith("/store/") ? href : "/";
}

function normalizeWhatsAppPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) {
    return "";
  }
  if (digits.startsWith("234")) {
    return digits;
  }
  if (digits.startsWith("0")) {
    return `234${digits.slice(1)}`;
  }
  return digits;
}

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <PaymentCallbackContent />
    </Suspense>
  );
}
