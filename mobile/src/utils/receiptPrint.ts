import * as Print from "expo-print";
import type { Order, OrderItem } from "@/src/context/OrdersContext";
import { formatCurrency } from "@/src/utils/currency";

export function buildReceiptHtml(
  order: Order,
  restaurantName: string,
  currency: string
): string {
  const tableLabel =
    order.tables?.table_name && order.tables?.table_number
      ? `${order.tables.table_name} ${order.tables.table_number}`
      : order.tables?.table_number
        ? `Table ${order.tables.table_number}`
        : `Table ${order.table_id ?? "—"}`;
  const time = order.accepted_at
    ? new Date(order.accepted_at).toLocaleString()
    : order.created_at
      ? new Date(order.created_at).toLocaleString()
      : "—";

  const itemsHtml = (order.items ?? [])
    .map((item: OrderItem) => {
      const qty = item.quantity ?? 1;
      const name = item.name ?? "—";
      const price = Number(item.price ?? 0) * qty;
      return `<tr><td>${qty}x ${name}</td><td style="text-align:right">${formatCurrency(price, currency)}</td></tr>`;
    })
    .join("");

  const total = (order.items ?? []).reduce(
    (sum: number, i: OrderItem) =>
      sum + Number(i.price ?? 0) * Number(i.quantity ?? 0),
    0
  );
  const commentBlock = order.comment
    ? `<p><strong>Comment:</strong> ${order.comment}</p>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: monospace; font-size: 14px; padding: 12px; margin: 0; max-width: 300px; }
    h2 { margin: 0 0 8px 0; font-size: 16px; text-align: center; }
    p { margin: 4px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 2px 0; }
    .total { font-weight: bold; margin-top: 8px; border-top: 1px dashed #000; padding-top: 8px; }
    .center { text-align: center; }
  </style>
</head>
<body>
  <h2>${restaurantName}</h2>
  <p class="center"><strong>Order #${order.order_number ?? "—"}</strong></p>
  <p class="center">${tableLabel}</p>
  <p class="center" style="font-size:12px">${time}</p>
  <hr>
  <table>
    ${itemsHtml}
  </table>
  ${commentBlock}
  <p class="total">TOTAL: ${formatCurrency(total, currency)}</p>
  <hr>
  <p class="center" style="font-size:11px">QRMenu</p>
</body>
</html>
`;
}

export async function printOrderTicket(
  order: Order,
  restaurantName: string,
  currency: string
) {
  const html = buildReceiptHtml(order, restaurantName, currency);
  await Print.printAsync({ html });
}
