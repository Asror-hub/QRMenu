import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PLANS = ["ordering", "grow", "ops"];
const STATUSES = ["trial_15", "trial_30", "active", "past_due", "canceled"];
const CYCLES = ["monthly", "yearly"];

function toNoonIso(ymd: string) {
  return new Date(`${ymd}T12:00:00`).toISOString();
}

function expiryFromStart(status: string, startYmd: string, expiresYmd: string) {
  if (expiresYmd) return toNoonIso(expiresYmd);
  const start = new Date(`${startYmd}T12:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  if (status === "trial_15") start.setDate(start.getDate() + 15);
  else if (status === "trial_30") start.setMonth(start.getMonth() + 1);
  else return null;
  return start.toISOString();
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Server configuration error." }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Not authenticated." }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: authData, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !authData.user) {
      return json({ error: authErr?.message || "Not authenticated." }, 401);
    }

    const { data: seat, error: seatErr } = await admin
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (seatErr) {
      return json({
        error: `Could not check platform owner: ${seatErr.message}. Run SQL migrations 039–041.`,
      }, 400);
    }
    if (!seat) return json({ error: "Only the platform owner can register restaurants." }, 403);

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const phone = String(body.phone ?? "").trim();
    const venueType = String(body.venue_type ?? "").trim();
    const planId = String(body.plan_id ?? "").trim();
    const billingCycle = String(body.billing_cycle ?? "monthly");
    const status = String(body.subscription_status ?? "").trim();
    const notes = String(body.subscription_notes ?? "").trim();
    const startsRaw = String(body.subscription_starts_at ?? "").trim();
    const expiresRaw = String(body.subscription_expires_at ?? "").trim();

    if (!name) return json({ error: "Restaurant name is required." }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "A valid owner email is required." }, 400);
    }
    if (password.length < 6) {
      return json({ error: "Password must be at least 6 characters." }, 400);
    }
    if (!PLANS.includes(planId)) return json({ error: "A plan is required." }, 400);
    if (!startsRaw) return json({ error: "Start date is required." }, 400);
    if (!CYCLES.includes(billingCycle)) return json({ error: "Invalid billing cycle." }, 400);
    if (!STATUSES.includes(status)) return json({ error: "Invalid status." }, 400);

    if (email === (authData.user.email ?? "").toLowerCase()) {
      return json({ error: "Use a restaurant owner email, not the platform owner account." }, 400);
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { restaurant_name: name },
    });

    if (createErr || !created.user) {
      return json({ error: createErr?.message || "Could not create owner account." }, 400);
    }

    const { data: restaurant, error: restErr } = await admin
      .from("restaurants")
      .insert({
        name,
        email,
        phone: phone || null,
        venue_type: venueType || null,
        plan_id: planId,
        billing_cycle: billingCycle,
        subscription_status: status,
        subscription_starts_at: toNoonIso(startsRaw),
        subscription_expires_at: expiryFromStart(status, startsRaw, expiresRaw),
        subscription_notes: notes || null,
        owner_id: created.user.id,
        currency: "UZS",
      })
      .select("id")
      .single();

    if (restErr || !restaurant) {
      await admin.auth.admin.deleteUser(created.user.id);
      const hint =
        restErr?.message?.includes("subscription_starts_at") ||
        restErr?.message?.includes("subscription_status")
          ? " Run supabase/migrations/042_subscription_trials_and_start.sql in the SQL Editor."
          : "";
      return json({ error: `${restErr?.message || "Could not create restaurant."}${hint}` }, 400);
    }

    return json({ id: restaurant.id, email });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[provision-restaurant]", err);
    return json({ error: msg || "Internal server error" }, 500);
  }
});
