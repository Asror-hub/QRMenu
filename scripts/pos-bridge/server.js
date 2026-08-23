/**
 * QRMenu POS Bridge - receives order webhooks and prints to thermal printer.
 *
 * Run: npm install && node server.js
 * Or: run.bat (Windows)
 *
 * Config (env or .env): PRINTER_IP, PRINTER_PORT (default 9100)
 * If PRINTER_IP is not set, orders are only logged to console.
 *
 * In Admin Settings → POS integration: set webhook URL (use ngrok for local).
 */

try {
  require("dotenv").config();
} catch {
  // dotenv optional
}

const http = require("http");

const PORT = Number(process.env.PORT) || 3000;
const PRINTER_IP = process.env.PRINTER_IP || "";
const PRINTER_PORT = Number(process.env.PRINTER_PORT) || 9100;

let escpos = null;
try {
  escpos = require("escpos");
  escpos.Network = require("escpos-network");
} catch {
  console.log("(escpos not installed - run npm install for printing)");
}

function formatKitchenTicket(payload, isBill = false) {
  const { order, restaurant } = payload;
  const lines = [
    "",
    "====================",
    `  ${restaurant?.name ?? "Order"}`,
    ...(isBill ? ["  *** BILL - PAID ***"] : []),
    "====================",
    `Order #${order?.order_number ?? "—"}  Table ${order?.table_name ?? order?.table_number ?? order?.table_id ?? "—"}`,
    `Time: ${order?.accepted_at ? new Date(order.accepted_at).toLocaleString() : "—"}`,
    "--------------------",
    ""
  ];

  for (const item of order?.items ?? []) {
    const qty = item.quantity ?? 1;
    const name = item.name ?? "—";
    const price = Number(item.price ?? 0) * qty;
    lines.push(`  ${qty}x ${name}  $${price.toFixed(2)}`);
    if (item.notes) lines.push(`     Note: ${item.notes}`);
  }

  if (order?.comment) {
    lines.push("");
    lines.push(`  *** Comment: ${order.comment} ***`);
  }

  lines.push("");
  lines.push(`  TOTAL: $${(order?.total ?? order?.amount_paid ?? 0).toFixed(2)}`);
  if (isBill) lines.push("  *** PAID ***");
  lines.push("====================");
  lines.push("");

  return lines.join("\n");
}

function printToNetworkPrinter(payload, isBill = false) {
  if (!escpos || !PRINTER_IP) return Promise.resolve(false);

  return new Promise((resolve) => {
    try {
      const device = new escpos.Network(PRINTER_IP, PRINTER_PORT);
      const printer = new escpos.Printer(device, { encoding: "UTF-8" });

      const text = formatKitchenTicket(payload, isBill);

      device.open((err) => {
        if (err) {
          console.error("[Printer] Error:", err.message);
          resolve(false);
          return;
        }
        printer
          .font("a")
          .align("ct")
          .size(1, 1)
          .text(text)
          .cut()
          .close(() => {
            console.log("[Printer] Ticket printed.");
            resolve(true);
          });
      });
    } catch (err) {
      console.error("[Printer] Error:", err.message);
      resolve(false);
    }
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "POST" || (req.url !== "/" && req.url !== "/order")) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  let body = "";
  for await (const chunk of req) {
    body += chunk;
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    res.writeHead(400);
    res.end(JSON.stringify({ error: "Invalid JSON" }));
    return;
  }

  const isBill = payload?.event === "order_paid";
  console.log(formatKitchenTicket(payload, isBill));

  if (PRINTER_IP && escpos && (payload?.event === "order_accepted" || payload?.event === "order_paid")) {
    await printToNetworkPrinter(payload, isBill);
  }

  res.writeHead(200);
  res.end(JSON.stringify({ received: true }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`QRMenu POS Bridge listening on http://0.0.0.0:${PORT}`);
  console.log(`  Webhook URL for Admin: http://YOUR_IP:${PORT}/order`);
  if (PRINTER_IP) {
    console.log(`  Printer: ${PRINTER_IP}:${PRINTER_PORT}`);
  } else {
    console.log(`  Printer: not configured (set PRINTER_IP for printing)`);
  }
});
