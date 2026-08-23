# Dotykacka Adapter

Forwards QRMenu orders to Dotykacka POS when you accept them.

## 1. Configure

Create a `.env` file:

```
DOTYKACKA_API_URL=https://app.dotykacka.cz/api
DOTYKACKA_API_KEY=your_api_key
PORT=3002
```

Get your API key from Dotykacka admin / developer settings. Exact API structure may vary.

## 2. Run

```bash
cd scripts/adapters/dotykacka
node server.js
```

## 3. Expose (ngrok)

```bash
ngrok http 3002
```

## 4. Admin Settings

- POS type: **Dotykacka**
- Adapter URL: `https://your-ngrok-url.ngrok-free.app/order`
- Save

---

Check Dotykacka's API docs and adjust `convertToDotykackaFormat()` if the format differs.
