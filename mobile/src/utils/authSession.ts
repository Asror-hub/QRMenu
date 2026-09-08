import { supabase } from "../services/supabase";
import type { Session } from "@supabase/supabase-js";

/** Refresh when this much of the access-token lifetime remains. */
const REFRESH_WITHIN_SECONDS = 90;
const DEFAULT_TOKEN_LIFETIME_SEC = 3600;

let refreshInFlight: Promise<Session | null> | null = null;
let lastRefreshAt = 0;
const MIN_REFRESH_GAP_MS = 8000;

/** Track when we last observed each access token (device wall clock). */
let tokenMeta: {
  fingerprint: string;
  receivedAtMs: number;
  lifetimeSec: number;
} | null = null;

export function isJwtExpiredError(
  error: { message?: string; code?: string } | null | undefined
) {
  const message = (error?.message ?? "").toLowerCase();
  return message.includes("jwt expired") || message.includes("invalid jwt");
}

function decodeJwtPayload(
  accessToken: string
): { iat?: number; exp?: number } | null {
  try {
    const part = accessToken.split(".")[1];
    if (!part) return null;
    const padded =
      part.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (part.length % 4)) % 4);
    // atob is available in RN / Hermes.
    const json = globalThis.atob(padded);
    return JSON.parse(json) as { iat?: number; exp?: number };
  } catch {
    return null;
  }
}

function tokenFingerprint(session: Session) {
  return `${session.expires_at ?? 0}:${session.access_token.slice(0, 16)}`;
}

/** Remember receipt time so expiry checks don't depend on absolute device clock. */
export function noteSessionReceipt(session: Session | null | undefined) {
  if (!session?.access_token) {
    tokenMeta = null;
    return;
  }
  const fingerprint = tokenFingerprint(session);
  if (tokenMeta?.fingerprint === fingerprint) return;

  const payload = decodeJwtPayload(session.access_token);
  const lifetimeSec =
    typeof payload?.exp === "number" && typeof payload?.iat === "number"
      ? Math.max(60, payload.exp - payload.iat)
      : DEFAULT_TOKEN_LIFETIME_SEC;

  tokenMeta = {
    fingerprint,
    receivedAtMs: Date.now(),
    lifetimeSec,
  };

  const deviceVsIat =
    typeof payload?.iat === "number"
      ? Math.round(Date.now() / 1000 - payload.iat)
      : null;
  if (deviceVsIat != null && Math.abs(deviceVsIat) > 5 * 60) {
    console.warn(
      `[auth] device clock looks skewed (~${deviceVsIat}s vs token iat). Using lifetime-based refresh.`
    );
  }
}

/**
 * Remaining lifetime using elapsed time since we received the token.
 * Immune to Android emulator clocks that are hours ahead/behind.
 */
export function getSkewAwareRemainingSeconds(
  session: Session | null | undefined
): number | null {
  if (!session?.access_token) return null;
  noteSessionReceipt(session);
  if (!tokenMeta) return null;
  const elapsedSec = (Date.now() - tokenMeta.receivedAtMs) / 1000;
  return tokenMeta.lifetimeSec - elapsedSec;
}

/**
 * Access tokens last ~1 hour. If the device clock disagrees with JWT `iat`
 * by more than that, the device (often an Android emulator) is skewed.
 * Positive = device is ahead of the auth server.
 */
export function getDeviceClockOffsetMs(
  session: Session | null | undefined
): number {
  const token = session?.access_token;
  if (!token) return 0;
  const payload = decodeJwtPayload(token);
  if (typeof payload?.iat !== "number") return 0;
  const apparentAgeMs = Date.now() - payload.iat * 1000;
  if (apparentAgeMs > 2 * 60 * 60 * 1000) return apparentAgeMs;
  if (apparentAgeMs < -5 * 60 * 1000) return apparentAgeMs;
  return 0;
}

/** Wall clock aligned to the auth server, for "today" filters on skewed emulators. */
export function getCorrectedNow(session: Session | null | undefined): Date {
  return new Date(Date.now() - getDeviceClockOffsetMs(session));
}

function needsRefresh(session: Session | null | undefined) {
  const remaining = getSkewAwareRemainingSeconds(session);
  if (remaining == null) return true;
  return remaining <= REFRESH_WITHIN_SECONDS;
}

async function refreshSessionOnce(): Promise<Session | null> {
  const now = Date.now();
  if (refreshInFlight) return refreshInFlight;
  if (now - lastRefreshAt < MIN_REFRESH_GAP_MS) {
    const { data } = await supabase.auth.getSession();
    return data.session ?? null;
  }

  refreshInFlight = (async () => {
    lastRefreshAt = Date.now();
    try {
      const { data: current } = await supabase.auth.getSession();
      if (!current.session) return null;

      if (!needsRefresh(current.session)) {
        return current.session;
      }

      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.warn("[auth] refresh failed:", error.message);
        const msg = error.message.toLowerCase();
        if (
          msg.includes("refresh token not found") ||
          msg.includes("invalid refresh token") ||
          msg.includes("refresh token has been revoked") ||
          msg.includes("session not found")
        ) {
          await supabase.auth.signOut({ scope: "local" });
          return null;
        }
        // Keep the existing session — server may still accept it.
        return current.session;
      }

      const next = data.session ?? current.session;
      noteSessionReceipt(next);
      return next;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/** Refresh only when the access token is near end-of-life (skew-aware). */
export async function ensureFreshSession(): Promise<Session | null> {
  const { data: current } = await supabase.auth.getSession();
  if (!current.session) return null;
  noteSessionReceipt(current.session);
  if (!needsRefresh(current.session)) return current.session;
  return refreshSessionOnce();
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
