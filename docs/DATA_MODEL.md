# Advance Pay – Data Model & Architecture Specification

## 1. Schema Overview

The database uses PostgreSQL managed via Prisma ORM.

```
+-----------------------------------------------------------+
|                          Customer                         |
+-----------------------------------------------------------+
| id          Int (PK, autoincrement)                       |
| name        String                                        |
| phone       String (Normalized 10 digits) [Indexed]       |
| createdAt   DateTime (default: now())                     |
+-----------------------------------------------------------+
                             | 1
                             |
                             | N
+-----------------------------------------------------------+
|                            Order                          |
+-----------------------------------------------------------+
| id            Int (PK, autoincrement)                     |
| itemName      String                                      |
| totalAmount   Int (Total price in rupees)                 |
| advance       Int (Agreed advance requirement)            |
| balance       Int (Outstanding balance due)               |
| paymentStatus String (PENDING, PARTIALLY_PAID, PAID)      |
| customerId    Int (FK -> Customer.id) [Indexed]           |
| promisedDate  DateTime? (Delivery date)                   |
| publicToken   String (UUID, Unique)                       |
| createdAt     DateTime (default: now())                   |
+-----------------------------------------------------------+
           | 1                                 | 1
           |                                   |
           | N                                 | N
+----------------------+         +--------------------------+
|       Payment        |         |        OrderStage        |
+----------------------+         +--------------------------+
| id         Int (PK)  |         | id        Int (PK)       |
| orderId    Int (FK)  |         | orderId   Int (FK)       |
| amount     Int       |         | name      String         |
| status     String    |         | status    String         |
| paymentType String   |         | createdAt DateTime       |
| razorpayOrderId Str? |         +--------------------------+
| razorpayPaymentId Str|         Indexes:                   |
| createdAt  DateTime  |         - @@unique([orderId, name])|
+----------------------+         - @@index([orderId])       |
Indexes:                         +--------------------------+
- @@unique([razorpayOrderId])
- @@unique([razorpayPaymentId])
- @@index([orderId])

+-----------------------------------------------------------+
|                       WebhookEvent                        |
+-----------------------------------------------------------+
| id          Int (PK, autoincrement)                       |
| eventId     String (Unique event identifier from gateway) |
| eventType   String (e.g. payment.captured)                |
| payload     Json (Raw event payload)                      |
| processedAt DateTime (default: now())                     |
| createdAt   DateTime (default: now())                     |
+-----------------------------------------------------------+
```

---

## 2. Model Detail & Attributes

### `Customer`
- **Purpose**: Stores individual boutique clientele records.
- **Attributes**:
  - `id`: Auto-incrementing primary key.
  - `name`: Client full name (trimmed, non-empty).
  - `phone`: Normalized 10-digit Indian mobile number (e.g. `9876543210`).
  - `orders`: One-to-many relationship with `Order`.
  - `createdAt`: Timestamp.
- **Indexes**: `Customer_phone_idx` on `phone` for rapid lookups and duplicate checks.

### `Order`
- **Purpose**: Tracks custom garments and financial balances.
- **Attributes**:
  - `id`: Primary key.
  - `itemName`: Garment description (e.g. Bridal Blouse, Kanjeevaram Saree).
  - `totalAmount`: Total agreed price.
  - `advance`: Minimum advance required before work starts.
  - `balance`: Remaining balance to be settled. Defaults to `totalAmount` upon order placement.
  - `paymentStatus`: Enum string (`PENDING`, `PARTIALLY_PAID`, `PAID`).
  - `customerId`: Foreign key referencing `Customer.id`.
  - `promisedDate`: Delivery deadline (`@db.Date`).
  - `publicToken`: Secure unpredictable UUID token used for customer tracking links.
- **Indexes**: `Order_customerId_idx` on `customerId`, `@unique` on `publicToken`.

### `Payment`
- **Purpose**: Immutable ledger of all payment attempts and completed transactions.
- **Attributes**:
  - `id`: Primary key.
  - `orderId`: Foreign key to `Order.id`.
  - `amount`: Payment amount in rupees.
  - `status`: Transaction status (`PENDING`, `COMPLETED`, `FAILED`).
  - `paymentType`: Purpose (`ADVANCE` or `BALANCE`).
  - `razorpayOrderId`: Gateway order identifier.
  - `razorpayPaymentId`: Gateway capture identifier.
- **Indexes**: `@unique` on `razorpayOrderId` and `razorpayPaymentId`, B-tree index on `orderId`.

### `OrderStage`
- **Purpose**: Stage-by-stage craftsmanship progress.
- **Attributes**:
  - `id`: Primary key.
  - `orderId`: Foreign key to `Order.id`.
  - `name`: Stage title (e.g. Measurements, Cutting, Embroidery, Trial, Ready).
  - `status`: Progress status (`PENDING`, `IN_PROGRESS`, `COMPLETED`).
- **Indexes**: Compound `@unique([orderId, name])` preventing duplicate stage names per garment, plus `OrderStage_orderId_idx` on `orderId`.

### `WebhookEvent`
- **Purpose**: Idempotency ledger for incoming gateway webhook events.
- **Attributes**:
  - `id`: Primary key.
  - `eventId`: Unique event ID from Razorpay header/payload.
  - `eventType`: Event name (e.g. `payment.captured`).
  - `payload`: Full JSON payload for auditing.
- **Indexes**: `@unique` on `eventId` guaranteeing single execution.

