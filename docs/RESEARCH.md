# Advance Pay – Payment Gateway Technical Research Document

This document provides architectural, cryptographic, and operational research on payment gateway integration for the Advance Pay custom boutique order management system, referencing official documentation.

---

## 1. Official Documentation Sources

- **Razorpay Payments Overview**: [https://razorpay.com/docs/payments/](https://razorpay.com/docs/payments/)
- **Razorpay Payment Links API**: [https://razorpay.com/docs/payments/payment-links/](https://razorpay.com/docs/payments/payment-links/)
- **Razorpay Standard Webhooks**: [https://razorpay.com/docs/webhooks/](https://razorpay.com/docs/webhooks/)
- **Razorpay Node.js Server SDK**: [https://razorpay.com/docs/payments/server-integration/nodejs/](https://razorpay.com/docs/payments/server-integration/nodejs/)

---

## 2. Payment Order Lifecycle

### Step 1: Server-Side Gateway Order Creation
- **Endpoint**: `razorpay.orders.create({ amount, currency, receipt, notes })`
- **Unit**: Amounts must be passed in smallest currency unit (i.e. **paise** for INR; ₹100 = 10000 paise).
- **Receipt & Notes**: Receipt links the unique boutique order ID and timestamp. `notes` store internal metadata (`orderId`, `paymentType`).
- **Storage**: The returned `razorpayOrderId` (`order_...`) must be persisted immediately in the database with status `PENDING`.

### Step 2: Client-Side Checkout Modal
- Loaded securely via `https://checkout.razorpay.com/v1/checkout.js`.
- Configured with `key` (public Test Key ID), `amount`, `currency`, `order_id`, and boutique details.
- Runs in an isolated iframe, ensuring customer card and UPI credentials never touch the boutique server.

### Step 3: Authoritative Payment Verification
When checkout finishes successfully, Razorpay returns:
1. `razorpay_order_id`
2. `razorpay_payment_id`
3. `razorpay_signature`

**Cryptographic Signature Calculation**:
```text
generated_signature = HMAC-SHA256(order_id + "|" + payment_id, secret)
```
- Must use `crypto.timingSafeEqual` to avoid timing side-channel attacks.
- Frontend success is treated as untrusted until the server confirms the signature and captures authoritative payment state.

---

## 3. Webhook Integration & Edge Cases

### Webhook Signature Verification
- Headers: `X-Razorpay-Signature`, `X-Razorpay-Event-Id`.
- Computed: `HMAC-SHA256(raw_body_string, webhook_secret)`.
- **CRITICAL**: The raw HTTP request body buffer must not be parsed or modified before hashing.

### Idempotency & Concurrency
1. **Duplicate Webhooks**:
   - Razorpay retries webhook delivery if the response is not HTTP 2xx or times out.
   - Database stores processed events in `WebhookEvent(eventId)` with a `@unique` constraint. If a duplicate event arrives, Prisma returns code `P2002` and the server acknowledges HTTP 200 without double-updating the order.
2. **Race Condition between Frontend & Webhook**:
   - Both the client `/payments/verify` call and the gateway `payment.captured` webhook attempt to update the balance.
   - Atomic update: `Order.updateMany({ where: { id: orderId, balance: { gte: amount } }, data: { balance: { decrement: amount } } })`.
   - Payment record update: `Payment.updateMany({ where: { id: paymentId, status: "PENDING", razorpayPaymentId: null }, data: { status: "COMPLETED", razorpayPaymentId } })`.
   - If either has already processed the payment, `count === 0` and the subsequent operation safely no-ops.

### Reconciliation Mechanism
If webhooks are missed (e.g. network partition, server downtime) or the customer closes the browser prematurely:
- Server provides `POST /orders/:id/reconcile`.
- Authoritatively queries Razorpay API: `razorpay.orders.fetchPayments(razorpayOrderId)`.
- If a captured transaction exists, atomically marks local payment `COMPLETED` and decrements balance.
- Unverified payments remain `PENDING` and never alter balances.

---

## 4. Test Mode vs. Production Configuration

| Environment Variable | Description | Test Mode Example |
|---|---|---|
| `RAZORPAY_KEY_ID` | Public Key ID from Razorpay Dashboard | `rzp_test_...` |
| `RAZORPAY_KEY_SECRET` | Secret Key used for order creation & signatures | `w8q...` |
| `RAZORPAY_WEBHOOK_SECRET` | Secret configured in Razorpay Dashboard Webhook settings | `whsec_...` |
| `DEMO_PAYMENTS_ENABLED` | Simulation switch for testing without live keys | `true` |

