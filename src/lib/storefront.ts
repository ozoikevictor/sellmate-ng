import { supabase } from "@/lib/supabase";

export type StoreProfile = {
  user_id: string;
  business_name: string;
  whatsapp_phone: string | null;
  city: string | null;
  store_slug: string;
  logo_url?: string | null;
  logo_text?: string | null;
};

export type StoreProduct = {
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
};

export function getProductShortDescription(product: StoreProduct) {
  return product.variant_options || `SKU: ${product.sku}`;
}

export function getProductFacts(product: StoreProduct) {
  return (product.variant_options ?? "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

export async function loadStoreBySlug(slug: string) {
  const { data, error } = await supabase
    .from("seller_profiles")
    .select("user_id,business_name,whatsapp_phone,city,store_slug,logo_url,logo_text")
    .eq("store_slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as StoreProfile | null;
}

export async function loadLiveStoreProducts(userId: string) {
  const { data, error } = await supabase
    .from("products")
    .select("id,user_id,name,sku,category,variant_options,price,stock,status,image_url")
    .eq("user_id", userId)
    .eq("status", "Live")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as StoreProduct[];
}

export async function loadLiveStoreProduct(userId: string, productId: string) {
  const { data, error } = await supabase
    .from("products")
    .select("id,user_id,name,sku,category,variant_options,price,stock,status,image_url")
    .eq("user_id", userId)
    .eq("id", productId)
    .eq("status", "Live")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as StoreProduct | null;
}
