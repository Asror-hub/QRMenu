import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });

serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return json({ error: "Server configuration error." }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { orderId } = await req.json().catch(() => ({}));
  if (!orderId) {
    return json({ error: "orderId is required." }, 400);
  }

  // Fetch order with table and restaurant (RLS enforces access)
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_number,
      table_id,
      restaurant_id,
      items,
      comment,
      status,
      created_at,
      accepted_at,
      tables (table_number, table_name),
      restaurants (id, name, pos_webhook_url, pos_webhook_enabled)
    `
    )
    .eq("id", orderId)
    .single();

  if (orderErr || !order) {
    return json({ error: "Order not found." }, 404);
  }

  const restaurant = (order.restaurants ?? order.restaurant) as unknown as {
    id: string;
    name: string;
    pos_webhook_url: string | null;
    pos_webhook_enabled: boolean | null;
  };

  if (!restaurant?.pos_webhook_enabled || !restaurant?.pos_webhook_url?.trim()) {
    return json({ sent: false, message: "POS webhook not configured." }, 200);
  }

  const table = order.tables as unknown as { table_number: number; table_name: string } | null;
  const items = (order.items ?? []) as Array<{ name: string; price: number; quantity: number; notes?: string }>;
  const total = items.reduce(
    (sum: number, i: { price?: number; quantity?: number }) =>
      sum + Number(i.price ?? 0) * Number(i.quantity ?? 0),
    0
  );

  const payload = {
    event: "order_accepted",
    timestamp: new Date().toISOString(),
    order: {
      id: order.id,
      order_number: order.order_number,
      table_id: order.table_id,
      table_number: table?.table_number ?? null,
      table_name: table?.table_name ?? null,
      items,
      comment: order.comment ?? null,
      total: Math.round(total * 100) / 100,
      created_at: order.created_at,
      accepted_at: order.accepted_at
    },
    restaurant: {
      id: restaurant.id,
      name: restaurant.name
    }
  };

  const webhookUrl = restaurant.pos_webhook_url.trim();

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) {
      const text = await res.text();
      return json(
        {
          sent: false,
          error: `Webhook returned ${res.status}`,
          detail: text.slice(0, 500)
        },
        502
      );
    }

    return json({ sent: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json(
      {
        sent: false,
        error: "Failed to reach POS webhook",
        detail: message
      },
      502
    );
  }
});
