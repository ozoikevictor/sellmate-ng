export type CartItem = {
  id: string;
  user_id: string;
  store_slug?: string;
  name: string;
  category: string;
  variant_options?: string | null;
  price: number;
  original_price?: number;
  agreed_price?: number;
  agreed_delivery_fee?: number;
  bargain_message_id?: string;
  stock: number;
  image_url?: string | null;
  qty: number;
};

export type ChatOffer = {
  message_id: string;
  seller_id: string;
  store_slug: string;
  product_id: string;
  product_name: string;
  agreed_price?: number;
  delivery_fee?: number;
  note?: string;
};

export type WishlistItem = Omit<CartItem, "qty">;

export type CustomerOrderItem = {
  id: string;
  name: string;
  qty: number;
  price: number;
};

export type CustomerOrder = {
  orderId: string;
  store_slug: string;
  seller_id: string;
  customer_name: string;
  customer_phone: string;
  city: string;
  delivery_address: string;
  total: number;
  status: string;
  payment_status: string;
  created_at: string;
  items: CustomerOrderItem[];
};

const CART_KEY = "sellmate-ng-cart";
const STORE_KEY = "sellmate-ng-current-store";
const WISHLIST_KEY = "sellmate-ng-wishlist";
const CUSTOMER_ORDERS_KEY = "sellmate-ng-customer-orders";
const ACCEPTED_OFFERS_KEY = "sellmate-ng-accepted-offers";
export const CHAT_OFFER_PREFIX = "SELLMATE_OFFER:";

export function readCurrentStoreHref() {
  try {
    return localStorage.getItem(STORE_KEY) || "/";
  } catch {
    return "/";
  }
}

export function writeCurrentStoreHref(href: string) {
  try {
    localStorage.setItem(STORE_KEY, href);
  } catch {
    // Ignore storage failures so shopping can continue.
  }
}

export function readCart(): CartItem[] {
  try {
    const stored = localStorage.getItem(CART_KEY);
    return stored ? (JSON.parse(stored) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("sellmate-cart-updated"));
}

export function addToCart(item: Omit<CartItem, "qty">) {
  const current = readCart().filter((cartItem) => !item.store_slug || !cartItem.store_slug || cartItem.store_slug === item.store_slug);
  const existing = current.find((cartItem) => cartItem.id === item.id);
  const next = existing
    ? current.map((cartItem) => (cartItem.id === item.id ? { ...cartItem, qty: cartItem.qty + 1 } : cartItem))
    : [...current, { ...item, qty: 1 }];
  writeCart(next);
  return next;
}

export function cartItemPrice(item: CartItem) {
  return Number(item.agreed_price ?? item.price ?? 0);
}

export function updateCartQty(id: string, qty: number) {
  const next = readCart()
    .map((item) => (item.id === id ? { ...item, qty } : item))
    .filter((item) => item.qty > 0);
  writeCart(next);
  return next;
}

export function clearCart() {
  writeCart([]);
}

export function cartTotal(items: CartItem[]) {
  return items.reduce((sum, item) => sum + cartItemPrice(item) * item.qty, 0);
}

export function readAcceptedOffers(storeSlug?: string): ChatOffer[] {
  try {
    const stored = localStorage.getItem(ACCEPTED_OFFERS_KEY);
    const offers = stored ? (JSON.parse(stored) as ChatOffer[]) : [];
    return storeSlug ? offers.filter((offer) => offer.store_slug === storeSlug) : offers;
  } catch {
    return [];
  }
}

export function saveAcceptedOffer(offer: ChatOffer) {
  const current = readAcceptedOffers().filter((item) => item.message_id !== offer.message_id);
  localStorage.setItem(ACCEPTED_OFFERS_KEY, JSON.stringify([offer, ...current].slice(0, 50)));
  window.dispatchEvent(new Event("sellmate-accepted-offer-updated"));
}

export function encodeChatOffer(offer: Omit<ChatOffer, "message_id">) {
  return `${CHAT_OFFER_PREFIX}${JSON.stringify(offer)}`;
}

export function parseChatOffer(text?: string | null, messageId = ""): ChatOffer | null {
  if (!text?.startsWith(CHAT_OFFER_PREFIX)) return null;
  try {
    const offer = JSON.parse(text.slice(CHAT_OFFER_PREFIX.length)) as Omit<ChatOffer, "message_id">;
    return { ...offer, message_id: messageId };
  } catch {
    return null;
  }
}

export function applyOfferToCart(product: Omit<CartItem, "qty">, offer: ChatOffer) {
  const current = readCart().filter((item) => !product.store_slug || !item.store_slug || item.store_slug === product.store_slug);
  const existing = current.find((item) => item.id === product.id);
  const nextItem = {
    ...(existing ?? product),
    ...product,
    original_price: product.price,
    agreed_price: offer.agreed_price,
    agreed_delivery_fee: offer.delivery_fee,
    bargain_message_id: offer.message_id,
    qty: existing?.qty ?? 1,
  };
  const next = existing ? current.map((item) => (item.id === product.id ? nextItem : item)) : [...current, nextItem];
  saveAcceptedOffer(offer);
  writeCart(next);
  return next;
}

export function readWishlist(storeSlug?: string): WishlistItem[] {
  try {
    const stored = localStorage.getItem(WISHLIST_KEY);
    const items = stored ? (JSON.parse(stored) as WishlistItem[]) : [];
    return storeSlug ? items.filter((item) => item.store_slug === storeSlug) : items;
  } catch {
    return [];
  }
}

export function toggleWishlistItem(item: WishlistItem) {
  const current = readWishlist();
  const exists = current.some((wishlistItem) => wishlistItem.id === item.id && wishlistItem.store_slug === item.store_slug);
  const next = exists
    ? current.filter((wishlistItem) => !(wishlistItem.id === item.id && wishlistItem.store_slug === item.store_slug))
    : [...current, item];
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("sellmate-wishlist-updated"));
  return next;
}

export function readCustomerOrders(storeSlug?: string): CustomerOrder[] {
  try {
    const stored = localStorage.getItem(CUSTOMER_ORDERS_KEY);
    const orders = stored ? (JSON.parse(stored) as CustomerOrder[]) : [];
    return storeSlug ? orders.filter((order) => order.store_slug === storeSlug) : orders;
  } catch {
    return [];
  }
}

export function saveCustomerOrder(order: CustomerOrder) {
  const current = readCustomerOrders().filter((existingOrder) => existingOrder.orderId !== order.orderId);
  localStorage.setItem(CUSTOMER_ORDERS_KEY, JSON.stringify([order, ...current]));
  window.dispatchEvent(new Event("sellmate-customer-orders-updated"));
}

export function updateCustomerOrder(orderId: string, patch: Partial<CustomerOrder>) {
  const next = readCustomerOrders().map((order) => (order.orderId === orderId ? { ...order, ...patch } : order));
  localStorage.setItem(CUSTOMER_ORDERS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("sellmate-customer-orders-updated"));
  return next;
}

