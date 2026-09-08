const CUSTOMER_DEV_PORT = 5174;

/** Used when the admin is deployed and VITE_CUSTOMER_APP_URL is missing or local. */
export const PRODUCTION_CUSTOMER_APP_URL =
  "https://qrmenu-customer.asrorkhanodilov.workers.dev";

export function isLoopbackHost(host) {
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

export function isPrivateLanHost(host) {
  return /^(10\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.)/.test(host);
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function isPublicCustomerUrl(url) {
  const host = hostnameOf(url);
  return Boolean(host) && !isLoopbackHost(host) && !isPrivateLanHost(host);
}

export function getConfiguredCustomerAppUrl() {
  return String(import.meta.env.VITE_CUSTOMER_APP_URL || "").replace(/\/$/, "");
}

export function getCustomerDevPort() {
  const url = getConfiguredCustomerAppUrl();
  if (!url) return CUSTOMER_DEV_PORT;
  try {
    const port = new URL(url).port;
    return port ? parseInt(port, 10) : CUSTOMER_DEV_PORT;
  } catch {
    return CUSTOMER_DEV_PORT;
  }
}

/**
 * Base URL encoded into table / website QR codes.
 * Deployed admin never falls back to localhost or a LAN IP.
 */
export function getCustomerAppBaseUrl(networkLanBaseUrl = null) {
  const envBase = getConfiguredCustomerAppUrl();
  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "";
  const adminIsLocal = isLoopbackHost(hostname) || isPrivateLanHost(hostname);

  if (isPublicCustomerUrl(envBase)) return envBase;
  if (!adminIsLocal) return PRODUCTION_CUSTOMER_APP_URL;

  const lan = String(networkLanBaseUrl || "").replace(/\/$/, "");
  if (lan) return lan;
  if (isPrivateLanHost(hostname)) {
    return `http://${hostname}:${getCustomerDevPort()}`;
  }
  if (envBase) return envBase;
  return `http://localhost:${getCustomerDevPort()}`;
}
