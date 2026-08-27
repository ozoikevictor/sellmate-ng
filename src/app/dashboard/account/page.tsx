"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SectionTitle, StatCard } from "@/components/ui";
import { useAuth } from "@/components/auth";
import { supabase } from "@/lib/supabase";

type AccountProfile = {
  owner_name: string;
  business_name: string;
  whatsapp_phone: string;
  city: string;
  store_slug: string;
};

function makeStoreSlug(businessName: string, userId: string) {
  const baseSlug = businessName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${baseSlug || "store"}-${userId.slice(0, 6)}`;
}

export default function AccountPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [productCount, setProductCount] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [message, setMessage] = useState("");
  const [siteOrigin] = useState(() => (typeof window === "undefined" ? "" : window.location.origin));

  const loadAccount = useCallback(async () => {
    const userId = user?.id;
    if (!userId) {
      return;
    }

    const [{ data: profileData, error: profileError }, productResult, orderResult] = await Promise.all([
      supabase
        .from("seller_profiles")
        .select("owner_name,business_name,whatsapp_phone,city,store_slug")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("user_id", userId),
    ]);

    if (profileError || productResult.error || orderResult.error) {
      setMessage(profileError?.message ?? productResult.error?.message ?? orderResult.error?.message ?? "Could not load account.");
      return;
    }

    const nextProfile = {
      owner_name: profileData?.owner_name || user.name,
      business_name: profileData?.business_name || user.business,
      whatsapp_phone: profileData?.whatsapp_phone || user.whatsapp || "Not set",
      city: profileData?.city || "Not set",
      store_slug: profileData?.store_slug || makeStoreSlug(user.business, userId),
    };

    if (!profileData) {
      await supabase.from("seller_profiles").upsert(
        {
          user_id: userId,
          owner_name: nextProfile.owner_name,
          business_name: nextProfile.business_name,
          whatsapp_phone: user.whatsapp,
          city: "",
          store_slug: nextProfile.store_slug,
        },
        { onConflict: "user_id" },
      );
    }

    setProfile(nextProfile);
    setProductCount(productResult.count ?? 0);
    setOrderCount(orderResult.count ?? 0);
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadAccount();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAccount]);

  const businessName = profile?.business_name ?? user?.business ?? "Your business";
  const storeSlug = profile?.store_slug ?? (user?.id ? makeStoreSlug(user.business, user.id) : "store");
  const storePath = `/store/${storeSlug}`;
  const storeUrl = siteOrigin ? `${siteOrigin}${storePath}` : storePath;

  return (
    <>
      <SectionTitle eyebrow="Seller account" title={businessName} />
      {message ? <p className="mb-4 rounded-md bg-rose-50 p-4 text-sm font-semibold text-rose-700">{message}</p> : null}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Products" value={String(productCount)} change="Catalog" tone="blue" />
        <StatCard label="Orders" value={String(orderCount)} change="Checkout" tone="green" />
        <StatCard label="Store status" value="Live" change="Public link" tone="amber" />
      </div>
      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">Account details</h2>
          <div className="mt-5 grid gap-4 text-sm">
            <AccountRow label="Owner" value={profile?.owner_name ?? user?.name ?? "Seller"} />
            <AccountRow label="Email" value={user?.email ?? ""} />
            <AccountRow label="Business" value={businessName} />
            <AccountRow label="City" value={profile?.city ?? "Not set"} />
            <AccountRow label="WhatsApp" value={profile?.whatsapp_phone ?? "Not set"} />
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">Store link</h2>
          <p className="mt-3 break-all rounded-md bg-slate-100 p-4 text-sm font-bold text-slate-700">{storeUrl}</p>
          <div className="mt-5 grid gap-3">
            <Link href={storePath} className="rounded-md bg-slate-950 px-5 py-3 text-center text-sm font-black text-white">Open my store</Link>
            <Link href="/dashboard/settings" className="rounded-md border border-slate-300 bg-white px-5 py-3 text-center text-sm font-black text-slate-800">Edit account settings</Link>
            <Link href="/dashboard" className="rounded-md border border-slate-300 bg-slate-100 px-5 py-3 text-center text-sm font-black text-slate-800">Go to dashboard</Link>
          </div>
        </div>
      </section>
    </>
  );
}

function AccountRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <span className="font-bold text-slate-500">{label}</span>
      <span className="font-black text-slate-950">{value}</span>
    </div>
  );
}
