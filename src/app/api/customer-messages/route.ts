import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server-security";

type MessagePatch = {
  id?: string;
  status?: string;
  sellerReply?: string;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase server key is not configured.");
  }
  return createClient(url, key);
}

async function getAuthenticatedSeller(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return { userId: "", error: NextResponse.json({ message: "Supabase auth is not configured." }, { status: 500 }) };
  }

  const accessToken = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!accessToken) {
    return { userId: "", error: NextResponse.json({ message: "Log in again to view messages." }, { status: 401 }) };
  }

  const authClient = createClient(supabaseUrl, anonKey);
  const { data, error } = await authClient.auth.getUser(accessToken);
  if (error || !data.user) {
    return { userId: "", error: NextResponse.json({ message: "Your login session could not be verified." }, { status: 401 }) };
  }

  return { userId: data.user.id, error: null };
}

export async function POST(request: Request) {
  const limited = rateLimit(request, "customer-message-create", 12);
  if (limited) {
    return limited;
  }

  let body: {
    sellerId?: string;
    storeSlug?: string;
    productId?: string;
    productName?: string;
    customerName?: string;
    customerPhone?: string;
    message?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid message details." }, { status: 400 });
  }

  const sellerId = String(body.sellerId ?? "").trim();
  const storeSlug = String(body.storeSlug ?? "").trim();
  const productId = String(body.productId ?? "").trim();
  const productName = String(body.productName ?? "").trim();
  const customerName = String(body.customerName ?? "").trim();
  const customerPhone = String(body.customerPhone ?? "").trim();
  const message = String(body.message ?? "").trim();

  if (!sellerId || !storeSlug || !productId || !productName || !customerName || !customerPhone || !message) {
    return NextResponse.json({ message: "Please enter your name, phone number, and message." }, { status: 400 });
  }

  if (message.length > 500) {
    return NextResponse.json({ message: "Please keep your message under 500 characters." }, { status: 400 });
  }

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ message: "Customer messages are not configured yet." }, { status: 500 });
  }

  const { data, error } = await supabase.from("customer_messages").insert({
    seller_id: sellerId,
    store_slug: storeSlug,
    product_id: productId,
    product_name: productName,
    customer_name: customerName,
    customer_phone: customerPhone,
    message,
    status: "New",
  }).select("id").single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: data?.id ?? "" });
}

export async function GET(request: Request) {
  const limited = rateLimit(request, "customer-message-list", 30);
  if (limited) {
    return limited;
  }

  const url = new URL(request.url);
  const publicIds = url.searchParams.get("ids")?.split(",").map((id) => id.trim()).filter(Boolean).slice(0, 20) ?? [];
  const publicStoreSlug = url.searchParams.get("store")?.trim() ?? "";

  if (publicIds.length > 0 && publicStoreSlug) {
    let supabase: ReturnType<typeof getSupabaseAdmin>;
    try {
      supabase = getSupabaseAdmin();
    } catch {
      return NextResponse.json({ message: "Customer messages are not configured yet." }, { status: 500 });
    }

    const { data, error } = await supabase
      .from("customer_messages")
      .select("id,store_slug,product_name,message,status,seller_reply,replied_at,created_at")
      .eq("store_slug", publicStoreSlug)
      .in("id", publicIds)
      .not("seller_reply", "is", null)
      .order("replied_at", { ascending: false });

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json({ messages: data ?? [] });
  }

  const auth = await getAuthenticatedSeller(request);
  if (auth.error) {
    return auth.error;
  }

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ message: "Customer messages are not configured yet." }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("customer_messages")
    .select("id,store_slug,product_id,product_name,customer_name,customer_phone,message,status,seller_reply,replied_at,created_at")
    .eq("seller_id", auth.userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }

  return NextResponse.json({ messages: data ?? [] });
}

export async function PATCH(request: Request) {
  const limited = rateLimit(request, "customer-message-update", 30);
  if (limited) {
    return limited;
  }

  const auth = await getAuthenticatedSeller(request);
  if (auth.error) {
    return auth.error;
  }

  let body: MessagePatch;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid message update." }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();
  const status = String(body.status ?? "").trim();
  const sellerReply = String(body.sellerReply ?? "").trim();
  if (!id || !["New", "Read", "Replied"].includes(status)) {
    return NextResponse.json({ message: "Choose a valid message status." }, { status: 400 });
  }

  if (sellerReply.length > 800) {
    return NextResponse.json({ message: "Please keep your reply under 800 characters." }, { status: 400 });
  }

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ message: "Customer messages are not configured yet." }, { status: 500 });
  }

  const updatePayload: { status: string; seller_reply?: string; replied_at?: string | null } = { status };
  if (sellerReply) {
    updatePayload.seller_reply = sellerReply;
    updatePayload.replied_at = new Date().toISOString();
    updatePayload.status = "Replied";
  }

  const { error } = await supabase
    .from("customer_messages")
    .update(updatePayload)
    .eq("id", id)
    .eq("seller_id", auth.userId);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, status: updatePayload.status });
}
