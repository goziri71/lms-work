# Guest checkout — digital downloads only

**Base:** `/api/marketplace`

**Courses cannot be bought as a guest.** Buyer must register / log in as a student, then `POST /courses/purchase` or pay with BVA (`source: "course"`).

**Digital downloads** can be bought **without an account** (email + name + Flutterwave card **or one-time BVA**). Magic link is emailed. Same email on signup/login claims the purchase.

---

## Create checkout

**POST** `/guest-checkout`

```json
{
  "product_type": "digital_download",
  "product_id": 42,
  "buyer_email": "ada@example.com",
  "buyer_name": "Ada Lovelace",
  "buyer_phone": "+2348012345678"
}
```

Paid response includes `payment.methods`:

- `flutterwave_inline` — existing card checkout (`public_key` + `tx_ref`)
- `bva` — bank transfer. Call **POST** `/payments/bva` with `{ "source": "guest_order", "order_id": 7 }`

Then confirm: **POST** `/guest-orders/:orderId/confirm-payment` (or wait for webhook).

Access: **GET** `/guest-orders/access/:accessToken` — `view_url` opens the purchase.

---

See also `md/BVA_STORE_COURSE_FRONTEND.md`.
