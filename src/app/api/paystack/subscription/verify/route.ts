import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { productPlans } from "@/lib/plans";

export async function GET(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secretKey || !supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json({ message: "Payment verification is missing server keys." }, { status: 400 });
  }

  const accessToken = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!accessToken) {
    return NextResponse.json({ message: "Log in again before confirming payment." }, { status: 401 });
  }

  const authClient = createClient(supabaseUrl, anonKey);
  const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return NextResponse.json({ message: "Your login session could not be verified." }, { status: 401 });
  }

  const url = new URL(request.url);
  const reference = url.searchParams.get("reference");
  const fallbackPlan = url.searchParams.get("plan");

  if (!reference) {
    return NextResponse.json({ message: "Missing Paystack payment reference." }, { status: 400 });
  }

  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });
  const data = await response.json();

  if (!response.ok || !data.status || data.data?.status !== "success") {
    return NextResponse.json({ message: data.message ?? "Paystack payment is not successful yet." }, { status: 400 });
  }

  const metadata = data.data?.metadata ?? {};
  const sellerId = metadata.seller_id;
  const planName = metadata.plan || fallbackPlan;
  const validPlan = productPlans.find((plan) => plan.name === planName);

  if (sellerId !== authData.user.id) {
    return NextResponse.json({ message: "This payment does not belong to the logged-in seller." }, { status: 403 });
  }

  if (!validPlan) {
    return NextResponse.json({ message: "Payment was successful, but the plan was not recognized." }, { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const renewsAt = validPlan.name === "Business" ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null;
  const { error } = await admin
    .from("seller_profiles")
    .update({
      plan: validPlan.name,
      billing_status: "Active",
      trial_ends_at: null,
      billing_renews_at: renewsAt,
      paystack_reference: reference,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", authData.user.id);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, plan: validPlan.name });
}
