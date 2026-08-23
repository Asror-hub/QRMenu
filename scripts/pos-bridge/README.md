# POS Bridge (Local Webhook Receiver)

A small app that receives order webhooks from QRMenu and prints to a thermal printer. Designed to run on the restaurant's Windows PC or POS terminal.

**Features:**
- Receives webhooks when orders are accepted
- Prints kitchen tickets to network thermal printer (ESC/POS)
- Logs orders to console if no printer configured
- Windows-friendly: `run.bat` to start

See **WINDOWS_SETUP.md** for full setup on restaurant PCs.

## Quick start

```bash
cd scripts/pos-bridge
npm install
node server.js
```

Or on Windows: double-click `run.bat`

By default it listens on port 3000. Because Supabase Edge Functions run in the cloud, the webhook URL must be reachable from the internet:

**For local testing**: Use [ngrok](https://ngrok.com) to expose your local server:
```bash
ngrok http 3000
# Use the HTTPS URL in Settings, e.g. https://abc123.ngrok-free.app/order
```

**For production**: Deploy the bridge to a VPS or cloud service with a public URL.

Then in Admin:
1. Open **Settings** → **POS integration**
2. Enable **POS webhook**
3. Webhook URL: your public URL + `/order` (e.g. `https://abc123.ngrok-free.app/order`)
4. Save

When you accept an order in the admin app, the bridge receives a POST with JSON like:

```json
{
  "event": "order_accepted",
  "timestamp": "2025-02-04T...",
  "order": {
    "id": "...",
    "order_number": 123,
    "table_number": 5,
    "table_name": "Window 1",
    "items": [
      { "name": "Burger", "price": 12.99, "quantity": 2 }
    ],
    "comment": "No onions",
    "total": 25.98,
    "created_at": "...",
    "accepted_at": "..."
  },
  "restaurant": {
    "id": "...",
    "name": "My Restaurant"
  }
}
```

## Extending

Edit `server.js` and add your logic where the `TODO` comment is:

- **ESC/POS printer**: Use a library like `escpos` or `node-thermal-printer` to send raw commands to a USB/network thermal printer
- **POS API**: Use `fetch` or `axios` to POST to your POS provider's order API
- **File output**: Write the payload to a file that another process watches

## Firewall

Ensure port 3000 (or your chosen port) is allowed for inbound connections on your local network. On Windows, you may need to add a firewall rule similar to the one for the dev servers (see `LOCAL_NETWORK_SETUP.md`).
