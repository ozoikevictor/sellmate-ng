export type PlanName = "Trial" | "Starter" | "Pro" | "Business";

export type ProductPlan = {
  name: PlanName;
  price: number;
  limit: number | null;
  badge: string;
  tone: "slate" | "green" | "blue";
  billing: string;
  features: string[];
};

export const productPlans: ProductPlan[] = [
  {
    name: "Starter",
    price: 3000,
    limit: 20,
    badge: "For new sellers",
    tone: "slate",
    billing: "Product pack",
    features: ["20 products", "Public storefront", "Orders and receipts", "Customer list"],
  },
  {
    name: "Pro",
    price: 7500,
    limit: 200,
    badge: "Most popular",
    tone: "green",
    billing: "Growth pack",
    features: ["200 products", "Inventory alerts", "Advanced analytics", "Priority support"],
  },
  {
    name: "Business",
    price: 15000,
    limit: null,
    badge: "For growing teams",
    tone: "blue",
    billing: "Monthly",
    features: ["Unlimited products", "Team access", "Custom storefront support", "Early payment features"],
  },
];

export const trialProductLimit = 10;

export function isPlanExpired(renewsAt?: string | null, nowMs = Date.now()) {
  if (!renewsAt) {
    return false;
  }

  return new Date(renewsAt).getTime() <= nowMs;
}

export function getActivePlanName(plan?: string | null, billingStatus?: string | null, renewsAt?: string | null, nowMs = Date.now()): PlanName {
  if (plan === "Business" && billingStatus === "Active" && isPlanExpired(renewsAt, nowMs)) {
    return "Trial";
  }

  if (billingStatus !== "Active") {
    return "Trial";
  }

  if (plan === "Starter" || plan === "Pro" || plan === "Business") {
    return plan;
  }

  return "Trial";
}

export function getProductLimit(plan?: string | null, billingStatus?: string | null, renewsAt?: string | null, nowMs = Date.now()) {
  const activePlanName = getActivePlanName(plan, billingStatus, renewsAt, nowMs);
  if (activePlanName === "Trial") {
    return trialProductLimit;
  }

  return productPlans.find((item) => item.name === activePlanName)?.limit ?? trialProductLimit;
}

export function formatProductLimit(limit: number | null) {
  return limit === null ? "Unlimited products" : `${limit} products`;
}
