# Advance Pay – Product Specification

## 1. Problem Statement
Designer boutiques specialize in high-value, bespoke garments (e.g. bridal blouses, lehengas, sherwanis) crafted across multiple production phases (Measurements, Cutting, Embroidery, Trial, Ready). 
Currently, tracking custom orders, collecting partial advance payments, managing delivery commitments, and reassuring anxious clients is manual and prone to lost records, duplicate customer entries, and payment discrepancies.

Advance Pay automates custom order tracking and payment collection with mobile-first tracking links, stage tracking, and payment gateway support.

---

## 2. Target Users
1. **Boutique Owner / Master Tailor (Admin)**:
   - Creates customer records and custom orders.
   - Sets total amounts, required advances, and promised delivery dates.
   - Updates garment preparation stages.
   - Generates and shares customer tracking/payment links.
   - Monitors outstanding balances and revenue.
2. **Boutique Customer (Client)**:
   - Receives a personalized, mobile-responsive tracking link.
   - Checks garment progress without needing an account or login.
   - Pays advance and balance online via secure gateway or offline.

---

## 3. Workflows

### A. Boutique Owner Workflow
1. Enters customer name and 10-digit Indian mobile number.
2. Creates order specifying item, total price (₹), advance required (₹), delivery date, and stages.
3. Automatically generates unpredictable UUID tracking token.
4. Copies customer tracking link to share via WhatsApp, SMS, or email.
5. As craftsmanship progresses, updates stage status from `PENDING` to `IN_PROGRESS` and `COMPLETED`.
6. Views payment history and outstanding balance.

### B. Customer Workflow
1. Opens tracking link (`/track/:token`) on phone or browser.
2. Sees garment details, delivery date, and current progress stage.
3. Taps **Pay Advance** or **Pay Balance** to launch Razorpay Checkout.
4. Completes payment; page verifies transaction and updates balance automatically.

---

## 4. Screens & User Interface

1. **Owner Dashboard**:
   - KPI metric summary: Total Orders, Total Customers, Total Revenue, Total Outstanding Balance.
   - Filter and search bar: Filter by payment status (`PENDING`, `PARTIALLY_PAID`, `PAID`) or search by client name/phone.
2. **Customer Creation Form**:
   - Customer name and 10-digit phone with input masking and duplicate alert.
3. **Order Creation Form**:
   - Customer selection dropdown, garment title, total price, advance amount, calendar delivery date picker.
4. **Order List & Details**:
   - Progress bar depicting percentage paid.
   - Stage status dropdowns (`PENDING`, `IN_PROGRESS`, `COMPLETED`).
   - One-click copy tracking link.
   - Manual payment recording and reconciliation trigger.
5. **Customer Public Tracking Screen**:
   - Personalized greeting, order overview, dynamic payment breakdown, visual progress checklist, and gateway checkout triggers.

---

## 5. Scope

### Included:
- Customer deduplication and strict 10-digit phone normalization.
- Order creation with automated 5-stage setup.
- Dual-mode payments: Official Razorpay Test Mode Checkout + Demo Simulation fallback.
- Authoritative backend HMAC-SHA256 signature verification.
- Idempotent raw-body Razorpay Webhooks.
- Stage updates synchronized between Owner and Customer tracking views.
- Automatic balance decrement inside database transactions.

### Excluded:
- Multi-tenant multi-store boutique SaaS onboarding.
- Inventory bolt and fabric stock management.
- Multi-currency non-INR payments.

---

## 6. Acceptance Criteria (Given / When / Then)

### Scenario 1: Customer Creation
- **Given**: Owner inputs valid name `"Anusha"` and 10-digit phone `"9876543210"`.
- **When**: Owner submits the form.
- **Then**: Customer record is saved and returned; duplicate submissions are prevented.

### Scenario 2: Strict Phone Validation
- **Given**: Owner inputs an invalid phone (e.g. `"+919876543210"` or `"1234567890"`).
- **When**: Owner attempts submission.
- **Then**: Submission is rejected inline with clear error message; no database record is created.

### Scenario 3: Order Creation
- **Given**: Owner selects customer, specifies `"Bridal Blouse"`, total ₹18,000, advance ₹6,000, and promised date.
- **When**: Order is submitted.
- **Then**: Order is created with balance = ₹18,000, 5 default production stages, and a unique tracking token.

### Scenario 4: Successful Advance Payment
- **Given**: An order has total ₹18,000, advance ₹6,000, balance ₹18,000.
- **When**: Customer completes ₹6,000 advance payment via gateway.
- **Then**: Backend verifies signature, sets order balance to ₹12,000, and marks payment status `PARTIALLY_PAID`.

### Scenario 5: Webhook Idempotency
- **Given**: Webhook event `evt_123` has already been processed and stored.
- **When**: The gateway delivers duplicate webhook with `evt_123`.
- **Then**: Server returns HTTP 200 and ignores event without deducting balance again.

### Scenario 6: Customer Progress Reflection
- **Given**: Owner updates stage `"Embroidery"` to `COMPLETED`.
- **When**: Customer views or refreshes the tracking page.
- **Then**: `"Embroidery"` reflects as completed immediately.

