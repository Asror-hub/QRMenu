# POS Integration

When a customer submits an order via QR code and you accept it in the admin app, QRMenu can automatically send the order to your POS system or kitchen printer.

## Flow

1. Customer places order → stored in Supabase
2. Admin sees new order in **Orders** page
3. Admin clicks **Accept**
4. Order status → `accepted`
5. If POS webhook is enabled → order is **POSTed** to your configured webhook URL
6. Your POS/bridge receives the order and prints tickets or imports into the POS

## Setup

1. **Settings** → **POS integration**
2. Enable **POS webhook**
3. Enter your **Webhook URL**
4. Save

## Webhook URL Examples

| Scenario | URL |
|----------|-----|
| Local bridge on same network | `http://192.168.1.100:3000/order` |
| Cloud-hosted bridge | `https://your-bridge.example.com/webhook` |
| Ngrok tunnel (for testing) | `https://abc123.ngrok.io/order` |

## Webhook Payload

```json
{
  "event": "order_accepted",
  "timestamp": "2025-02-04T12:34:56.789Z",
  "order": {
    "id": "uuid",
    "order_number": 123,
    "table_id": "uuid",
    "table_number": 5,
    "table_name": "Window 1",
    "items": [
      { "name": "Burger", "price": 12.99, "quantity": 2, "notes": null }
    ],
    "comment": "No onions",
    "total": 25.98,
    "created_at": "2025-02-04T12:34:00Z",
    "accepted_at": "2025-02-04T12:34:56Z"
  },
  "restaurant": {
    "id": "uuid",
    "name": "My Restaurant"
  }
}
```

## Local POS Bridge

A minimal Node.js server is included at `scripts/pos-bridge/`:

```bash
cd scripts/pos-bridge
node server.js
```

It prints a kitchen-style ticket to the console. Extend it to:

- Send to an ESC/POS thermal printer
- Forward to Square, Toast, Clover, or other POS APIs
- Write to a file for another process

See `scripts/pos-bridge/README.md` for details.

## Firewall

If your webhook URL points to a machine on your local network (e.g. `http://192.168.1.100:3000/order`), ensure:

- The Edge Function runs in the cloud and can reach **public** URLs
- For **local** URLs, the QRMenu Edge Function cannot reach them from Supabase’s servers

**Workaround for local POS**: Run a tunnel (e.g. [ngrok](https://ngrok.com)) on the machine with your POS bridge so it gets a public URL, then use that URL in Settings.

## Security

- The webhook is invoked only when an authenticated admin accepts an order
- The webhook URL is stored per restaurant and only the restaurant owner can change it
- Consider using HTTPS and authentication (e.g. API key in a custom header) if your bridge is exposed to the internet
