export const formatNaira = (amount: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);

export const metrics = [
  { label: "Today revenue", value: "₦842,500", change: "+18%", tone: "green" },
  { label: "Open orders", value: "36", change: "12 urgent", tone: "amber" },
  { label: "WhatsApp carts", value: "128", change: "+31%", tone: "blue" },
  { label: "Low stock SKUs", value: "7", change: "Restock soon", tone: "red" },
];

export const products = [
  { name: "Ankara Wrap Dress", sku: "ADA-DR-041", price: 38500, stock: 18, category: "Dresses", status: "Live" },
  { name: "Lagos Linen Set", sku: "ADA-ST-015", price: 52000, stock: 9, category: "Co-ords", status: "Live" },
  { name: "Kente Mini Bag", sku: "ADA-BG-008", price: 18000, stock: 4, category: "Accessories", status: "Low stock" },
  { name: "Aso Oke Blazer", sku: "ADA-BZ-022", price: 76000, stock: 6, category: "Outerwear", status: "Live" },
  { name: "Coral Bead Choker", sku: "ADA-JW-013", price: 12500, stock: 28, category: "Jewellery", status: "Live" },
  { name: "Adire Palazzo", sku: "ADA-TR-019", price: 34000, stock: 0, category: "Trousers", status: "Sold out" },
];

export const orders = [
  { id: "SM-2048", customer: "Muna Okafor", channel: "WhatsApp", total: 90500, status: "Paid", city: "Lekki", time: "10:42 AM" },
  { id: "SM-2047", customer: "Tolu Balogun", channel: "Storefront", total: 52000, status: "Packing", city: "Ibadan", time: "9:18 AM" },
  { id: "SM-2046", customer: "Adaeze Ibe", channel: "Instagram DM", total: 30500, status: "Awaiting payment", city: "Enugu", time: "Yesterday" },
  { id: "SM-2045", customer: "Kemi Martins", channel: "WhatsApp", total: 148000, status: "Dispatched", city: "Abuja", time: "Yesterday" },
];

export const customers = [
  { name: "Muna Okafor", phone: "+234 802 143 9071", orders: 8, spent: 426000, segment: "VIP" },
  { name: "Tolu Balogun", phone: "+234 816 650 4432", orders: 3, spent: 164000, segment: "Repeat" },
  { name: "Adaeze Ibe", phone: "+234 705 119 2263", orders: 2, spent: 71500, segment: "New" },
  { name: "Kemi Martins", phone: "+234 809 770 1015", orders: 11, spent: 612000, segment: "VIP" },
];

export const inventory = [
  { item: "Ankara Wrap Dress", available: 18, reserved: 5, reorder: 8, supplier: "Balogun Market" },
  { item: "Lagos Linen Set", available: 9, reserved: 3, reorder: 10, supplier: "Yaba Studio" },
  { item: "Kente Mini Bag", available: 4, reserved: 2, reorder: 12, supplier: "Kumasi Craft" },
  { item: "Adire Palazzo", available: 0, reserved: 0, reorder: 6, supplier: "Abeokuta Dye House" },
];

export const receipts = [
  { id: "RCT-8821", order: "SM-2048", customer: "Muna Okafor", amount: 90500, method: "Transfer", issued: "Today" },
  { id: "RCT-8820", order: "SM-2047", customer: "Tolu Balogun", amount: 52000, method: "Card demo", issued: "Today" },
  { id: "RCT-8819", order: "SM-2045", customer: "Kemi Martins", amount: 148000, method: "POS", issued: "Yesterday" },
];

export const storefrontProducts = products.filter((product) => product.status !== "Sold out").slice(0, 5);

export const cartItems = [
  { name: "Lagos Linen Set", qty: 1, price: 52000 },
  { name: "Kente Mini Bag", qty: 2, price: 18000 },
];
