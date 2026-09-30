# Guest checkout — courses & digital products

**Base:** `/api/marketplace`

Buyers can pay **without a student account** (email + name + Flutterwave). They receive a **magic link** by email. When they **register or log in** with the same email, purchases attach to their library automatically.

Logged-in students may also use guest checkout (`optionalAuthorize`); entitlements apply immediately when payment completes.

---

## Product types

| `product_type`       | Meaning              |
|----------------------|----------------------|
| `course`             | Marketplace course   |
| `digital_download`   | Digital download     |

Use the numeric product id from browse/detail APIs (`course.id` or digital product id).

---

## Create checkout

**POST** `/guest-checkout`

**Headers (optional):**

- `Authorization: Bearer <student JWT>` — links order to student; entitlement on pay if logged in
- `Idempotency-Key: <uuid>` — safe retries for the same checkout attempt

**Body**

```json
{
  "product_type": "course",
  "product_id": 42,
  "buyer_email": "ada@example.com",
  "buyer_name": "Ada Lovelace",
  "buyer_phone": "+2348012345678"
}
```

**Paid response (201)**

```json
{
  "success": true,
  "message": "Order created",
  "data": {
    "order": {
      "id": 7,
      "status": "pending",
      "product_type": "course",
      "product_id": 42,
      "product_title": "Intro to Design",
      "total_amount": "15000.00",
      "currency": "NGN",
      "buyer_email": "ada@example.com",
      "access_token": null,
      "entitlement_created": false,
      "reservation_expires_at": "2026-09-25T14:00:00.000Z"
    },
    "payment": {
      "provider": "flutterwave",
      "tx_ref": "GST-ORDER-7-1727270400000",
      "amount": "15000.00",
      "currency": "NGN",
      "public_key": "<flutterwave public key>",
      "meta": {
        "order_id": 7,
        "product_type": "course",
        "product_id": 42,
        "type": "marketplace_guest",
        "buyer_email": "ada@example.com"
      }
    }
  }
}
```

Open Flutterwave with `payment` (same pattern as event tickets). Pending orders expire after **15 minutes** (`reservation_expires_at`).

**Free product (200)** — no Flutterwave; `access_token` is set and `access_url` is relative:

```json
{
  "success": true,
  "message": "Purchase confirmed",
  "data": {
    "order": { "status": "paid", "access_token": "…" },
    "access_url": "/access/purchase/<token>"
  }
}
```

**Errors (400):** already owned, invalid product, email already has access (paid + entitled).

---

## Confirm payment (client callback)

**POST** `/guest-orders/:orderId/confirm-payment`

```json
{
  "transaction_reference": "GST-ORDER-7-1727270400000",
  "flutterwave_transaction_id": "123456"
}
```

Either reference field is enough if verification succeeds.

**Response (200)**

```json
{
  "success": true,
  "message": "Payment confirmed",
  "data": {
    "order": {
      "status": "paid",
      "access_token": "…",
      "entitlement_created": false
    },
    "access_url": "/access/purchase/<token>"
  }
}
```

Webhook (`meta.type === "marketplace_guest"` or `GST-ORDER-*` tx_ref) also fulfills if the client never calls confirm.

---

## Magic link page (public)

**GET** `/guest-orders/access/:accessToken`

No auth. Use token from email or post-checkout `access_url`.

**Paid course example**

```json
{
  "success": true,
  "data": {
    "status": "paid",
    "product_type": "course",
    "product_title": "Intro to Design",
    "buyer_email": "ada@example.com",
    "entitlement_created": false,
    "course": {
      "id": 42,
      "title": "Intro to Design",
      "slug": "intro-to-design",
      "needs_account": true,
      "start_url": "https://app…/login?email=ada%40example.com"
    }
  }
}
```

When `entitlement_created` is true (logged-in buyer or after claim), `needs_account` is false and `start_url` points to the course.

**Paid digital product**

- `can_download`: true when downloads enabled  
- **GET** `/guest-orders/access/:accessToken/download-url` → `{ download_url, expires_in }` (7 days)

**Resend email:** **POST** `/guest-orders/access/:accessToken/resend-email`

---

## Account claim

On **POST** `/api/auth/register/student` or **POST** `/api/auth/student/login**, the backend claims all **paid** guest orders for that email where `entitlement_created` was false.

Response may include:

```json
"guest_purchases_claimed": 2
```

Refresh **My courses** / **My downloads** after login.

---

## Frontend routes (suggested)

| Route | Purpose |
|-------|---------|
| `/checkout/guest?type=course&id=42` | Collect buyer fields → create order → Flutterwave |
| `/access/purchase/:accessToken` | Magic link landing; call GET access API |
| `/login?email=` | Pre-fill email when course needs account |

Prefix paths with your app base; API `access_url` is relative to the **learner app**, not the API host.

---

## Logged-in purchase (unchanged)

Students with a wallet/session can still use:

- **POST** `/courses/purchase` (JWT)
- **POST** `/digital-downloads/purchase` (JWT)

Guest checkout is for **anonymous** or **email-first** flows on public product pages.

---

## Production migration

```bash
node scripts/migrate-marketplace-guest-orders.js
```
