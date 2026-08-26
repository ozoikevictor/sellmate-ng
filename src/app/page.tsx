"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { IconGlyph, VendoraqLogo } from "@/components/ui";
import { useAuth } from "@/components/auth";
import { formatNaira } from "@/lib/data";
import { productPlans } from "@/lib/plans";
import { supabase } from "@/lib/supabase";

type SellerSummary = {
  businessName: string;
  storeSlug: string;
};

type FaqItem = {
  question: string;
  answer: string;
};

const trustItems = ["Professional Storefront", "Secure Checkout", "Order Management", "WhatsApp Friendly"];
const steps = [
  { number: "01", title: "Create your store", text: "Add your business name, logo and details." },
  { number: "02", title: "Add your products", text: "Upload product photos, prices and stock." },
  { number: "03", title: "Share your link", text: "Share your VENDORAQ store through WhatsApp, Instagram, TikTok and anywhere else." },
  { number: "04", title: "Start receiving orders", text: "Customers browse, add to cart, checkout and pay." },
];
const features = [
  { title: "Beautiful Storefront", text: "Give customers a professional mobile-friendly shopping experience." },
  { title: "Product Management", text: "Manage products, categories, prices, variants and stock." },
  { title: "Secure Payments", text: "Accept supported online payments securely." },
  { title: "Orders & Delivery", text: "Manage orders and delivery status." },
  { title: "WhatsApp Selling", text: "Share products and your store through WhatsApp." },
  { title: "Business Analytics", text: "Understand orders, products and sales." },
];
const businessCategories = ["Fashion", "Beauty", "Electronics", "Food & Groceries", "Home & Kitchen", "Building Materials", "Auto Parts", "Books", "Accessories", "Other Products"];
const faqs: FaqItem[] = [
  { question: "What is VENDORAQ?", answer: "VENDORAQ helps Nigerian sellers create a public online store, upload products, receive orders, and manage business activity from a seller dashboard." },
  { question: "Do I need coding knowledge?", answer: "No. Sellers can create a store, add products, and share a store link without writing code." },
  { question: "Can I use VENDORAQ with WhatsApp?", answer: "Yes. You can keep selling through WhatsApp while giving customers a professional store to browse before they message or checkout." },
  { question: "Do I get my own store link?", answer: "Yes. Each seller gets a store link that can be shared on WhatsApp, Instagram, TikTok, and other channels." },
  { question: "How do customers place orders?", answer: "Customers open your store, search products, add items to cart, enter delivery details, and continue through checkout." },
  { question: "How do customers pay?", answer: "Customer checkout uses the existing secure payment flow already configured in the application." },
  { question: "Can I manage my store from my phone?", answer: "Yes. The dashboard and public store are designed for mobile users as well as desktop users." },
  { question: "Can I sell different types of products?", answer: "Yes. Fashion, beauty, electronics, food items, accessories, tools, books, and many other product types can be listed." },
];

function makeStoreSlug(businessName: string, userId: string) {
  const baseSlug = businessName.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${baseSlug || "store"}-${userId.slice(0, 6)}`;
}

export default function LandingPage() {
  const { ready, user } = useAuth();
  const [sellerSummary, setSellerSummary] = useState<SellerSummary | null>(null);
  const [accountChecked, setAccountChecked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const [demoCartOpen, setDemoCartOpen] = useState(false);

  useEffect(() => {
    async function loadSellerSummary() {
      if (!ready) return;
      if (!user?.id) {
        setSellerSummary(null);
        setAccountChecked(true);
        return;
      }

      const { data: profileData } = await supabase.from("seller_profiles").select("business_name,store_slug").eq("user_id", user.id).maybeSingle();
      const businessName = profileData?.business_name || user.business || "Your store";
      setSellerSummary({ businessName, storeSlug: profileData?.store_slug || makeStoreSlug(businessName, user.id) });
      setAccountChecked(true);
    }

    const timer = window.setTimeout(() => {
      setAccountChecked(false);
      loadSellerSummary();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [ready, user]);

  const demoStoreHref = "/store/ada-fashion";
  const storeHref = sellerSummary ? `/store/${sellerSummary.storeSlug}` : demoStoreHref;
  const navLinks = useMemo(
    () => [
      { label: "Home", href: "/" },
      { label: "Features", href: "#features" },
      { label: "How It Works", href: "#how-it-works" },
      { label: "Pricing", href: "#pricing" },
      { label: "Marketplace", href: "#marketplace" },
      { label: "FAQ", href: "#faq" },
    ],
    [],
  );

  if (!accountChecked) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F8FAFC] px-5">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 text-center shadow-lg">
          <div className="flex justify-center"><VendoraqLogo /></div>
          <p className="mt-4 text-sm font-black text-[#111827]">Opening your VENDORAQ page...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F8FAFC] text-[#111827]">
      <LandingHeader storeHref={storeHref} navLinks={navLinks} menuOpen={menuOpen} setMenuOpen={setMenuOpen} onDemoCartOpen={() => setDemoCartOpen(true)} />
      {demoCartOpen ? <DemoCartModal onClose={() => setDemoCartOpen(false)} /> : null}

      <section id="home" className="border-b border-[#E2E8F0] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFC_58%,#F0FDF4_100%)] pt-24 sm:pt-28">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-14 pt-8 sm:px-6 lg:min-h-[calc(100vh-7rem)] lg:grid-cols-[minmax(0,1fr)_minmax(23rem,0.86fr)] lg:items-center lg:py-14">
          <div className="landing-fade-up max-w-3xl">
            <p className="inline-flex rounded-full border border-emerald-200 bg-[#F0FDF4] px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Built for Nigerian sellers</p>
            <h1 className="mt-5 text-[2.15rem] font-black leading-[1.03] text-[#0F172A] sm:text-5xl lg:text-6xl">
              Turn Your WhatsApp Business Into a <span className="text-[#22C55E]">Real Online Store.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-[15px] font-semibold leading-7 text-[#475569] sm:text-lg">
              Create your store, upload products, receive orders and payments, and give your customers a professional place to shop, all from one simple link.
            </p>
            <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap">
              <Link href="/register" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#22C55E] px-6 py-3 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-[#16A34A] focus:outline-none focus:ring-4 focus:ring-emerald-200">Start Selling Free</Link>
              <Link href={storeHref} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white px-6 py-3 text-sm font-black text-[#0F172A] shadow-sm transition hover:border-emerald-200 hover:bg-[#F0FDF4] focus:outline-none focus:ring-4 focus:ring-emerald-100">View Demo Store</Link>
            </div>
            <div className="mt-6 grid gap-2 text-sm font-bold text-[#475569] sm:flex sm:flex-wrap sm:gap-4">
              {["No coding required", "Mobile friendly", "Secure payments"].map((item) => (
                <span key={item} className="inline-flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-[#DCFCE7] text-xs text-emerald-700">✓</span>{item}</span>
              ))}
            </div>
          </div>
          <div className="landing-float relative mx-auto w-full max-w-[25rem] lg:max-w-none">
            <PhoneStoreMockup />
            <FloatingCard className="-left-1 top-10 sm:-left-8" title="New order" value="₦24,500" />
            <FloatingCard className="-right-1 bottom-16 sm:-right-8" title="Payment successful" value="₦24,500" />
          </div>
        </div>
      </section>

      <section className="bg-white py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-3 rounded-[1.25rem] border border-[#E2E8F0] bg-white p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
            {trustItems.map((item, index) => (
              <div key={item} className={`landing-fade-up flex items-center gap-3 rounded-2xl bg-[#F8FAFC] p-4 ${index === 1 ? "landing-delay-1" : index === 2 ? "landing-delay-2" : index === 3 ? "landing-delay-3" : ""}`}>
                <span className="landing-pulse-dot grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F0FDF4] text-[#22C55E]">✓</span>
                <p className="text-sm font-black text-[#0F172A]">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <LandingSection id="how-it-works" eyebrow="HOW IT WORKS" title="From WhatsApp seller to online store in minutes.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((step) => (
            <article key={step.title} className="landing-fade-up rounded-[1.25rem] border border-[#E2E8F0] bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <p className="text-sm font-black text-[#22C55E]">{step.number}</p>
              <h3 className="mt-4 text-xl font-black text-[#0F172A]">{step.title}</h3>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#475569]">{step.text}</p>
            </article>
          ))}
        </div>
      </LandingSection>

      <LandingSection eyebrow="ONE PLATFORM" title="Your store. Your customers. Your business." text="Manage your business while your customers enjoy a simple shopping experience.">
        <div className="grid gap-5 lg:grid-cols-2">
          <SellerDashboardPreview />
          <CustomerStorePreview />
        </div>
      </LandingSection>

      <LandingSection id="features" eyebrow="POWERFUL BUT SIMPLE" title="Everything you need to run your online store.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <article key={feature.title} className={`landing-fade-up rounded-[1.25rem] border border-[#E2E8F0] bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${index % 3 === 1 ? "landing-delay-1" : index % 3 === 2 ? "landing-delay-2" : ""}`}>
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#F0FDF4] text-sm font-black text-[#16A34A]">{index + 1}</span>
              <h3 className="mt-5 text-lg font-black text-[#0F172A]">{feature.title}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#475569]">{feature.text}</p>
            </article>
          ))}
        </div>
      </LandingSection>

      <section className="bg-[#F0FDF4] py-14 sm:py-18">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">BUILT FOR SOCIAL SELLERS</p>
            <h2 className="mt-3 text-[1.8rem] font-black leading-tight text-[#0F172A] sm:text-4xl">Keep WhatsApp. Upgrade how you sell.</h2>
            <p className="mt-4 text-[15px] font-semibold leading-7 text-[#475569]">You don&apos;t need to stop selling through WhatsApp. VENDORAQ gives your customers a professional store to browse before they message you.</p>
            <Link href="/register" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#22C55E] px-6 py-3 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-[#16A34A]">Start Selling Free</Link>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-[1.25rem] border border-emerald-200 bg-white p-4 shadow-sm">
            {["WhatsApp", "VENDORAQ Store", "Cart", "Payment", "Order"].map((item, index) => (
              <div key={item} className="flex items-center gap-3">
                <span className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm font-black text-[#0F172A]">{item}</span>
                {index < 4 ? <span className="hidden text-xl font-black text-[#22C55E] sm:inline">→</span> : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <LandingSection title="Whatever you sell, there's a place for it.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {businessCategories.map((category) => (
            <div key={category} className="landing-fade-up rounded-2xl border border-[#E2E8F0] bg-white p-4 text-sm font-black text-[#0F172A] shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg">
              <span className="mb-3 block h-2 w-10 rounded-full bg-[#22C55E]" />
              {category}
            </div>
          ))}
        </div>
      </LandingSection>

      <LandingSection id="marketplace" eyebrow="DISCOVER" title="More than just your own store." text="Build your own storefront today. As VENDORAQ grows, customers can also discover products and businesses across the platform.">
        <div className="overflow-hidden rounded-[1.25rem] border border-[#E2E8F0] bg-white shadow-xl">
          <div className="flex flex-col gap-3 border-b border-[#E2E8F0] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="rounded-full bg-[#F8FAFC] px-4 py-3 text-sm font-bold text-[#475569]">Search fashion, gadgets, beauty...</div>
            <span className="w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-amber-700 ring-1 ring-amber-100">Coming Soon</span>
          </div>
          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
            {[["Amaka Styles", "Ankara Dress", 18500, "0% 0%"], ["Gadget Plug", "Classic Sneakers", 32000, "100% 0%"], ["Glow Beauty", "Leather Handbag", 24500, "0% 100%"], ["Home Picks", "Sunglasses", 6000, "100% 100%"]].map(([store, product, price, position]) => (
              <article key={`${store}-${product}`} className="landing-fade-up rounded-2xl bg-[#F8FAFC] p-4 transition hover:-translate-y-1 hover:shadow-lg">
                <div className="h-28 rounded-xl bg-cover bg-no-repeat" style={{ backgroundImage: "url('/landing/amaka-products.png')", backgroundPosition: String(position), backgroundSize: "200% 200%" }} />
                <p className="mt-3 text-xs font-black uppercase tracking-wide text-[#22C55E]">{store}</p>
                <h3 className="mt-1 text-base font-black text-[#0F172A]">{product}</h3>
                <p className="mt-1 text-sm font-black text-[#16A34A]">{formatNaira(Number(price))}</p>
              </article>
            ))}
          </div>
          <div className="border-t border-[#E2E8F0] p-4">
            <Link href={storeHref} className="inline-flex min-h-11 items-center rounded-2xl bg-[#0F172A] px-5 py-3 text-sm font-black text-white transition hover:bg-[#16A34A]">Explore Marketplace</Link>
          </div>
        </div>
      </LandingSection>

      <LandingSection id="pricing" eyebrow="PRICING" title="Choose the plan that fits your business.">
        <div className="grid gap-5 lg:grid-cols-3">
          {productPlans.map((plan) => {
            const highlighted = plan.badge.toLowerCase().includes("popular");
            return (
              <article key={plan.name} className={`rounded-[1.25rem] border bg-white p-5 shadow-sm ${highlighted ? "border-[#22C55E] ring-4 ring-emerald-100" : "border-[#E2E8F0]"}`}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-2xl font-black text-[#0F172A]">{plan.name}</h3>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${highlighted ? "bg-[#22C55E] text-white" : "bg-[#F8FAFC] text-[#475569]"}`}>{plan.badge}</span>
                </div>
                <p className="mt-6 text-4xl font-black text-[#0F172A]">{formatNaira(plan.price)}<span className="text-sm font-bold text-[#475569]"> / month</span></p>
                <ul className="mt-6 grid gap-3">
                  {plan.features.map((feature) => <li key={feature} className="flex gap-3 text-sm font-semibold text-[#475569]"><span className="text-[#22C55E]">✓</span>{feature}</li>)}
                </ul>
                <Link href="/register" className={`mt-7 flex min-h-12 items-center justify-center rounded-2xl px-5 py-3 text-sm font-black transition ${highlighted ? "bg-[#22C55E] text-white hover:bg-[#16A34A]" : "border border-[#E2E8F0] bg-white text-[#0F172A] hover:bg-[#F0FDF4]"}`}>Get Started</Link>
              </article>
            );
          })}
        </div>
      </LandingSection>

      <LandingSection id="faq" title="Everything you need to know about VENDORAQ.">
        <div className="grid gap-3 lg:grid-cols-2">
          {faqs.map((faq, index) => (
            <div key={faq.question} className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
              <button type="button" onClick={() => setOpenFaq(openFaq === index ? -1 : index)} className="flex min-h-14 w-full items-center justify-between gap-4 px-4 py-4 text-left text-sm font-black text-[#0F172A]">
                {faq.question}
                <span className="shrink-0 text-xl text-[#22C55E]">{openFaq === index ? "-" : "+"}</span>
              </button>
              {openFaq === index ? <p className="border-t border-[#E2E8F0] px-4 py-4 text-sm font-semibold leading-6 text-[#475569]">{faq.answer}</p> : null}
            </div>
          ))}
        </div>
      </LandingSection>

      <section className="bg-[#0F172A] py-14 text-white sm:py-18">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_24rem] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#22C55E]">YOUR STORE IS WAITING</p>
            <h2 className="mt-3 text-[2rem] font-black leading-tight text-white sm:text-5xl">Start selling smarter today.</h2>
            <p className="mt-4 max-w-2xl text-[15px] font-semibold leading-7 text-slate-300">Create your VENDORAQ store, add your products and give your customers a professional way to shop.</p>
            <div className="mt-7 grid gap-3 sm:flex">
              <Link href="/register" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#22C55E] px-6 py-3 text-sm font-black text-white transition hover:bg-[#16A34A]">Start Selling Free</Link>
              <Link href={storeHref} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-6 py-3 text-sm font-black text-white transition hover:bg-white/15">View Demo Store</Link>
            </div>
          </div>
          <div className="rounded-[1.25rem] border border-white/10 bg-white/10 p-5">
            <p className="text-sm font-bold text-slate-300">Latest order preview</p>
            <p className="mt-3 text-3xl font-black text-white">₦24,500</p>
            <p className="mt-2 text-sm font-semibold text-slate-300">Paid order from Amaka Styles storefront.</p>
          </div>
        </div>
      </section>

      <LandingFooter storeHref={storeHref} />
    </main>
  );
}

function LandingHeader({ storeHref, navLinks, menuOpen, setMenuOpen, onDemoCartOpen }: { storeHref: string; navLinks: Array<{ label: string; href: string }>; menuOpen: boolean; setMenuOpen: (open: boolean) => void; onDemoCartOpen: () => void }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#E2E8F0] bg-white/95 shadow-sm backdrop-blur">
      <nav className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="min-w-0 shrink-0" aria-label="VENDORAQ home"><VendoraqLogo compact /></Link>
        <div className="hidden items-center gap-1 rounded-full bg-[#F8FAFC] p-1 lg:flex">
          {navLinks.map((link) => <Link key={link.label} href={link.href} className="rounded-full px-3 py-2 text-sm font-bold text-[#475569] transition hover:bg-white hover:text-[#16A34A] hover:shadow-sm">{link.label}</Link>)}
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={onDemoCartOpen}
            aria-label="Open demo cart preview"
            title="Open demo cart preview"
            className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#0F172A] transition hover:bg-[#F3F4F6] hover:text-[#16A34A] focus:outline-none focus:ring-4 focus:ring-[#16A34A]/20"
          >
            <IconGlyph name="cart" className="h-5 w-5" />
            <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#16A34A] px-1 text-[10px] font-black leading-none text-white ring-2 ring-white">
              3
            </span>
          </button>
          <Link href="/register" className="hidden rounded-full bg-[#22C55E] px-4 py-2.5 text-xs font-black text-white transition hover:bg-[#16A34A] sm:inline-flex">Start Selling</Link>
          <button type="button" onClick={() => setMenuOpen(true)} className="grid h-10 w-10 place-items-center rounded-full text-[#0F172A] transition hover:bg-[#F8FAFC] lg:hidden" aria-label="Open menu" aria-expanded={menuOpen}>
            <IconGlyph name="menu" className="h-5 w-5" />
          </button>
        </div>
      </nav>
      {menuOpen ? (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button type="button" className="absolute inset-0 bg-[#0F172A]/45" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
          <aside className="relative ml-auto flex h-[100dvh] w-[min(88vw,22rem)] flex-col bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <VendoraqLogo compact />
              <button type="button" onClick={() => setMenuOpen(false)} className="grid h-10 w-10 place-items-center rounded-full border border-[#E2E8F0]" aria-label="Close menu"><IconGlyph name="x" className="h-5 w-5" /></button>
            </div>
            <nav className="mt-8 grid gap-2">
              {navLinks.map((link) => <Link key={link.label} href={link.href} onClick={() => setMenuOpen(false)} className="rounded-2xl px-4 py-3 text-sm font-black text-[#0F172A] hover:bg-[#F0FDF4]">{link.label}</Link>)}
              <Link href={storeHref} onClick={() => setMenuOpen(false)} className="rounded-2xl px-4 py-3 text-sm font-black text-[#0F172A] hover:bg-[#F0FDF4]">View Demo Store</Link>
              <Link href="/login" onClick={() => setMenuOpen(false)} className="rounded-2xl px-4 py-3 text-sm font-black text-[#0F172A] hover:bg-[#F0FDF4]">Seller Login</Link>
            </nav>
            <Link href="/register" onClick={() => setMenuOpen(false)} className="mt-auto flex min-h-12 items-center justify-center rounded-2xl bg-[#22C55E] px-5 py-3 text-sm font-black text-white">Start Selling Free</Link>
          </aside>
        </div>
      ) : null}
    </header>
  );
}

function LandingSection({ id, eyebrow, title, text, children }: { id?: string; eyebrow?: string; title: string; text?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="py-14 sm:py-18">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-8 max-w-3xl">
          {eyebrow ? <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">{eyebrow}</p> : null}
          <h2 className="mt-3 text-[1.8rem] font-black leading-tight text-[#0F172A] sm:text-4xl">{title}</h2>
          {text ? <p className="mt-4 text-[15px] font-semibold leading-7 text-[#475569] sm:text-base">{text}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

function PhoneStoreMockup() {
  const products = [["Ankara Dress", "₦18,500", "Fashion", "0% 0%"], ["Classic Sneakers", "₦32,000", "Shoes", "100% 0%"], ["Leather Handbag", "₦24,500", "Bags", "0% 100%"], ["Sunglasses", "₦6,000", "Style", "100% 100%"]];
  return (
    <div className="mx-auto max-w-[22rem] rounded-[2.3rem] border-[10px] border-[#0F172A] bg-[#0F172A] shadow-2xl">
      <div className="overflow-hidden rounded-[1.55rem] bg-white">
        <div className="bg-[#0F172A] px-5 py-4 text-white">
          <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-white/20" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#22C55E] text-sm font-black">AS</span>
              <div><p className="text-sm font-black text-white">Amaka Styles</p><p className="text-xs font-semibold text-slate-300">Lagos storefront</p></div>
            </div>
            <span className="text-xl">♡</span>
          </div>
        </div>
        <div className="p-4">
          <div className="rounded-full bg-[#F8FAFC] px-4 py-3 text-sm font-semibold text-[#94A3B8] ring-1 ring-[#E2E8F0]">Search products</div>
          <div className="mt-3 flex gap-2 overflow-hidden">{["All", "Dresses", "Shoes"].map((item) => <span key={item} className="shrink-0 rounded-full bg-[#F0FDF4] px-3 py-1 text-xs font-black text-emerald-700">{item}</span>)}</div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {products.map(([name, price, category, position]) => (
              <article key={name} className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
                <div className="relative h-24 bg-cover bg-no-repeat" style={{ backgroundImage: "url('/landing/amaka-products.png')", backgroundPosition: position, backgroundSize: "200% 200%" }}><span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white text-xs text-rose-500 shadow-sm">♡</span></div>
                <div className="p-3"><p className="text-[10px] font-black uppercase tracking-wide text-[#22C55E]">{category}</p><h3 className="mt-1 truncate text-xs font-black text-[#0F172A]">{name}</h3><p className="mt-1 text-xs font-black text-[#16A34A]">{price}</p><button type="button" className="mt-2 w-full rounded-full bg-[#22C55E] px-2 py-1.5 text-[10px] font-black text-white">Add to cart</button></div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FloatingCard({ title, value, className }: { title: string; value: string; className: string }) {
  return <div className={`absolute hidden rounded-2xl border border-[#E2E8F0] bg-white/95 p-4 shadow-xl sm:block ${className}`}><p className="text-xs font-black uppercase tracking-wide text-[#22C55E]">{title}</p><p className="mt-1 text-xl font-black text-[#0F172A]">{value}</p></div>;
}

function DemoCartModal({ onClose }: { onClose: () => void }) {
  const items = [
    ["Ankara Dress", "Fashion", 18500, "0% 0%"],
    ["Classic Sneakers", "Shoes", 32000, "100% 0%"],
    ["Leather Handbag", "Bags", 24500, "0% 100%"],
  ];
  const total = items.reduce((sum, [, , price]) => sum + Number(price), 0);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center overflow-y-auto bg-[#0F172A]/50 p-3 backdrop-blur-sm sm:items-start sm:p-6 sm:pt-8" role="dialog" aria-modal="true" aria-label="Demo cart preview">
      <button type="button" className="absolute inset-0" aria-label="Close demo cart preview" onClick={onClose} />
      <aside className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-[1.25rem] bg-white shadow-2xl sm:max-h-[calc(100dvh-4rem)]">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#E2E8F0] px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#16A34A]">Demo cart</p>
            <h2 className="mt-1 text-lg font-black leading-tight text-[#0F172A] sm:text-xl">How customer checkout looks</h2>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#E2E8F0] text-[#0F172A]" aria-label="Close demo cart preview">
            <IconGlyph name="x" className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-3 p-5">
            {items.map(([name, category, price, position]) => (
              <div key={name} className="flex gap-3 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                <div className="h-20 w-20 shrink-0 rounded-xl bg-cover bg-no-repeat" style={{ backgroundImage: "url('/landing/amaka-products.png')", backgroundPosition: String(position), backgroundSize: "200% 200%" }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-[#0F172A]">{name}</p>
                  <p className="mt-1 text-xs font-black uppercase tracking-wide text-[#16A34A]">{category}</p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#475569] ring-1 ring-[#E2E8F0]">Qty 1</span>
                    <span className="text-sm font-black text-[#0F172A]">{formatNaira(Number(price))}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-[#E2E8F0] bg-white p-5">
            <div className="flex items-center justify-between text-sm font-black text-[#0F172A]">
              <span>Sample total</span>
              <span>{formatNaira(total)}</span>
            </div>
            <p className="mt-3 rounded-2xl bg-[#F0FDF4] px-4 py-3 text-sm font-bold leading-6 text-emerald-800">
              This is only a demo preview. Real customers open a seller&apos;s shared store link before adding products to cart.
            </p>
            <Link href="/register" onClick={onClose} className="mt-4 flex min-h-12 items-center justify-center rounded-2xl bg-[#22C55E] px-5 py-3 text-sm font-black text-white transition hover:bg-[#16A34A]">
              Start Selling Free
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}

function SellerDashboardPreview() {
  return (
    <article className="rounded-[1.25rem] border border-[#E2E8F0] bg-white p-4 shadow-xl">
      <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-[#22C55E]">Seller dashboard</p><h3 className="mt-1 text-xl font-black text-[#0F172A]">Today&apos;s Sales</h3></div><p className="text-2xl font-black text-[#16A34A]">₦185,400</p></div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Orders", "24"], ["Products", "68"], ["Customers", "142"], ["Paid", "18"]].map(([label, value]) => <div key={label} className="rounded-2xl bg-[#F8FAFC] p-3"><p className="text-xs font-bold text-[#475569]">{label}</p><p className="mt-1 text-xl font-black text-[#0F172A]">{value}</p></div>)}</div>
      <div className="mt-5 rounded-2xl border border-[#E2E8F0]">{[["#VN1024", "₦24,500", "Paid"], ["#VN1023", "₦18,000", "Processing"], ["#VN1022", "₦32,000", "Shipped"]].map(([id, amount, status]) => <div key={id} className="flex items-center justify-between gap-3 border-b border-[#E2E8F0] px-4 py-3 last:border-b-0"><span className="text-sm font-black text-[#0F172A]">{id}</span><span className="text-sm font-bold text-[#475569]">{amount}</span><span className="rounded-full bg-[#F0FDF4] px-3 py-1 text-xs font-black text-emerald-700">{status}</span></div>)}</div>
    </article>
  );
}

function CustomerStorePreview() {
  return (
    <article className="rounded-[1.25rem] border border-[#E2E8F0] bg-white p-4 shadow-xl">
      <div className="flex items-center justify-between"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#0F172A] text-sm font-black text-white">AS</span><div><h3 className="text-xl font-black text-[#0F172A]">Amaka Styles</h3><p className="text-xs font-bold text-[#475569]">Customer storefront</p></div></div><span className="rounded-full bg-[#F0FDF4] px-3 py-1 text-xs font-black text-emerald-700">Cart 3</span></div>
      <div className="mt-4 rounded-full bg-[#F8FAFC] px-4 py-3 text-sm font-bold text-[#94A3B8] ring-1 ring-[#E2E8F0]">Search</div>
      <div className="mt-3 flex flex-wrap gap-2">{["Categories", "Products", "Wishlist", "Cart"].map((item) => <span key={item} className="rounded-full border border-[#E2E8F0] px-3 py-1 text-xs font-black text-[#475569]">{item}</span>)}</div>
      <div className="mt-4 grid grid-cols-2 gap-3">{[["Leather Handbag", "₦24,500", "0% 100%"], ["Classic Sneakers", "₦32,000", "100% 0%"]].map(([name, price, position]) => <div key={name} className="rounded-2xl bg-[#F8FAFC] p-3"><div className="h-24 rounded-xl bg-cover bg-no-repeat" style={{ backgroundImage: "url('/landing/amaka-products.png')", backgroundPosition: position, backgroundSize: "200% 200%" }} /><p className="mt-3 truncate text-sm font-black text-[#0F172A]">{name}</p><p className="mt-1 text-sm font-black text-[#16A34A]">{price}</p></div>)}</div>
    </article>
  );
}

function LandingFooter({ storeHref }: { storeHref: string }) {
  const columns = [
    { title: "Product", links: [{ label: "Features", href: "#features" }, { label: "Pricing", href: "#pricing" }, { label: "Marketplace", href: "#marketplace" }, { label: "Demo Store", href: storeHref }] },
    { title: "Account", links: [{ label: "Login", href: "/login" }, { label: "Create Seller Account", href: "/register" }, { label: "Demo Store", href: storeHref }] },
    { title: "Company", links: [{ label: "About", href: "#home" }, { label: "Contact", href: "#faq" }, { label: "Support", href: "#faq" }, { label: "Help Center", href: "#faq" }] },
    { title: "Legal", links: [{ label: "Privacy Policy", href: "#faq" }, { label: "Terms", href: "#faq" }] },
  ];

  return (
    <footer className="bg-[#07111F] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.25fr_0.75fr_0.75fr_0.75fr_0.75fr]">
        <div className="landing-fade-up">
          <VendoraqLogo tone="light" />
          <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-[#4ADE80]">Sell. Connect. Grow.</p>
          <p className="mt-4 max-w-md text-sm font-semibold leading-7 text-slate-100">
            A modern commerce platform for Nigerian sellers to launch online stores, manage orders, receive payments and grow their businesses.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/login" className="rounded-full border border-white/20 bg-white px-4 py-2 text-xs font-black text-[#07111F] transition hover:bg-[#DCFCE7]">Login</Link>
            <Link href="/register" className="rounded-full bg-[#22C55E] px-4 py-2 text-xs font-black text-white transition hover:bg-[#16A34A]">Start Selling</Link>
          </div>
        </div>
        {columns.map((column, index) => (
          <div key={column.title} className={`landing-fade-up ${index === 1 ? "landing-delay-1" : index === 2 ? "landing-delay-2" : index === 3 ? "landing-delay-3" : ""}`}>
            <h3 className="text-sm font-black text-white">{column.title}</h3>
            <nav className="mt-4 grid gap-3">
              {column.links.map((link) => (
                <Link key={`${column.title}-${link.label}`} href={link.href} className="text-sm font-bold text-slate-100 transition hover:text-[#4ADE80]">
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        ))}
      </div>
      <div className="border-t border-white/15 px-4 py-5 text-center text-xs font-bold text-slate-200">© 2026 VENDORAQ. All rights reserved.</div>
    </footer>
  );
}
