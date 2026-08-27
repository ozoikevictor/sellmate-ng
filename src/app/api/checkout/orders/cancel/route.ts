import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server-security";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase server key is not configured.");
  }
  return createClient(url, key);
}

export async function POST(request: Request) {
  const limited = rateLimit(request, "checkout-order-cancel", 8);
  if (limited) {
    return limited;
  }

  let body: {
    orderId?: string;
    customerPhone?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid cancellation details." }, { status: 400 });
  }

  const orderId = String(body.orderId ?? "").trim();
  const customerPhone = String(body.customerPhone ?? "").trim();
  if (!orderId || !customerPhone) {
    return NextResponse.json({ message: "Order and customer phone are required." }, { status: 400 });
  }

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ message: "Order cancellation is not configured yet." }, { status: 500 });
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,customer_phone,status,payment_status")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    return NextResponse.json({ message: orderError.message }, { status: 400 });
  }

  if (!order) {
    return NextResponse.json({ message: "Order not found." }, { status: 404 });
  }

  if (normalizePhone(order.customer_phone) !== normalizePhone(customerPhone)) {
    return NextResponse.json({ message: "This order does not match the customer phone on this device." }, { status: 403 });
  }

  if (order.status === "Delivered") {
    return NextResponse.json({ message: "Delivered orders cannot be cancelled from the customer portal." }, { status: 400 });
  }

  if (order.status === "Cancelled") {
    return NextResponse.json({ ok: true, status: "Cancelled" });
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({ status: "Cancelled" })
    .eq("id", orderId);

  if (updateError) {
    return NextResponse.json({ message: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, status: "Cancelled" });
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}
