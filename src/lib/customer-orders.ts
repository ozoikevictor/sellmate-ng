export type CustomerOrderItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
  image_url?: string | null;
};

export type CustomerOrderRecord = {
  id: string;
  store_slug: string;
  seller_id: string;
  seller_name: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  city: string;
  delivery_address: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment_status: "Pending" | "Paid" | "Failed";
  order_status: string;
  created_at: string;
  items: CustomerOrderItem[];
};

const CUSTOMER_ORDERS_KEY = "vendoraq-customer-orders";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readCustomerOrders(storeSlug?: string) {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const orders = JSON.parse(window.localStorage.getItem(CUSTOMER_ORDERS_KEY) || "[]") as CustomerOrderRecord[];
    return storeSlug ? orders.filter((order) => order.store_slug === storeSlug) : orders;
  } catch {
    return [];
  }
}

export function readCustomerOrder(orderId: string, storeSlug: string) {
  return readCustomerOrders(storeSlug).find((order) => order.id === orderId) ?? null;
}

export function saveCustomerOrder(order: CustomerOrderRecord) {
  if (!canUseStorage()) {
    return [];
  }

  const existing = readCustomerOrders().filter((item) => item.id !== order.id);
  const next = [order, ...existing].slice(0, 60);
  window.localStorage.setItem(CUSTOMER_ORDERS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("vendoraq-customer-orders-updated"));
  return next;
}

export function markCustomerOrderPaid(orderId: string) {
  const next = readCustomerOrders().map((order) =>
    order.id === orderId ? { ...order, payment_status: "Paid" as const, order_status: "Confirmed" } : order,
  );
  if (canUseStorage()) {
    window.localStorage.setItem(CUSTOMER_ORDERS_KEY, JSON.stringify(next));
  }
  return next;
}
