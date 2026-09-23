# Event Ticketing — Frontend Implementation Guide

**Status:** Backend live (schema + APIs).  
**Base URL:** `https://<api-host>/api/marketplace`

Migrations (already applied on production DB):

```bash
node scripts/migrate-create-event-ticket-tables.js
node scripts/migrate-event-ticket-video-benefits-sales.js
node scripts/migrate-event-ticket-approval.js
node scripts/migrate-event-ticket-discount.js
node scripts/migrate-event-forensics.js
```

---

## Product rules (read first)

| Rule | Detail |
|------|--------|
| Creator sets price | Each **package/tier** has its own `price` — **not** a fixed platform price. `0` = free RSVP. |
| Paid-ticket discount | Optional `discount_type`: `none` \| `percent` \| `fixed`. Applied at checkout. Free tickets cannot have a discount. |
| Event + packages | Create the **event** (ticket), then add **packages** (Premium, Gold, etc.) under it. |
| Benefits | Each package has `benefits: string[]` (e.g. `["VIP seat", "Merch"]`). |
| Ticket code | Every sold/RSVP ticket gets a short code like `YDHSJ3`. |
| Open / close sales | `sales_open` / `sales_status: "open" \| "closed"`. Closing stops checkout; event can stay published. |
| Instant vs approval | `requires_approval: false` (default) = ticket allocated immediately. `true` = buyer applies/pays, creator must **approve** before tickets are issued. |
| Creator revenue | On ticket allocation (`status: paid`), creator wallet is credited (net of commission, same rate as other products). Free = no credit. Approval events credit **on approve**, not while pending. |
| Buyers | Guest checkout (email + name) or logged-in student (wallet or Flutterwave). |
| Formats | `online` \| `in_person` \| `hybrid` |

---

## Auth

| Who | Header |
|-----|--------|
| Tutor / organization | `Authorization: Bearer <tutor_jwt>` |
| Student (optional at checkout, required for wallet / my-tickets) | `Authorization: Bearer <student_jwt>` |
| Public / guest | none |

Use existing marketplace tutor login and student login.

---

## Response shape

```json
{ "success": true, "message": "...", "data": { } }
```

Errors typically:

```json
{ "status": false, "code": 400, "message": "..." }
```

---

## 1. Tutor — create & manage events

### Upload cover image

`POST /tutor/events/upload-cover`  
`Content-Type: multipart/form-data`  
Field: `cover_image` (JPEG/PNG/WebP, max 5MB)

```json
{
  "success": true,
  "data": {
    "cover_image_url": "https://...",
    "file_path": "tutors/123/covers/..."
  }
}
```

Pass `cover_image_url` into create/update event.  
**Video:** pass a URL string as `video_url` (no dedicated upload endpoint yet — use your CDN / YouTube / Vimeo / storage URL).

---

### Create event

`POST /tutor/events`

```json
{
  "title": "Transformation Night",
  "description": "Worship and teaching night",
  "format": "in_person",
  "timezone": "Africa/Lagos",
  "starts_at": "2026-10-15T18:00:00.000Z",
  "ends_at": "2026-10-15T21:00:00.000Z",
  "doors_open_at": "2026-10-15T17:00:00.000Z",
  "venue_name": "Main Auditorium",
  "address_line1": "12 Example Street",
  "city": "Lagos",
  "region": "LA",
  "country": "NG",
  "cover_image_url": "https://...",
  "video_url": "https://...",
  "category": "concert",
  "max_attendees": 500,
  "refund_policy": "none",
  "refund_policy_text": null,
  "requires_approval": false
}
```

Required: `title`, `format`, `starts_at`, `ends_at`.

Optional: **`requires_approval`** (`false` = instant tickets, `true` = creator must approve before tickets are issued).

Starts as `status: "draft"`, `sales_open: true`.

---

### List / get / update

| Method | Path |
|--------|------|
| GET | `/tutor/events?page=1&limit=20&status=draft` |
| GET | `/tutor/events/:id` |
| PUT | `/tutor/events/:id` |

Updatable fields include: `title`, `description`, `format`, dates, venue fields, `online_url`, `cover_image_url`, **`video_url`**, `category`, refund fields, `max_attendees`, `slug`, **`requires_approval`**.

List/summary includes:

```json
{
  "id": 1,
  "title": "...",
  "slug": "...",
  "status": "published",
  "sales_open": true,
  "sales_status": "open",
  "cover_image_url": "...",
  "video_url": "...",
  "tier_count": 2,
  "tickets_sold": 12,
  "gross_revenue": "45000.00"
}
```

---

### Publish / unpublish / open / close sales / cancel

| Action | Method | Path | Effect |
|--------|--------|------|--------|
| Publish | POST | `/tutor/events/:id/publish` | Requires ≥1 tier with inventory. Sets `status=published`, `sales_open=true` |
| Unpublish | POST | `/tutor/events/:id/unpublish` | `status=draft`, `sales_open=false` |
| **Close sales** | POST | `/tutor/events/:id/close-sales` | `sales_open=false` (page can stay published) |
| **Open sales** | POST | `/tutor/events/:id/open-sales` | `sales_open=true` (must already be published) |
| Cancel | POST | `/tutor/events/:id/cancel` | `status=cancelled`, `sales_open=false` |

**UI tip:** Use **Close sales / Open sales** for “stop accepting tickets” without hiding the event. Use **Unpublish** to take the event off public discovery.

Checkout is blocked when `status !== "published"` **or** `sales_open === false`.

---

## 2. Tutor — ticket packages (tiers)

Packages live **under** an event. Creator chooses each package price.

### Create package

`POST /tutor/events/:eventId/tiers`

```json
{
  "name": "Premium",
  "description": "Best seats",
  "price": 1000,
  "currency": "NGN",
  "quantity_total": 100,
  "max_per_order": 4,
  "benefits": [
    "Front row seating",
    "Welcome drink",
    "Early entry"
  ],
  "sales_start": null,
  "sales_end": null,
  "sort_order": 0,
  "is_hidden": false,
  "discount_type": "percent",
  "discount_value": 20,
  "discount_starts_at": null,
  "discount_ends_at": null
}
```

```json
{
  "name": "Gold",
  "description": "VIP experience",
  "price": 5000,
  "currency": "NGN",
  "quantity_total": 50,
  "benefits": ["VIP lounge", "Meet & greet", "Gift bag"]
}
```

| Field | Notes |
|-------|--------|
| `name` | Required |
| `price` | **Creator-set list price**, ≥ 0. Not fixed by platform. `0` = free |
| `discount_type` | `none` (default) \| `percent` \| `fixed`. Paid tickets only |
| `discount_value` | Percent `0–100`, or fixed amount in the tier currency (must be ≤ price) |
| `discount_starts_at` / `discount_ends_at` | Optional window. Outside the window, list price applies |
| `quantity_total` | Required — how many tickets in this package |
| `benefits` | Array of strings (max 50). Also accepts newline-separated string |
| `max_per_order` | Default `4` |
| `is_hidden` | Hide from public listing |

### List / update / delete packages

| Method | Path |
|--------|------|
| GET | `/tutor/events/:eventId/tiers` |
| PUT | `/tutor/events/:eventId/tiers/:tierId` |
| DELETE | `/tutor/events/:eventId/tiers/:tierId` |

Cannot delete a tier with `quantity_sold > 0`.  
Cannot set `quantity_total` below sold + reserved.

### Public tier shape (what buyers see)

```json
{
  "id": 3,
  "name": "Premium",
  "description": "Best seats",
  "benefits": ["Front row seating", "Welcome drink"],
  "price": "800.00",
  "list_price": "1000.00",
  "discount": {
    "type": "percent",
    "value": 20,
    "amount": "200.00",
    "active": true,
    "starts_at": null,
    "ends_at": null
  },
  "currency": "NGN",
  "quantity_total": 100,
  "quantity_available": 87,
  "max_per_order": 4,
  "sales_start": null,
  "sales_end": null,
  "is_sales_open": true
}
```

---

## 3. Tutor — sales, attendees, check-in

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/tutor/events/:id/sales` | Revenue + tier breakdown |
| GET | `/tutor/events/:id/forensics` | World-class dashboard: funnel, money, door, by-tier, by-day, recent audit |
| GET | `/tutor/events/:id/activity` | Full audit trail (`?action=&include_views=true`) |
| GET | `/tutor/events/:id/orders/:orderId` | One order: prices, fees, tickets, timeline |
| GET | `/tutor/events/:id/orders` | Orders list |
| GET | `/tutor/events/:id/attendees` | Ticket holders |
| GET | `/tutor/events/:id/attendees/export` | CSV (ticket_code, name, phone, status) — printable / Excel at the door |
| GET | `/tutor/events/:id/check-in/offline-pack` | JSON snapshot to cache on device before doors open |
| POST | `/tutor/events/:id/check-in/sync` | Push offline marks when network returns |
| POST | `/tutor/events/:id/check-in/lookup` | Preview ticket + customer `{ "ticket_code": "YDHSJ3" }` |
| POST | `/tutor/events/:id/check-in` | Mark used `{ "ticket_code": "YDHSJ3" }` |

**Lookup response (found):**

```json
{
  "success": true,
  "message": "Ticket found",
  "data": {
    "found": true,
    "valid": true,
    "already_checked_in": false,
    "ticket_code": "YDHSJ3",
    "ticket": {
      "id": 1,
      "ticket_code": "YDHSJ3",
      "status": "valid",
      "holder_name": "Ada Okafor",
      "holder_email": "ada@example.com",
      "tier_name": "Premium",
      "buyer": {
        "name": "Ada Okafor",
        "email": "ada@example.com",
        "phone": "+234..."
      },
      "order": { "id": 10, "status": "paid", "paid_at": "...", "total_amount": "1000.00", "currency": "NGN" }
    },
    "customer": {
      "name": "Ada Okafor",
      "email": "ada@example.com",
      "phone": "+234..."
    }
  }
}
```

**Lookup response (wrong / unknown code):**

```json
{
  "success": true,
  "message": "Ticket not found",
  "data": {
    "found": false,
    "valid": false,
    "already_checked_in": false,
    "ticket_code": "WRONG1",
    "ticket": null,
    "customer": null
  }
}
```

Use `data.found` / `data.customer` — do **not** treat every `200` as a valid ticket.
| GET | `/tutor/events/:id/check-in/stats` | Checked-in counts |

Ticket codes are case-insensitive on check-in (stored uppercase).

### Forensics (creator dashboard)

`GET /tutor/events/:id/forensics`

Use this as the event “control room”:

| Block | What it shows |
|-------|----------------|
| `funnel` | Page views → checkout started → pending / approval / paid / rejected |
| `money` | List price, discounts, collected, platform fee, creator earnings, refunds |
| `door` | Issued vs checked in vs remaining (no-shows after event end) |
| `by_tier` / `by_day` | Package and daily breakdown |
| `recent_activity` | Last 25 audit rows (excludes raw page views) |

`GET /tutor/events/:id/activity?action=order_paid` — full trail.  
`GET /tutor/events/:id/orders/:orderId` — one buyer: line items, fees, tickets, timeline.

---

### Offline / bad-network check-in

Download **before doors open** (or whenever signal is good). Check people in on the device. Sync when the network returns.

**1. Cache the list (preferred for the app)**

`GET /tutor/events/:id/check-in/offline-pack`

Store `data.attendees` locally (IndexedDB / SQLite). Search by `ticket_code`, name, email, or phone.

```json
{
  "downloaded_at": "2026-09-23T14:00:00.000Z",
  "attendee_count": 120,
  "already_checked_in": 3,
  "attendees": [
    {
      "ticket_id": 1,
      "ticket_code": "YDHSJ3",
      "status": "valid",
      "holder_name": "Ada Okafor",
      "holder_email": "ada@example.com",
      "tier_name": "Premium",
      "checked_in_at": null,
      "buyer_name": "Ada Okafor",
      "buyer_email": "ada@example.com",
      "buyer_phone": "+234..."
    }
  ]
}
```

**2. Or download CSV**

`GET /tutor/events/:id/attendees/export` — open in Sheets / print. Columns: `ticket_code,tier,holder_name,holder_email,buyer_phone,status,checked_in_at`.

**3. Offline mark (device only)**

If `status === "valid"`, mark local record `status: "used"` and set `checked_in_at` (ISO). Queue `{ ticket_code, checked_in_at }` for sync. Do **not** check in `used` or missing codes.

**4. Sync when online**

`POST /tutor/events/:id/check-in/sync`

```json
{
  "check_ins": [
    { "ticket_code": "YDHSJ3", "checked_in_at": "2026-09-23T15:04:00.000Z" }
  ]
}
```

| Result | Meaning |
|--------|---------|
| `applied` | Server marked used |
| `already_checked_in` | Already used (treat as success / idempotent) |
| `not_found` | Sold after the download — refresh pack |
| `rejected` | Cancelled or bad payload |

Max **500** items per request. After sync, call `offline-pack` again if you can.

---

## 4. Public discovery & event page

| Method | Path | Auth |
|--------|------|------|
| GET | `/events?page=1&limit=20&format=in_person&category=&search=` | Public |
| GET | `/events/slug/:slug` | Optional student JWT |
| GET | `/public/tutor/:slug/events` | Public storefront events |

**Important:** Event detail is `GET /events/slug/:slug` — not `/events/:id`.

### Event object (public)

```json
{
  "id": 1,
  "slug": "transformation-night",
  "title": "Transformation Night",
  "description": "...",
  "format": "in_person",
  "timezone": "Africa/Lagos",
  "starts_at": "...",
  "ends_at": "...",
  "cover_image_url": "...",
  "video_url": "https://...",
  "category": "concert",
  "status": "published",
  "sales_open": true,
  "sales_status": "open",
  "venue": {
    "venue_name": "Main Auditorium",
    "address_line1": "...",
    "city": "Lagos",
    "region": "LA",
    "country": "NG",
    "latitude": null,
    "longitude": null
  },
  "owner_type": "organization",
  "owner_id": 4
}
```

If `sales_status === "closed"` or `sales_open === false`, show “Sales closed” and disable Buy/RSVP.

`online_url` is only revealed to ticket holders after purchase (not on public browse).

---

## 5. Checkout (guest + student)

### Create order

`POST /events/:eventId/orders`  
Optional: student JWT  
Optional header: `Idempotency-Key: <uuid>`

```json
{
  "buyer_email": "buyer@example.com",
  "buyer_name": "Ada Okafor",
  "buyer_phone": "+2348012345678",
  "payment_method": "flutterwave",
  "items": [
    { "tier_id": 3, "quantity": 2 }
  ],
  "holder_names": ["Ada Okafor", "Guest Two"]
}
```

| `payment_method` | When |
|------------------|------|
| omit / `free` | Auto when total is `0` |
| `flutterwave` | Guests paid, or students paying by card |
| `wallet` | Logged-in student only |

**Free order response** (immediate tickets):

```json
{
  "success": true,
  "message": "RSVP confirmed",
  "data": {
    "order": { "id": 10, "status": "paid", "total_amount": "0.00", "currency": "NGN", "ticket_count": 2 },
    "access_token": "<token>",
    "tickets_url": "/tickets/order/<token>",
    "tickets": [
      { "id": 1, "ticket_code": "YDHSJ3", "tier_name": "Premium" },
      { "id": 2, "ticket_code": "K7MPQ2", "tier_name": "Premium" }
    ]
  }
}
```

**Paid Flutterwave response:**

```json
{
  "success": true,
  "message": "Order created",
  "data": {
    "order": {
      "id": 11,
      "status": "pending",
      "total_amount": "2000.00",
      "currency": "NGN",
      "ticket_count": 2,
      "reservation_expires_at": "..."
    },
    "payment": {
      "public_key": "...",
      "tx_ref": "EVT-ORDER-11-...",
      "amount": 2000,
      "currency": "NGN",
      "customer": { "email": "...", "name": "..." },
      "meta": { }
    }
  }
}
```

Inventory is **reserved** for ~15 minutes until paid or expired.

### Confirm Flutterwave

`POST /events/orders/:orderId/confirm-payment`

```json
{ "transaction_id": "<flutterwave_transaction_id>" }
```

### Pay with wallet (student)

`POST /events/orders/:orderId/pay-with-wallet`  
Requires student JWT.

### Order status / cancel

| Method | Path |
|--------|------|
| GET | `/events/orders/:orderId/status` |
| POST | `/events/orders/:orderId/cancel` |

---

## 6. Tickets after purchase

| Method | Path | Notes |
|--------|------|-------|
| GET | `/tickets/order/:accessToken` | Magic link — no login |
| GET | `/tickets/order/:accessToken/calendar.ics` | Calendar download |
| POST | `/tickets/order/:accessToken/resend-email` | Resend confirmation |
| GET | `/my-tickets` | Student JWT — all my tickets |

Each ticket includes:

- `ticket_code` — e.g. `YDHSJ3` (show large; use for typed check-in)
- **`qr_url`** — encode **this URL** as the QR (e.g. `https://app.thenomada.com/t/YDHSJ3`). Phone cameras open it instead of dumping base64.
- `qr_payload` — legacy blob; **do not** put this in the QR
- `holder_name`, `status` (`valid` \| `used` \| `cancelled`)

**QR / scan page (frontend):** route `/t/:ticketCode` should call `GET /tickets/scan/:ticketCode` and show event name, holder, package, status (valid / already used). Door app scanner can still POST the scanned URL to `/tutor/events/:id/check-in/lookup`.

**Suggested frontend routes**

- Public event: `/events/:slug` or `/e/:slug`
- Tickets: `/tickets/order/:accessToken`
- Tutor: `/tutor/events`, `/tutor/events/:id`, `/tutor/events/:id/check-in`

---

## 7. Suggested tutor UI flow

1. **Create event** — title, description, venue, date/time, cover image, video URL, category  
2. **Add packages** — e.g. Premium ₦1,000 + benefits + qty; Gold ₦5,000 + benefits + qty  
3. **Publish** — goes live with sales open  
4. **Close sales** when needed (or reopen)  
5. **Day-of** — check-in by ticket code / QR  

---

## 8. Suggested buyer UI flow

1. Open public event page (`GET /events/slug/:slug`)  
2. Show image, video, venue, date, packages + benefits + prices (use `list_price` + `price` when `discount.active`)  
3. If `sales_status === "closed"` → disable purchase  
4. Select package + qty → checkout (email/name)  
5. Free → show ticket codes immediately  
6. Paid → Flutterwave → confirm → show ticket codes  
7. Email + magic link to `/tickets/order/:accessToken`  

---

## 9. Error cases to handle in UI

| Message / situation | UI |
|---------------------|----|
| `Ticket sales are closed for this event` | Show closed state |
| `Event is not available for ticket sales` | Not published / cancelled |
| `Tier "X" is not available for sale` | Sold out / hidden / outside sales window |
| `Maximum N tickets per order...` | Cap quantity picker |
| Reservation expired | Restart checkout |
| `Ticket already checked in` | Show already used |

---

## 10. Frontend screens checklist

**Tutor / org**

- [ ] Event list (filter by status / sales open)  
- [ ] Create / edit event (incl. video URL + cover upload)  
- [ ] Package manager (price, optional percent/fixed discount + window, benefits, quantity)  
- [ ] Publish / unpublish / open sales / close sales  
- [ ] **Approval queue** — list orders with `?status=pending_approval`, approve / reject  
- [ ] Sales dashboard + attendees + CSV  
- [ ] **Forensics** — `/forensics` funnel + money + door + `/activity` audit + order drill-down  
- [ ] Check-in scanner (code or QR)  
- [ ] **Offline pack** — download list before doors; search locally if network dies  
- [ ] **Sync queue** — push offline marks via `/check-in/sync` when back online  

**Public / buyer**

- [ ] Event browse + detail (video, packages, benefits)  
- [ ] If `requires_approval`, show **Apply** / “Awaiting approval” instead of instant tickets  
- [ ] Guest checkout + Flutterwave  
- [ ] Student wallet checkout  
- [ ] Ticket confirmation page (codes + QR) — only after `status: paid`  
- [ ] My tickets (logged-in)  

---

## Approval flow (when `requires_approval: true`)

1. Buyer submits checkout (free) or pays (wallet / Flutterwave).
2. Order becomes `pending_approval`. **No ticket codes yet.** Seats stay reserved.
3. Creator lists: `GET /tutor/events/:id/orders?status=pending_approval`
4. Approve: `POST /tutor/events/:id/orders/:orderId/approve` → status `paid`, tickets issued + email.
5. Reject: `POST /tutor/events/:id/orders/:orderId/reject` body `{ "reason": "optional" }` → seats released; wallet refunded automatically; Flutterwave refund attempted (else `refund_status: "manual_required"`).

Checkout responses include `awaiting_approval: true` and **no** `tickets` / `access_token` until approved.

---

## 11. Quick reference — all routes

### Tutor (Bearer tutor JWT)

```
POST   /tutor/events/upload-cover
POST   /tutor/events
GET    /tutor/events
GET    /tutor/events/:id
PUT    /tutor/events/:id
POST   /tutor/events/:id/publish
POST   /tutor/events/:id/unpublish
POST   /tutor/events/:id/close-sales
POST   /tutor/events/:id/open-sales
POST   /tutor/events/:id/cancel
POST   /tutor/events/:eventId/tiers
GET    /tutor/events/:eventId/tiers
PUT    /tutor/events/:eventId/tiers/:tierId
DELETE /tutor/events/:eventId/tiers/:tierId
GET    /tutor/events/:id/sales
GET    /tutor/events/:id/forensics
GET    /tutor/events/:id/activity
GET    /tutor/events/:id/orders
GET    /tutor/events/:id/orders/:orderId
POST   /tutor/events/:id/orders/:orderId/approve
POST   /tutor/events/:id/orders/:orderId/reject
GET    /tutor/events/:id/attendees
GET    /tutor/events/:id/attendees/export
GET    /tutor/events/:id/check-in/offline-pack
POST   /tutor/events/:id/check-in/sync
POST   /tutor/events/:id/check-in/lookup
POST   /tutor/events/:id/check-in
GET    /tutor/events/:id/check-in/stats
```

### Public / checkout

```
GET    /events
GET    /events/slug/:slug
GET    /public/tutor/:slug/events
POST   /events/:eventId/orders
POST   /events/orders/:orderId/confirm-payment
POST   /events/orders/:orderId/pay-with-wallet
GET    /events/orders/:orderId/status
POST   /events/orders/:orderId/cancel
GET    /tickets/scan/:ticketCode
GET    /tickets/order/:accessToken
GET    /tickets/order/:accessToken/calendar.ics
POST   /tickets/order/:accessToken/resend-email
GET    /my-tickets
```

All paths are under `/api/marketplace`.
