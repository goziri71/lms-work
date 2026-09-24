# Events — discovery, related events, conversion

Send this to the **app frontend** (separate repo). Backend is ready.

**Base:** `/api/marketplace`  
**Auth:** none for browse / event page (optional student JWT on event page).

**Rule:** nobody should leave an event page or checkout seeing only one event. Always show **other upcoming events** with date, time, city, and price.

---

## Routes to add / finish

| Page | Route | Data |
|------|--------|------|
| Events directory | `/events` | `GET /events` |
| Event + buy | `/events/:slug` | `GET /events/slug/:slug` |
| After pay | existing tickets / success | reuse `other_events` from the event page |

Do **not** call `/events/:id` for the public page. Slug only.

---

## 1. Directory — `GET /events`

```
GET /events?page=1&limit=20
  &search=gospel
  &city=Lagos
  &category=concert
  &format=in_person
  &from=2026-08-01T00:00:00.000Z
  &to=2026-08-31T23:59:59.000Z
  &exclude=2
  &exclude_slug=transformation-camp-experience
```

| Query | What |
|--------|------|
| `search` | Title, slug, **city, venue, description** |
| `city` | Partial match (`Lagos` matches `Ikeja, Lagos`) |
| `category` | Exact category |
| `format` | `online` \| `in_person` \| `hybrid` |
| `from` / `to` | Filter by `starts_at` |
| `exclude` | Comma-separated ids to skip |
| `exclude_slug` | Skip this slug |
| `include_past=true` | Include events that already ended (default: upcoming only) |

**Response**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 2,
        "slug": "transformation-camp-experience",
        "title": "Transformation Camp Experience",
        "format": "in_person",
        "starts_at": "2026-10-03T11:00:00.000Z",
        "ends_at": "2026-10-03T18:00:00.000Z",
        "timezone": "Africa/Lagos",
        "cover_image_url": "https://...",
        "venue_name": "Ambience Studio",
        "city": "Ikota",
        "country": "NG",
        "category": "camp",
        "status": "published",
        "min_price": "0.00",
        "currency": "NGN",
        "is_free_available": true,
        "tickets_sold": 7,
        "tickets_remaining": 193,
        "early_bird_ends_at": "2026-09-30T23:00:00.000Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 1, "total_pages": 1 }
  }
}
```

`early_bird_ends_at` is `null` when no discount is active.

### Directory UI

Filters: **city**, **month/date**, **category**, **in person / online**, search.

Each card:

- Cover
- Title
- **Date + time in `timezone`** (e.g. Sat 3 Oct · 12:00 · WAT)
- City + venue, or **Online** if `format === "online"`
- From ₦X / **Free** if `is_free_available`
- Optional: `12 left` if `tickets_remaining` is low; `Early bird` if `early_bird_ends_at` is set
- Click → `/events/:slug`

Empty: “No events in this city yet” + show upcoming with filters cleared.

---

## 2. Event page — `GET /events/slug/:slug`

One call. Do not fetch related events separately unless you want a refresh.

```json
{
  "success": true,
  "data": {
    "event": {
      "id": 2,
      "slug": "transformation-camp-experience",
      "title": "Transformation Camp Experience",
      "description": "...",
      "format": "in_person",
      "timezone": "Africa/Lagos",
      "starts_at": "2026-10-03T11:00:00.000Z",
      "ends_at": "...",
      "doors_open_at": "...",
      "cover_image_url": "https://...",
      "video_url": "https://...",
      "category": "camp",
      "status": "published",
      "sales_open": true,
      "sales_status": "open",
      "tickets_sold": 7,
      "tickets_remaining": 193,
      "early_bird_ends_at": "2026-09-30T23:00:00.000Z",
      "venue": {
        "venue_name": "Ambience Studio",
        "address_line1": "...",
        "city": "Ikota",
        "region": "...",
        "country": "NG"
      }
    },
    "tiers": [
      {
        "id": 3,
        "name": "General",
        "price": "8000.00",
        "list_price": "10000.00",
        "discount": {
          "type": "percent",
          "value": 20,
          "amount": "2000.00",
          "active": true,
          "starts_at": null,
          "ends_at": "2026-09-30T23:00:00.000Z"
        },
        "quantity_available": 80,
        "is_sales_open": true
      }
    ],
    "host": {
      "display_name": "...",
      "slug": "...",
      "logo_url": "..."
    },
    "other_events": [],
    "user_context": {
      "is_logged_in": false,
      "existing_order_id": null,
      "tickets_owned": 0
    }
  }
}
```

`other_events` is the **same card shape** as directory `items` (max 6). Backend already ranked: **same city → same category → soonest upcoming**. Current event is excluded. Empty array if nothing else is live.

---

## 3. “Other events happening” (required)

Show this strip in **three places**, same cards:

1. Event page — under packages / above footer  
2. Checkout — while they pick tickets or pay  
3. Success / ticket screen — after they buy  

**Copy**

- Same city as hero: **More events in {city}**
- Else: **Other events happening**
- CTA on card: **Get tickets**

**Each card must show**

- Cover  
- Title  
- **Date + time** (`starts_at` + `timezone`)  
- City / venue or Online  
- From price or Free  
- Tap → `/events/:slug`

**Hide the whole block if `other_events.length === 0`.**

On checkout / success, reuse `other_events` already loaded from the event page. Optional refresh:

```
GET /events?limit=6&exclude=<id>&exclude_slug=<slug>&city=<city>
```

---

## 3b. Reminder emails (backend — no new FE API)

After a paid / free confirmed order, Nomada emails the buyer:

1. **Confirmation** — tickets + QR link  
2. **~24 hours before** start — “Tomorrow: {title}”  
3. **~3 hours before** start — “Starting soon: {title}”

Each reminder includes when, where, ticket codes, view-tickets link, and add-to-calendar.

**FE copy on success / ticket screen:**

> We’ll email you a reminder the day before, and again when it’s about to start.

No extra endpoint. If they bought within 3 hours of start they only get the “starting soon” mail (plus confirmation).

---

## 4. Make the buy page convert

| Use | UI |
|-----|-----|
| `video_url` | Play first if present, not only the cover |
| `starts_at`, `ends_at`, `doors_open_at`, `timezone` | Large, obvious when |
| `event.early_bird_ends_at` or `tier.discount.ends_at` | Countdown while `discount.active` |
| `tickets_sold` | “7 going” / “7 tickets sold” |
| `tickets_remaining` | “Only 12 left” when low (e.g. ≤ 20) |
| Share | WhatsApp / copy `https://app.thenomada.com/events/{slug}` |
| `sales_open === false` | “Sales closed”, disable buy |

Checkout itself is unchanged: `POST /events/:eventId/orders` (see main ticketing guide).

---

## 5. Date / time (do not ignore timezone)

`starts_at` is UTC ISO. Always format with `event.timezone` (usually `Africa/Lagos`).

```
Sat, 3 Oct 2026 · 12:00
Africa/Lagos
```

Same on directory cards, related strip, and the hero.

---

## Checklist

- [ ] `/events` directory with city, date, category, format, search  
- [ ] Cards show **date + time + city + price**  
- [ ] `/events/:slug` uses `GET /events/slug/:slug`  
- [ ] **Other events happening** on event page, checkout, and success  
- [ ] Hide related strip when `other_events` is empty  
- [ ] Early-bird countdown when discount is active  
- [ ] Share button  
- [ ] Sold / remaining social proof  

---

## Not this pass

Embed widget, reminder emails, seat maps. Ticketing, QR, and tutor manage APIs stay as in `EVENT_TICKET_SALES_FRONTEND_GUIDE.md`.
