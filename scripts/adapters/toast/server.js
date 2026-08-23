/**
 * Toast POS Adapter
 *
 * Receives order webhooks from QRMenu and forwards them to Toast POS API.
 * Configure via environment variables (see README).
 *
 * Run: TOAST_API_KEY=xxx TOAST_APPLICATION_KEY=xxx node server.js
 * Or use .env file
 */

const http = require("http");

const PORT = Number(process.env.PORT) || 3001;

// Toast config - set these before running
const TOAST_API_KEY = process.env.TOAST_API_KEY;
const TOAST_APPLICATION_KEY = process.env.TOAST_APPLICATION_KEY;
const TOAST_RESTAURANT_GUID = process.env.TOAST_RESTAURANT_GUID;

function convertToToastFormat(payload) {
  // Toast API format - adjust to match Toast's current API docs
  const { order, restaurant } = payload;
  return {
    // See Toast API docs: https://doc.toasttab.com/
    // This is a placeholder structure - Toast's order API may differ
    orderType: "QR_ORDER",
    source: "QRMenu",
    externalId: order?.id,
    orderNumber: String(order?.order_number ?? ""),
    table: order?.table_name ?? String(order?.table_number ?? order?.table_id ?? ""),
    items: (order?.items ?? []).map((item) => ({
      name: item.name,
      quantity: item.quantity ?? 1,
      price: item.price,
      notes: item.notes ?? null
    })),
    note: order?.comment ?? null,
    total: order?.total ?? 0
  };
}

async function sendToToast(payload) {
  if (!TOAST_API_KEY || !TOAST_APPLICATION_KEY) {
    console.error("[Toast] Missing TOAST_API_KEY or TOAST_APPLICATION_KEY. Check your .env");
    return { ok: false, error: "Toast not configured" };
  }

  const toastOrder = convertToToastFormat(payload);

  // Toast API endpoint - verify with Toast docs
  const baseUrl = "https://ws-api.toasttab.com";
  const url = `${baseUrl}/orders/v2/orders`;
  const body = JSON.stringify(toastOrder);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Toast-Restaurant-External-ID": TOAST_RESTAURANT_GUID ?? "",
        Authorization: `Bearer ${TOAST_API_KEY}`,
        "Toast-Application-Key": TOAST_APPLICATION_KEY
      },
      body
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[Toast] API error:", res.status, text);
      return { ok: false, error: text };
    }

    const data = await res.json();
    console.log("[Toast] Order sent:", data);
    return { ok: true, data };
  } catch (err) {
    console.error("[Toast] Request failed:", err.message);
    return { ok: false, error: err.message };
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "POST" && (req.url === "/" || req.url === "/order")) {
    let body = "";
    for await (const chunk of req) body += chunk;

    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      res.writeHead(400);
      res.end(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }

    console.log("[Toast Adapter] Received order #" + (payload?.order?.order_number ?? "?"));
    const result = await sendToToast(payload);

    res.writeHead(result.ok ? 200 : 502);
    res.end(JSON.stringify(result.ok ? { received: true } : { error: result.error }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Toast adapter listening on http://0.0.0.0:${PORT}`);
  if (!TOAST_API_KEY) console.warn("  WARNING: TOAST_API_KEY not set");
  if (!TOAST_APPLICATION_KEY) console.warn("  WARNING: TOAST_APPLICATION_KEY not set");
  console.log("  Webhook URL for Settings:", `http://YOUR_IP:${PORT}/order`);
});
