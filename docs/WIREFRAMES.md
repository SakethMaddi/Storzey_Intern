# Advance Pay – UI/UX Wireframes & Component Design Specification

This document details the mobile-first layouts, component specifications, and user interactions across all screens of the Advance Pay boutique application.

---

## 1. Design System & Tokens
- **Primary Accent**: `#2563eb` (Royal Blue) / Hover `#1d4ed8`
- **Background**: `#f4f6fb` (Soft Canvas) / Cards: `#ffffff`
- **Text Primary**: `#1e293b` (Slate 900)
- **Text Secondary / Muted**: `#64748b` (Slate 500)
- **Border / Divider**: `#e2e8f0` (Slate 200)
- **Success Tone**: `#15803d` (Green 700) / Background `#f0fdf4`
- **Warning Tone**: `#b45309` (Amber 700) / Background `#fffbeb`
- **Error Tone**: `#dc2626` (Red 600) / Background `#fef2f2`
- **Typography**: System sans-serif stack (`Arial, Helvetica, sans-serif`) optimized for rendering across Android and iOS browsers.

---

## 2. Screen 1: Owner Dashboard & KPI Overview

```
+-------------------------------------------------------------+
|                      Advance Pay                            |
|             Designer Boutique Management                    |
+-------------------------------------------------------------+
| [ Total Orders: 12 ] [ Clients: 8 ] [ Outstanding: ₹42,000 ]|
+-------------------------------------------------------------+
|  Search orders... [🔍]          | Status: [ All Statuses ▾] |
+-------------------------------------------------------------+
|  + Create New Customer Form                                 |
|  [ Customer name                     ]                      |
|  [ Phone number (10 digits)          ]                      |
|  [ + Add Customer ]                                         |
+-------------------------------------------------------------+
|  + Create Custom Order Form                                 |
|  [ Select Customer ▾                 ]                      |
|  [ Item Name (e.g. Bridal Blouse)    ]                      |
|  [ Total Amount (₹)                  ]                      |
|  [ Required Advance (₹)              ]                      |
|  [ Promised Delivery Date (📅)       ]                      |
|  [ + Create Order ]                                         |
+-------------------------------------------------------------+
```

---

## 3. Screen 2: Order Details & Stage Management

```
+-------------------------------------------------------------+
| Anusha — Bridal Blouse                                      |
| Total: ₹18,000 | Advance: ₹6,000 | Balance: ₹12,000          |
| Progress: [========          ] 33% Paid                     |
| Tracking Link: [ https://.../track/6d505a95... ] [Copy 📋]  |
+-------------------------------------------------------------+
| Garment Production Stages:                                  |
| 1. Measurements ..................... [ COMPLETED ▾ ]       |
| 2. Cutting .......................... [ COMPLETED ▾ ]       |
| 3. Embroidery ....................... [ IN_PROGRESS ▾]      |
| 4. Trial ............................ [ PENDING ▾   ]       |
| 5. Ready ............................ [ PENDING ▾   ]       |
+-------------------------------------------------------------+
| Record Payment / Reconciliation:                            |
| Amount: [ ₹6,000  ] Type: [ Advance ▾ ] [ Submit Payment ]  |
| [ 🔄 Reconcile Pending Gateway Payments ]                   |
+-------------------------------------------------------------+
```

---

## 4. Screen 3: Customer Public Tracking & Checkout (Mobile-First)

```
+-------------------------------------------------------------+
|                       Order Tracking                        |
|                     Hello, Anusha!                          |
|         Here is the update on your custom order.            |
+-------------------------------------------------------------+
| Item: Bridal Blouse                                         |
| Delivery Date: 25 December 2026                             |
+-------------------------------------------------------------+
| Payment Breakdown:                                          |
| Total Price: ............................. ₹18,000          |
| Required Advance: ........................ ₹6,000           |
| Amount Paid: ............................. ₹6,000           |
| Remaining Balance: ....................... ₹12,000          |
| Payment Status: .......................... PARTIALLY_PAID   |
+-------------------------------------------------------------+
| [ Pay Remaining Balance ₹12,000 (Razorpay Checkout) ]       |
+-------------------------------------------------------------+
| Garment Craftsmanship Stages:                               |
| ✓ 1. Measurements ........................ Completed        |
| ✓ 2. Cutting ............................. Completed        |
| ⏳ 3. Embroidery .......................... In Progress     |
| ○ 4. Trial ............................... Pending          |
| ○ 5. Ready ............................... Pending          |
+-------------------------------------------------------------+
```

