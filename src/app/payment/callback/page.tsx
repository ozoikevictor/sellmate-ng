"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { LoadingScreen } from "@/components/loading-screen";
import { clearCart, readCurrentStoreHref } from "@/lib/cart";

function PaymentCallbackContent() {
  const params = useSearchParams();
  const reference = params.get("reference");
  const order = params.get("order");
  const [status, setStatus] = useState<"checking" | "success" | "error">("checking");
  const [message, setMessage] = useState("Confirming your payment...");
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [storeHref, setStoreHref] = useState("/");

  useEffect(() => {
    async function verifyPayment() {
      setStoreHref(readCurrentStoreHref());

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
      setStatus("success");
      setMessage("Payment received. Your order has been sent to the seller.");
      const nextWhatsappUrl = buildPendingWhatsAppUrl();
      if (nextWhatsappUrl) {
        setWhatsappUrl(nextWhatsappUrl);
      }
    }

    verifyPayment();
  }, [order, reference]);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-5">
      <section className={`w-full max-w-xl rounded-lg border bg-white p-6 shadow-sm ${status === "error" ? "border-rose-200" : "border-emerald-200"}`}>
        <p className={`text-xs font-black uppercase tracking-[0.18em] ${status === "error" ? "text-rose-700" : "text-emerald-700"}`}>
          {status === "checking" ? "Checking payment" : status === "success" ? "Payment successful" : "Payment issue"}
        </p>
        <h1 className="mt-3 text-3xl font-black text-slate-950">{status === "success" ? "Thank you for your order" : "Payment status"}</h1>
        <p className="mt-3 leading-7 text-slate-600">{message}</p>
        {status === "success" ? (
          <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-bold text-emerald-900">Next step</p>
            <p className="mt-1 text-sm leading-6 text-emerald-800">
              Send your paid order to the seller on WhatsApp so they can confirm delivery.
            </p>
            {whatsappUrl ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-emerald-700 px-5 py-3 text-sm font-black text-white hover:bg-emerald-800"
              >
                <span aria-hidden="true" className="grid h-6 w-6 place-items-center rounded-full bg-white text-emerald-700">☎</span>
                Send order on WhatsApp
              </a>
            ) : (
              <p className="mt-3 text-sm font-semibold text-amber-800">The seller has not added a WhatsApp number yet.</p>
            )}
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={storeHref} className="rounded-md bg-slate-950 px-5 py-3 text-sm font-black text-white">Continue shopping</Link>
          <Link href="/" className="rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-700">Home</Link>
        </div>
      </section>
    </main>
  );
}

function buildPendingWhatsAppUrl() {
  const raw = window.localStorage.getItem("sellmate_pending_whatsapp");
  if (!raw) {
    return "";
  }

  try {
    const data = JSON.parse(raw) as { sellerPhone?: string; text?: string };
    const phone = normalizeWhatsAppPhone(data.sellerPhone ?? "");
    if (!phone || !data.text) {
      return "";
    }
    window.localStorage.removeItem("sellmate_pending_whatsapp");
    return `https://wa.me/${phone}?text=${encodeURIComponent(data.text)}`;
  } catch {
    return "";
  }
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
