# POS Adapters – How to Create and Use

Two ways to send orders to your POS or kitchen:

| Option | When to use | Setup |
|--------|-------------|-------|
| **API (webhook)** | You have Toast, Dotykacka, or other POS API credentials | Configure webhook URL in Admin Settings. Run an adapter or use POS API. |
| **Plan B: Local printing** | No API; you have an Android tablet + Bluetooth printer | Use the mobile app → POS Bridge. No webhook. |

---

## Flow (API path)

```
Customer orders → Admin accepts → QRMenu sends webhook → Adapter receives → Adapter converts → POS gets order
```

### Payment flow (when customer pays online)

When a customer pays for an order (Apple Pay, Google Pay, Blik, or card) on the Order Status screen:

```
Customer taps Pay → Stripe Checkout → Payment succeeds → Webhook updates order → QRMenu sends order_paid → Adapter checks out order in POS + prints bill
```

1. Your app sends a **standard JSON payload** to the webhook URL.
2. The **adapter** is a small program that receives that payload.
3. The adapter **converts** it to the format your POS expects.
4. The adapter **sends** it to the POS API (or printer).

---

## Standard webhook payload (what QRMenu sends)

Every adapter receives the same structure:

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
    "created_at": "...",
    "accepted_at": "..."
  },
  "restaurant": {
    "id": "uuid",
    "name": "My Restaurant"
  }
}
```

### order_paid event (when customer pays)

Same structure, but `event: "order_paid"` and the order includes `amount_paid`, `print_bill: true`. Use this to:

- Close/checkout the order in the POS
- Print the bill/receipt

```json
{
  "event": "order_paid",
  "timestamp": "2025-02-04T12:34:56.789Z",
  "order": {
    "id": "uuid",
    "order_number": 123,
    "table_number": 5,
    "table_name": "Window 1",
    "items": [...],
    "total": 25.98,
    "amount_paid": 25.98,
    "print_bill": true,
    "created_at": "...",
    "accepted_at": "..."
  },
  "restaurant": { "id": "uuid", "name": "My Restaurant" }
}
```

---

## How to use an adapter

### 1. Pick your POS type

In Admin → **Settings** → **POS integration**:

- Select **Toast**, **Dotykacka**, **Gastro POS**, or **Custom webhook**.

### 2. Configure the adapter

Each adapter has its **own config** (not in the admin app). You configure it when you run the adapter:

| Adapter   | Config location      | What to set                                           |
|----------|----------------------|-------------------------------------------------------|
| Toast    | `.env` or env vars   | `TOAST_API_KEY`, `TOAST_APPLICATION_KEY`              |
| Dotykacka| `.env` or env vars   | `DOTYKACKA_API_URL`, `DOTYKACKA_API_KEY`              |
| Generic  | None                 | Just runs, prints to console                          |

### 3. Run the adapter

```bash
# Generic (prints to console)
cd scripts/pos-bridge
node server.js

# Toast
cd scripts/adapters/toast
TOAST_API_KEY=xxx TOAST_APPLICATION_KEY=xxx node server.js

# Dotykacka
cd scripts/adapters/dotykacka
DOTYKACKA_API_KEY=xxx node server.js
```

### 4. Expose it (for local testing)

If the adapter runs on your PC, use ngrok so QRMenu can reach it:

```bash
ngrok http 3000
```

You get a URL like `https://abc123.ngrok-free.app`.

### 5. Save the URL in Admin

In Admin → **Settings** → **POS integration**:

- Enable POS integration: **ON**
- POS type: your POS (e.g. Toast)
- Adapter / Webhook URL: `https://abc123.ngrok-free.app/order`
- Save

---

## How to create a new adapter

### 1. Copy an existing one

Use `scripts/pos-bridge/server.js` or `scripts/adapters/toast/server.js` as a starting point.

### 2. What the adapter must do

1. Listen for HTTP POST on `/` or `/order`
2. Parse the JSON body (the standard payload above)
3. Convert it to your POS’s format
5. Send to POS API (or printer) and return HTTP 200 on success

### 3. Config

- Put POS-specific credentials in env vars (e.g. `MY_POS_API_KEY`)
- Document them in a `README.md` in the adapter folder

### 4. Example structure

```
scripts/adapters/
├── toast/
│   ├── server.js
│   └── README.md
├── dotykacka/
│   ├── server.js
│   └── README.md
└── my-pos/
    ├── server.js      ← your new adapter
    └── README.md
```

---

## Summary

| Step       | Where        | What                                      |
|-----------|--------------|-------------------------------------------|
| 1. Config | In the adapter (env vars, `.env`) | API keys, URLs for the POS |
| 2. Run    | Terminal     | `node server.js`                          |
| 3. Expose | ngrok (or deploy) | Get a public URL                    |
| 4. Connect| Admin Settings | Paste the adapter URL in POS settings |

Your app always sends the same payload. Each adapter does the translation for its POS.
