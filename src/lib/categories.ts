export type MarketplaceSubcategory = {
  id: string;
  slug: string;
  name: string;
  productTypes?: string[];
  attributes?: string[];
};

export type MarketplaceCategory = {
  id: string;
  slug: string;
  name: string;
  subcategories: MarketplaceSubcategory[];
  attributes?: string[];
};

export const marketplaceCategories: MarketplaceCategory[] = [
  {
    id: "phones-tablets",
    slug: "phones-tablets",
    name: "Phones & Tablets",
    attributes: ["Brand", "Model", "Storage", "RAM", "Color", "Condition"],
    subcategories: [
      { id: "smartphones", slug: "smartphones", name: "Smartphones", productTypes: ["Android Phone", "iPhone", "Foldable Phone"] },
      { id: "tablets", slug: "tablets", name: "Tablets", productTypes: ["Android Tablet", "iPad", "Kids Tablet"] },
      { id: "phone-accessories", slug: "phone-accessories", name: "Phone Accessories", productTypes: ["Chargers", "Cases", "Screen Guards", "Power Banks"] },
    ],
  },
  {
    id: "computers",
    slug: "computers",
    name: "Computers",
    attributes: ["Brand", "Processor", "RAM", "Storage", "Condition"],
    subcategories: [
      { id: "laptops", slug: "laptops", name: "Laptops", productTypes: ["Windows Laptop", "MacBook", "Gaming Laptop"] },
      { id: "desktops", slug: "desktops", name: "Desktops", productTypes: ["All-in-One", "Tower PC", "Mini PC"] },
      { id: "computer-accessories", slug: "computer-accessories", name: "Computer Accessories", productTypes: ["Keyboard", "Mouse", "Monitor", "Printer"] },
    ],
  },
  {
    id: "electronics",
    slug: "electronics",
    name: "Electronics",
    attributes: ["Brand", "Model", "Power", "Condition"],
    subcategories: [
      { id: "televisions", slug: "televisions", name: "Televisions", productTypes: ["Smart TV", "LED TV", "Projector"] },
      { id: "audio", slug: "audio", name: "Audio", productTypes: ["Speakers", "Headphones", "Soundbar"] },
      { id: "cameras", slug: "cameras", name: "Cameras", productTypes: ["Digital Camera", "Security Camera", "Drone"] },
    ],
  },
  {
    id: "fashion",
    slug: "fashion",
    name: "Fashion",
    attributes: ["Size", "Color", "Gender", "Material", "Brand"],
    subcategories: [
      { id: "mens-clothing", slug: "mens-clothing", name: "Men's Clothing", productTypes: ["Shirt", "Trouser", "Jeans", "Native Wear", "Suit"] },
      { id: "womens-clothing", slug: "womens-clothing", name: "Women's Clothing", productTypes: ["Dress", "Top", "Skirt", "Jeans", "Abaya"] },
      { id: "kids-clothing", slug: "kids-clothing", name: "Kids Clothing", productTypes: ["Dress", "Shirt", "School Wear", "Sleepwear"] },
    ],
  },
  {
    id: "shoes-bags-accessories",
    slug: "shoes-bags-accessories",
    name: "Shoes, Bags & Accessories",
    attributes: ["Size", "Color", "Gender", "Brand", "Material"],
    subcategories: [
      { id: "shoes", slug: "shoes", name: "Shoes", productTypes: ["Sneakers", "Heels", "Slides", "Formal Shoes", "Boots"] },
      { id: "bags", slug: "bags", name: "Bags", productTypes: ["Handbag", "Backpack", "Laptop Bag", "Travel Bag"] },
      { id: "accessories", slug: "accessories", name: "Accessories", productTypes: ["Belts", "Caps", "Scarves", "Wallets"] },
    ],
  },
  {
    id: "beauty-health",
    slug: "beauty-health",
    name: "Beauty & Health",
    attributes: ["Brand", "Skin Type", "Shade", "Size", "Expiry Date"],
    subcategories: [
      { id: "makeup", slug: "makeup", name: "Makeup", productTypes: ["Foundation", "Lipstick", "Powder", "Eye Shadow"] },
      { id: "hair", slug: "hair", name: "Hair", productTypes: ["Wig", "Attachment", "Hair Cream", "Shampoo"] },
      { id: "skincare", slug: "skincare", name: "Skincare", productTypes: ["Cream", "Cleanser", "Serum", "Sunscreen"] },
    ],
  },
  {
    id: "home-furniture",
    slug: "home-furniture",
    name: "Home & Furniture",
    attributes: ["Material", "Color", "Size", "Room"],
    subcategories: [
      { id: "furniture", slug: "furniture", name: "Furniture", productTypes: ["Sofa", "Bed", "Table", "Chair", "Wardrobe"] },
      { id: "home-decor", slug: "home-decor", name: "Home Decor", productTypes: ["Curtains", "Rugs", "Wall Art", "Lighting"] },
      { id: "bedding", slug: "bedding", name: "Bedding", productTypes: ["Bedsheet", "Duvet", "Pillow", "Blanket"] },
    ],
  },
  {
    id: "appliances",
    slug: "appliances",
    name: "Appliances",
    attributes: ["Brand", "Capacity", "Type", "Color", "Condition"],
    subcategories: [
      { id: "washing-machines", slug: "washing-machines", name: "Washing Machines", productTypes: ["Front Load", "Top Load", "Twin Tub"] },
      { id: "refrigerators", slug: "refrigerators", name: "Refrigerators", productTypes: ["Single Door", "Double Door", "Freezer"] },
      { id: "air-conditioners", slug: "air-conditioners", name: "Air Conditioners", productTypes: ["Split Unit", "Window Unit", "Standing AC"] },
    ],
  },
  {
    id: "kitchen",
    slug: "kitchen",
    name: "Kitchen",
    subcategories: [
      { id: "cookware", slug: "cookware", name: "Cookware", productTypes: ["Pot", "Pan", "Kettle", "Pressure Cooker"] },
      { id: "utensils", slug: "utensils", name: "Utensils", productTypes: ["Spoons", "Knives", "Plates", "Cups"] },
      { id: "small-appliances", slug: "small-appliances", name: "Small Appliances", productTypes: ["Blender", "Toaster", "Microwave", "Rice Cooker"] },
    ],
  },
  {
    id: "groceries",
    slug: "groceries",
    name: "Groceries",
    attributes: ["Brand", "Weight", "Pack Size", "Expiry Date"],
    subcategories: [
      { id: "food-cupboard", slug: "food-cupboard", name: "Food Cupboard", productTypes: ["Rice", "Pasta", "Cereal", "Oil"] },
      { id: "drinks", slug: "drinks", name: "Drinks", productTypes: ["Water", "Juice", "Soft Drink", "Malt"] },
      { id: "household", slug: "household", name: "Household", productTypes: ["Detergent", "Tissue", "Cleaning Supplies"] },
    ],
  },
  {
    id: "baby-products",
    slug: "baby-products",
    name: "Baby Products",
    subcategories: [
      { id: "baby-clothing", slug: "baby-clothing", name: "Baby Clothing" },
      { id: "diapers", slug: "diapers", name: "Diapers & Wipes" },
      { id: "baby-gear", slug: "baby-gear", name: "Baby Gear", productTypes: ["Stroller", "Car Seat", "Walker"] },
    ],
  },
  {
    id: "tools-hardware-building",
    slug: "tools-hardware-building",
    name: "Tools, Hardware & Building Materials",
    attributes: ["Brand", "Material", "Size", "Weight", "Condition"],
    subcategories: [
      { id: "building-materials", slug: "building-materials", name: "Building Materials", productTypes: ["Cement", "Tiles", "Paint", "Roofing"] },
      { id: "plumbing", slug: "plumbing", name: "Plumbing", productTypes: ["Pipe", "Tap", "Fitting", "Valve"], attributes: ["Material", "Diameter", "Length", "Brand", "Type"] },
      { id: "tools", slug: "tools", name: "Tools", productTypes: ["Drill", "Hammer", "Screwdriver", "Grinder"] },
    ],
  },
  {
    id: "electrical",
    slug: "electrical",
    name: "Electrical",
    attributes: ["Brand", "Voltage", "Power Rating", "Cable Size"],
    subcategories: [
      { id: "cables", slug: "cables", name: "Cables & Wires" },
      { id: "switches-sockets", slug: "switches-sockets", name: "Switches & Sockets" },
      { id: "solar", slug: "solar", name: "Solar & Inverters", productTypes: ["Panel", "Battery", "Inverter", "Charge Controller"] },
    ],
  },
  {
    id: "automotive",
    slug: "automotive",
    name: "Automotive",
    attributes: ["Brand", "Compatibility", "Part Type", "Condition"],
    subcategories: [
      { id: "car-parts", slug: "car-parts", name: "Car Parts" },
      { id: "car-accessories", slug: "car-accessories", name: "Car Accessories" },
      { id: "motorcycle-parts", slug: "motorcycle-parts", name: "Motorcycle Parts" },
    ],
  },
  { id: "books", slug: "books", name: "Books", subcategories: [{ id: "school-books", slug: "school-books", name: "School Books" }, { id: "novels", slug: "novels", name: "Novels" }, { id: "religious-books", slug: "religious-books", name: "Religious Books" }] },
  { id: "sports", slug: "sports", name: "Sports", subcategories: [{ id: "fitness", slug: "fitness", name: "Fitness" }, { id: "football", slug: "football", name: "Football" }, { id: "outdoor", slug: "outdoor", name: "Outdoor" }] },
  { id: "gaming", slug: "gaming", name: "Gaming", subcategories: [{ id: "consoles", slug: "consoles", name: "Consoles" }, { id: "games", slug: "games", name: "Games" }, { id: "gaming-accessories", slug: "gaming-accessories", name: "Gaming Accessories" }] },
  { id: "watches-jewellery", slug: "watches-jewellery", name: "Watches & Jewellery", subcategories: [{ id: "watches", slug: "watches", name: "Watches" }, { id: "jewellery", slug: "jewellery", name: "Jewellery" }, { id: "sunglasses", slug: "sunglasses", name: "Sunglasses" }] },
  { id: "office", slug: "office", name: "Office", subcategories: [{ id: "stationery", slug: "stationery", name: "Stationery" }, { id: "office-furniture", slug: "office-furniture", name: "Office Furniture" }, { id: "office-equipment", slug: "office-equipment", name: "Office Equipment" }] },
  { id: "agriculture", slug: "agriculture", name: "Agriculture", subcategories: [{ id: "farm-tools", slug: "farm-tools", name: "Farm Tools" }, { id: "seeds", slug: "seeds", name: "Seeds" }, { id: "animal-feed", slug: "animal-feed", name: "Animal Feed" }] },
  { id: "pets", slug: "pets", name: "Pets", subcategories: [{ id: "pet-food", slug: "pet-food", name: "Pet Food" }, { id: "pet-accessories", slug: "pet-accessories", name: "Pet Accessories" }] },
  { id: "musical", slug: "musical", name: "Musical Instruments", subcategories: [{ id: "guitars", slug: "guitars", name: "Guitars" }, { id: "keyboards", slug: "keyboards", name: "Keyboards" }, { id: "studio", slug: "studio", name: "Studio Equipment" }] },
  { id: "industrial", slug: "industrial", name: "Industrial", subcategories: [{ id: "machines", slug: "machines", name: "Machines" }, { id: "safety", slug: "safety", name: "Safety Equipment" }, { id: "industrial-supplies", slug: "industrial-supplies", name: "Industrial Supplies" }] },
  { id: "other", slug: "other", name: "Other", subcategories: [{ id: "general", slug: "general", name: "General Products" }] },
];

export function getCategoryBySlug(slug: string) {
  return marketplaceCategories.find((category) => category.slug === slug);
}

export function getCategoryByName(name: string) {
  const normalized = normalizeLabel(name);
  return marketplaceCategories.find((category) => normalizeLabel(category.name) === normalized);
}

export function getSubcategoriesForCategory(categorySlug: string) {
  return getCategoryBySlug(categorySlug)?.subcategories ?? [];
}

export function getAttributesForCategory(categorySlug: string, subcategorySlug?: string) {
  const category = getCategoryBySlug(categorySlug);
  const subcategory = category?.subcategories.find((item) => item.slug === subcategorySlug);
  return Array.from(new Set([...(category?.attributes ?? []), ...(subcategory?.attributes ?? [])]));
}

export function buildCategoryPath(categorySlug: string, subcategorySlug: string, productType: string) {
  const category = getCategoryBySlug(categorySlug);
  const subcategory = category?.subcategories.find((item) => item.slug === subcategorySlug);
  return [category?.name, subcategory?.name, productType.trim()].filter(Boolean).join(" > ");
}

export function parseCategoryPath(value: string) {
  const [mainName = "", subcategoryName = "", productType = ""] = value.split(">").map((part) => part.trim());
  const category = getCategoryByName(mainName);
  const subcategory = category?.subcategories.find((item) => normalizeLabel(item.name) === normalizeLabel(subcategoryName));

  return {
    categorySlug: category?.slug ?? "",
    subcategorySlug: subcategory?.slug ?? "",
    productType,
    mainName,
    subcategoryName,
  };
}

export function getCategoryMainLabel(value: string) {
  return value.split(">")[0]?.trim() || value || "Products";
}

export function getStoreCategoryLabels(categoryValues: string[]) {
  return Array.from(new Set(categoryValues.map(getCategoryMainLabel).filter(Boolean))).slice(0, 12);
}

function normalizeLabel(value: string) {
  return value.trim().toLowerCase().replace(/&/g, "and").replace(/\s+/g, " ");
}
