"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PlatformHeader, PublicFooter, SectionTitle, StatCard, VendoraqLogo } from "@/components/ui";
import { useAuth } from "@/components/auth";
import { readCart } from "@/lib/cart";
import { formatNaira } from "@/lib/data";
import { supabase } from "@/lib/supabase";

type SellerSummary = {
  businessName: string;
  storeSlug: string;
  productCount: number;
  lowStockCount: number;
  products: Array<{
    id: string;
    name: string;
    category: string;
    price: number;
    stock: number;
    image_url: string | null;
  }>;
};

function makeStoreSlug(businessName: string, userId: string) {
  const baseSlug = businessName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${baseSlug || "store"}-${userId.slice(0, 6)}`;
}

export default function LandingPage() {
  const { ready, user } = useAuth();
  const [cartCount, setCartCount] = useState(0);
  const [sellerSummary, setSellerSummary] = useState<SellerSummary | null>(null);
  const [accountChecked, setAccountChecked] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    async function loadSellerSummary() {
      if (!ready) {
        return;
      }
      if (!user?.id) {
        setSellerSummary(null);
        setAccountChecked(true);
        return;
      }

      const { data: profileData } = await supabase
        .from("seller_profiles")
        .select("business_name,store_slug")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: productData } = await supabase
        .from("products")
        .select("id,name,category,price,stock,status,image_url")
        .eq("user_id", user.id)
        .eq("status", "Live")
        .order("created_at", { ascending: false });

      setSellerSummary({
        businessName: profileData?.business_name || "Your store",
        storeSlug: profileData?.store_slug || makeStoreSlug(profileData?.business_name || "Your store", user.id),
        productCount: productData?.length ?? 0,
        lowStockCount: productData?.filter((product) => Number(product.stock) <= 3).length ?? 0,
        products: (productData ?? []).slice(0, 3),
      });
      setAccountChecked(true);
    }

    function syncCartCount() {
      setCartCount(readCart().reduce((sum, item) => sum + item.qty, 0));
    }

    setAccountChecked(false);
    loadSellerSummary();
    syncCartCount();
    window.addEventListener("sellmate-cart-updated", syncCartCount);
    window.addEventListener("storage", syncCartCount);

    return () => {
      window.removeEventListener("sellmate-cart-updated", syncCartCount);
      window.removeEventListener("storage", syncCartCount);
    };
  }, [ready, user]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveStep((step) => (step + 1) % 3);
    }, 3200);

    return () => window.clearInterval(timer);
  }, []);

  const demoStoreHref = "/store/ada-fashion";
  const storeHref = sellerSummary ? `/store/${sellerSummary.storeSlug}` : demoStoreHref;
  const isLoggedInSeller = Boolean(sellerSummary);

  const publicMetrics = useMemo(() => {
    if (sellerSummary) {
      return [
        { label: "Your store", value: sellerSummary.businessName, change: "Logged in", tone: "green" },
        { label: "Live products", value: String(sellerSummary.productCount), change: "Available", tone: "blue" },
        { label: "Items in your cart", value: String(cartCount), change: cartCount > 0 ? "Ready" : "Empty", tone: "slate" },
        { label: "Low stock", value: String(sellerSummary.lowStockCount), change: sellerSummary.lowStockCount > 0 ? "Check stock" : "Healthy", tone: sellerSummary.lowStockCount > 0 ? "amber" : "green" },
      ];
    }

    return [
      { label: "Seller dashboard", value: "Ready", change: "Manage shop", tone: "blue" },
      { label: "Items in your cart", value: String(cartCount), change: cartCount > 0 ? "Ready to checkout" : "Start shopping", tone: "green" },
      { label: "Storefronts", value: "Public", change: "Share links", tone: "slate" },
      { label: "Payments", value: "Paystack", change: "Test mode", tone: "amber" },
    ];
  }, [cartCount, sellerSummary]);

  const liveActivities = [
    "New product added to public shop",
    "Customer cart updated",
    "Receipt ready for WhatsApp follow-up",
  ];

  const howItWorks = [
    {
      title: "Seller creates store",
      text: "Register, add business details, logo, delivery fee, WhatsApp number, and product photos.",
      badge: "Store setup",
      stat: "10 min",
    },
    {
      title: "Customer shops",
      text: "Visitors search the store, compare products, add items to cart, and review their order.",
      badge: "Public store",
      stat: "Live cart",
    },
    {
      title: "Payment and receipt",
      text: "Checkout collects delivery details, Paystack handles payment, and WhatsApp gets the receipt.",
      badge: "Checkout",
      stat: "Paid order",
    },
  ];

  const howItWorksTitles = [
    "for sellers",
    "for customers",
    "for WhatsApp orders",
  ];

  if (!accountChecked) {
    return (
      <main className="grid min-h-screen place-items-center sellmate-page-bg px-5">
        <div className="rounded-lg border border-slate-300 bg-white/90 p-6 text-center shadow-lg">
          <div className="flex justify-center"><VendoraqLogo /></div>
          <p className="mt-4 text-sm font-black text-slate-950">Opening your VENDORAQ page...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen sellmate-page-bg pt-28 sm:pt-20">
      <PlatformHeader cartCount={cartCount} storeHref={storeHref} isLoggedInSeller={isLoggedInSeller} onHelpClick={() => setSupportOpen(true)} />
      <section className="border-b border-slate-300 sellmate-hero-bg">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:min-h-[calc(100vh-5rem)] lg:grid-cols-[1fr_0.92fr] lg:items-center">
          <div className="landing-fade-up">
            <p className="landing-fade-up w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">WhatsApp commerce for Nigerian sellers</p>
            <h1 className="landing-fade-up landing-delay-1 mt-5 max-w-3xl text-4xl font-black capitalize leading-[1.02] text-slate-950 sm:text-5xl lg:text-6xl">
              {isLoggedInSeller ? `${sellerSummary?.businessName} store control.` : "Create your online store and manage WhatsApp orders."}
            </h1>
            <p className="landing-fade-up landing-delay-2 mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              {isLoggedInSeller
                ? "You are logged in. Open your store to see your public products, pictures, available stock, cart, and checkout flow."
                : "VENDORAQ helps sellers create a public shop, add products, collect customer orders, receive Paystack payments, and manage everything from a private dashboard."}
            </p>
            <div className="landing-fade-up landing-delay-3 mt-8 flex flex-wrap gap-3">
              {isLoggedInSeller ? (
                <Link href={storeHref} className="rounded-md bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-emerald-700">Open my store</Link>
              ) : (
                <>
                  <Link href="/register" className="rounded-md bg-emerald-700 px-5 py-3 text-sm font-black text-white">Create seller account</Link>
                  <Link href="/login" className="rounded-md border border-slate-400 bg-slate-100 px-5 py-3 text-sm font-black text-slate-800">Seller login</Link>
                  <button type="button" onClick={() => setSupportOpen(true)} className="rounded-md border border-emerald-200 bg-white px-5 py-3 text-sm font-black text-emerald-700 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50">Need help?</button>
                </>
              )}
            </div>
            <div className="landing-fade-up landing-delay-3 mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
              {liveActivities.map((activity, index) => (
                <div key={activity} className={`rounded-xl border bg-white/80 p-3 shadow-sm transition duration-300 ${activeStep === index ? "border-emerald-300 ring-4 ring-emerald-100" : "border-slate-200"}`}>
                  <span className={`mb-2 block h-2 w-2 rounded-full ${activeStep === index ? "landing-pulse-dot bg-emerald-500" : "bg-slate-300"}`} />
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Live flow</p>
                  <p className="mt-1 text-sm font-bold leading-5 text-slate-800">{activity}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="landing-float rounded-lg border border-slate-700 bg-[#0b1728] p-3 shadow-2xl shadow-emerald-900/10">
            <div className="rounded-md bg-slate-100 p-4 shadow-inner">
              <div className="grid gap-3 sm:grid-cols-2">
                {publicMetrics.map((metric) => <StatCard key={metric.label} {...metric} />)}
              </div>
              <div className="mt-4 rounded-lg border border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5,#e2e8f0)] p-5">
                <p className="text-sm font-black text-emerald-800">Customer shopping flow</p>
                <p className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">Browse - Cart - Checkout</p>
                <p className="mt-2 text-sm text-slate-600">Public visitors see products and their own cart only. Seller revenue stays inside the dashboard.</p>
                <div className="mt-4 space-y-2">
                  {["Store link opened", "Item added to cart", "Payment receipt sent"].map((item, index) => (
                    <div key={item} className={`flex items-center justify-between rounded-md border bg-white/80 px-3 py-2 text-xs font-black text-slate-700 transition ${activeStep === index ? "border-emerald-300 shadow-sm" : "border-slate-200"}`}>
                      <span>{item}</span>
                      <span className={activeStep === index ? "text-emerald-700" : "text-slate-400"}>{activeStep === index ? "Active" : "Ready"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-14">
        {isLoggedInSeller ? (
          <>
            <SectionTitle
              eyebrow="Your products"
              title="Products available in your store"
              action={<Link href={storeHref} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700">View my store</Link>}
            />
            {sellerSummary?.products.length ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {sellerSummary.products.map((product) => (
                  <article key={product.id} className="group overflow-hidden rounded-lg border border-slate-300 bg-white shadow-md transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-2xl">
                    <div className="relative bg-slate-200 p-3">
                      <div
                        className="h-56 rounded-md bg-[linear-gradient(135deg,#334155,#94a3b8_55%,#475569)] bg-cover bg-center shadow-inner transition duration-300 group-hover:scale-[1.02]"
                        style={product.image_url ? { backgroundImage: `url(${product.image_url})` } : undefined}
                      />
                      <span className="absolute right-6 top-6 rounded-full bg-white/95 px-3 py-1 text-xs font-black text-emerald-700 shadow-md ring-1 ring-emerald-100">
                        {product.stock} left
                      </span>
                      <span className="absolute bottom-6 left-6 rounded-full bg-slate-950/90 px-3 py-1 text-xs font-black text-white shadow-md">
                        Live product
                      </span>
                    </div>
                    <div className="p-5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{product.category}</span>
                        <span className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">In store</span>
                      </div>
                      <h2 className="mt-3 line-clamp-2 text-xl font-black leading-tight text-slate-950">{product.name}</h2>
                      <p className="mt-2 text-2xl font-black text-emerald-700">
                        {formatNaira(product.price)}
                      </p>
                      <Link href={storeHref} className="mt-5 block rounded-md bg-slate-950 px-4 py-3 text-center text-sm font-black text-white shadow-sm transition hover:bg-emerald-700">
                        View product
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
                <h2 className="text-lg font-black text-slate-950">No live products yet</h2>
                <p className="mt-2 text-sm leading-6 text-amber-800">Add products in your dashboard and set them to Live so they can appear here.</p>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div className="max-w-4xl">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-800">How it works</p>
                <h2 className="mt-4 text-4xl font-black leading-[1.04] text-slate-950 sm:text-5xl lg:text-6xl">
                  <span className="block">One platform</span>
                  <span key={activeStep} className="landing-rotate-line mt-1 block text-emerald-700">
                    {howItWorksTitles[activeStep]}
                  </span>
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                  VENDORAQ connects the seller dashboard, public store, cart, checkout, payment, and receipt follow-up in one clean flow.
                </p>
              </div>
              <Link href={storeHref} className="w-fit rounded-full border border-emerald-200 bg-white px-5 py-3 text-sm font-black text-emerald-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-50">
                View demo store
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {howItWorks.map((step, index) => (
                <button
                  key={step.title}
                  type="button"
                  onClick={() => setActiveStep(index)}
                  className={`landing-fade-up ${index === 1 ? "landing-delay-1" : index === 2 ? "landing-delay-2" : ""} group rounded-2xl border bg-white p-5 text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-2xl ${activeStep === index ? "border-emerald-300 ring-4 ring-emerald-100" : "border-slate-300"}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-lg font-black text-white shadow-lg shadow-slate-900/15 transition group-hover:bg-emerald-700">
                      {index + 1}
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-200">{step.badge}</span>
                  </div>
                  <h2 className="mt-5 text-xl font-black text-slate-950">{step.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{step.text}</p>
                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                    <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Step {index + 1}</span>
                    <span className="text-sm font-black text-slate-950">{step.stat}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </section>
      {supportOpen ? <LandingSupportModal onClose={() => setSupportOpen(false)} storeHref={storeHref} /> : null}
      <PublicFooter storeHref={storeHref} />
    </main>
  );
}

function LandingSupportModal({ onClose, storeHref }: { onClose: () => void; storeHref: string }) {
  const guides = [
    {
      title: "Create a seller account",
      text: "Click Start Selling, enter your name, business name, email, and password. After that you can open the dashboard and add products.",
    },
    {
      title: "Log in as a seller",
      text: "Click Seller Login, enter the same email and password you used to register, then you will enter your private dashboard.",
    },
    {
      title: "How customers shop",
      text: "Customers open your store link, search for goods, add products to cart, review the order, and continue to checkout.",
    },
    {
      title: "Payment and support flow",
      text: "Customers fill delivery details, pay through Paystack when connected, then send a clean receipt-style WhatsApp message to the seller.",
    },
  ];

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="support-title">
      <div className="landing-fade-up max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 p-5 sm:p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Help and support</p>
            <h2 id="support-title" className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">Learn how VENDORAQ works</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">This quick guide helps sellers and customers understand registration, login, shopping, checkout, and payment follow-up.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-100" aria-label="Close help">
            Close
          </button>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          {guides.map((guide, index) => (
            <article key={guide.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-sm font-black text-emerald-700 ring-1 ring-emerald-200">
                {index + 1}
              </div>
              <h3 className="mt-4 text-lg font-black text-slate-950">{guide.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{guide.text}</p>
            </article>
          ))}
        </div>
        <div className="border-t border-slate-200 bg-[#0F172A] p-5 text-white sm:p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <h3 className="text-xl font-black">Need to test it now?</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">Use the buttons to register, log in, or open the public store flow.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/register" onClick={onClose} className="rounded-md bg-[#16A34A] px-4 py-3 text-sm font-black text-white hover:bg-[#15803D]">Start selling</Link>
              <Link href="/login" onClick={onClose} className="rounded-md bg-white px-4 py-3 text-sm font-black text-slate-950 hover:bg-slate-100">Seller login</Link>
              <Link href={storeHref} onClick={onClose} className="rounded-md border border-white/20 px-4 py-3 text-sm font-black text-white hover:bg-white/10">Open store</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

