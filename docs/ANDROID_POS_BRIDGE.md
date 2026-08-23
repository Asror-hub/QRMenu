# Android POS Bridge

The mobile app includes a **POS Bridge** feature that automatically prints accepted orders to the device's printer. Use it on the restaurant's Android tablet connected to a thermal printer.

---

## Setup

1. **Install the QRMenu mobile app** on the Android tablet (same app as admin).
2. **Log in** with the restaurant owner account.
3. **Pair the printer** in Android Settings → Bluetooth (for Bluetooth printers) or ensure the tablet can reach a network printer.
4. Open **POS Bridge** from the home menu.
5. Turn **Enabled** ON.

---

## How it works

- When an order is **accepted** (in the admin app or mobile Orders screen), the POS Bridge receives it via Supabase Realtime.
- It automatically opens the system print dialog and sends a kitchen ticket.
- Select your thermal printer when prompted (or set it as default).

---

## Printer connection

| Printer type   | Setup                                                                 |
|----------------|-----------------------------------------------------------------------|
| **Bluetooth**  | Pair in Android Settings → Bluetooth. Choose it when the print dialog appears. |
| **Network**    | Configure in Android print settings. May require a print service app. |
| **USB**        | OTG cable + printer. Supported if the tablet and printer allow it.    |

---

## Notes

- Keep the **POS Bridge screen open** (or the app in foreground) for automatic printing.
- The app uses **expo-print** (system print). It works with any printer Android supports.
- For best results with thermal receipt printers, use a printer that supports standard Android printing.
