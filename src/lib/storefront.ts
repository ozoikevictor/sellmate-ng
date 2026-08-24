import { supabase } from "@/lib/supabase";

const CACHE_TTL_MS = 30_000;

type CacheEnvelope<T> = {
  value: T;
  expiresAt: number;
};

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

function readCache<T>(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(key);
    if (!rawValue) {
      return null;
    }
    const cached = JSON.parse(rawValue) as CacheEnvelope<T>;
    if (cached.expiresAt < Date.now()) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return cached.value;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(key, JSON.stringify({ value, expiresAt: Date.now() + CACHE_TTL_MS }));
  } catch {
    // Storage can be unavailable in private browsing; the app should still work normally.
  }
}

export function primeStorefrontCache(profile: StoreProfile, products: StoreProduct[]) {
  writeCache(`store:${profile.store_slug}`, profile);
  writeCache(`products:${profile.user_id}`, products);
  products.forEach((product) => writeCache(`product:${profile.user_id}:${product.id}`, product));
}

export async function loadStoreBySlug(slug: string) {
  const cachedProfile = readCache<StoreProfile>(`store:${slug}`);
  if (cachedProfile) {
    return cachedProfile;
  }

  const { data, error } = await supabase
    .from("seller_profiles")
    .select("user_id,business_name,whatsapp_phone,city,store_slug,logo_url,logo_text")
    .eq("store_slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const profile = (data ?? null) as StoreProfile | null;
  if (profile) {
    writeCache(`store:${slug}`, profile);
  }

  return profile;
}

export async function loadLiveStoreProducts(userId: string) {
  const cachedProducts = readCache<StoreProduct[]>(`products:${userId}`);
  if (cachedProducts) {
    return cachedProducts;
  }

  const { data, error } = await supabase
    .from("products")
    .select("id,user_id,name,sku,category,variant_options,price,stock,status,image_url")
    .eq("user_id", userId)
    .eq("status", "Live")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const products = (data ?? []) as StoreProduct[];
  writeCache(`products:${userId}`, products);
  products.forEach((product) => writeCache(`product:${userId}:${product.id}`, product));

  return products;
}

export async function loadLiveStoreProduct(userId: string, productId: string) {
  const cachedProduct = readCache<StoreProduct>(`product:${userId}:${productId}`);
  if (cachedProduct) {
    return cachedProduct;
  }

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

  const product = (data ?? null) as StoreProduct | null;
  if (product) {
    writeCache(`product:${userId}:${productId}`, product);
  }

  return product;
}
