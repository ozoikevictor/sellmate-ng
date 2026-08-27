"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth";
import { Badge, SectionTitle, StatCard } from "@/components/ui";
import { formatNaira } from "@/lib/data";
import { formatProductLimit, getProductLimit, isPlanExpired, productPlans } from "@/lib/plans";
import { supabase } from "@/lib/supabase";

export default function BillingPage() {
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState("Starter");
  const [billingStatus, setBillingStatus] = useState("Trial");
  const [trialEndsAt, setTrialEndsAt] = useState("");
  const [billingRenewsAt, setBillingRenewsAt] = useState("");
  const [nowMs] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [savingPlan, setSavingPlan] = useState("");
  const [payingPlan, setPayingPlan] = useState("");
  const [message, setMessage] = useState("");
  const verifiedPayment = useRef(false);
  const selected = productPlans.find((plan) => plan.name === selectedPlan) ?? productPlans[0];
  const paystackPublicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "";
  const hasPaystackPublicKey = Boolean(paystackPublicKey);
  const activeLimit = getProductLimit(selectedPlan, billingStatus, billingRenewsAt, nowMs);
  const businessExpired = selectedPlan === "Business" && billingStatus === "Active" && isPlanExpired(billingRenewsAt, nowMs);
  const userId = user?.id;

  const loadBilling = useCallback(async () => {
    if (!userId) {
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("seller_profiles")
      .select("plan,billing_status,trial_ends_at,billing_renews_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      setMessage(error.message);
    } else {
      setSelectedPlan(data?.plan || "Starter");
      setBillingStatus(data?.billing_status || "Trial");
      setTrialEndsAt(data?.trial_ends_at || "");
      setBillingRenewsAt(data?.billing_renews_at || "");
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadBilling();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadBilling]);

  useEffect(() => {
    if (!userId || verifiedPayment.current) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference");
    const plan = params.get("plan");
    if (!reference) {
      return;
    }
    const paymentReference = reference;

    async function verifyPayment() {
      verifiedPayment.current = true;
      setMessage("Confirming your Paystack payment...");

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setMessage("Payment returned, but your login session expired. Log in again and open Billing.");
        return;
      }

      const verifyUrl = new URL("/api/paystack/subscription/verify", window.location.origin);
      verifyUrl.searchParams.set("reference", paymentReference);
      if (plan) {
        verifyUrl.searchParams.set("plan", plan);
      }

      const response = await fetch(verifyUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message ?? "Payment could not be confirmed. Please try again.");
        return;
      }

      setMessage(`${data.plan} payment confirmed. Your product limit has been updated.${data.plan === "Business" ? " Business renews again in 30 days." : ""}`);
      window.history.replaceState({}, "", "/dashboard/billing");
      await loadBilling();
    }

    verifyPayment();
  }, [loadBilling, userId]);

  async function choosePlan(planName: string) {
    if (!user?.id) {
      setMessage("You need to be logged in to change your plan.");
      return;
    }

    setSavingPlan(planName);
    setMessage("");

    const { error } = await supabase
      .from("seller_profiles")
      .update({
        plan: planName,
        billing_status: "Trial",
        billing_renews_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (error) {
      setMessage(error.message);
    } else {
      setSelectedPlan(planName);
      setBillingStatus("Trial");
      setMessage(`${planName} selected. Pay with Paystack to activate this product limit.`);
    }

    setSavingPlan("");
  }

  async function payForPlan(planName: string) {
    if (!user?.id || !user.email) {
      setMessage("You need to be logged in before paying for a plan.");
      return;
    }

    const plan = productPlans.find((item) => item.name === planName);
    if (!plan) {
      return;
    }

    if (!hasPaystackPublicKey) {
      setMessage("Add your Paystack test public key to NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY in .env.local, then restart the dev server.");
      return;
    }

    setPayingPlan(planName);
    setMessage("Opening Paystack checkout...");

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setMessage("Please log in again before starting billing payment.");
      setPayingPlan("");
      return;
    }

    const response = await fetch("/api/paystack/subscription", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        planName: plan.name,
        amount: plan.price,
      }),
    });
    const data = await response.json();

    if (!response.ok || !data.authorizationUrl) {
      setMessage(data.message ?? "Could not open Paystack checkout. Please try again.");
      setPayingPlan("");
      return;
    }

    window.location.href = data.authorizationUrl;
  }

  const trialText = trialEndsAt ? `Trial ends ${new Date(trialEndsAt).toLocaleDateString()}` : "Trial active";
  const renewalText = billingRenewsAt ? `Renews ${new Date(billingRenewsAt).toLocaleDateString()}` : "No renewal date";

  return (
    <>
      <SectionTitle eyebrow="Subscription" title="Billing" />

      <section className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-5 bg-[linear-gradient(135deg,#0F172A_0%,#14532D_58%,#16A34A_100%)] p-5 text-white lg:grid-cols-[1fr_340px] lg:items-center lg:p-7">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-100">Seller subscription</p>
            <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">{loading ? "Loading your billing account..." : `${selected.name} plan`}</h2>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-emerald-50">
              Manage the product limit, renewal status, and Paystack subscription used to keep your vendor dashboard active.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-black">
              <span className="rounded-full bg-white/15 px-3 py-2 ring-1 ring-white/20">{billingStatus}</span>
              <span className="rounded-full bg-white/15 px-3 py-2 ring-1 ring-white/20">{formatProductLimit(activeLimit)} products</span>
              <span className="rounded-full bg-white/15 px-3 py-2 ring-1 ring-white/20">{billingStatus === "Active" && !businessExpired ? renewalText : trialText}</span>
            </div>
          </div>
          <div className="rounded-lg border border-white/15 bg-white p-5 text-slate-950 shadow-xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Amount due</p>
            <p className="mt-2 text-4xl font-black">{formatNaira(selected.price)}</p>
            <p className="mt-2 text-sm font-semibold text-slate-500">{selected.name === "Business" ? "Monthly renewal" : selected.billing}</p>
            <button
              onClick={() => payForPlan(selected.name)}
              disabled={payingPlan === selected.name || loading}
              className="mt-5 w-full rounded-md bg-[#16A34A] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#15803D] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {payingPlan === selected.name ? "Opening payment..." : "Pay current plan"}
            </button>
          </div>
        </div>
      </section>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Current plan" value={loading ? "Loading..." : billingStatus === "Active" && !businessExpired ? selected.name : "Free trial"} change={businessExpired ? "Expired" : billingStatus} tone="green" />
        <StatCard label="Plan price" value={formatNaira(selected.price)} change={selected.name === "Business" ? "Monthly" : selected.billing} tone={hasPaystackPublicKey ? "green" : "amber"} />
        <StatCard label="Product limit" value={formatProductLimit(activeLimit)} change={billingStatus === "Active" && !businessExpired ? renewalText : trialText} tone="blue" />
      </div>

      {message ? <p className="mb-6 rounded-md bg-slate-100 p-4 text-sm font-semibold text-slate-700">{message}</p> : null}
      {businessExpired ? (
        <p className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
          Your Business monthly plan has expired. Renew with Paystack to continue unlimited products.
        </p>
      ) : null}

      <div className={`mb-6 rounded-lg border p-5 text-sm ${hasPaystackPublicKey ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
        {hasPaystackPublicKey ? (
          <span>Paystack test checkout is connected. Click <strong>Pay with Paystack</strong> to open the secure Paystack payment page.</span>
        ) : (
          <span>Add your Paystack test public key in <strong>NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY</strong>, then restart the dev server before testing payment.</span>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {productPlans.map((plan) => {
          const active = selectedPlan === plan.name;
          return (
            <article key={plan.name} className={`sellmate-card rounded-lg p-5 transition hover:-translate-y-0.5 hover:shadow-xl ${active ? "border-emerald-600 ring-2 ring-emerald-100" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black text-slate-950">{plan.name}</h2>
                  <p className="mt-2 text-sm text-slate-500">{formatProductLimit(plan.limit)}</p>
                </div>
                <Badge tone={plan.tone}>{plan.badge}</Badge>
              </div>
              <p className="mt-6 text-4xl font-black text-slate-950">{formatNaira(plan.price)}<span className="text-sm font-bold text-slate-500"> / month</span></p>
              <ul className="mt-6 grid gap-3 text-sm font-semibold text-slate-600">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-emerald-600" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => choosePlan(plan.name)}
                disabled={savingPlan === plan.name || loading}
                className={`mt-6 w-full rounded-md px-5 py-3 text-sm font-black ${
                  active ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : "bg-slate-950 text-white hover:bg-slate-800"
                }`}
              >
                {savingPlan === plan.name ? "Saving..." : active ? "Current plan" : `Choose ${plan.name}`}
              </button>
              <button
                onClick={() => payForPlan(plan.name)}
                disabled={payingPlan === plan.name || loading}
                className="mt-3 w-full rounded-md border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                {payingPlan === plan.name ? "Opening payment..." : `Pay with Paystack`}
              </button>
            </article>
          );
        })}
      </div>

      <section className="sellmate-card mt-6 rounded-lg p-5">
        <h2 className="text-xl font-black text-slate-950">Billing workflow</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="font-black text-slate-950">1. Select a plan</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">Choose the product limit that matches the seller business size.</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="font-black text-slate-950">2. Pay securely</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">Paystack opens a protected checkout and returns here after payment.</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="font-black text-slate-950">3. Limit updates</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">After confirmation, the dashboard updates the seller active product limit.</p>
          </div>
        </div>
      </section>
    </>
  );
}

