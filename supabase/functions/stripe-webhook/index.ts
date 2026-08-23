import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import Stripe from "https://esm.sh/stripe@14?target=denonext";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-11-20"
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signature = req.headers.get("Stripe-Signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SIGNING_SECRET");
  if (!signature || !webhookSecret) {
    return new Response("Webhook not configured", { status: 500 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(`Webhook signature verification failed: ${message}`, {
      status: 400
    });
  }

  if (event.type !== "checkout.session.completed") {
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const orderId = session.metadata?.order_id;
  if (!orderId) {
    console.error("No order_id in session metadata");
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  const amountPaid = (session.amount_total ?? 0) / 100;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .update({
      payment_status: "paid",
      amount_paid: amountPaid,
      status: "finish",
      finished_at: new Date().toISOString()
    })
    .eq("id", orderId)
    .select(
      `
      id,
      order_number,
      table_id,
      restaurant_id,
      items,
      comment,
      created_at,
      accepted_at,
      amount_paid,
      tables (table_number, table_name),
      restaurants (id, name, pos_webhook_url, pos_webhook_enabled)
    `
    )
    .single();

  if (orderErr || !order) {
    console.error("Failed to update order:", orderErr);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  const restaurant = (order.restaurants ?? order.restaurant) as {
    id: string;
    name: string;
    pos_webhook_url: string | null;
    pos_webhook_enabled: boolean | null;
  };

  if (restaurant?.pos_webhook_enabled && restaurant?.pos_webhook_url?.trim()) {
    const table = order.tables as { table_number: number; table_name: string } | null;
    const items = (order.items ?? []) as Array<{
      name: string;
      price: number;
      quantity: number;
      notes?: string;
    }>;
    const total =
      order.amount_paid ??
      items.reduce(
        (sum: number, i: { price?: number; quantity?: number }) =>
          sum + Number(i.price ?? 0) * Number(i.quantity ?? 1),
        0
      );

    const payload = {
      event: "order_paid",
      timestamp: new Date().toISOString(),
      order: {
        id: order.id,
        order_number: order.order_number,
        table_id: order.table_id,
        table_number: table?.table_number ?? null,
        table_name: table?.table_name ?? null,
        items,
        comment: order.comment ?? null,
        total: Math.round(Number(total) * 100) / 100,
        amount_paid: Number(order.amount_paid ?? total),
        created_at: order.created_at,
        accepted_at: order.accepted_at,
        print_bill: true
      },
      restaurant: {
        id: restaurant.id,
        name: restaurant.name
      }
    };

    try {
      await fetch(restaurant.pos_webhook_url.trim(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000)
      });
    } catch (err) {
      console.error("Failed to send order_paid to POS:", err);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});
