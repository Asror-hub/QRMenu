import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import Stripe from "https://esm.sh/stripe@14?target=denonext";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders }
  });

serve(async (req) => {
  try {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) return json({ error: "Stripe not configured." }, 500);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceKey) {
    return json({ error: "Server configuration error." }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let body: { orderId: string; successUrl?: string; cancelUrl?: string; customerEmail?: string | null } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { orderId, successUrl, cancelUrl, customerEmail } = body;
  if (!orderId) return json({ error: "orderId is required." }, 400);

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_number,
      restaurant_id,
      table_id,
      items,
      payment_status,
      tables (table_number, table_name),
      restaurants (id, name, currency, stripe_enabled)
    `
    )
    .eq("id", orderId)
    .single();

  if (orderErr || !order) return json({ error: "Order not found." }, 404);

  const restaurant = (order.restaurants ?? order.restaurant) as {
    id: string;
    name: string;
    currency?: string | null;
    stripe_enabled?: boolean | null;
  };

  if (!restaurant?.stripe_enabled) {
    return json({ error: "Payments not enabled for this restaurant." }, 400);
  }

  if (order.payment_status === "paid") {
    return json({ error: "Order already paid." }, 400);
  }

  const items = (order.items ?? []) as Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  const totalCents = Math.round(
    items.reduce(
      (sum: number, i: { price?: number; quantity?: number }) =>
        sum + Number(i.price ?? 0) * Number(i.quantity ?? 1),
      0
    ) * 100
  );

  if (totalCents <= 0) return json({ error: "Order total must be greater than 0." }, 400);

  const currency = (restaurant.currency ?? "usd").toLowerCase().slice(0, 3);
  const stripe = new Stripe(stripeKey);

  const paymentMethods: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] =
    currency === "pln" ? ["card", "blik"] : ["card"];
  const origin = successUrl ? new URL(successUrl).origin : undefined;
  const emailForStripe =
    customerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(customerEmail).trim())
      ? String(customerEmail).trim()
      : `noreply-${order.id}@receipt.qrmenu.local`;
  const success = successUrl ?? `${origin || "http://localhost:5173"}/r/${restaurant.id}/t/${order.table_id}?order_paid=1&order_id=${order.id}`;
  const cancel = cancelUrl ?? `${origin || "http://localhost:5173"}/r/${restaurant.id}/t/${order.table_id}?payment_cancelled=1`;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: paymentMethods,
    customer_email: emailForStripe,
    mode: "payment",
    line_items: items.map((item) => ({
      price_data: {
        currency,
        product_data: {
          name: String(item.name ?? "Item")
        },
        unit_amount: Math.round(Number(item.price ?? 0) * 100)
      },
      quantity: Number(item.quantity ?? 1)
    })),
    metadata: {
      order_id: order.id,
      restaurant_id: restaurant.id
    },
    success_url: success,
    cancel_url: cancel
  });

  await supabase
    .from("orders")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", orderId);

  return json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[create-checkout-session]", err);
    return json({ error: msg || "Internal server error" }, 500);
  }
});
