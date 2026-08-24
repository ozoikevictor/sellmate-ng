"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SectionTitle } from "@/components/ui";
import { useAuth } from "@/components/auth";
import { supabase } from "@/lib/supabase";

type SellerProfile = {
  owner_name: string;
  business_name: string;
  whatsapp_phone: string;
  city: string;
  store_slug: string;
  logo_url: string;
  logo_text: string;
  delivery_fee: string;
  bank_name: string;
  bank_code: string;
  account_number: string;
  account_name: string;
  paystack_subaccount_code: string;
};

const emptyProfile: SellerProfile = {
  owner_name: "",
  business_name: "",
  whatsapp_phone: "",
  city: "",
  store_slug: "",
  logo_url: "",
  logo_text: "",
  delivery_fee: "3500",
  bank_name: "",
  bank_code: "",
  account_number: "",
  account_name: "",
  paystack_subaccount_code: "",
};

const nigerianBanks = [
  { name: "Access Bank", code: "044" },
  { name: "Guaranty Trust Bank", code: "058" },
  { name: "Zenith Bank", code: "057" },
  { name: "United Bank for Africa", code: "033" },
  { name: "First Bank of Nigeria", code: "011" },
  { name: "Fidelity Bank", code: "070" },
  { name: "FCMB", code: "214" },
  { name: "Stanbic IBTC Bank", code: "221" },
  { name: "Sterling Bank", code: "232" },
  { name: "Wema Bank", code: "035" },
];

function makeStoreSlug(businessName: string, userId: string) {
  const baseSlug = businessName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${baseSlug || "store"}-${userId.slice(0, 6)}`;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<SellerProfile>(emptyProfile);
  const [siteOrigin, setSiteOrigin] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connectingPayout, setConnectingPayout] = useState(false);
  const [message, setMessage] = useState("");
  const cleanStoreSlug = profile.store_slug.trim().toLowerCase().replace(/\s+/g, "-") || (user?.id ? makeStoreSlug(profile.business_name || user.business || "store", user.id) : "store");
  const storePath = `/store/${cleanStoreSlug}`;
  const storeUrl = siteOrigin ? `${siteOrigin}${storePath}` : storePath;

  const loadProfile = useCallback(async () => {
    const userId = user?.id;
    if (!userId) {
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("seller_profiles")
      .select("owner_name,business_name,whatsapp_phone,city,store_slug,logo_url,logo_text,delivery_fee,bank_name,bank_code,account_number,account_name,paystack_subaccount_code")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      setMessage(error.message);
    } else {
      setProfile({
        owner_name: data?.owner_name || user.name || "",
        business_name: data?.business_name || user.business || "",
        whatsapp_phone: data?.whatsapp_phone || "",
        city: data?.city || "Lagos",
        store_slug: data?.store_slug || makeStoreSlug(data?.business_name || user.business || "store", userId),
        logo_url: data?.logo_url || "",
        logo_text: data?.logo_text || data?.business_name || user.business || "",
        delivery_fee: String(data?.delivery_fee ?? 3500),
        bank_name: data?.bank_name || "",
        bank_code: data?.bank_code || "",
        account_number: data?.account_number || "",
        account_name: data?.account_name || "",
        paystack_subaccount_code: data?.paystack_subaccount_code || "",
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadProfile();
    }, 0);
    setSiteOrigin(window.location.origin);
    return () => window.clearTimeout(timer);
  }, [loadProfile]);

  function updateProfile(name: keyof SellerProfile, value: string) {
    setProfile((current) => ({ ...current, [name]: value }));
  }

  function updateBank(code: string) {
    const bank = nigerianBanks.find((item) => item.code === code);
    setProfile((current) => ({
      ...current,
      bank_code: code,
      bank_name: bank?.name ?? current.bank_name,
    }));
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user?.id) {
      setMessage("You need to be logged in to save settings.");
      return;
    }

    setSaving(true);
    setMessage("");
    const payload = {
      user_id: user.id,
      ...profile,
      logo_url: "",
      logo_text: profile.business_name,
      delivery_fee: Number(profile.delivery_fee || 0),
      store_slug: profile.store_slug.trim().toLowerCase().replace(/\s+/g, "-"),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("seller_profiles").upsert(payload, { onConflict: "user_id" });
    if (error) {
      setMessage(error.message);
    } else {
      setProfile((current) => ({ ...current, store_slug: payload.store_slug }));
      setMessage("Settings saved.");
    }
    setSaving(false);
  }

  async function connectPaystackPayout() {
    if (!user?.id) {
      setMessage("You need to be logged in to connect payout.");
      return;
    }

    setConnectingPayout(true);
    setMessage("Connecting seller payout to Paystack...");

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setMessage("Your login session expired. Log in again and try connecting payout.");
      setConnectingPayout(false);
      return;
    }

    const response = await fetch("/api/paystack/subaccount", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        businessName: profile.business_name,
        bankName: profile.bank_name,
        bankCode: profile.bank_code,
        accountNumber: profile.account_number,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.message ?? "Could not connect Paystack payout.");
      setConnectingPayout(false);
      return;
    }

    setProfile((current) => ({ ...current, paystack_subaccount_code: data.subaccountCode }));
    setMessage("Paystack payout connected. Customer product payments can now use this seller payout account.");
    setConnectingPayout(false);
  }

  return (
    <>
      <SectionTitle eyebrow="Workspace" title="Settings" />
      <form onSubmit={saveProfile} className="sellmate-card rounded-lg p-5">
        <h2 className="mb-4 text-xl font-black text-slate-950">Store details</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <SettingsField label="Owner name" name="owner_name" value={profile.owner_name} onChange={updateProfile} placeholder="Ozoike Victor" />
          <SettingsField label="Business name" name="business_name" value={profile.business_name} onChange={updateProfile} placeholder="Victor Fashions" />
          <SettingsField label="WhatsApp line" name="whatsapp_phone" value={profile.whatsapp_phone} onChange={updateProfile} placeholder="+234 801 555 0199" />
          <SettingsField label="City" name="city" value={profile.city} onChange={updateProfile} placeholder="Lagos" />
          <SettingsField label="Delivery fee" name="delivery_fee" value={profile.delivery_fee} onChange={updateProfile} placeholder="3500" type="number" />
          <SettingsField label="Store slug" name="store_slug" value={profile.store_slug} onChange={updateProfile} placeholder="victor-fashions" />
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Store URL</p>
            <p className="mt-2 break-all text-lg font-black text-slate-950">{storeUrl}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={storePath}
                target="_blank"
                className="rounded-md bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-slate-800"
              >
                Open store
              </Link>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(storeUrl);
                  setMessage("Store link copied.");
                }}
                className="rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-100"
              >
                Copy link
              </button>
            </div>
          </div>
        </div>
        <div className="mt-8 border-t border-slate-200 pt-6">
          <h2 className="text-xl font-black text-slate-950">Seller payment account</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            This is where each seller adds the bank account for product payments. Customer checkout can later use Paystack subaccounts or splits so product money goes to this seller.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Bank
              <select
                value={profile.bank_code}
                onChange={(event) => updateBank(event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-3 font-normal outline-none focus:border-emerald-600"
              >
                <option value="">Choose bank</option>
                {nigerianBanks.map((bank) => (
                  <option key={bank.code} value={bank.code}>{bank.name}</option>
                ))}
              </select>
            </label>
            <SettingsField label="Account number" name="account_number" value={profile.account_number} onChange={updateProfile} placeholder="0123456789" />
            <SettingsField label="Account name" name="account_name" value={profile.account_name} onChange={updateProfile} placeholder="Victor Fashions" />
            <SettingsField label="Paystack subaccount code" name="paystack_subaccount_code" value={profile.paystack_subaccount_code} onChange={updateProfile} placeholder="ACCT_xxxxxxx" />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={connectPaystackPayout}
              disabled={loading || connectingPayout || !profile.business_name || !profile.bank_code || !profile.account_number}
              className="rounded-md bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {connectingPayout ? "Connecting..." : "Connect Paystack payout"}
            </button>
            {profile.paystack_subaccount_code ? <span className="text-sm font-bold text-emerald-700">Connected: {profile.paystack_subaccount_code}</span> : null}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button disabled={loading || saving} className="rounded-md bg-emerald-700 px-5 py-3 text-sm font-black text-white disabled:bg-slate-400">
            {saving ? "Saving..." : "Save settings"}
          </button>
          {message ? <p className="text-sm font-semibold text-slate-700">{message}</p> : null}
        </div>
      </form>
      <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
        Your app-owner Paystack keys collect SellMate subscription payments. Seller bank details are for customer product payouts and future Paystack split setup.
      </div>
    </>
  );
}

function SettingsField({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  name: keyof SellerProfile;
  value: string;
  onChange: (name: keyof SellerProfile, value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      {label}
      <input
        name={name}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        type={type}
        min={type === "number" ? 0 : undefined}
        className="rounded-md border border-slate-300 px-3 py-3 font-normal outline-none focus:border-emerald-600"
        placeholder={placeholder}
      />
    </label>
  );
}
