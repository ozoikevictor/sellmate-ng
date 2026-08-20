import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server-security";

type CheckoutItem = {
  id: string;
  qty: number;
};

type ProductRow = {
  id: string;
  user_id: string;
  name: string;
  price: number;
  stock: number;
  status: string;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase server key is not configured.");
  }
  return createClient(url, key);
}

export async function POST(request: Request) {
  const limited = rateLimit(request, "checkout-orders", 8);
  if (limited) {
    return limited;
  }

  let body: {
    sellerId?: string;
    customerName?: string;
    customerPhone?: string;
    city?: string;
    deliveryAddress?: string;
    items?: CheckoutItem[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid checkout details." }, { status: 400 });
  }

  const sellerId = String(body.sellerId ?? "").trim();
  const customerName = String(body.customerName ?? "").trim();
  const customerPhone = String(body.customerPhone ?? "").trim();
  const city = String(body.city ?? "").trim();
  const deliveryAddress = String(body.deliveryAddress ?? "").trim();
  const checkoutItems = Array.isArray(body.items) ? body.items : [];

  if (!sellerId || !customerName || !customerPhone || !city || !deliveryAddress || checkoutItems.length === 0) {
    return NextResponse.json({ message: "Please complete your delivery details and cart before payment." }, { status: 400 });
  }

  const ids = checkoutItems.map((item) => item.id).filter(Boolean);
  if (ids.length !== checkoutItems.length) {
    return NextResponse.json({ message: "One cart item is missing product details." }, { status: 400 });
  }

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json(
      { message: "Checkout is not configured yet. Add SUPABASE_SERVICE_ROLE_KEY in Vercel and redeploy." },
      { status: 500 },
    );
  }
  const { data: profile, error: profileError } = await supabase
    .from("seller_profiles")
    .select("delivery_fee")
    .eq("user_id", sellerId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ message: profileError.message }, { status: 400 });
  }

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id,user_id,name,price,stock,status")
    .in("id", ids);

  if (productsError) {
    return NextResponse.json({ message: productsError.message }, { status: 400 });
  }

  const productsById = new Map((products ?? []).map((product: ProductRow) => [product.id, product]));
  const orderItems = checkoutItems.map((item) => {
    const product = productsById.get(item.id);
    const quantity = Math.max(1, Number(item.qty) || 1);
    if (!product || product.user_id !== sellerId || product.status !== "Live" || product.stock < quantity) {
      return null;
    }

    return {
      order_id: "",
      product_id: product.id,
      product_name: product.name,
      quantity,
      unit_price: Number(product.price),
      line_total: Number(product.price) * quantity,
    };
  });

  if (orderItems.some((item) => item === null)) {
    return NextResponse.json({ message: "One item is no longer available. Please return to the store and review your cart." }, { status: 400 });
  }

  const subtotal = orderItems.reduce((sum, item) => sum + (item?.line_total ?? 0), 0);
  const deliveryFee = Number(profile?.delivery_fee ?? 0);
  const total = subtotal + deliveryFee;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: sellerId,
      customer_name: customerName,
      customer_phone: customerPhone,
      city,
      delivery_address: deliveryAddress,
      subtotal,
      delivery_fee: deliveryFee,
      total,
      status: "New",
      payment_status: "Pending",
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return NextResponse.json({ message: orderError?.message ?? "Could not create order." }, { status: 400 });
  }

  const itemsWithOrderId = orderItems.map((item) => ({
    ...item,
    order_id: order.id,
  }));

  const { error: itemsError } = await supabase.from("order_items").insert(itemsWithOrderId);
  if (itemsError) {
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ message: itemsError.message }, { status: 400 });
  }

  return NextResponse.json({
    orderId: order.id,
    subtotal,
    deliveryFee,
    total,
  });
}
