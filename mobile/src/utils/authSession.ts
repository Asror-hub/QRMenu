import { supabase } from "../services/supabase";
import type { Session } from "@supabase/supabase-js";

export function isJwtExpiredError(error: { message?: string; code?: string } | null | undefined) {
  const message = (error?.message ?? "").toLowerCase();
  return message.includes("jwt expired") || message.includes("invalid jwt");
}

/** Refresh persisted session so API calls don't use a stale access token (common on Android emulators with clock skew). */
export async function ensureFreshSession(): Promise<Session | null> {
  const { data: current } = await supabase.auth.getSession();
  if (!current.session) return null;

  const { data, error } = await supabase.auth.refreshSession();
  if (error) {
    console.warn("[auth] refresh failed:", error.message);
    // Keep existing session if refresh fails for network reasons; clear only on auth errors.
    const msg = error.message.toLowerCase();
    if (
      msg.includes("refresh token") ||
      msg.includes("invalid") ||
      msg.includes("expired") ||
      msg.includes("not found")
    ) {
      await supabase.auth.signOut();
      return null;
    }
    return current.session;
  }

  return data.session ?? current.session;
}

export async function withAuthRetry<T>(
  run: () => PromiseLike<{ data: T; error: { message?: string } | null }>
): Promise<{ data: T | null; error: { message?: string } | null }> {
  const first = await run();
  if (!first.error || !isJwtExpiredError(first.error)) {
    return first;
  }

  const session = await ensureFreshSession();
  if (!session) {
    return first;
  }

  return run();
}
