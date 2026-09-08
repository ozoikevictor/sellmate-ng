"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DashboardPageHeader, StatCard } from "@/components/ui";
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
  const [emailMessage, setEmailMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);
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

  async function changeEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailMessage("");
    setEmailError("");
    const formData = new FormData(event.currentTarget);
    const newEmail = String(formData.get("new_email") ?? "").trim().toLowerCase();

    if (!newEmail) {
      setEmailError("Enter the new email address.");
      return;
    }

    if (newEmail === user?.email?.toLowerCase()) {
      setEmailError("This is already your current email.");
      return;
    }

    setChangingEmail(true);
    const { error } = await supabase.auth.updateUser(
      { email: newEmail },
      { emailRedirectTo: siteOrigin ? `${siteOrigin}/login?email_changed=1` : undefined },
    );
    setChangingEmail(false);

    if (error) {
      setEmailError(error.message);
      return;
    }

    event.currentTarget.reset();
    setEmailMessage("Check the new email inbox and confirm the change. After confirmation, use the new email to sign in.");
  }

  return (
    <>
      <DashboardPageHeader
        eyebrow="Seller account"
        title={businessName}
        description="Manage your seller profile, login email, password, and account access."
      />
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
          <form onSubmit={changeEmail} className="mt-6 rounded-lg border border-emerald-100 bg-emerald-50 p-4">
            <h3 className="text-base font-black text-slate-950">Change login email</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Enter a new email for this seller account. Supabase will ask you to confirm it before it becomes active.</p>
            <label className="mt-4 grid gap-2 text-sm font-black text-slate-700">
              New email
              <input name="new_email" type="email" required placeholder="newemail@gmail.com" className="rounded-md border border-slate-300 bg-white px-3 py-3 font-normal outline-none focus:border-emerald-600" />
            </label>
            <button disabled={changingEmail} className="mt-4 rounded-md bg-[#16A34A] px-5 py-3 text-sm font-black text-white disabled:bg-slate-400">
              {changingEmail ? "Sending confirmation..." : "Change email"}
            </button>
            {emailMessage ? <p className="mt-3 rounded-md bg-white p-3 text-sm font-semibold text-emerald-800">{emailMessage}</p> : null}
            {emailError ? <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-700">{emailError}</p> : null}
          </form>
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
