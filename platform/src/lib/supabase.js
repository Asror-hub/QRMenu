import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy platform/.env.example to platform/.env (same values as admin) and restart the dev server."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function platformAdminExists() {
  const { data } = await supabase.rpc("platform_admin_exists");
  return data === true;
}

export async function ensurePlatformAdmin() {
  const { data: claimed, error } = await supabase.rpc("claim_first_platform_admin");
  if (!error && claimed === true) return true;

  const { data: flag } = await supabase.rpc("is_platform_admin");
  return flag === true;
}

export async function invokeFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (data?.error) return { data: null, error: data.error };
  if (!error) return { data, error: null };

  let message = error.message || "Request failed.";
  const ctx = error.context;
  if (ctx) {
    try {
      const payload = typeof ctx.clone === "function" ? await ctx.clone().json() : await ctx.json();
      message = payload?.error || payload?.message || message;
    } catch {
      try {
        const text = typeof ctx.clone === "function" ? await ctx.clone().text() : await ctx.text();
        if (text) message = text;
      } catch {
        /* keep message */
      }
    }
  }
  return { data: null, error: message };
}
