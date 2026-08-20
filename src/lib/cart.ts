export type CartItem = {
  id: string;
  user_id: string;
  name: string;
  category: string;
  variant_options?: string | null;
  price: number;
  stock: number;
  image_url?: string | null;
  qty: number;
};

const CART_KEY = "sellmate-ng-cart";

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
  const current = readCart();
  const existing = current.find((cartItem) => cartItem.id === item.id);
  const next = existing
    ? current.map((cartItem) => (cartItem.id === item.id ? { ...cartItem, qty: cartItem.qty + 1 } : cartItem))
    : [...current, { ...item, qty: 1 }];
  writeCart(next);
  return next;
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
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}
