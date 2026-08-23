# Online Payments (Stripe)

Customers can pay for orders on the **Order Status** screen using Apple Pay, Google Pay, Blik (Poland), or card.

## Flow

1. Customer places an order and goes to Order Status
2. When the order is **accepted** or **ready**, a **Pay** button appears on each order card
3. Customer taps Pay → redirects to Stripe Checkout (Apple Pay, Google Pay, Blik, card)
4. After payment succeeds → order is marked **paid**, status set to **finish**
5. POS webhook receives `order_paid` event → adapter checkouts order in POS and prints bill

## Setup

### 1. Stripe account

1. Create a [Stripe](https://stripe.com) account
2. Get your **Secret key** and **Publishable key** from Dashboard → Developers → API keys
3. Create a **Webhook** endpoint:
   - URL: `https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook`
   - Events: `checkout.session.completed`
   - Copy the **Signing secret** (wh_sec_...)

### 2. Supabase secrets

In Supabase Dashboard → Edge Functions → Secrets, add:

- `STRIPE_SECRET_KEY` – your Stripe secret key (sk_...)
- `STRIPE_WEBHOOK_SIGNING_SECRET` – webhook signing secret (wh_sec_...)

### 3. Enable payments per restaurant

In **Admin** or **Mobile** Settings → **Menu defaults**:

- Turn **Online payments (Stripe)** ON
- Set **Currency** (USD, EUR, PLN for Blik, etc.)
- Save

### 4. POS integration

When a customer pays, the same POS webhook receives `event: "order_paid"` instead of `order_accepted`. Your adapter should:

- Close/checkout the order in the POS
- Print the bill

See [ADAPTERS.md](./ADAPTERS.md) for the `order_paid` payload format.

## Payment methods

| Method   | When shown                         |
|----------|------------------------------------|
| Card     | Always                             |
| Apple Pay| Safari, iOS                        |
| Google Pay | Chrome, Android                 |
| Blik     | When currency is PLN (Poland)      |
