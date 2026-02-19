# Hybrid Coaching Booking System - Frontend Implementation Guide

## Overview

This system enables one-on-one coaching sessions where tutors and students negotiate a time that works for both parties. Tutors set their availability and hourly rate; students browse, pick a time (or propose a custom one), and both agree before payment is processed.

**Base URL:** `https://lms-work.onrender.com/api/marketplace`

---

## Authentication

| Role | Header | How to get token |
|------|--------|-----------------|
| **Tutor** | `Authorization: Bearer <tutor_token>` | Tutor login endpoint |
| **Student** | `Authorization: Bearer <student_token>` | Student login endpoint |
| **Public** | None required | Some endpoints accept optional auth |

---

## Complete User Flow

```
TUTOR SETUP:
  1. Create/update coaching profile (hourly rate, bio, duration limits)
  2. Add availability windows (recurring weekly or specific dates)

STUDENT BOOKING:
  3. Browse coaching tutors
  4. View tutor's profile + availability
  5. Submit booking request (pick from availability OR propose custom time)

NEGOTIATION:
  6a. Tutor ACCEPTS  → booking status = "accepted" → go to step 7
  6b. Tutor DECLINES → booking closed
  6c. Tutor COUNTER-PROPOSES → student reviews:
      → Student ACCEPTS counter  → booking status = "accepted" → go to step 7
      → Student DECLINES counter → booking closed

PAYMENT & SESSION CREATION:
  7. Student previews payment (GET /payment-preview)
  8. Student processes payment (POST /process-payment)
     → Wallet debited, session created, Stream.io call ready

SESSION:
  9. Both join via Stream.io video call (use existing token endpoints)

CANCELLATION (if needed):
  10. Either party cancels (only if >24 hours before session)
      → Full refund to student wallet
```

---

## PART 1: TUTOR ENDPOINTS

All tutor endpoints require `Authorization: Bearer <tutor_token>`.

### 1.1 Get Coaching Profile

```
GET /tutor/coaching/profile
```

**Response:**
```json
{
  "success": true,
  "data": {
    "profile": {
      "id": 1,
      "tutor_id": 5,
      "tutor_type": "sole_tutor",
      "hourly_rate": "5000.00",
      "currency": "NGN",
      "bio": "Expert JavaScript tutor with 5 years experience",
      "specializations": ["JavaScript", "React", "Node.js"],
      "is_accepting_bookings": true,
      "min_duration_minutes": 30,
      "max_duration_minutes": 180,
      "timezone": "Africa/Lagos",
      "total_sessions_completed": 12,
      "average_rating": "4.50",
      "created_at": "2025-01-20T10:00:00.000Z",
      "updated_at": "2025-01-20T10:00:00.000Z"
    }
  }
}
```

> **Note:** If no profile exists, one is auto-created with default values.

---

### 1.2 Update Coaching Profile

```
PUT /tutor/coaching/profile
Content-Type: application/json
```

**Body (all fields optional):**
```json
{
  "hourly_rate": 5000,
  "currency": "NGN",
  "bio": "Expert JavaScript tutor with 5 years experience",
  "specializations": ["JavaScript", "React", "Node.js"],
  "is_accepting_bookings": true,
  "min_duration_minutes": 30,
  "max_duration_minutes": 180,
  "timezone": "Africa/Lagos"
}
```

**Validation:**
- `hourly_rate`: Must be >= 0
- `min_duration_minutes`: Must be >= 15
- `max_duration_minutes`: Must be >= 30
- `min_duration_minutes` cannot exceed `max_duration_minutes`
- `specializations`: Must be an array

**Response:**
```json
{
  "success": true,
  "message": "Coaching profile updated successfully",
  "data": { "profile": { "...updated profile..." } }
}
```

---

### 1.3 Get Availability

```
GET /tutor/coaching/availability
```

**Response:**
```json
{
  "success": true,
  "data": {
    "recurring": [
      {
        "id": 1,
        "day_of_week": 1,
        "start_time": "09:00:00",
        "end_time": "13:00:00",
        "timezone": "Africa/Lagos",
        "is_active": true
      },
      {
        "id": 2,
        "day_of_week": 3,
        "start_time": "14:00:00",
        "end_time": "18:00:00",
        "timezone": "Africa/Lagos",
        "is_active": true
      }
    ],
    "specific": [
      {
        "id": 3,
        "specific_date": "2025-02-15",
        "start_time": "10:00:00",
        "end_time": "16:00:00",
        "timezone": "Africa/Lagos",
        "is_active": true
      }
    ],
    "total": 3
  }
}
```

> **Day of week mapping:** 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday

---

### 1.4 Add Availability Slots

```
POST /tutor/coaching/availability
Content-Type: application/json
```

**Body:**
```json
{
  "slots": [
    {
      "is_recurring": true,
      "day_of_week": 1,
      "start_time": "09:00:00",
      "end_time": "13:00:00",
      "timezone": "Africa/Lagos"
    },
    {
      "is_recurring": false,
      "specific_date": "2025-02-15",
      "start_time": "10:00:00",
      "end_time": "16:00:00"
    }
  ]
}
```

**Rules:**
- Maximum 20 slots per request
- `start_time` must be before `end_time`
- Recurring slots require `day_of_week` (0-6)
- Specific date slots require `specific_date` (cannot be in the past)
- Overlapping slots with existing active slots are rejected (409)

**Response (201):**
```json
{
  "success": true,
  "message": "2 availability slot(s) added",
  "data": { "slots": [ "...created slots..." ] }
}
```

---

### 1.5 Update Availability Slot

```
PUT /tutor/coaching/availability/:slotId
Content-Type: application/json
```

**Body (all optional):**
```json
{
  "start_time": "10:00:00",
  "end_time": "14:00:00",
  "timezone": "Africa/Lagos",
  "is_active": true
}
```

---

### 1.6 Delete Availability Slot

```
DELETE /tutor/coaching/availability/:slotId
```

### 1.7 Bulk Delete Availability Slots

```
DELETE /tutor/coaching/availability/bulk
Content-Type: application/json
```

**Body:**
```json
{
  "slot_ids": [1, 2, 3]
}
```

---

### 1.8 Get Booking Requests (Tutor)

```
GET /tutor/coaching/booking-requests?status=pending&page=1&limit=20
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter: `pending`, `counter_proposed`, `accepted`, `declined`, `expired`, `cancelled` |
| `page` | number | Page number (default 1) |
| `limit` | number | Items per page (default 20, max 100) |

**Response:**
```json
{
  "success": true,
  "data": {
    "bookings": [
      {
        "id": 1,
        "status": "pending",
        "topic": "Learn React Hooks",
        "description": "I want to understand useEffect and custom hooks",
        "category": "Technology & Data",
        "proposed_start_time": "2025-02-10T14:00:00.000Z",
        "proposed_end_time": "2025-02-10T15:00:00.000Z",
        "proposed_duration_minutes": 60,
        "is_from_availability": true,
        "counter_proposed_start_time": null,
        "counter_proposed_end_time": null,
        "counter_proposed_duration_minutes": null,
        "hourly_rate": 5000,
        "estimated_price": 5000,
        "final_price": null,
        "currency": "NGN",
        "student_note": "I prefer hands-on coding examples",
        "tutor_note": null,
        "session_id": null,
        "expires_at": "2025-02-08T14:00:00.000Z",
        "accepted_at": null,
        "student": {
          "id": 10,
          "name": "John Doe",
          "email": "john@example.com",
          "image": null
        },
        "created_at": "2025-02-06T14:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 20,
      "total_pages": 1
    }
  }
}
```

---

### 1.9 Get Booking Request Detail (Tutor)

```
GET /tutor/coaching/booking-requests/:id
```

---

### 1.10 Accept Booking Request (Tutor)

Accepts the student's proposed time. This sets the status to "accepted" and the student can then process payment.

```
POST /tutor/coaching/booking-requests/:id/accept
Content-Type: application/json
```

**Body (optional):**
```json
{
  "tutor_note": "Looking forward to it!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Booking request accepted. Payment will be processed and session will be created.",
  "data": {
    "booking_id": 1,
    "status": "accepted",
    "final_price": 5000,
    "currency": "NGN",
    "proposed_start_time": "2025-02-10T14:00:00.000Z",
    "proposed_end_time": "2025-02-10T15:00:00.000Z",
    "proposed_duration_minutes": 60
  }
}
```

**Conditions:**
- Only `pending` bookings can be accepted
- Expired requests are auto-marked as expired (410 error)
- Proposed time must still be in the future

---

### 1.11 Decline Booking Request (Tutor)

```
POST /tutor/coaching/booking-requests/:id/decline
Content-Type: application/json
```

**Body (optional):**
```json
{
  "tutor_note": "Sorry, I'm not available for that topic"
}
```

**Conditions:** Only `pending` or `counter_proposed` bookings can be declined.

---

### 1.12 Counter-Propose a Time (Tutor)

The tutor proposes a different time. The student must then accept or decline.

```
POST /tutor/coaching/booking-requests/:id/counter
Content-Type: application/json
```

**Body:**
```json
{
  "counter_start_time": "2025-02-10T16:00:00.000Z",
  "counter_end_time": "2025-02-10T17:30:00.000Z",
  "tutor_note": "I'm free later that day instead"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Counter-proposal sent to student. Awaiting their response.",
  "data": {
    "booking_id": 1,
    "status": "counter_proposed",
    "counter_proposed_start_time": "2025-02-10T16:00:00.000Z",
    "counter_proposed_end_time": "2025-02-10T17:30:00.000Z",
    "counter_proposed_duration_minutes": 90,
    "estimated_price": 7500,
    "currency": "NGN",
    "expires_at": "2025-02-08T16:00:00.000Z"
  }
}
```

**Notes:**
- Price is recalculated based on the new duration
- Student gets 48 hours to respond (expires_at is reset)
- Only `pending` bookings can receive a counter-proposal
- Duration is validated against tutor's min/max

---

### 1.13 Cancel Booked Session (Tutor)

Cancel an accepted booking that has been paid and has a session created.

```
POST /tutor/coaching/booking-requests/:id/cancel-session
```

**Rule:** Only allowed if session start time is more than 24 hours away.

**Response:**
```json
{
  "success": true,
  "message": "Session cancelled and student has been refunded",
  "data": {
    "booking_id": 1,
    "session_id": 15,
    "status": "cancelled",
    "cancelled_by": "tutor",
    "refunded": true,
    "refund_amount": 5000,
    "refund_currency": "NGN"
  }
}
```

---

## PART 2: STUDENT ENDPOINTS

### 2.1 Browse Coaching Tutors

Public endpoint (optional auth). Shows tutors who are accepting bookings with an hourly rate > 0.

```
GET /coaching/tutors?page=1&limit=20&search=javascript&min_price=1000&max_price=10000&category=Technology
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number (default 1) |
| `limit` | number | Items per page (default 20, max 100) |
| `search` | string | Search in tutor name and bio |
| `min_price` | number | Minimum hourly rate |
| `max_price` | number | Maximum hourly rate |
| `category` | string | Filter by specialization category |

**Response:**
```json
{
  "success": true,
  "data": {
    "tutors": [
      {
        "profile_id": 1,
        "tutor_id": 5,
        "tutor_type": "sole_tutor",
        "tutor_name": "Jane Smith",
        "tutor_slug": "jane-smith",
        "tutor_image": "https://...",
        "hourly_rate": 5000,
        "currency": "NGN",
        "bio": "Expert JavaScript tutor",
        "specializations": ["JavaScript", "React"],
        "min_duration_minutes": 30,
        "max_duration_minutes": 180,
        "timezone": "Africa/Lagos",
        "total_sessions_completed": 12,
        "average_rating": 4.5
      }
    ],
    "pagination": {
      "total": 15,
      "page": 1,
      "limit": 20,
      "total_pages": 1
    }
  }
}
```

---

### 2.2 Get Tutor Coaching Details + Availability

Public endpoint. Shows full profile and all availability windows.

```
GET /coaching/tutors/:tutorId?tutor_type=sole_tutor
```

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `tutor_type` | string | `sole_tutor` | `sole_tutor` or `organization` |

**Response:**
```json
{
  "success": true,
  "data": {
    "tutor": {
      "id": 5,
      "type": "sole_tutor",
      "name": "Jane Smith",
      "slug": "jane-smith",
      "image": "https://...",
      "bio": "Full-stack developer and educator"
    },
    "coaching": {
      "hourly_rate": 5000,
      "currency": "NGN",
      "coaching_bio": "Expert JavaScript tutor with hands-on approach",
      "specializations": ["JavaScript", "React", "Node.js"],
      "min_duration_minutes": 30,
      "max_duration_minutes": 180,
      "timezone": "Africa/Lagos",
      "total_sessions_completed": 12,
      "average_rating": 4.5
    },
    "availability": {
      "recurring": [
        {
          "id": 1,
          "day_of_week": 1,
          "start_time": "09:00:00",
          "end_time": "13:00:00",
          "timezone": "Africa/Lagos"
        },
        {
          "id": 2,
          "day_of_week": 3,
          "start_time": "14:00:00",
          "end_time": "18:00:00",
          "timezone": "Africa/Lagos"
        }
      ],
      "specific_dates": [
        {
          "id": 3,
          "date": "2025-02-15",
          "start_time": "10:00:00",
          "end_time": "16:00:00",
          "timezone": "Africa/Lagos"
        }
      ]
    }
  }
}
```

> **Frontend UI tip:** Use `recurring` to render a weekly calendar. Use `specific_dates` to highlight special availability. Let the student click a time slot to pre-fill the booking form.

---

### 2.3 Submit Booking Request

Requires student authentication.

```
POST /coaching/booking-request
Content-Type: application/json
Authorization: Bearer <student_token>
```

**Body:**
```json
{
  "tutor_id": 5,
  "tutor_type": "sole_tutor",
  "topic": "Learn React Hooks",
  "description": "I want to understand useEffect and custom hooks",
  "category": "Technology & Data",
  "proposed_start_time": "2025-02-10T14:00:00.000Z",
  "proposed_end_time": "2025-02-10T15:00:00.000Z",
  "duration_minutes": 60,
  "student_note": "I prefer hands-on coding examples"
}
```

**Required fields:** `tutor_id`, `topic`, `proposed_start_time`, `proposed_end_time`

**Optional fields:** `tutor_type` (default "sole_tutor"), `description`, `category`, `duration_minutes`, `student_note`

**Validation:**
- Proposed time must be in the future
- Duration must be within tutor's min/max limits
- Cannot have multiple active requests with the same tutor (409)

**Categories:** `"Business & Management"`, `"Technology & Data"`, `"Engineering & Physical Science"`, `"Health & Medicine"`, `"Arts & Humanities"`, `"Personal Development & Education"`

**Response (201):**
```json
{
  "success": true,
  "message": "Booking request submitted from tutor's available slot. Awaiting tutor confirmation.",
  "data": {
    "booking": {
      "id": 1,
      "status": "pending",
      "topic": "Learn React Hooks",
      "proposed_start_time": "2025-02-10T14:00:00.000Z",
      "proposed_end_time": "2025-02-10T15:00:00.000Z",
      "proposed_duration_minutes": 60,
      "is_from_availability": true,
      "hourly_rate": 5000,
      "estimated_price": 5000,
      "currency": "NGN",
      "expires_at": "2025-02-08T14:00:00.000Z"
    }
  }
}
```

> **`is_from_availability`**: `true` means the student's proposed time falls within one of the tutor's availability windows. `false` means it's a custom time proposal (the tutor is more likely to counter-propose).

---

### 2.4 Get My Booking Requests

```
GET /coaching/my-booking-requests?status=pending&page=1&limit=20
Authorization: Bearer <student_token>
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by status |
| `page` | number | Page number |
| `limit` | number | Items per page |

**Response:** Same structure as tutor's booking list, but with `tutor` object instead of `student`.

---

### 2.5 Cancel Booking Request (Before Payment)

Cancel a request that is still in negotiation (no payment has been made).

```
POST /coaching/booking-request/:id/cancel
Authorization: Bearer <student_token>
```

**Conditions:** Only `pending` or `counter_proposed` requests can be cancelled.

---

### 2.6 Accept Counter-Proposal

When the tutor counter-proposes a different time, the student can accept it.

```
POST /coaching/booking-request/:id/accept-counter
Authorization: Bearer <student_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Counter-proposal accepted. Payment will be processed and session will be created.",
  "data": {
    "booking_id": 1,
    "status": "accepted",
    "final_price": 7500,
    "currency": "NGN",
    "start_time": "2025-02-10T16:00:00.000Z",
    "end_time": "2025-02-10T17:30:00.000Z",
    "duration_minutes": 90
  }
}
```

---

### 2.7 Decline Counter-Proposal

```
POST /coaching/booking-request/:id/decline-counter
Content-Type: application/json
Authorization: Bearer <student_token>
```

**Body (optional):**
```json
{
  "student_note": "That time doesn't work for me"
}
```

---

### 2.8 Payment Preview

After a booking is accepted (by either party), the student should preview the payment before confirming.

```
GET /coaching/booking/:id/payment-preview
Authorization: Bearer <student_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "booking_id": 1,
    "topic": "Learn React Hooks",
    "agreed_start_time": "2025-02-10T14:00:00.000Z",
    "agreed_end_time": "2025-02-10T15:00:00.000Z",
    "agreed_duration_minutes": 60,
    "price": 5000,
    "price_currency": "NGN",
    "price_in_your_currency": 5000,
    "your_currency": "NGN",
    "platform_fee": 750,
    "wallet_balance": 15000,
    "can_afford": true,
    "shortfall": 0
  }
}
```

> **Frontend UI tip:** Show a confirmation screen with these details. If `can_afford` is `false`, show the `shortfall` and prompt the student to fund their wallet.

---

### 2.9 Process Payment (Create Session)

This is the final step. Debits the wallet, creates the coaching session, and sets up the Stream.io video call.

```
POST /coaching/booking/:id/process-payment
Authorization: Bearer <student_token>
```

**Response (201):**
```json
{
  "success": true,
  "message": "Payment processed and coaching session created successfully",
  "data": {
    "booking_id": 1,
    "session_id": 15,
    "stream_call_id": "coaching_5_abc123-def456",
    "view_link": "https://app.knomada.co/coaching/session/coaching_5_abc123-def456",
    "price_paid": 5000,
    "currency": "NGN",
    "transaction_ref": "COACHING-BOOKING-1-1707580000000",
    "new_wallet_balance": 10000,
    "session": {
      "id": 15,
      "title": "One-on-One: Learn React Hooks",
      "start_time": "2025-02-10T14:00:00.000Z",
      "end_time": "2025-02-10T15:00:00.000Z",
      "duration_minutes": 60,
      "status": "scheduled"
    }
  }
}
```

> After this, the session works exactly like existing coaching sessions. Use the existing `POST /coaching/sessions/:id/join-token` and `POST /tutor/coaching/sessions/:id/token` to join the video call.

---

### 2.10 Cancel Booked Session (Student)

Cancel a paid/booked session. Full refund to wallet.

```
POST /coaching/booking/:id/cancel-session
Authorization: Bearer <student_token>
```

**Rule:** Only allowed if session start time is more than 24 hours away.

**Response:**
```json
{
  "success": true,
  "message": "Session cancelled and full refund processed to your wallet",
  "data": {
    "booking_id": 1,
    "session_id": 15,
    "status": "cancelled",
    "cancelled_by": "student",
    "refunded": true,
    "refund_amount": 5000,
    "refund_currency": "NGN"
  }
}
```

---

## Booking Status Flow

```
                                    ┌─────────────┐
                                    │   pending    │ ← Student submits request
                                    └──────┬──────┘
                                           │
                          ┌────────────────┼────────────────┐
                          │                │                │
                    Tutor ACCEPTS    Tutor COUNTERS   Tutor DECLINES
                          │                │                │
                          ▼                ▼                ▼
                   ┌─────────────┐  ┌──────────────┐  ┌──────────┐
                   │  accepted   │  │counter_proposed│  │ declined │
                   └──────┬──────┘  └──────┬───────┘  └──────────┘
                          │                │
                          │    ┌───────────┼───────────┐
                          │    │           │           │
                          │  Student    Student    48h passes
                          │  ACCEPTS    DECLINES       │
                          │    │           │           ▼
                          │    ▼           ▼      ┌─────────┐
                          │ ┌──────────┐ ┌──────┐ │ expired │
                          │ │ accepted │ │declined│ └─────────┘
                          │ └────┬─────┘ └──────┘
                          │      │
                          └──────┤
                                 │
                    Student calls /process-payment
                                 │
                                 ▼
                          ┌─────────────┐
                          │   SESSION    │ ← CoachingSession created
                          │  CREATED     │   Stream.io call ready
                          └──────┬──────┘
                                 │
                    ┌────────────┼────────────┐
                    │                         │
              >24h before              <24h before
              Either party              LOCKED
              can CANCEL                No cancellation
                    │
                    ▼
             ┌─────────────┐
             │  cancelled   │ ← Full refund to student
             └─────────────┘
```

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "message": "Error description here"
}
```

### Common Error Codes

| Code | Meaning |
|------|---------|
| 400 | Bad request (validation error, invalid state transition) |
| 401 | Not authenticated |
| 403 | Not authorized (tutor not accepting bookings, wrong user type) |
| 404 | Resource not found |
| 409 | Conflict (duplicate booking request, overlapping availability) |
| 410 | Gone (booking request expired) |

---

## Frontend UI Recommendations

### Tutor Dashboard
1. **Profile Setup Page**: Form for hourly rate, bio, specializations, duration limits, timezone
2. **Availability Calendar**: Visual weekly calendar to set recurring slots + date picker for specific dates
3. **Booking Requests Tab**: List with status badges (pending = yellow, accepted = green, declined = red, counter_proposed = blue). Show student name, topic, proposed time, and action buttons.

### Student Booking Flow
1. **Tutor Listing Page**: Cards with tutor photo, name, hourly rate, rating, specializations. Search + price filter.
2. **Tutor Detail Page**: Full profile + availability calendar. Student clicks a time slot or "Propose Custom Time" button.
3. **Booking Form**: Pre-filled from selected slot. Fields: topic (required), description, category, note. Shows calculated price.
4. **My Bookings Page**: List with status badges. Actions vary by status:
   - `pending`: Cancel button
   - `counter_proposed`: Show counter time, Accept/Decline buttons
   - `accepted`: Show "Pay Now" button → payment preview → confirm
5. **Payment Confirmation**: Show price, wallet balance, session details. "Confirm & Pay" button.
6. **Post-Payment**: Show session details with "Join Session" button (activates when tutor starts).

### Notifications (Suggested)
- Student submits request → Notify tutor
- Tutor accepts/declines/counters → Notify student
- Student accepts/declines counter → Notify tutor
- Session reminder (1 hour before) → Notify both
- Cancellation → Notify other party

---

## Price Calculation

```
price = hourly_rate × (duration_minutes / 60)

Example:
  hourly_rate = 5000 NGN
  duration = 90 minutes
  price = 5000 × (90/60) = 7500 NGN

Payment split:
  platform_commission = price × 15% = 1125 NGN
  tutor_earnings = price - commission = 6375 NGN
```

Currency conversion (if tutor and student currencies differ) uses the platform exchange rate from GeneralSetup.

---

## Integration with Existing Features

- **Video Calls**: After payment, use existing `POST /tutor/coaching/sessions/:id/token` (tutor) and `POST /coaching/sessions/:id/join-token` (student) to get Stream.io tokens.
- **Messaging**: One-on-one sessions support messaging via existing `GET /coaching/sessions/:sessionId/messages` and `PUT /coaching/sessions/:sessionId/messages/read`.
- **Wallet**: Students must have sufficient wallet balance. Use existing wallet funding endpoints if balance is low.
- **Coaching Hours**: Tutor hours are automatically deducted when the session is created and refunded on cancellation (or skipped for unlimited subscription tiers).
