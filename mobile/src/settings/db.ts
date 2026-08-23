import { supabase } from "@/src/services/supabase";

export async function saveRestaurantPatch(restaurantId: string, patch: Record<string, unknown>) {
  const { data, error } = await supabase
    .from("restaurants")
    .update(patch)
    .eq("id", restaurantId)
    .select("*")
    .single();
  return { data, error };
}

/** Normalize user time input to HH:mm for Postgres `time` columns. */
export function normalizeTimeInput(value: string, fallback = "09:00") {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return fallback;
  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2])));
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
