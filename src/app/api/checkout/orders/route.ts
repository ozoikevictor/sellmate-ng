import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { parseChatOffer } from "@/lib/cart";
import { rateLimit } from "@/lib/server-security";

type CheckoutItem = {
  id: string;
  qty: number;
  agreedPrice?: number;
  agreedDeliveryFee?: number;
  bargainMessageId?: string;
};

type ProductRow = {
  id: string;
  user_id: string;
  name: string;
  price: number;
  stock: number;
  status: string;
};

type MessageOfferRow = {
  id: string;
  seller_reply: string | null;
  customer_phone: string;
  product_id: string;
  store_slug: string;
};

type ValidOffer = NonNullable<ReturnType<typeof parseChatOffer>> & {
  customer_phone: string;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase server key is not configured.");
  }
  return createClient(url, key);
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0")) return `234${digits.slice(1)}`;
  return digits;
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

  const bargainIds = checkoutItems.map((item) => String(item.bargainMessageId ?? "").trim()).filter(Boolean);
  let offersByMessageId = new Map<string, ValidOffer>();
  if (bargainIds.length > 0) {
    const { data: offerMessages, error: offerError } = await supabase
      .from("customer_messages")
      .select("id,seller_reply,customer_phone,product_id,store_slug")
      .eq("seller_id", sellerId)
      .in("id", bargainIds);

    if (offerError) {
      return NextResponse.json({ message: offerError.message }, { status: 400 });
    }

    offersByMessageId = new Map(
      (offerMessages ?? [])
        .map((message: MessageOfferRow) => {
          const offer = parseChatOffer(message.seller_reply, message.id);
          return offer ? [message.id, { ...offer, customer_phone: message.customer_phone }] as const : null;
        })
        .filter((entry): entry is readonly [string, ValidOffer] => Boolean(entry)),
    );
  }

  const productsById = new Map((products ?? []).map((product: ProductRow) => [product.id, product]));
  let agreedDeliveryFee: number | null = null;
  const orderItems = checkoutItems.map((item) => {
    const product = productsById.get(item.id);
    const quantity = Math.max(1, Number(item.qty) || 1);
    if (!product || product.user_id !== sellerId || product.status !== "Live" || product.stock < quantity) {
      return null;
    }

    let unitPrice = Number(product.price);
    const bargainMessageId = String(item.bargainMessageId ?? "").trim();
    if (bargainMessageId) {
      const offer = offersByMessageId.get(bargainMessageId);
      if (!offer || offer.seller_id !== sellerId || offer.product_id !== product.id || normalizePhone(customerPhone) !== normalizePhone(offer.customer_phone)) {
        return null;
      }
      if (typeof offer.agreed_price === "number" && offer.agreed_price > 0) {
        unitPrice = offer.agreed_price;
      }
      if (typeof offer.delivery_fee === "number" && offer.delivery_fee >= 0) {
        agreedDeliveryFee = Math.max(agreedDeliveryFee ?? 0, offer.delivery_fee);
      }
    }

    return {
      order_id: "",
      product_id: product.id,
      product_name: product.name,
      quantity,
      unit_price: unitPrice,
      line_total: unitPrice * quantity,
    };
  });

  if (orderItems.some((item) => item === null)) {
    return NextResponse.json({ message: "One item is no longer available. Please return to the store and review your cart." }, { status: 400 });
  }

  const subtotal = orderItems.reduce((sum, item) => sum + (item?.line_total ?? 0), 0);
  const deliveryFee = agreedDeliveryFee ?? Number(profile?.delivery_fee ?? 0);
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
