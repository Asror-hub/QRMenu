/**
 * Dotykacka POS Adapter
 *
 * Receives order webhooks from QRMenu and forwards them to Dotykacka.
 * Configure via environment variables (see README).
 *
 * Run: DOTYKACKA_API_URL=xxx DOTYKACKA_API_KEY=xxx node server.js
 */

const http = require("http");

const PORT = Number(process.env.PORT) || 3002;

const DOTYKACKA_API_URL = process.env.DOTYKACKA_API_URL; // e.g. https://app.dotykacka.cz/api
const DOTYKACKA_API_KEY = process.env.DOTYKACKA_API_KEY;

function convertToDotykackaFormat(payload) {
  const { order, restaurant } = payload;
  // Adjust to Dotykacka's API - structure may vary
  return {
    externalId: order?.id,
    orderNumber: order?.order_number,
    table: order?.table_name ?? order?.table_number ?? order?.table_id,
    items: (order?.items ?? []).map((item) => ({
      name: item.name,
      amount: item.quantity ?? 1,
      unitPrice: item.price,
      note: item.notes ?? null
    })),
    note: order?.comment ?? null,
    totalPrice: order?.total
  };
}

async function sendToDotykacka(payload) {
  if (!DOTYKACKA_API_URL || !DOTYKACKA_API_KEY) {
    console.error("[Dotykacka] Missing DOTYKACKA_API_URL or DOTYKACKA_API_KEY");
    return { ok: false, error: "Dotykacka not configured" };
  }

  const data = convertToDotykackaFormat(payload);
  const url = `${DOTYKACKA_API_URL.replace(/\/$/, "")}/orders`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DOTYKACKA_API_KEY}`,
        "X-API-Key": DOTYKACKA_API_KEY
      },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[Dotykacka] API error:", res.status, text);
      return { ok: false, error: text };
    }

    const result = await res.json();
    console.log("[Dotykacka] Order sent:", result);
    return { ok: true, data: result };
  } catch (err) {
    console.error("[Dotykacka] Request failed:", err.message);
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

    console.log("[Dotykacka Adapter] Received order #" + (payload?.order?.order_number ?? "?"));
    const result = await sendToDotykacka(payload);

    res.writeHead(result.ok ? 200 : 502);
    res.end(JSON.stringify(result.ok ? { received: true } : { error: result.error }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Dotykacka adapter listening on http://0.0.0.0:${PORT}`);
  if (!DOTYKACKA_API_KEY) console.warn("  WARNING: DOTYKACKA_API_KEY not set");
  console.log("  Webhook URL for Settings:", `http://YOUR_IP:${PORT}/order`);
});
