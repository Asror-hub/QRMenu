# QRMenu

**Restaurant QR Ordering & POS Platform**

A production-oriented SaaS platform for restaurants: guests order by scanning a table QR code (or visiting the restaurant's website), staff manage everything from a web dashboard or mobile app, and orders flow straight through to the kitchen or POS.

Live demo: https://qrmenu.asrorkhanodilov.workers.dev

---

## Overview

QRMenu replaces printed menus and manual order-taking with a QR-based ordering flow: guests scan a table code, browse a live multilingual menu, order, and track status in real time — no app install required. Restaurant staff manage orders, menu, tables, and reservations from a web admin panel or a dedicated mobile app, with accepted orders routed to the kitchen via POS webhook, a local print bridge, or an in-app tablet printer.

The platform is multi-tenant: a super-admin "platform" app provisions restaurants, assigns subscription plans, and tracks payments.

---

## Screenshots

### Customer (Guest)

<table>
  <tr>
    <td align="center">
      <strong>Guest menu — QR ordering</strong><br/>
      <img src="screenshots/customer-menu-screen.jpg" width="400" alt="Guest menu — QR ordering"/>
    </td>
    <td align="center">
      <strong>Customer cart</strong><br/>
      <img src="screenshots/customer-cart-screen.jpg" width="400" alt="Customer cart"/>
    </td>
  </tr>
  <tr>
    <td align="center">
      <strong>Live order updates</strong><br/>
      <img src="screenshots/customer-live-order-updates.jpg" width="400" alt="Live order updates"/>
    </td>
    <td></td>
  </tr>
</table>

<details>
<summary>Show more Customer screenshots</summary>

<table>
  <tr>
    <td align="center">
      <strong>Item details</strong><br/>
      <img src="screenshots/customer-item-details.jpg" width="400" alt="Item details"/>
    </td>
    <td></td>
  </tr>
</table>

</details>

### Admin — Desktop

<table>
  <tr>
    <td align="center">
      <strong>Desktop orders</strong><br/>
      <img src="screenshots/desktop-orders-screen.png" width="400" alt="Desktop orders"/>
    </td>
    <td align="center">
      <strong>Desktop analytics</strong><br/>
      <img src="screenshots/desktop-analytics-screen.png" width="400" alt="Desktop analytics"/>
    </td>
  </tr>
  <tr>
    <td align="center">
      <strong>Desktop reservations</strong><br/>
      <img src="screenshots/desktop-reservations-screen.png" width="400" alt="Desktop reservations"/>
    </td>
    <td></td>
  </tr>
</table>

<details>
<summary>Show more Admin — Desktop screenshots</summary>

<table>
  <tr>
    <td align="center">
      <strong>Desktop feedbacks</strong><br/>
      <img src="screenshots/desktop-feedbacks-screen.png" width="400" alt="Desktop feedbacks"/>
    </td>
    <td></td>
  </tr>
</table>

</details>

### Admin — Mobile

<table>
  <tr>
    <td align="center">
      <strong>Mobile dashboard</strong><br/>
      <img src="screenshots/main-admin-mobile-screen.jpg" width="400" alt="Mobile dashboard"/>
    </td>
    <td align="center">
      <strong>Mobile orders</strong><br/>
      <img src="screenshots/mobile-orders-screen.jpg" width="400" alt="Mobile orders"/>
    </td>
  </tr>
  <tr>
    <td align="center">
      <strong>Order details</strong><br/>
      <img src="screenshots/mobile-order-details-screen.jpg" width="400" alt="Order details"/>
    </td>
    <td></td>
  </tr>
</table>

<details>
<summary>Show more Admin — Mobile screenshots</summary>

<table>
  <tr>
    <td align="center">
      <strong>Live tables map</strong><br/>
      <img src="screenshots/mobile-live-tables-view.jpg" width="400" alt="Live tables map"/>
    </td>
    <td align="center">
      <strong>Mobile analytics</strong><br/>
      <img src="screenshots/mobile-analytics-screen.jpg" width="400" alt="Mobile analytics"/>
    </td>
  </tr>
  <tr>
    <td align="center">
      <strong>Edit menu</strong><br/>
      <img src="screenshots/mobile-edit-menu-screen.jpg" width="400" alt="Edit menu"/>
    </td>
    <td align="center">
      <strong>Edit / view item</strong><br/>
      <img src="screenshots/mobile-edit-view-item-screen.jpg" width="400" alt="Edit / view item"/>
    </td>
  </tr>
  <tr>
    <td align="center">
      <strong>QR codes</strong><br/>
      <img src="screenshots/mobile-qr-codes-screen.jpg" width="400" alt="QR codes"/>
    </td>
    <td align="center">
      <strong>Mobile reservations</strong><br/>
      <img src="screenshots/mobile-reservations-screen.jpg" width="400" alt="Mobile reservations"/>
    </td>
  </tr>
  <tr>
    <td align="center">
      <strong>Mobile feedbacks</strong><br/>
      <img src="screenshots/mobile-feedbacks-screen.jpg" width="400" alt="Mobile feedbacks"/>
    </td>
    <td></td>
  </tr>
</table>

</details>

### Admin — Tablet

<table>
  <tr>
    <td align="center">
      <strong>Tablet main screen</strong><br/>
      <img src="screenshots/tablet-main-screen.png" width="400" alt="Tablet main screen"/>
    </td>
    <td align="center">
      <strong>Tablet orders</strong><br/>
      <img src="screenshots/tablet-orders-screen.png" width="400" alt="Tablet orders"/>
    </td>
  </tr>
  <tr>
    <td align="center">
      <strong>Submit order</strong><br/>
      <img src="screenshots/tablet-order-submitting-screen.png" width="400" alt="Submit order"/>
    </td>
    <td></td>
  </tr>
</table>

<details>
<summary>Show more Admin — Tablet screenshots</summary>

<table>
  <tr>
    <td align="center">
      <strong>Menu view / edit</strong><br/>
      <img src="screenshots/tablet-menu-view-edit-screen.png" width="400" alt="Menu view / edit"/>
    </td>
    <td></td>
  </tr>
</table>

</details>

---

## Architecture

Four Vite + React single-page apps, each deployed independently as a Cloudflare Worker, plus one Expo/React Native app for staff:

| App | Folder | What it is |
|---|---|---|
| Marketing / company site | `company/` | Public landing, pricing, contact, privacy |
| Restaurant admin | `admin/` | Owner/manager web dashboard |
| Guest menu | `customer/` | QR table menu + restaurant website |
| Platform (super admin) | `platform/` | Internal tool: plans, restaurants, payments |
| Staff mobile app | `mobile/` | Owner/staff app for iOS & Android |

Backend is entirely **Supabase** — no custom Node API. PostgreSQL with Row Level Security, Supabase Auth, Realtime subscriptions on orders/reservations/feedback, and Deno Edge Functions for payment and integration logic.

---

## Features

### Customer (no install — QR or website)
- Browse a live menu with photos, prices, categories, sold-out/hidden items
- Multilingual: English, Russian, Uzbek
- Add items, adjust quantity, leave an order comment, submit
- Real-time order status tracking (pending → accepted → ready → finished) with a prep timer
- Call a waiter
- Rate food and service after the meal
- Pay online via Stripe (Apple Pay, Google Pay, Blik, card) — where enabled
- **Website only (Grow/Ops plans):** delivery/pickup ordering, table reservations with confirmation

### Restaurant / manager (web + mobile)
- Live order inbox with accept/ready/finish actions, sound alerts, auto-accept
- Menu management: categories, items, photos, pricing, drag-to-reorder, hide/sold-out (updates guest menu live)
- Table management with QR code generation, printing, and sharing (mobile includes a floor map)
- Analytics: order counts, weekly revenue/order charts, best-sellers
- Feedback inbox (ratings and comments)
- Reservations (Grow+ plans): bookings, table assignment, status tracking
- Settings: profile, logo, hours, currency, Stripe, prep time, auto-accept, POS webhook
- Light/dark theme

### Mobile app (staff/owner — not a guest app)
- Live dashboard, order history, menu editor, tables + floor map, QR share/save
- Staff-submit order flow for waiters (Ops plan)
- Reservations, feedback, and POS Bridge (in-app kitchen ticket printing)
- EN/RU/UZ, haptic/sound alerts, light/dark theme

### POS integration
POS isn't a separate product — it's how accepted (and paid) orders leave QRMenu, via one of three paths:
1. **API webhook (Ops plan):** Edge Function POSTs `order_accepted` / `order_paid` events to a configured URL (starter adapters for Toast and Dotykacka)
2. **Local Node bridge** (`scripts/pos-bridge`): receives the webhook and prints via ESC/POS
3. **In-app POS Bridge (mobile, Ops):** listens on Realtime and prints kitchen tickets via `expo-print` (Bluetooth/network/USB, AirPrint on iOS)

---

## Tech Stack

**Web:** React 19, React Router, styled-components (marketing site uses plain CSS), Vite, TypeScript
**Mobile:** Expo 54, React Native 0.81, Expo Router, TypeScript, styled-components, Reanimated, gesture-handler
**Backend:** Supabase (PostgreSQL, Row Level Security, Auth, Realtime, Deno Edge Functions)
**Payments:** Stripe Checkout (Apple Pay, Google Pay, Blik, card)
**Media:** Cloudinary
**Infra:** Cloudflare Workers (web), EAS (mobile builds — `uz.qrmenu.admin`, iOS & Android)
**Other:** qrcode.react, expo-print, expo-av, expo-image-picker, expo-media-library, expo-secure-store

---

## Deployment

| App | URL |
|---|---|
| Marketing site | https://qrmenu.asrorkhanodilov.workers.dev |
| Admin (restaurant web app) | https://qrmenu-admin.asrorkhanodilov.workers.dev |
| Guest menu | https://qrmenu-customer.asrorkhanodilov.workers.dev |
| Platform (internal) | https://qrmenu-platform.asrorkhanodilov.workers.dev |

Guest table links follow the pattern:
`https://qrmenu-customer.asrorkhanodilov.workers.dev/r/{restaurantId}/t/{tableId}`

Pricing (contact-to-buy, not self-serve): Ordering 99k UZS, Grow 199k UZS, Ops 249k UZS per location/month.

---

## Roadmap

- [ ] Support chat (web + mobile)
- [ ] True item modifiers (size, extras)
- [ ] Staff roles (waiters vs. managers) — currently one owner login per restaurant
- [ ] Full Toast / Dotykacka POS adapter mapping
- [ ] Public App Store / Google Play listing
- [ ] Custom domain (e.g. `qrmenu.app`)
- [ ] Product demo video and marketing screenshots

---

## License

Proprietary — all rights reserved.
