"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge, SectionTitle } from "@/components/ui";
import { useAuth } from "@/components/auth";
import {
  buildCategoryPath,
  getAttributesForCategory,
  getCategoryBySlug,
  getSubcategoriesForCategory,
  marketplaceCategories,
  parseCategoryPath,
} from "@/lib/categories";
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
  category_slug: "",
  subcategory_slug: "",
  product_type: "",
  brand: "",
  condition: "New",
  variant_options: "",
  price: "",
  stock: "",
  image_url: "",
  status: "Live",
};

export default function ProductsPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(emptyForm);
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
  const selectedCategory = getCategoryBySlug(form.category_slug);
  const subcategories = getSubcategoriesForCategory(form.category_slug);
  const selectedSubcategory = subcategories.find((subcategory) => subcategory.slug === form.subcategory_slug);
  const productTypes = selectedSubcategory?.productTypes ?? [];
  const suggestedAttributes = getAttributesForCategory(form.category_slug, form.subcategory_slug);

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

  function updateForm(name: string, value: string) {
    setForm((current) => {
      if (name === "category_slug") {
        return { ...current, category_slug: value, subcategory_slug: "", product_type: "" };
      }
      if (name === "subcategory_slug") {
        return { ...current, subcategory_slug: value, product_type: "" };
      }
      return { ...current, [name]: value };
    });
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
    const categoryParts = parseCategoryPath(product.category);
    setEditingId(product.id);
    setForm({
      name: product.name,
      sku: product.sku,
      category: product.category,
      category_slug: categoryParts.categorySlug,
      subcategory_slug: categoryParts.subcategorySlug,
      product_type: categoryParts.productType,
      brand: "",
      condition: "New",
      variant_options: product.variant_options ?? "",
      price: String(product.price),
      stock: String(product.stock),
      image_url: product.image_url ?? "",
      status: product.status,
    });
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
    const brand = String(formData.get("brand") ?? "").trim();
    const condition = String(formData.get("condition") ?? "").trim();
    const productDetails = String(formData.get("variant_options") ?? "").trim();
    const detailParts = [
      brand ? `Brand: ${brand}` : "",
      condition ? `Condition: ${condition}` : "",
      productDetails,
    ].filter(Boolean);
    const payload = {
      user_id: user.id,
      name: String(formData.get("name") ?? "").trim(),
      sku: String(formData.get("sku") ?? "").trim(),
      category: buildCategoryPath(
        String(formData.get("category_slug") ?? ""),
        String(formData.get("subcategory_slug") ?? ""),
        String(formData.get("product_type") ?? ""),
      ) || String(formData.get("category") ?? "").trim(),
      variant_options: detailParts.join(" | ") || null,
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

      <form onSubmit={saveProduct} className="sellmate-card mb-6 rounded-lg p-5">
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
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Product name" name="name" value={form.name} onChange={updateForm} placeholder="Blue Jeans, Cement, Lip Gloss, Human Hair Wig" />
          <Field label="SKU" name="sku" value={form.sku} onChange={updateForm} placeholder="SKU-001" />
          <CategorySelect label="Main category" name="category_slug" value={form.category_slug} onChange={updateForm} />
          <SubcategorySelect label="Subcategory" name="subcategory_slug" value={form.subcategory_slug} onChange={updateForm} options={subcategories} disabled={!selectedCategory} />
          <ProductTypeField label="Product type" name="product_type" value={form.product_type} onChange={updateForm} options={productTypes} disabled={!selectedSubcategory} />
          <input type="hidden" name="category" value={form.category} />
          <Field label="Brand" name="brand" value={form.brand} onChange={updateForm} placeholder="Optional: Nike, Samsung, Dangote..." required={false} />
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Condition
            <select name="condition" value={form.condition} onChange={(event) => updateForm("condition", event.target.value)} className="rounded-md border border-slate-300 px-3 py-3 font-normal outline-none focus:border-emerald-600">
              <option>New</option>
              <option>Used</option>
              <option>Refurbished</option>
              <option>Not applicable</option>
            </select>
          </label>
          <Field label="Options / variants / details" name="variant_options" value={form.variant_options} onChange={updateForm} placeholder={suggestedAttributes.length ? `Example: ${suggestedAttributes.slice(0, 4).join(", ")}` : "Blue, Brown, Black / Size 40, 41, 42 / 50kg"} required={false} />
          <Field label="Price" name="price" value={form.price} onChange={updateForm} placeholder="38500" type="number" />
          <Field label="Stock" name="stock" value={form.stock} onChange={updateForm} placeholder="18" type="number" />
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Product image
            <input name="image_upload" type="file" accept="image/*" onChange={handleImageUpload} className="rounded-md border border-slate-300 bg-white px-3 py-3 text-sm font-normal outline-none file:mr-4 file:rounded-md file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white focus:border-emerald-600" />
            <input type="hidden" name="image_url" value={form.image_url} />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Status
            <select name="status" value={form.status} onChange={(event) => updateForm("status", event.target.value)} className="rounded-md border border-slate-300 px-3 py-3 font-normal outline-none focus:border-emerald-600">
              <option>Live</option>
              <option>Low stock</option>
              <option>Sold out</option>
              <option>Hidden</option>
            </select>
          </label>
        </div>
        {suggestedAttributes.length ? (
          <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-950">
            <p className="font-black">Useful details for this category</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {suggestedAttributes.map((attribute) => (
                <span key={attribute} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-100">
                  {attribute}
                </span>
              ))}
            </div>
          </div>
        ) : null}
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

      <div className="sellmate-card overflow-hidden rounded-lg">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
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
                        <strong className="text-slate-950">{product.name}</strong>
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
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      {label}
      <input
        name={name}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        required={required}
        type={type}
        min={type === "number" ? 0 : undefined}
        className="rounded-md border border-slate-300 px-3 py-3 font-normal outline-none focus:border-emerald-600"
        placeholder={placeholder}
      />
    </label>
  );
}

function CategorySelect({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      {label}
      <select
        name={name}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        required
        className="rounded-md border border-slate-300 px-3 py-3 font-normal outline-none focus:border-emerald-600"
      >
        <option value="">Choose product category</option>
        {marketplaceCategories.map((category) => (
          <option key={category.slug} value={category.slug}>
            {category.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function SubcategorySelect({
  label,
  name,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  options: Array<{ slug: string; name: string }>;
  disabled: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      {label}
      <select
        name={name}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        required
        disabled={disabled}
        className="rounded-md border border-slate-300 px-3 py-3 font-normal outline-none focus:border-emerald-600 disabled:bg-slate-100 disabled:text-slate-400"
      >
        <option value="">{disabled ? "Choose main category first" : "Choose subcategory"}</option>
        {options.map((subcategory) => (
          <option key={subcategory.slug} value={subcategory.slug}>
            {subcategory.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function ProductTypeField({
  label,
  name,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  options: string[];
  disabled: boolean;
}) {
  const listId = "product-type-options";
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      {label}
      <input
        name={name}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        list={listId}
        disabled={disabled}
        required={false}
        className="rounded-md border border-slate-300 px-3 py-3 font-normal outline-none focus:border-emerald-600 disabled:bg-slate-100 disabled:text-slate-400"
        placeholder={disabled ? "Choose subcategory first" : "Example: Sneakers, Cement, Wig, Phone"}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </label>
  );
}

function formatProductError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.toLowerCase().includes("failed to fetch")) {
    return "Could not reach Supabase products table. Check that the products SQL was run, then refresh this page and try again.";
  }
  return message;
}
