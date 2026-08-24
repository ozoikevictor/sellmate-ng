export type WishlistItem = {
  id: string;
  user_id: string;
  store_slug: string;
  name: string;
  sku?: string | null;
  category: string;
  variant_options?: string | null;
  price: number;
  stock: number;
  image_url?: string | null;
  saved_at: string;
};

const WISHLIST_KEY = "vendoraq-wishlist";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readWishlist(storeSlug?: string) {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const items = JSON.parse(window.localStorage.getItem(WISHLIST_KEY) || "[]") as WishlistItem[];
    return storeSlug ? items.filter((item) => item.store_slug === storeSlug) : items;
  } catch {
    return [];
  }
}

export function writeWishlist(items: WishlistItem[]) {
  if (!canUseStorage()) {
    return items;
  }

  window.localStorage.setItem(WISHLIST_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("vendoraq-wishlist-updated"));
  return items;
}

export function isWishlisted(productId: string, storeSlug: string) {
  return readWishlist(storeSlug).some((item) => item.id === productId);
}

export function toggleWishlist(product: Omit<WishlistItem, "saved_at">) {
  const current = readWishlist();
  const exists = current.some((item) => item.id === product.id && item.store_slug === product.store_slug);
  const next = exists
    ? current.filter((item) => !(item.id === product.id && item.store_slug === product.store_slug))
    : [{ ...product, saved_at: new Date().toISOString() }, ...current];

  return writeWishlist(next);
}

export function removeWishlistItem(productId: string, storeSlug: string) {
  return writeWishlist(readWishlist().filter((item) => !(item.id === productId && item.store_slug === storeSlug)));
}
