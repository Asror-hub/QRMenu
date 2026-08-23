# QRMenu Platform (super admin)

Separate web app for **you only**: grant restaurant packages, set subscription status, and log payments.

## Setup

1. Apply migration `supabase/migrations/038_platform_subscriptions.sql`
2. In Supabase → Authentication → Users → your user → **App metadata**:

```json
{ "is_platform_admin": true }
```

3. Copy env:

```bash
cp platform/.env.example platform/.env
```

Use the same `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as admin.

4. Install & run:

```bash
cd platform
npm install
npm run dev
```

Open **http://localhost:5175**

## What you can do

- List / search all restaurants
- Set plan: Ordering / Grow / Ops
- Set status: pending, trial, active, past due, canceled
- Set venue type, expiry, internal notes
- Record payments (Payme, Click, cash, bank transfer…)
- View payment history per restaurant and globally

## Security notes

- This is a **separate app** from owner `admin/`
- Only users with `app_metadata.is_platform_admin = true` can enter
- Restaurant owners cannot change their own plan/subscription fields (DB trigger)
- Payment rows are readable/writable only by platform admins (RLS)
