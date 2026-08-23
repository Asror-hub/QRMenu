# Toast Adapter

Forwards QRMenu orders to Toast POS when you accept them.

## 1. Configure (Toast credentials)

Create a `.env` file in this folder:

```
TOAST_API_KEY=your_toast_api_key
TOAST_APPLICATION_KEY=your_application_key
TOAST_RESTAURANT_GUID=your_restaurant_guid
PORT=3001
```

Get these from [Toast Developer Portal](https://doc.toasttab.com/). You may need a Toast partner account.

## 2. Run

```bash
cd scripts/adapters/toast
npm install   # if using dotenv
node server.js
```

Or with env vars inline:

```bash
TOAST_API_KEY=xxx TOAST_APPLICATION_KEY=xxx node server.js
```

## 3. Expose (ngrok for local)

```bash
ngrok http 3001
```

Use the HTTPS URL + `/order` in Admin Settings → POS integration.

## 4. Admin Settings

- POS type: **Toast**
- Adapter URL: `https://your-ngrok-url.ngrok-free.app/order`
- Save

---

**Note:** Toast's API format may change. Check [Toast API docs](https://doc.toasttab.com/) and update `convertToToastFormat()` in `server.js` if needed.
