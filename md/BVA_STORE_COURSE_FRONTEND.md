# BVA, store contact, course discounts, view links

**Base:** `/api/marketplace`

## One-time BVA (bank virtual account)

**POST** `/payments/bva`  
Auth: optional. Required student JWT for `wallet`, `course`, `coaching_session`.

```json
{
  "source": "guest_order | event_order | wallet | course | coaching_session",
  "order_id": 7,
  "course_id": 12,
  "session_id": 9,
  "amount": 5000
}
```

| source | extra fields | after payment |
|--------|----------------|---------------|
| `guest_order` | `order_id` | `POST /guest-orders/:id/confirm-payment` |
| `event_order` | `order_id` | `POST /events/orders/:id/confirm-payment` |
| `wallet` | `amount` | `POST /api/wallet/fund` with `transaction_reference` |
| `course` | `course_id` | `POST /payments/bva/confirm` `{ "source": "course", "transaction_reference" }` |
| `coaching_session` | `session_id` | `POST /payments/bva/confirm` `{ "source": "coaching_session", "transaction_reference" }` |

Response includes `account_number`, `bank_name`, `account_name`, `amount`, `tx_ref`, `expires_at`. Show these and poll/confirm after the transfer. **NGN only.**

Guest/event `payment` objects also include `methods[]` with `flutterwave_inline` and `bva`.

---

## Courses require an account

- Guest checkout for `course` returns **400**.
- Store/course cards set `requires_account: true`.
- Pay with wallet (`POST /courses/purchase`) or BVA (`source: "course"`).

---

## Course discount

Tutors set on create/update:

- `discount_percent` (0–100)
- `discount_starts_at` / `discount_ends_at` (optional window)

Public APIs return `list_price`, `sale_price`/`price` (effective), `discount_percent`, `discount_active`.

Run: `node scripts/migrate-course-discount.js`

---

## View links

Product payloads include `view_path` and `view_url` (absolute, learner app):

- course → `/courses/{id|slug}`
- digital_download → `/digital-downloads/{id|slug}`
- coaching → `/coaching/sessions/{id}` (or session `view_link` if set)

---

## Store owner contact

Public storefront `GET /public/tutor/:slug/products` → `tutor.contact` (`email`, `phone`, `website` for orgs).

Browse/detail tutor objects also include email/phone so buyers can reach out.
