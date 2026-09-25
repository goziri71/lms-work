# Event ticket coupon codes — frontend guide

**Base:** `/api/marketplace`

Creators generate **promo codes**. Buyers enter a code at checkout. **Package early-bird discount and coupon stack:** tier sale price first, then coupon off that subtotal.

---

## Pricing stack (important)

1. **Tier list price** → apply tier `discount` if active → **`unit_price`** per line  
2. Sum line subtotals → **`tier_subtotal`**  
3. Apply **coupon** on eligible paid lines only → **`coupon_discount`**  
4. **`total_amount`** = tier_subtotal − coupon_discount (min 0)

Example: VIP ₦10,000, tier 20% off → ₦8,000. Coupon `GOSPEL20` (20%) → −₦1,600 → **₦6,400**.

Free RSVP tiers (₦0) never receive coupon discount.

---

## Buyer — preview code (checkout UI)

**POST** `/events/:eventId/coupons/validate`

```json
{
  "coupon_code": "GOSPEL20",
  "buyer_email": "ada@example.com",
  "items": [{ "tier_id": 3, "quantity": 2 }]
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "valid": true,
    "coupon": {
      "id": 1,
      "code": "GOSPEL20",
      "discount_type": "percent",
      "discount_value": 20,
      "max_uses": 50,
      "uses_count": 3,
      "uses_remaining": 47,
      "one_per_email": true,
      "tier_ids": null,
      "starts_at": null,
      "ends_at": null,
      "is_active": true
    },
    "pricing": {
      "currency": "NGN",
      "ticket_count": 2,
      "tier_subtotal": "16000.00",
      "tier_discount_total": "4000.00",
      "coupon_discount": "3200.00",
      "total_amount": "12800.00"
    },
    "line_items": []
  }
}
```

Call when user taps **Apply** on the promo field. Show tier subtotal, coupon savings, and new total.

**Errors (400):** invalid code, expired, usage limit, already used with this email, does not apply to selected packages.

---

## Buyer — create order

**POST** `/events/:eventId/orders`

Same body as before, plus optional:

```json
{
  "coupon_code": "GOSPEL20",
  "buyer_email": "ada@example.com",
  "buyer_name": "Ada Okafor",
  "items": [{ "tier_id": 3, "quantity": 2 }],
  "payment_method": "flutterwave"
}
```

Order response includes:

```json
{
  "order": {
    "total_amount": "12800.00",
    "coupon_code": "GOSPEL20",
    "coupon_discount_amount": "3200.00"
  }
}
```

Re-send the same `coupon_code` on the final order create after validate.

---

## Creator — manage coupons (tutor JWT)

| Action | Method | Path |
|--------|--------|------|
| List | GET | `/tutor/events/:eventId/coupons` |
| Create | POST | `/tutor/events/:eventId/coupons` |
| Update | PUT | `/tutor/events/:eventId/coupons/:couponId` |
| Delete / deactivate | DELETE | `/tutor/events/:eventId/coupons/:couponId` |

### Create body

```json
{
  "code": "GOSPEL20",
  "discount_type": "percent",
  "discount_value": 20,
  "max_uses": 50,
  "one_per_email": true,
  "tier_ids": [3, 4],
  "starts_at": "2026-09-01T00:00:00.000Z",
  "ends_at": "2026-10-01T00:00:00.000Z",
  "is_active": true
}
```

| Field | Notes |
|--------|--------|
| `code` | Optional — server generates e.g. `SAVEA1B2C3` if omitted |
| `discount_type` | `percent` \| `fixed` |
| `discount_value` | Percent 1–100 or fixed amount in tier currency |
| `max_uses` | Omit or `null` = unlimited |
| `one_per_email` | Default `true` |
| `tier_ids` | Omit / `null` = all **paid** packages; else only those tier ids |
| `starts_at` / `ends_at` | Optional window |

List response shows `uses_count` and `uses_remaining`.

If DELETE on a used coupon → **deactivates** instead of hard delete.

---

## UI checklist

**Manage (tutor)**

- [ ] Coupons tab on event  
- [ ] Create form: code, % or fixed, max uses, one-per-email, optional tiers & dates  
- [ ] Table: code, discount, uses (3 / 50), active, edit / deactivate  

**Checkout (buyer)**

- [ ] Promo code field + Apply → `POST .../coupons/validate`  
- [ ] Show tier discount, coupon discount, total  
- [ ] Pass `coupon_code` on `POST .../orders`  

---

## Migration (ops)

```bash
node scripts/migrate-event-ticket-coupons.js
```
