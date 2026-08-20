import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server-security";

export async function POST(request: Request) {
  const limited = rateLimit(request, "paystack-initialize", 10);
  if (limited) {
    return limited;
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secretKey) {
    return NextResponse.json(
      { message: "Paystack is not configured yet. Add PAYSTACK_SECRET_KEY to .env.local and restart the dev server." },
      { status: 400 },
    );
  }

  const { orderId, email, amount, customerName } = await request.json();
  const safeAmount = Number(amount);
  if (!orderId || !email || !safeAmount || safeAmount <= 0) {
    return NextResponse.json({ message: "Missing order, email, or amount for payment." }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  let sellerId = "";
  let subaccountCode = "";

  if (supabaseUrl && serviceRoleKey) {
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: order } = await admin
      .from("orders")
      .select("user_id")
      .eq("id", orderId)
      .maybeSingle();

    sellerId = order?.user_id || "";

    if (sellerId) {
      const { data: profile } = await admin
        .from("seller_profiles")
        .select("paystack_subaccount_code")
        .eq("user_id", sellerId)
        .maybeSingle();
      subaccountCode = profile?.paystack_subaccount_code || "";
    }
  }

  const paystackPayload: Record<string, unknown> = {
    email,
    amount: Math.round(safeAmount * 100),
    callback_url: `${origin}/payment/callback?order=${orderId}`,
    metadata: {
      order_id: orderId,
      seller_id: sellerId,
      customer_name: customerName,
    },
  };

  if (subaccountCode) {
    paystackPayload.subaccount = subaccountCode;
    paystackPayload.bearer = "subaccount";
  }

  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(paystackPayload),
  });

  const data = await response.json();
  if (!response.ok || !data.status) {
    return NextResponse.json({ message: data.message ?? "Could not initialize Paystack payment." }, { status: 400 });
  }

  return NextResponse.json({
    authorizationUrl: data.data.authorization_url,
    reference: data.data.reference,
  });
}
