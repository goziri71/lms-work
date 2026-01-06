# Coaching System - Pricing & Course-like Features Update

## Overview

The coaching system has been enhanced to support **paid and free sessions** with course-like metadata. Students can now purchase access to paid coaching sessions, while tutors can add categories, images, and tags to make sessions more discoverable.

**Key Changes:**
- ✅ Sessions can be **free** or **paid**
- ✅ Students must **purchase access** before joining paid sessions
- ✅ Added **course-like fields**: category, image_url, tags
- ✅ **Separate commission rate** for coaching sessions (different from courses)
- ✅ **Public browsing** with optional authentication
- ✅ **Revenue sharing** for paid sessions

---

## Table of Contents

1. [Database Changes](#database-changes)
2. [New Fields](#new-fields)
3. [API Endpoints](#api-endpoints)
4. [Pricing Model](#pricing-model)
5. [Access Control](#access-control)
6. [Revenue Sharing](#revenue-sharing)
7. [Migration Guide](#migration-guide)
8. [Examples](#examples)

---

## Database Changes

### New Migration Required

Run the new migration script to add pricing and course-like fields:

```bash
node scripts/migrate-add-coaching-pricing-fields.js
```

This migration:
1. Adds `pricing_type`, `price`, `currency` to `coaching_sessions`
2. Adds `category`, `image_url`, `tags` to `coaching_sessions`
3. Adds `commission_rate` to `coaching_sessions` (separate from course commission)
4. Creates `coaching_session_purchases` table

### New Table: `coaching_session_purchases`

Tracks student purchases of paid coaching sessions:

- `session_id` - FK to coaching_sessions
- `student_id` - FK to students
- `price_paid` - Amount paid by student
- `currency` - Payment currency
- `commission_rate` - WPU commission rate applied
- `wsp_commission` - WPU commission amount
- `tutor_earnings` - Tutor earnings after commission
- `transaction_ref` - Transaction reference
- `payment_method` - Payment method (wallet)
- `purchased_at` - Purchase timestamp

---

## New Fields

### Coaching Session Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pricing_type` | ENUM('free', 'paid') | Yes | Session pricing type |
| `price` | DECIMAL(10,2) | If paid | Price for paid sessions |
| `currency` | VARCHAR(10) | If paid | Currency (default: NGN) |
| `category` | ENUM | No | Session category (Business, Tech, Art, etc.) |
| `image_url` | TEXT | No | Session cover image URL |
| `tags` | JSONB | No | Session tags (array) |
| `commission_rate` | DECIMAL(5,2) | No | WPU commission rate (default: 15%) |

### Valid Categories

- Business
- Tech
- Art
- Logistics
- Ebooks
- Podcast
- Videos
- Music
- Articles
- Code
- 2D/3D Files

---

## API Endpoints

### Tutor Endpoints (Updated)

#### Create Session (Updated)

**Endpoint:** `POST /api/marketplace/tutor/coaching/sessions`

**New Request Body Fields:**
```json
{
  "title": "JavaScript Fundamentals Review",
  "description": "Review of core JavaScript concepts",
  "start_time": "2024-01-20T14:00:00.000Z",
  "end_time": "2024-01-20T15:00:00.000Z",
  "student_ids": [1, 2, 3],
  
  // NEW FIELDS:
  "pricing_type": "paid",  // or "free"
  "price": 50.0,           // Required if pricing_type is "paid"
  "currency": "NGN",       // Optional, default: "NGN"
  "category": "Tech",      // Optional
  "image_url": "https://...", // Optional
  "tags": ["javascript", "fundamentals", "review"], // Optional (array or JSON string)
  "commission_rate": 15.0  // Optional, default: 15.0
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Coaching session created successfully",
  "data": {
    "id": 5,
    "title": "JavaScript Fundamentals Review",
    "description": "Review of core JavaScript concepts",
    "start_time": "2024-01-20T14:00:00.000Z",
    "end_time": "2024-01-20T15:00:00.000Z",
    "duration_minutes": 60,
    "pricing_type": "paid",
    "price": 50.0,
    "currency": "NGN",
    "category": "Tech",
    "image_url": "https://...",
    "tags": ["javascript", "fundamentals", "review"],
    "commission_rate": 15.0,
    "stream_call_id": "coaching_5_abc123",
    "view_link": "https://app.stream.io/coaching/session/coaching_5_abc123",
    "status": "scheduled",
    "hours_reserved": 1.0,
    "student_count": 3
  }
}
```

**Validation Rules:**
- If `pricing_type = "paid"`, `price` is required and must be > 0
- If `pricing_type = "free"`, `price` is ignored (set to null)
- `category` must be one of the valid categories
- `tags` can be array or JSON string
- `commission_rate` must be between 0 and 100

---

### Student Endpoints (New)

#### Browse Coaching Sessions

**Endpoint:** `GET /api/marketplace/coaching/sessions`

**Authentication:** Optional (public can browse, authenticated students see purchase status)

**Query Parameters:**
- `category` (optional) - Filter by category
- `pricing_type` (optional) - Filter by pricing type (free/paid)
- `search` (optional) - Search in title/description
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 20) - Items per page

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": 5,
        "title": "JavaScript Fundamentals Review",
        "description": "Review of core JavaScript concepts",
        "start_time": "2024-01-20T14:00:00.000Z",
        "end_time": "2024-01-20T15:00:00.000Z",
        "duration_minutes": 60,
        "pricing_type": "paid",
        "price": 50.0,
        "currency": "NGN",
        "category": "Tech",
        "image_url": "https://...",
        "tags": ["javascript", "fundamentals"],
        "tutor": {
          "id": 10,
          "name": "John Doe",
          "type": "sole_tutor"
        },
        "purchased": false,  // true if student has purchased (only if authenticated)
        "status": "scheduled"
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "pages": 1
    }
  }
}
```

---

#### Get Session Details

**Endpoint:** `GET /api/marketplace/coaching/sessions/:id`

**Authentication:** Optional (public can view, authenticated students see purchase status)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 5,
    "title": "JavaScript Fundamentals Review",
    "description": "Review of core JavaScript concepts",
    "start_time": "2024-01-20T14:00:00.000Z",
    "end_time": "2024-01-20T15:00:00.000Z",
    "duration_minutes": 60,
    "pricing_type": "paid",
    "price": 50.0,
    "currency": "NGN",
    "category": "Tech",
    "image_url": "https://...",
    "tags": ["javascript", "fundamentals"],
    "status": "scheduled",
    "tutor": {
      "id": 10,
      "name": "John Doe",
      "email": "john@example.com",
      "profile_image": "https://...",
      "bio": "Experienced JavaScript developer",
      "type": "sole_tutor"
    },
    "has_purchased": false,  // true if student has purchased (only if authenticated)
    "can_join": false        // true if free session or purchased
  }
}
```

---

#### Purchase Session Access

**Endpoint:** `POST /api/marketplace/coaching/sessions/:id/purchase`

**Authentication:** Student only

**Request Body:** (empty - session ID is in URL)

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Coaching session access purchased successfully",
  "data": {
    "purchase_id": 10,
    "session_id": 5,
    "price_paid": 50.0,
    "currency": "NGN",
    "transaction_ref": "COACHING-SESSION-5-1705312800000",
    "new_wallet_balance": 450.0
  }
}
```

**Error Responses:**

**Session Not Paid (400):**
```json
{
  "success": false,
  "message": "This session is free. No purchase required."
}
```

**Already Purchased (400):**
```json
{
  "success": false,
  "message": "You have already purchased access to this session"
}
```

**Insufficient Balance (400):**
```json
{
  "success": false,
  "message": "Insufficient wallet balance. Required: 50.0 NGN, Available: 30.0 NGN. Please fund your wallet first."
}
```

**Session Not Available (400):**
```json
{
  "success": false,
  "message": "This session is no longer available"
}
```

---

#### Get Join Token (Student)

**Endpoint:** `POST /api/marketplace/coaching/sessions/:id/join-token`

**Authentication:** Student only

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "apiKey": "your-stream-api-key",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "streamCallId": "coaching_5_abc123",
    "userId": "123",
    "role": "participant"
  }
}
```

**Error Responses:**

**Not Purchased (403) - Paid Session:**
```json
{
  "success": false,
  "message": "You must purchase access to join this paid session. Please purchase access first."
}
```

**Not Invited (403) - Free Session:**
```json
{
  "success": false,
  "message": "You are not invited to this session"
}
```

---

#### Get My Purchased Sessions

**Endpoint:** `GET /api/marketplace/coaching/my-sessions`

**Authentication:** Student only

**Query Parameters:**
- `status` (optional) - Filter by session status
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 20) - Items per page

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "purchase_id": 10,
        "session": {
          "id": 5,
          "title": "JavaScript Fundamentals Review",
          "description": "Review of core JavaScript concepts",
          "start_time": "2024-01-20T14:00:00.000Z",
          "end_time": "2024-01-20T15:00:00.000Z",
          "duration_minutes": 60,
          "status": "scheduled",
          "stream_call_id": "coaching_5_abc123",
          "view_link": "https://app.stream.io/coaching/session/coaching_5_abc123",
          "tutor": {
            "id": 10,
            "name": "John Doe",
            "type": "sole_tutor"
          }
        },
        "price_paid": 50.0,
        "currency": "NGN",
        "purchased_at": "2024-01-15T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "pages": 1
    }
  }
}
```

---

## Pricing Model

### Free Sessions
- **Student Access:** Free (tutor invites students)
- **Tutor Cost:** Tutor pays for hours used
- **Revenue:** No revenue (tutor covers cost)

### Paid Sessions
- **Student Access:** Students must purchase access
- **Tutor Cost:** Tutor still pays for hours used
- **Revenue:** 
  - Student pays session price
  - WPU takes commission (default 15%, can be set per session)
  - Tutor receives earnings (price - commission)
  - Tutor still pays for hours separately

### Example Flow

**Paid Session:**
1. Tutor creates session with `pricing_type: "paid"`, `price: 50.0`
2. Tutor pays for hours (e.g., 1 hour = 10 NGN)
3. Student purchases access (50 NGN)
4. Revenue split:
   - WPU commission: 7.5 NGN (15%)
   - Tutor earnings: 42.5 NGN
5. Tutor's net: 42.5 NGN - 10 NGN (hours) = 32.5 NGN profit

**Free Session:**
1. Tutor creates session with `pricing_type: "free"`
2. Tutor pays for hours (e.g., 1 hour = 10 NGN)
3. Students join for free
4. No revenue, tutor covers all costs

---

## Access Control

### Paid Sessions
- ✅ **Only purchased students can join**
- ✅ Purchase required before getting join token
- ✅ Access checked when requesting join token
- ✅ Students automatically added as participants upon purchase

### Free Sessions
- ✅ **Invited students can join**
- ✅ No purchase required
- ✅ Tutor invites students (via `student_ids` or invite endpoint)
- ✅ Access checked via participant list

### Tutor Access
- ✅ **Tutor always has access** (host role)
- ✅ Can join regardless of pricing type
- ✅ Uses tutor join token endpoint

---

## Revenue Sharing

### Commission Rate

- **Separate from course commission**: Coaching sessions have their own commission rate
- **Per-session setting**: Each session can have a different commission rate
- **Default**: 15% if not specified
- **Range**: 0-100%

### Revenue Distribution

When a student purchases a paid session:

1. **Student Payment**: Deducted from student wallet
2. **WPU Commission**: Calculated as `(price * commission_rate) / 100`
3. **Tutor Earnings**: `price - wsp_commission`
4. **Records Created**:
   - `coaching_session_purchases` record
   - `wsp_commissions` record
   - Tutor's `total_earnings` updated

### Example Calculation

**Session Price:** 100 NGN  
**Commission Rate:** 15%

- WPU Commission: 15 NGN
- Tutor Earnings: 85 NGN
- Tutor still pays for hours separately (e.g., 10 NGN)
- Tutor Net Profit: 85 - 10 = 75 NGN

---

## Migration Guide

### Step 1: Run Migration

```bash
node scripts/migrate-add-coaching-pricing-fields.js
```

This will:
- Add pricing fields to existing `coaching_sessions` table
- Add course-like fields (category, image_url, tags)
- Create `coaching_session_purchases` table
- Add `commission_rate` field

### Step 2: Update Existing Sessions (Optional)

If you have existing sessions, you may want to set default values:

```sql
-- Set all existing sessions to free (if not already set)
UPDATE coaching_sessions 
SET pricing_type = 'free' 
WHERE pricing_type IS NULL;

-- Set default commission rate (if not set)
UPDATE coaching_sessions 
SET commission_rate = 15.0 
WHERE commission_rate IS NULL;
```

### Step 3: Test Endpoints

1. Create a paid session
2. Browse sessions (public)
3. Purchase access (student)
4. Get join token (student)
5. Verify revenue sharing

---

## Examples

### Example 1: Create Free Session

```json
POST /api/marketplace/tutor/coaching/sessions
{
  "title": "Free JavaScript Q&A",
  "description": "Ask me anything about JavaScript",
  "start_time": "2024-01-20T14:00:00.000Z",
  "end_time": "2024-01-20T15:00:00.000Z",
  "student_ids": [1, 2, 3],
  "pricing_type": "free",
  "category": "Tech",
  "tags": ["javascript", "qna"]
}
```

**Result:**
- Students can join for free
- Tutor pays for hours
- No revenue generated

---

### Example 2: Create Paid Session

```json
POST /api/marketplace/tutor/coaching/sessions
{
  "title": "Advanced React Patterns",
  "description": "Learn advanced React patterns and best practices",
  "start_time": "2024-01-25T10:00:00.000Z",
  "end_time": "2024-01-25T12:00:00.000Z",
  "pricing_type": "paid",
  "price": 100.0,
  "currency": "NGN",
  "category": "Tech",
  "image_url": "https://example.com/react-patterns.jpg",
  "tags": ["react", "patterns", "advanced"],
  "commission_rate": 20.0
}
```

**Result:**
- Students must purchase access (100 NGN)
- WPU gets 20 NGN commission (20%)
- Tutor gets 80 NGN earnings
- Tutor still pays for 2 hours (20 NGN)
- Tutor net: 60 NGN profit

---

### Example 3: Student Purchase Flow

```bash
# 1. Browse sessions
GET /api/marketplace/coaching/sessions?category=Tech&pricing_type=paid

# 2. View session details
GET /api/marketplace/coaching/sessions/5

# 3. Purchase access
POST /api/marketplace/coaching/sessions/5/purchase

# 4. Get join token
POST /api/marketplace/coaching/sessions/5/join-token

# 5. Join session (use token with Stream.io SDK)
```

---

## Important Notes

### 1. Tutor Always Pays for Hours
- **Regardless of pricing type**, tutors pay for hours used
- Hours are deducted at session creation
- Refunded if session is cancelled or ends early

### 2. Commission Rate
- **Separate from course commission**: Coaching sessions use their own rate
- **Per-session**: Each session can have different commission
- **Default**: 15% if not specified
- **Admin can update**: Via tutor commission endpoints (affects future sessions)

### 3. Access Control
- **Paid sessions**: Purchase required
- **Free sessions**: Invitation required
- **Tutor**: Always has access (host)

### 4. Public Browsing
- **Anyone can browse**: No authentication required
- **Purchase status**: Only shown to authenticated students
- **Purchase required**: For joining paid sessions

### 5. Currency Conversion
- **Automatic conversion**: If session currency ≠ student currency
- **Exchange rate**: From system settings
- **Payment**: Always in student's currency

---

## Frontend Integration

### Creating a Session

```javascript
const createSession = async (sessionData) => {
  const response = await fetch('/api/marketplace/tutor/coaching/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tutorToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: sessionData.title,
      description: sessionData.description,
      start_time: sessionData.startTime,
      end_time: sessionData.endTime,
      student_ids: sessionData.studentIds,
      pricing_type: sessionData.pricingType, // 'free' or 'paid'
      price: sessionData.pricingType === 'paid' ? sessionData.price : undefined,
      currency: sessionData.currency || 'NGN',
      category: sessionData.category,
      image_url: sessionData.imageUrl,
      tags: sessionData.tags, // Array or JSON string
      commission_rate: sessionData.commissionRate
    })
  });
  return response.json();
};
```

### Browsing Sessions

```javascript
const browseSessions = async (filters = {}) => {
  const params = new URLSearchParams({
    page: filters.page || 1,
    limit: filters.limit || 20,
    ...(filters.category && { category: filters.category }),
    ...(filters.pricing_type && { pricing_type: filters.pricing_type }),
    ...(filters.search && { search: filters.search })
  });

  const response = await fetch(`/api/marketplace/coaching/sessions?${params}`);
  return response.json();
};
```

### Purchasing Access

```javascript
const purchaseSession = async (sessionId) => {
  const response = await fetch(`/api/marketplace/coaching/sessions/${sessionId}/purchase`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${studentToken}`,
      'Content-Type': 'application/json'
    }
  });
  return response.json();
};
```

### Joining Session

```javascript
const joinSession = async (sessionId) => {
  // 1. Get join token
  const tokenResponse = await fetch(`/api/marketplace/coaching/sessions/${sessionId}/join-token`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${studentToken}`
    }
  });
  
  const { data } = await tokenResponse.json();
  
  // 2. Use token with Stream.io SDK
  const call = streamClient.video.call('default', data.streamCallId);
  await call.join({ token: data.token });
  
  return call;
};
```

---

## Error Handling

### Common Errors

**Session Not Paid:**
```json
{
  "success": false,
  "message": "This session is free. No purchase required."
}
```
**Action:** Use invite endpoint instead of purchase

**Already Purchased:**
```json
{
  "success": false,
  "message": "You have already purchased access to this session"
}
```
**Action:** Proceed directly to join token

**Insufficient Balance:**
```json
{
  "success": false,
  "message": "Insufficient wallet balance. Required: 50.0 NGN, Available: 30.0 NGN. Please fund your wallet first."
}
```
**Action:** Prompt user to fund wallet

**Not Purchased (Paid Session):**
```json
{
  "success": false,
  "message": "You must purchase access to join this paid session. Please purchase access first."
}
```
**Action:** Redirect to purchase page

**Not Invited (Free Session):**
```json
{
  "success": false,
  "message": "You are not invited to this session"
}
```
**Action:** Show message that invitation is required

---

## Summary of Changes

### ✅ What's New

1. **Pricing Support**
   - Sessions can be free or paid
   - Students purchase access to paid sessions
   - Tutor always pays for hours (regardless of pricing)

2. **Course-like Fields**
   - Category (Business, Tech, Art, etc.)
   - Image URL (cover image)
   - Tags (for searchability)

3. **Separate Commission**
   - Coaching sessions have their own commission rate
   - Different from course commission
   - Can be set per session

4. **Student Endpoints**
   - Browse sessions (public)
   - View session details (public)
   - Purchase access (student only)
   - Get join token (student only)
   - View purchased sessions (student only)

5. **Revenue Sharing**
   - Automatic revenue distribution
   - WPU commission tracking
   - Tutor earnings tracking

### ✅ What Stayed the Same

- Tutor hours purchase (still direct payment, no commission)
- Subscription system (unchanged)
- Session creation flow (same, just with new fields)
- Time tracking (unchanged)
- Auto-end and warnings (unchanged)

---

## Testing Checklist

- [ ] Run migration script
- [ ] Create free session
- [ ] Create paid session
- [ ] Browse sessions (public)
- [ ] Browse sessions (authenticated student)
- [ ] Purchase paid session access
- [ ] Try to purchase already purchased session (should fail)
- [ ] Try to join paid session without purchase (should fail)
- [ ] Join paid session after purchase (should work)
- [ ] Join free session when invited (should work)
- [ ] Verify revenue sharing (check wsp_commissions table)
- [ ] Verify tutor earnings updated
- [ ] Test category filtering
- [ ] Test search functionality
- [ ] Test pagination

---

**Last Updated:** January 2024  
**Version:** 2.0.0

