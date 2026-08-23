# Windows Setup – QRMenu POS Bridge

Small app that runs on the restaurant's Windows PC (or POS terminal). Receives orders from QRMenu and prints to a thermal printer.

---

## What you need

- Windows PC (laptop, desktop, or POS terminal) at the restaurant
- Thermal printer connected via **USB** or **WiFi/network** (same network as the PC)
- Node.js installed ([nodejs.org](https://nodejs.org)) – LTS version

---

## Step 1: Install Node.js

1. Download from [nodejs.org](https://nodejs.org)
2. Run the installer
3. Restart the PC if asked

---

## Step 2: Copy the pos-bridge folder

Copy the entire `pos-bridge` folder to the PC, for example:
```
C:\QRMenu-Bridge\
```

---

## Step 3: Configure the printer (optional)

If you have a **network/WiFi printer**:

1. Find the printer's IP (on the printer display or your router)
2. In the `pos-bridge` folder, create a file named `.env` (or copy `config.example.env` and rename it)
3. Add:
   ```
   PRINTER_IP=192.168.1.100
   PRINTER_PORT=9100
   ```
   (Replace with your printer's IP)

If you leave `PRINTER_IP` empty, the app will only log orders to the console (no printing).

---

## Step 4: Run the bridge

**Option A – Double-click:**
- Double-click `run.bat`
- A window opens; keep it open

**Option B – Command line:**
```
cd C:\QRMenu-Bridge
npm install
node server.js
```

---

## Step 5: Expose with ngrok (for local network)

The bridge runs on the restaurant's PC. To receive webhooks from the internet:

1. Download [ngrok](https://ngrok.com/download)
2. Run: `ngrok http 3000`
3. Copy the HTTPS URL (e.g. `https://abc123.ngrok-free.app`)
4. In QRMenu Admin → Settings → POS integration:
   - Enable POS integration
   - Adapter URL: `https://abc123.ngrok-free.app/order`
   - Save

---

## Step 6: Run at startup (optional)

To start the bridge automatically when Windows boots:

1. Press `Win + R`, type `shell:startup`, Enter
2. Create a shortcut to `run.bat` in that folder
3. Or use Task Scheduler to run `node server.js` at startup

---

## Printer types

| Connection | Config | Notes |
|------------|--------|-------|
| **Network/WiFi** | `PRINTER_IP=192.168.x.x` | Use printer's IP; port 9100 is typical |
| **USB** | Not yet supported | Requires escpos-usb; on Windows may need Zadig driver |

---

## Troubleshooting

- **"node is not recognized"** – Install Node.js and restart the PC
- **No printing** – Check `PRINTER_IP` and that the printer is on the same network
- **Webhook not received** – Ensure ngrok is running and the URL in Admin is correct
