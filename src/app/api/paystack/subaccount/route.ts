import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secretKey || !supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json({ message: "Paystack or Supabase server keys are missing." }, { status: 400 });
  }

  const accessToken = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!accessToken) {
    return NextResponse.json({ message: "Log in again before connecting payout." }, { status: 401 });
  }

  const authClient = createClient(supabaseUrl, anonKey);
  const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return NextResponse.json({ message: "Your login session could not be verified." }, { status: 401 });
  }

  const { businessName, bankName, bankCode, accountNumber } = await request.json();
  if (!businessName || !bankCode || !accountNumber) {
    return NextResponse.json({ message: "Add business name, bank, and account number before connecting payout." }, { status: 400 });
  }

  const response = await fetch("https://api.paystack.co/subaccount", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      business_name: businessName,
      settlement_bank: bankCode,
      account_number: accountNumber,
      percentage_charge: 0,
      description: `${businessName} seller payout account`,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.status) {
    return NextResponse.json({ message: data.message ?? "Could not create Paystack subaccount." }, { status: 400 });
  }

  const subaccountCode = data.data?.subaccount_code;
  if (!subaccountCode) {
    return NextResponse.json({ message: "Paystack did not return a subaccount code." }, { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await admin
    .from("seller_profiles")
    .update({
      bank_name: bankName,
      bank_code: bankCode,
      account_number: accountNumber,
      paystack_subaccount_code: subaccountCode,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", authData.user.id);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, subaccountCode });
}
