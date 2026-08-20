import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type OrderItem = {
  product_id: string;
  quantity: number;
  products:
    | {
    user_id: string;
    name: string;
    stock: number;
      }
    | {
        user_id: string;
        name: string;
        stock: number;
      }[]
    | null;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase is not configured.");
  }
  return createClient(url, key);
}

export async function GET(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ message: "Paystack secret key is missing." }, { status: 400 });
  }

  const url = new URL(request.url);
  const reference = url.searchParams.get("reference");
  const orderId = url.searchParams.get("order");
  if (!reference || !orderId) {
    return NextResponse.json({ message: "Missing payment reference or order id." }, { status: 400 });
  }

  const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const data = await response.json();
  if (!response.ok || !data.status || data.data?.status !== "success") {
    return NextResponse.json({ message: data.message ?? "Payment was not successful." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error: orderError } = await supabase
    .from("orders")
    .update({ payment_status: "Paid", status: "Confirmed" })
    .eq("id", orderId);

  if (orderError) {
    return NextResponse.json({ message: orderError.message }, { status: 400 });
  }

  const { data: orderItems, error: itemsError } = await supabase
    .from("order_items")
    .select("product_id,quantity,products(user_id,name,stock)")
    .eq("order_id", orderId);

  if (itemsError) {
    return NextResponse.json({ message: itemsError.message }, { status: 400 });
  }

  for (const item of (orderItems ?? []) as unknown as OrderItem[]) {
    const product = Array.isArray(item.products) ? item.products[0] : item.products;
    if (!product) {
      continue;
    }
    const nextStock = Math.max(0, product.stock - item.quantity);
    const nextStatus = nextStock === 0 ? "Sold out" : nextStock <= 5 ? "Low stock" : "Live";
    await supabase
      .from("products")
      .update({ stock: nextStock, status: nextStatus })
      .eq("id", item.product_id)
      .eq("user_id", product.user_id);
  }

  return NextResponse.json({ ok: true });
}
