# Local network setup (phone on same Wi‑Fi)

So your phone can open the QR code links when the app runs locally, do the following.

## 1. Allow the dev server ports in Windows Firewall (Private only)

**Option A – PowerShell (recommended, run as Administrator)**

1. Open **PowerShell as Administrator** (right‑click Start → Windows PowerShell (Admin) or Terminal (Admin)).
2. Go to the project and run the script:

   ```powershell
   cd "c:\Users\asror\QRMenu"
   Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force
   .\scripts\allow-local-network-firewall.ps1
   ```

3. If you get “cannot be loaded because running scripts is disabled”, run the `Set-ExecutionPolicy` line above first, then run the script again.

**Option B – Manual firewall rules**

1. Press **Win**, type **Windows Defender Firewall**, open **Windows Defender Firewall**.
2. Click **Advanced settings**.
3. In the left pane, click **Inbound Rules**.
4. Click **New Rule…**.
5. Choose **Port** → Next.
6. **TCP**, **Specific local ports**: `5173, 5174` → Next.
7. **Allow the connection** → Next.
8. Leave **Domain** and **Private** checked, **Public** unchecked → Next.
9. Name: e.g. **QRMenu Dev (5173, 5174)** → Finish.

Repeat for **Outbound Rules** with the same ports if you want (often not required for phone → PC).

## 2. Set your Wi‑Fi to “Private” in Windows

Firewall “Private” rules only apply when Windows sees the network as Private.

1. **Settings** → **Network & Internet** → **Wi‑Fi**.
2. Click your connected Wi‑Fi name.
3. Under **Network profile type**, choose **Private**.

## 3. Run both apps and use the Tables page

- Start the **customer** app (port 5174) and the **admin** app (port 5173).
- In the admin app, open **Tables**. The QR codes should show URLs like `http://192.168.x.x:5174/...`.
- Connect your phone to the **same Wi‑Fi** and scan a QR code.

If it still fails, check:

- Your PC’s IP: in PowerShell run `ipconfig` and look at the **IPv4 Address** under your Wi‑Fi adapter (e.g. `192.168.1.5`). On your phone’s browser, try opening `http://192.168.1.5:5174` — you should see the customer app.
- Antivirus or other security software that might block incoming connections.
