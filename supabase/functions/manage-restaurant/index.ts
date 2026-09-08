import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ACTIONS = ["activate", "deactivate", "delete"] as const;
type Action = (typeof ACTIONS)[number];

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
      return json({ error: `Could not check platform owner: ${seatErr.message}` }, 400);
    }
    if (!seat) return json({ error: "Only the platform owner can manage restaurants." }, 403);

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const id = String(body.id ?? "").trim();
    const action = String(body.action ?? "").trim() as Action;
    if (!id) return json({ error: "Restaurant id is required." }, 400);
    if (!ACTIONS.includes(action)) return json({ error: "Invalid action." }, 400);

    const { data: restaurant, error: loadErr } = await admin
      .from("restaurants")
      .select("id, owner_id, is_active")
      .eq("id", id)
      .maybeSingle();
    if (loadErr) return json({ error: loadErr.message }, 400);
    if (!restaurant) return json({ error: "Restaurant not found." }, 404);

    if (action === "activate" || action === "deactivate") {
      const is_active = action === "activate";
      const { data: updated, error: updErr } = await admin
        .from("restaurants")
        .update({ is_active })
        .eq("id", id)
        .select("id, is_active")
        .single();
      if (updErr || !updated) {
        return json({ error: updErr?.message || "Could not update restaurant." }, 400);
      }
      if (updated.is_active !== is_active) {
        return json({
          error:
            "Access did not change. Run supabase/migrations/046_allow_service_role_restaurant_access.sql in the SQL Editor.",
        }, 400);
      }
      return json({ id: updated.id, is_active: updated.is_active, action });
    }

    const ownerId = restaurant.owner_id as string | null;
    const { error: delErr } = await admin.from("restaurants").delete().eq("id", id);
    if (delErr) {
      const hint = delErr.message.toLowerCase().includes("foreign key")
        ? " Run supabase/migrations/045_restaurant_is_active_and_platform_manage.sql in the SQL Editor."
        : "";
      return json({ error: `${delErr.message}${hint}` }, 400);
    }

    if (ownerId) {
      const { count } = await admin
        .from("restaurants")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", ownerId);
      if (!count) {
        await admin.auth.admin.deleteUser(ownerId);
      }
    }

    return json({ id, action: "delete" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[manage-restaurant]", err);
    return json({ error: msg || "Internal server error" }, 500);
  }
});
