"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, SectionTitle } from "@/components/ui";
import { useAuth } from "@/components/auth";
import { formatNaira } from "@/lib/data";
import { formatProductLimit, getProductLimit, isPlanExpired } from "@/lib/plans";
import { supabase } from "@/lib/supabase";

type Product = {
  id: string;
  user_id: string;
  name: string;
  sku: string;
  category: string;
  variant_options: string | null;
  price: number;
  stock: number;
  status: string;
  image_url: string | null;
  created_at: string;
};

const emptyForm = {
  name: "",
  sku: "",
  category: "",
  variant_options: "",
  price: "",
  stock: "",
  image_url: "",
  status: "Live",
};

type DetailField = {
  key: string;
  label: string;
  placeholder: string;
};

const categoryTemplates: Array<{ name: string; aliases: string[]; fields: DetailField[] }> = [
  {
    name: "Shoes",
    aliases: ["shoe", "shoes", "sneaker", "slippers", "sandals"],
    fields: [
      { key: "type", label: "Shoe type", placeholder: "Sneakers, heels, palms" },
      { key: "size", label: "Size", placeholder: "40, 41, 42" },
      { key: "gender", label: "Gender", placeholder: "Men, women, unisex" },
      { key: "color", label: "Color", placeholder: "Black, white, brown" },
      { key: "condition", label: "Condition", placeholder: "Brand new, fairly used" },
      { key: "brand", label: "Brand", placeholder: "Nike, Adidas, Zara" },
    ],
  },
  {
    name: "Phones & Tablets",
    aliases: ["phone", "phones", "tablet", "iphone", "samsung", "android"],
    fields: [
      { key: "brand", label: "Brand", placeholder: "Apple, Samsung, Tecno" },
      { key: "model", label: "Model", placeholder: "iPhone 13, Galaxy A16" },
      { key: "storage", label: "Storage", placeholder: "64GB, 128GB, 256GB" },
      { key: "ram", label: "RAM", placeholder: "4GB, 6GB, 8GB" },
      { key: "condition", label: "Condition", placeholder: "New, UK used, neatly used" },
      { key: "battery", label: "Battery health", placeholder: "100%, 89%, strong battery" },
    ],
  },
  {
    name: "Beauty / Cosmetics",
    aliases: ["beauty", "cosmetic", "cosmetics", "makeup", "cream", "skincare", "deodorant"],
    fields: [
      { key: "type", label: "Product type", placeholder: "Cream, foundation, deodorant" },
      { key: "brand", label: "Brand", placeholder: "Nivea, Dove, Fenty" },
      { key: "shade", label: "Shade / color", placeholder: "Dark, light, nude, red" },
      { key: "skin", label: "Skin type", placeholder: "Oily, dry, sensitive" },
      { key: "size", label: "Size / volume", placeholder: "50ml, 100ml, 250g" },
      { key: "expiry", label: "Expiry date", placeholder: "12/2027" },
    ],
  },
  {
    name: "Hair / Wigs",
    aliases: ["hair", "wig", "wigs", "extension", "extensions"],
    fields: [
      { key: "type", label: "Hair type", placeholder: "Bone straight, frontal, closure" },
      { key: "length", label: "Length", placeholder: "12 inches, 18 inches" },
      { key: "texture", label: "Texture", placeholder: "Straight, curly, wavy" },
      { key: "color", label: "Color", placeholder: "Black, brown, blonde" },
      { key: "density", label: "Density", placeholder: "180%, 200%" },
      { key: "condition", label: "Condition", placeholder: "New, used once" },
    ],
  },
  {
    name: "Perfume",
    aliases: ["perfume", "fragrance", "body spray"],
    fields: [
      { key: "brand", label: "Brand", placeholder: "Dior, Lattafa, Smart Collection" },
      { key: "scent", label: "Scent type", placeholder: "Oud, floral, fresh, sweet" },
      { key: "size", label: "Bottle size", placeholder: "50ml, 100ml" },
      { key: "gender", label: "For", placeholder: "Men, women, unisex" },
      { key: "strength", label: "Strength", placeholder: "EDP, EDT, oil perfume" },
      { key: "condition", label: "Condition", placeholder: "Sealed, opened once" },
    ],
  },
  {
    name: "Clothing / Fashion",
    aliases: ["cloth", "clothes", "clothing", "fashion", "gown", "jeans", "shirt", "dress"],
    fields: [
      { key: "type", label: "Clothing type", placeholder: "Dress, jeans, shirt" },
      { key: "size", label: "Size", placeholder: "S, M, L, XL, 32" },
      { key: "gender", label: "Gender", placeholder: "Men, women, unisex" },
      { key: "color", label: "Color", placeholder: "Blue, black, red" },
      { key: "material", label: "Material", placeholder: "Cotton, denim, silk" },
      { key: "condition", label: "Condition", placeholder: "Brand new, thrift" },
    ],
  },
  {
    name: "Other",
    aliases: ["other", "general"],
    fields: [
      { key: "type", label: "Item type", placeholder: "What kind of item is it?" },
      { key: "brand", label: "Brand / maker", placeholder: "Brand or maker name" },
      { key: "condition", label: "Condition", placeholder: "New, used, refurbished" },
      { key: "color", label: "Color", placeholder: "Main color" },
    ],
  },
];

const categorySuggestions = categoryTemplates.map((template) => template.name);

function getCategoryTemplate(category: string) {
  const normalized = category.toLowerCase().trim();
  return categoryTemplates.find((template) => template.aliases.some((alias) => normalized.includes(alias))) ?? categoryTemplates[categoryTemplates.length - 1];
}

function buildVariantDetails(details: Record<string, string>, manualDetails: string) {
  const smartDetails = Object.entries(details)
    .map(([key, value]) => [key, value.trim()] as const)
    .filter(([, value]) => value)
    .map(([key, value]) => `${labelFromKey(key)}: ${value}`);
  const extra = manualDetails.trim();
  return [...smartDetails, extra].filter(Boolean).join(" / ");
}

function labelFromKey(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ProductsPage() {
  const { user } = useAuth();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [smartDetails, setSmartDetails] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [billingPlan, setBillingPlan] = useState("Starter");
  const [billingStatus, setBillingStatus] = useState("Trial");
  const [billingRenewsAt, setBillingRenewsAt] = useState("");
  const [nowMs] = useState(() => Date.now());
  const productLimit = getProductLimit(billingPlan, billingStatus, billingRenewsAt, nowMs);
  const usedProducts = products.length;
  const limitReached = !editingId && productLimit !== null && usedProducts >= productLimit;
  const businessExpired = billingPlan === "Business" && billingStatus === "Active" && isPlanExpired(billingRenewsAt, nowMs);
  const planLabel = billingStatus === "Active" && !businessExpired ? billingPlan : "Free trial";
  const liveProducts = products.filter((product) => product.status === "Live").length;
  const lowStockProducts = products.filter((product) => product.status === "Low stock" || product.stock <= 5).length;
  const catalogValue = products.reduce((sum, product) => sum + product.price * product.stock, 0);

  const loadProducts = useCallback(async () => {
    const userId = user?.id;
    if (!userId) {
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.from("products").select("*").eq("user_id", userId).order("created_at", { ascending: false });
      const { data: profile } = await supabase
        .from("seller_profiles")
        .select("plan,billing_status,billing_renews_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        setMessage(error.message);
      } else {
        setProducts(data ?? []);
        setBillingPlan(profile?.plan || "Starter");
        setBillingStatus(profile?.billing_status || "Trial");
        setBillingRenewsAt(profile?.billing_renews_at || "");
      }
    } catch (error) {
      setMessage(formatProductError(error));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadProducts();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadProducts]);

  const activeTemplate = useMemo(() => getCategoryTemplate(form.category), [form.category]);

  function updateForm(name: string, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
    if (name === "category") {
      setSmartDetails({});
    }
  }

  function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setMessage("Please choose a valid image file.");
      return;
    }

    if (file.size > 1_500_000) {
      setMessage("Please choose an image smaller than 1.5MB for this demo.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      updateForm("image_url", String(reader.result ?? ""));
      setMessage("");
    };
    reader.onerror = () => setMessage("Could not read this image. Please choose another picture.");
    reader.readAsDataURL(file);
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      sku: product.sku,
      category: product.category,
      variant_options: product.variant_options ?? "",
      price: String(product.price),
      stock: String(product.stock),
      image_url: product.image_url ?? "",
      status: product.status,
    });
    setSmartDetails({});
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user?.id) {
      setMessage("You need to be logged in to save products.");
      return;
    }
    if (!editingId && productLimit !== null && products.length >= productLimit) {
      setMessage(`${businessExpired ? "Your Business monthly plan has expired." : "Product limit reached."} Your ${planLabel} allows ${formatProductLimit(productLimit)}. Upgrade or renew your billing plan to add more products.`);
      return;
    }
    setSaving(true);
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const payload = {
      user_id: user.id,
      name: String(formData.get("name") ?? "").trim(),
      sku: String(formData.get("sku") ?? "").trim(),
      category: String(formData.get("category") ?? "").trim(),
      variant_options: buildVariantDetails(smartDetails, String(formData.get("variant_options") ?? "")) || null,
      price: Number(formData.get("price") ?? 0),
      stock: Number(formData.get("stock") ?? 0),
      image_url: String(formData.get("image_url") ?? "").trim() || null,
      status: String(formData.get("status") ?? "Live"),
    };
    try {
      const result = editingId
        ? await supabase.from("products").update(payload).eq("id", editingId).eq("user_id", user.id)
        : await supabase.from("products").insert(payload);
      if (result.error) {
        setMessage(result.error.message);
      } else {
        setMessage(editingId ? "Product updated." : "Product added.");
        resetForm();
        await loadProducts();
      }
    } catch (error) {
      setMessage(formatProductError(error));
    }
    setSaving(false);
  }

  async function deleteProduct(productId: string) {
    if (!user?.id) {
      return;
    }
    setMessage("");
    try {
      const { error } = await supabase.from("products").delete().eq("id", productId).eq("user_id", user.id);
      if (error) {
        setMessage(error.message);
      } else {
        setProducts((current) => current.filter((product) => product.id !== productId));
        setMessage("Product deleted.");
      }
    } catch (error) {
      setMessage(formatProductError(error));
    }
  }

  return (
    <>
      <SectionTitle eyebrow="Catalog" title="Products" />

      <section className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-5 bg-[linear-gradient(135deg,#F8FAFC_0%,#ECFDF5_58%,#FFF7ED_100%)] p-5 lg:grid-cols-[1fr_360px] lg:items-center lg:p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Catalog control center</p>
            <h2 className="mt-3 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">Keep your storefront stocked, priced, and ready for buyers.</h2>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
              Add products, upload clear photos, manage stock, and decide which items should appear live in the customer store.
            </p>
          </div>
          <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <ProductMetric label="Live products" value={loading ? "..." : String(liveProducts)} tone="green" />
            <ProductMetric label="Low stock" value={loading ? "..." : String(lowStockProducts)} tone="amber" />
            <ProductMetric label="Stock value" value={loading ? "..." : formatNaira(catalogValue)} tone="dark" />
          </div>
        </div>
      </section>

      <form ref={formRef} onSubmit={saveProduct} className="sellmate-card scroll-mt-28 mb-6 overflow-hidden rounded-lg p-4 sm:scroll-mt-24 sm:p-5">
        <div className={`mb-5 rounded-lg border p-4 text-sm font-semibold ${limitReached ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {planLabel}: {usedProducts}/{formatProductLimit(productLimit)} used.
              {businessExpired ? " Business has expired. Renew monthly to continue unlimited products." : ""}
            </span>
            {limitReached ? (
              <Link href="/dashboard/billing" className="rounded-md bg-slate-950 px-4 py-2 text-center text-xs font-black text-white">
                Upgrade plan
              </Link>
            ) : null}
          </div>
        </div>
        <div className="grid min-w-0 gap-4 md:grid-cols-3">
          <Field label="Product name" name="name" value={form.name} onChange={updateForm} placeholder="Blue Jeans, Cement, Lip Gloss, Human Hair Wig" />
          <Field label="SKU" name="sku" value={form.sku} onChange={updateForm} placeholder="SKU-001" />
          <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-700">
            Category
            <input
              name="category"
              list="product-category-suggestions"
              value={form.category}
              onChange={(event) => updateForm("category", event.target.value)}
              required
              className="w-full min-w-0 rounded-md border border-slate-300 px-3 py-3 font-normal outline-none focus:border-emerald-600"
              placeholder="Shoes, Phones, Cosmetics, Hair"
            />
            <datalist id="product-category-suggestions">
              {categorySuggestions.map((category) => <option key={category} value={category} />)}
            </datalist>
          </label>
          <Field label="Price" name="price" value={form.price} onChange={updateForm} placeholder="38500" type="number" />
          <Field label="Stock" name="stock" value={form.stock} onChange={updateForm} placeholder="18" type="number" />
          <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-700">
            Product image
            <input name="image_upload" type="file" accept="image/*" onChange={handleImageUpload} className="w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-3 text-sm font-normal outline-none file:mr-3 file:rounded-md file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white focus:border-emerald-600 sm:file:px-4 sm:file:text-sm" />
            <input type="hidden" name="image_url" value={form.image_url} />
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-700">
            Status
            <select name="status" value={form.status} onChange={(event) => updateForm("status", event.target.value)} className="w-full min-w-0 rounded-md border border-slate-300 px-3 py-3 font-normal outline-none focus:border-emerald-600">
              <option>Live</option>
              <option>Low stock</option>
              <option>Sold out</option>
              <option>Hidden</option>
            </select>
          </label>
        </div>
        <section className="mt-5 rounded-lg border border-emerald-100 bg-emerald-50 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Smart product details</p>
              <h3 className="mt-1 text-lg font-black text-slate-950">{activeTemplate.name} form</h3>
            </div>
            <p className="text-xs font-bold text-slate-600">Changes when you choose a category.</p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {activeTemplate.fields.map((field) => (
              <Field
                key={field.key}
                label={field.label}
                name={`detail_${field.key}`}
                value={smartDetails[field.key] ?? ""}
                onChange={(_, value) => setSmartDetails((current) => ({ ...current, [field.key]: value }))}
                placeholder={field.placeholder}
                required={false}
              />
            ))}
          </div>
          <label className="mt-4 grid min-w-0 gap-2 text-sm font-bold text-slate-700">
            Extra details
            <textarea
              name="variant_options"
              value={form.variant_options}
              onChange={(event) => updateForm("variant_options", event.target.value)}
              rows={3}
              className="w-full min-w-0 resize-none rounded-md border border-slate-300 bg-white px-3 py-3 font-normal outline-none focus:border-emerald-600"
              placeholder="Anything else customers should know, like colors, sizes, warranty, or package content"
            />
          </label>
        </section>
        {form.image_url ? (
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-sm font-bold text-slate-700">Image preview</p>
            <div className="h-48 max-w-sm rounded-md border border-slate-200 bg-slate-200 bg-cover bg-center" style={{ backgroundImage: `url(${form.image_url})` }} />
            <button type="button" onClick={() => updateForm("image_url", "")} className="mt-3 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700">
              Remove image
            </button>
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <button disabled={saving || limitReached} className="rounded-md bg-emerald-700 px-5 py-3 text-sm font-black text-white disabled:bg-slate-400">
            {saving ? "Saving..." : editingId ? "Update product" : limitReached ? "Product limit reached" : "Add product"}
          </button>
          {editingId ? (
            <button type="button" onClick={resetForm} className="rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700">
              Cancel edit
            </button>
          ) : null}
        </div>
        {message ? <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm font-semibold text-slate-700">{message}</p> : null}
      </form>

      <div className="grid gap-3 md:hidden">
        {loading ? (
          <p className="rounded-lg border border-slate-200 bg-white p-5 text-center font-semibold text-slate-500">Loading products...</p>
        ) : products.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-white p-5 text-center font-semibold text-slate-500">No products yet. Add your first product above.</p>
        ) : (
          products.map((product) => (
            <article key={product.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex gap-3">
                <div
                  className="h-20 w-20 shrink-0 rounded-md border border-slate-200 bg-slate-100 bg-cover bg-center"
                  style={product.image_url ? { backgroundImage: `url(${product.image_url})` } : undefined}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="break-words text-base font-black leading-tight text-slate-950">{product.name}</h3>
                  <p className="mt-1 break-words text-xs font-bold text-slate-500">{product.sku}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge tone={product.status === "Low stock" ? "amber" : product.status === "Sold out" ? "red" : "green"}>{product.status}</Badge>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{product.stock} left</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-sm font-semibold text-slate-600">
                <div className="flex justify-between gap-3"><span>Category</span><strong className="break-words text-right text-slate-950">{product.category}</strong></div>
                <div className="flex justify-between gap-3"><span>Price</span><strong className="text-slate-950">{formatNaira(product.price)}</strong></div>
                {product.variant_options ? <p className="break-words text-xs leading-5 text-slate-500">{product.variant_options}</p> : null}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={() => startEdit(product)} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">Edit</button>
                <button onClick={() => deleteProduct(product.id)} className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">Delete</button>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="sellmate-card hidden overflow-hidden rounded-lg md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-500">
              <tr>
                {["Product", "SKU", "Category", "Options", "Price", "Stock", "Status", "Actions"].map((header) => (
                  <th key={header} className="px-4 py-3 font-bold">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center font-semibold text-slate-500">Loading products...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center font-semibold text-slate-500">No products yet. Add your first product above.</td></tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="text-slate-700">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-12 w-12 shrink-0 rounded-md border border-slate-200 bg-slate-100 bg-cover bg-center"
                          style={product.image_url ? { backgroundImage: `url(${product.image_url})` } : undefined}
                        />
                        <strong className="max-w-[180px] break-words text-slate-950">{product.name}</strong>
                      </div>
                    </td>
                    <td className="px-4 py-4">{product.sku}</td>
                    <td className="px-4 py-4">{product.category}</td>
                    <td className="max-w-[220px] truncate px-4 py-4">{product.variant_options || "None"}</td>
                    <td className="px-4 py-4">{formatNaira(product.price)}</td>
                    <td className="px-4 py-4">{product.stock}</td>
                    <td className="px-4 py-4"><Badge tone={product.status === "Low stock" ? "amber" : product.status === "Sold out" ? "red" : "green"}>{product.status}</Badge></td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(product)} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">Edit</button>
                        <button onClick={() => deleteProduct(product.id)} className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  required = true,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  placeholder: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-700">
      {label}
      <input
        name={name}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        required={required}
        type={type}
        min={type === "number" ? 0 : undefined}
        className="w-full min-w-0 rounded-md border border-slate-300 px-3 py-3 font-normal outline-none focus:border-emerald-600"
        placeholder={placeholder}
      />
    </label>
  );
}

function ProductMetric({ label, value, tone }: { label: string; value: string; tone: "green" | "amber" | "dark" }) {
  const styles = {
    green: "bg-emerald-50 text-emerald-900",
    amber: "bg-amber-50 text-amber-900",
    dark: "bg-slate-950 text-white",
  };

  return (
    <div className={`flex items-center justify-between rounded-md px-3 py-2 ${styles[tone]}`}>
      <span className="text-xs font-black uppercase tracking-wide opacity-75">{label}</span>
      <strong className="text-sm font-black">{value}</strong>
    </div>
  );
}

function formatProductError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.toLowerCase().includes("failed to fetch")) {
    return "Could not reach Supabase products table. Check that the products SQL was run, then refresh this page and try again.";
  }
  return message;
}
