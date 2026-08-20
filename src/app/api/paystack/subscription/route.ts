import { NextResponse } from "next/server";
import { rateLimit, requireSeller } from "@/lib/server-security";

export async function POST(request: Request) {
  const limited = rateLimit(request, "paystack-subscription", 6);
  if (limited) {
    return limited;
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json(
      { message: "Paystack secret key is missing. Add PAYSTACK_SECRET_KEY to .env.local and restart the dev server." },
      { status: 400 },
    );
  }

  const { error, user } = await requireSeller(request);
  if (error || !user) {
    return error;
  }

  const { planName, amount } = await request.json();
  const safeAmount = Number(amount);
  if (!user.email || !planName || !safeAmount || safeAmount <= 0) {
    return NextResponse.json({ message: "Missing email, plan, or amount for subscription payment." }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const callbackUrl = new URL("/dashboard/billing", origin);
  callbackUrl.searchParams.set("plan", planName);
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: user.email,
      amount: Math.round(safeAmount * 100),
      callback_url: callbackUrl.toString(),
      metadata: {
        seller_id: user.id,
        plan: planName,
        payment_type: "seller_subscription",
      },
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.status) {
    return NextResponse.json({ message: data.message ?? "Could not initialize Paystack subscription payment." }, { status: 400 });
  }

  return NextResponse.json({
    authorizationUrl: data.data.authorization_url,
    reference: data.data.reference,
  });
}
