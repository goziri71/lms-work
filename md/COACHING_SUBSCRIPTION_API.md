# Coaching & Subscription System - API Documentation

## Overview

This document describes the new **Coaching Service** and **Subscription System** for tutors. This system allows tutors to:
- Subscribe to different tiers with varying limits
- Purchase coaching hours (pay-as-you-go)
- Create and manage coaching sessions for their students
- Use unlimited coaching (for Expert/Grand Master tiers)

**Base URL:** `/api/marketplace/tutor`

**Authentication:** All tutor endpoints require authentication using the `tutorAuthorize` middleware. Include the JWT token in the Authorization header:

```
Authorization: Bearer <access_token>
```

**Important:** 
- ✅ **NO EXISTING ENDPOINTS WERE AFFECTED** - All new functionality is additive
- ✅ All existing endpoints continue to work exactly as before
- ✅ This is a completely new feature set

---

## Table of Contents

1. [Subscription Management](#subscription-management)
2. [Coaching Hours Management](#coaching-hours-management)
3. [Coaching Sessions Management](#coaching-sessions-management)
4. [Admin Coaching Settings](#admin-coaching-settings)
5. [Subscription Tiers](#subscription-tiers)
6. [How It Works](#how-it-works)
7. [Background Jobs](#background-jobs)
8. [Database Migration](#database-migration)

---

## Subscription Management

### Get Current Subscription

Get the tutor's current subscription tier and limits.

**Endpoint:** `GET /api/marketplace/tutor/subscription`

**Headers:**
```
Authorization: Bearer <tutor_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "subscription_tier": "professional",
    "tier_name": "Professional",
    "status": "active",
    "start_date": "2024-01-15T00:00:00.000Z",
    "end_date": "2024-02-15T00:00:00.000Z",
    "auto_renew": true,
    "courses_limit": 25,
    "communities_limit": 1,
    "digital_downloads_limit": 10,
    "memberships_limit": 0,
    "unlimited_coaching": false,
    "commission_rate": 10.0,
    "name": "Professional",
    "price": 99
  }
}
```

**Notes:**
- If no subscription exists, returns default "free" tier
- `unlimited_coaching: true` means tutor doesn't need to purchase hours

---

### Subscribe to a Tier

Subscribe or upgrade to a subscription tier.

**Endpoint:** `POST /api/marketplace/tutor/subscription`

**Headers:**
```
Authorization: Bearer <tutor_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "subscription_tier": "professional"
}
```

**Valid Tiers:**
- `free` - Free tier (default)
- `basic` - Basic tier ($39/month)
- `professional` - Professional tier ($99/month)
- `expert` - Expert tier ($249/month)
- `grand_master` - Grand Master tier ($499/month)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Subscription updated successfully",
  "data": {
    "id": 1,
    "tutor_id": 5,
    "tutor_type": "sole_tutor",
    "subscription_tier": "professional",
    "status": "active",
    "start_date": "2024-01-15T00:00:00.000Z",
    "end_date": "2024-02-15T00:00:00.000Z",
    "auto_renew": true,
    "courses_limit": 25,
    "communities_limit": 1,
    "digital_downloads_limit": 10,
    "memberships_limit": 0,
    "unlimited_coaching": false,
    "commission_rate": 10.0
  }
}
```

**Notes:**
- If subscription exists, it will be updated
- Monthly subscriptions set `end_date` to 30 days from now
- Free tier has no `end_date`

---

### Get Subscription Limits and Usage

Get current usage vs limits for all resources.

**Endpoint:** `GET /api/marketplace/tutor/subscription/limits`

**Headers:**
```
Authorization: Bearer <tutor_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "courses": {
      "limit": 25,
      "used": 10,
      "remaining": 15,
      "unlimited": false
    },
    "digital_downloads": {
      "limit": 10,
      "used": 3,
      "remaining": 7,
      "unlimited": false
    },
    "communities": {
      "limit": 1,
      "used": 0,
      "remaining": 1,
      "unlimited": false
    },
    "memberships": {
      "limit": 0,
      "used": 0,
      "remaining": 0,
      "unlimited": false
    },
    "coaching": {
      "unlimited": false
    }
  }
}
```

**Notes:**
- `unlimited: true` means no limit (null in database)
- `remaining: null` means unlimited
- Communities and memberships counts will be implemented later

---

## Coaching Hours Management

### Get Coaching Hours Balance

Get the tutor's current coaching hours balance.

**Endpoint:** `GET /api/marketplace/tutor/coaching/hours-balance`

**Headers:**
```
Authorization: Bearer <tutor_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "hours_balance": 5.5,
    "unlimited": false,
    "total_purchased": 10.0,
    "total_used": 4.5,
    "last_updated": "2024-01-15T10:30:00.000Z"
  }
}
```

**Response for Unlimited Coaching:**
```json
{
  "success": true,
  "data": {
    "hours_balance": null,
    "unlimited": true,
    "total_purchased": 0,
    "total_used": 0
  }
}
```

**Notes:**
- `unlimited: true` means tutor has Expert or Grand Master subscription
- Hours are deducted at session start
- Hours are refunded if session is cancelled or ends early

---

### Purchase Coaching Hours

Purchase coaching hours (pay-as-you-go).

**Endpoint:** `POST /api/marketplace/tutor/coaching/purchase-hours`

**Headers:**
```
Authorization: Bearer <tutor_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "hours": 5.5
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Coaching hours purchased successfully",
  "data": {
    "purchase_id": 10,
    "hours_purchased": 5.5,
    "price_per_hour": 10.0,
    "total_amount": 55.0,
    "new_hours_balance": 11.0,
    "new_wallet_balance": 445.0,
    "transaction_ref": "COACHING-HOURS-5-1705312800000",
    "currency": "NGN"
  }
}
```

**Error Responses:**

**Insufficient Wallet Balance (400):**
```json
{
  "success": false,
  "message": "Insufficient wallet balance. Required: 55.0 NGN, Available: 30.0 NGN"
}
```

**Unlimited Coaching (400):**
```json
{
  "success": false,
  "message": "You have unlimited coaching hours. No purchase needed."
}
```

**Notes:**
- Hours can be purchased in any amount (e.g., 1.5, 2, 5, 10)
- Payment is deducted from tutor's wallet
- Price per hour is set by WPU admin
- Expert and Grand Master tiers have unlimited coaching (cannot purchase)

---

### Get Purchase History

Get history of coaching hours purchases.

**Endpoint:** `GET /api/marketplace/tutor/coaching/purchase-history`

**Headers:**
```
Authorization: Bearer <tutor_token>
```

**Query Parameters:**
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 20) - Items per page

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "purchases": [
      {
        "id": 10,
        "hours_purchased": 5.5,
        "price_per_hour": 10.0,
        "total_amount": 55.0,
        "currency": "NGN",
        "transaction_ref": "COACHING-HOURS-5-1705312800000",
        "status": "completed",
        "purchased_at": "2024-01-15T10:30:00.000Z"
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

## Coaching Sessions Management

### Create Coaching Session

Create a new coaching session and invite students.

**Endpoint:** `POST /api/marketplace/tutor/coaching/sessions`

**Headers:**
```
Authorization: Bearer <tutor_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "JavaScript Fundamentals Review",
  "description": "Review of core JavaScript concepts",
  "start_time": "2024-01-20T14:00:00.000Z",
  "end_time": "2024-01-20T15:00:00.000Z",
  "student_ids": [1, 2, 3]
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
    "start_time": "2024-01-20T14:00:00.000Z",
    "end_time": "2024-01-20T15:00:00.000Z",
    "duration_minutes": 60,
    "stream_call_id": "coaching_5_abc123-def456",
    "view_link": "https://app.stream.io/coaching/session/coaching_5_abc123-def456",
    "status": "scheduled",
    "hours_reserved": 1.0,
    "student_count": 3
  }
}
```

**Error Responses:**

**Insufficient Hours (400):**
```json
{
  "success": false,
  "message": "Insufficient coaching hours. Required: 1.0, Available: 0.5. Please purchase more hours."
}
```

**Invalid Time (400):**
```json
{
  "success": false,
  "message": "end_time must be after start_time"
}
```

**Notes:**
- Hours are deducted at session creation (reserved)
- Stream.io call is created automatically
- Email invitations are sent to all students
- Students can join for free (tutor pays)
- Multiple students can be invited

---

### List Coaching Sessions

Get list of all coaching sessions.

**Endpoint:** `GET /api/marketplace/tutor/coaching/sessions`

**Headers:**
```
Authorization: Bearer <tutor_token>
```

**Query Parameters:**
- `status` (optional) - Filter by status: `scheduled`, `active`, `ended`, `cancelled`
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
        "view_link": "https://app.stream.io/coaching/session/coaching_5_abc123",
        "status": "scheduled",
        "hours_reserved": 1.0,
        "hours_used": 0.0,
        "student_count": 3,
        "actual_start_time": null,
        "actual_end_time": null,
        "participants": [
          {
            "id": 1,
            "student": {
              "id": 1,
              "name": "John Doe",
              "email": "john@example.com"
            },
            "invited_at": "2024-01-15T10:00:00.000Z",
            "joined_at": null,
            "left_at": null
          }
        ],
        "created_at": "2024-01-15T10:00:00.000Z"
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

### Get Session Details

Get detailed information about a specific session.

**Endpoint:** `GET /api/marketplace/tutor/coaching/sessions/:id`

**Headers:**
```
Authorization: Bearer <tutor_token>
```

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
    "stream_call_id": "coaching_5_abc123",
    "view_link": "https://app.stream.io/coaching/session/coaching_5_abc123",
    "status": "active",
    "hours_reserved": 1.0,
    "hours_used": 0.75,
    "student_count": 3,
    "actual_start_time": "2024-01-20T14:05:00.000Z",
    "actual_end_time": null,
    "participants": [...],
    "created_at": "2024-01-15T10:00:00.000Z",
    "updated_at": "2024-01-20T14:05:00.000Z"
  }
}
```

---

### Invite Students to Session

Invite additional students to an existing session.

**Endpoint:** `POST /api/marketplace/tutor/coaching/sessions/:id/invite`

**Headers:**
```
Authorization: Bearer <tutor_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "student_ids": [4, 5, 6]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Students invited successfully",
  "data": {
    "invited_count": 3,
    "participants": [
      {
        "id": 4,
        "student_id": 4
      },
      {
        "id": 5,
        "student_id": 5
      },
      {
        "id": 6,
        "student_id": 6
      }
    ]
  }
}
```

**Notes:**
- Email invitations are sent automatically
- Cannot invite students to ended/cancelled sessions
- Duplicate invitations are ignored

---

### Start Session

Start a scheduled coaching session.

**Endpoint:** `POST /api/marketplace/tutor/coaching/sessions/:id/start`

**Headers:**
```
Authorization: Bearer <tutor_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Session started successfully",
  "data": {
    "id": 5,
    "status": "active",
    "actual_start_time": "2024-01-20T14:05:00.000Z",
    "stream_call_id": "coaching_5_abc123",
    "view_link": "https://app.stream.io/coaching/session/coaching_5_abc123"
  }
}
```

**Error Responses:**

**Session Not Scheduled (400):**
```json
{
  "success": false,
  "message": "Cannot start session with status: ended"
}
```

**Start Time Not Reached (400):**
```json
{
  "success": false,
  "message": "Session start time has not been reached"
}
```

**Notes:**
- Session must be in `scheduled` status
- Start time must have been reached
- Time tracking begins when session starts

---

### End Session

Manually end an active coaching session.

**Endpoint:** `POST /api/marketplace/tutor/coaching/sessions/:id/end`

**Headers:**
```
Authorization: Bearer <tutor_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Session ended successfully",
  "data": {
    "id": 5,
    "status": "ended",
    "actual_start_time": "2024-01-20T14:05:00.000Z",
    "actual_end_time": "2024-01-20T14:50:00.000Z",
    "hours_reserved": 1.0,
    "hours_used": 0.75
  }
}
```

**Notes:**
- Actual duration is calculated and recorded
- If actual duration < reserved, difference is refunded
- Stream.io call is ended automatically
- Session cannot be restarted after ending

---

### Get Join Token

Get Stream.io token to join the session.

**Endpoint:** `POST /api/marketplace/tutor/coaching/sessions/:id/token`

**Headers:**
```
Authorization: Bearer <tutor_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "apiKey": "your-stream-api-key",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "streamCallId": "coaching_5_abc123",
    "userId": "5",
    "role": "host"
  }
}
```

**Notes:**
- Token is valid for 1 hour
- Tutor gets `host` role
- Use this token with Stream.io SDK to join the call

---

### Cancel Session

Cancel a scheduled or active session.

**Endpoint:** `DELETE /api/marketplace/tutor/coaching/sessions/:id`

**Headers:**
```
Authorization: Bearer <tutor_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Session cancelled successfully",
  "data": {
    "id": 5,
    "status": "cancelled"
  }
}
```

**Error Responses:**

**Cannot Cancel Ended Session (400):**
```json
{
  "success": false,
  "message": "Cannot cancel an ended session"
}
```

**Notes:**
- Reserved hours are refunded automatically
- Stream.io call is ended if active
- Students are notified (via email - TODO)

---

## Admin Coaching Settings

### Get Coaching Settings

Get current coaching settings (price per hour, etc.).

**Endpoint:** `GET /api/admin/coaching/settings`

**Authorization:** Admin only

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "price_per_hour": 10.0,
    "currency": "NGN",
    "default_duration_minutes": 60,
    "warning_threshold_minutes": 10,
    "auto_end_enabled": true,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-15T10:00:00.000Z"
  }
}
```

---

### Update Coaching Settings

Update coaching settings (Super Admin only).

**Endpoint:** `PUT /api/admin/coaching/settings`

**Authorization:** Super Admin only

**Headers:**
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "price_per_hour": 15.0,
  "currency": "NGN",
  "default_duration_minutes": 60,
  "warning_threshold_minutes": 10,
  "auto_end_enabled": true
}
```

**All fields are optional** - only include fields you want to update.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Coaching settings updated successfully",
  "data": {
    "id": 1,
    "price_per_hour": 15.0,
    "currency": "NGN",
    "default_duration_minutes": 60,
    "warning_threshold_minutes": 10,
    "auto_end_enabled": true,
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## Subscription Tiers

### Tier Comparison

| Tier | Price | Courses | Communities | Digital Downloads | Memberships | Coaching | Commission |
|------|-------|---------|-------------|-------------------|-------------|----------|------------|
| **Free** | $0 | 2 | 0 | 0 | 0 | Pay-as-you-go | 10% |
| **Basic** | $39/mo | 5 | 1 | 0 | 0 | Pay-as-you-go | 10% |
| **Professional** | $99/mo | 25 | 1 | 10 | 0 | Pay-as-you-go | 10% |
| **Expert** | $249/mo | 100 | 3 | 20 | 5 | **Unlimited** | 10% |
| **Grand Master** | $499/mo | **Unlimited** | **Unlimited** | **Unlimited** | **Unlimited** | **Unlimited** | 10% |

### Tier Details

#### Free Tier
- **Price:** $0
- **Courses:** 2 maximum
- **Communities:** 0
- **Digital Downloads:** 0
- **Memberships:** 0
- **Coaching:** Pay-as-you-go (must purchase hours)
- **Commission:** 10%

#### Basic Tier
- **Price:** $39/month
- **Courses:** 5 maximum
- **Communities:** 1
- **Digital Downloads:** 0
- **Memberships:** 0
- **Coaching:** Pay-as-you-go (must purchase hours)
- **Commission:** 10%

#### Professional Tier
- **Price:** $99/month
- **Courses:** 25 maximum
- **Communities:** 1
- **Digital Downloads:** 10 maximum
- **Memberships:** 0
- **Coaching:** Pay-as-you-go (must purchase hours)
- **Commission:** 10%

#### Expert Tier
- **Price:** $249/month
- **Courses:** 100 maximum
- **Communities:** 3
- **Digital Downloads:** 20 maximum
- **Memberships:** 5
- **Coaching:** **Unlimited** (no need to purchase hours)
- **Commission:** 10%

#### Grand Master Tier
- **Price:** $499/month
- **Courses:** **Unlimited**
- **Communities:** **Unlimited**
- **Digital Downloads:** **Unlimited**
- **Memberships:** **Unlimited**
- **Coaching:** **Unlimited** (no need to purchase hours)
- **Commission:** 10%

---

## How It Works

### Subscription Flow

1. **Tutor registers** → Gets default "Free" tier
2. **Tutor subscribes** → Chooses tier (Basic, Professional, Expert, Grand Master)
3. **System checks limits** → Before creating courses/downloads, system checks subscription limits
4. **Tutor can upgrade/downgrade** → Anytime via `POST /api/marketplace/tutor/subscription`

### Coaching Hours Flow

1. **Check subscription** → If Expert/Grand Master, unlimited coaching (skip to step 4)
2. **Purchase hours** → Tutor purchases hours from wallet (`POST /api/marketplace/tutor/coaching/purchase-hours`)
3. **Hours added to balance** → Balance tracked in `coaching_hours_balance` table
4. **Create session** → Hours deducted at session creation (reserved)
5. **Start session** → Time tracking begins
6. **During session** → Warnings sent at 10min and 5min remaining
7. **End session** → Actual duration calculated, hours adjusted
8. **Refund if early** → If session ends early, difference is refunded

### Session Lifecycle

```
scheduled → active → ended
    ↓
cancelled (can happen at any time before ended)
```

1. **Scheduled:** Session created, hours reserved, students invited
2. **Active:** Session started, time tracking active
3. **Ended:** Session completed, hours finalized
4. **Cancelled:** Session cancelled, hours refunded

### Time Tracking

- **Reserved Hours:** Deducted at session creation
- **Actual Hours:** Calculated from `actual_start_time` to `actual_end_time`
- **Refund:** If `actual_hours < reserved_hours`, difference is refunded
- **Auto-end:** System automatically ends sessions when `end_time` is reached
- **Warnings:** Sent at 10 minutes and 5 minutes remaining

---

## Background Jobs

### Time Tracking Job

A background job (`trackActiveSessions`) should run periodically (every minute) to:
1. Check all active sessions
2. Send warnings at 10min and 5min remaining
3. Automatically end sessions when time is up
4. Check wallet balance and send low balance warnings

**Implementation:**
```javascript
import { trackActiveSessions } from './src/services/coachingTimeTracker.js';

// Run every minute
setInterval(async () => {
  await trackActiveSessions();
}, 60000);
```

**Or use node-cron:**
```javascript
import cron from 'node-cron';
import { trackActiveSessions } from './src/services/coachingTimeTracker.js';

// Run every minute
cron.schedule('* * * * *', async () => {
  await trackActiveSessions();
});
```

---

## Database Migration

### Run Migration

Before using any coaching/subscription endpoints, run the migration:

```bash
node scripts/migrate-create-coaching-subscription-tables.js
```

This creates:
- `tutor_subscriptions` - Subscription records
- `coaching_sessions` - Session records
- `coaching_session_participants` - Student participants
- `coaching_hours_balance` - Hours balance tracking
- `coaching_hours_purchases` - Purchase history
- `coaching_settings` - Admin settings

### Default Settings

After migration, default coaching settings are created:
- `price_per_hour`: 10.0 NGN
- `default_duration_minutes`: 60
- `warning_threshold_minutes`: 10
- `auto_end_enabled`: true

Update via admin endpoint: `PUT /api/admin/coaching/settings`

---

## Endpoint Summary

### ✅ New Endpoints Added

**Subscription:**
- `GET /api/marketplace/tutor/subscription` - Get subscription
- `POST /api/marketplace/tutor/subscription` - Subscribe/upgrade
- `GET /api/marketplace/tutor/subscription/limits` - Get limits and usage

**Coaching Hours:**
- `GET /api/marketplace/tutor/coaching/hours-balance` - Get balance
- `POST /api/marketplace/tutor/coaching/purchase-hours` - Purchase hours
- `GET /api/marketplace/tutor/coaching/purchase-history` - Get history

**Coaching Sessions:**
- `POST /api/marketplace/tutor/coaching/sessions` - Create session
- `GET /api/marketplace/tutor/coaching/sessions` - List sessions
- `GET /api/marketplace/tutor/coaching/sessions/:id` - Get session
- `POST /api/marketplace/tutor/coaching/sessions/:id/invite` - Invite students
- `POST /api/marketplace/tutor/coaching/sessions/:id/start` - Start session
- `POST /api/marketplace/tutor/coaching/sessions/:id/end` - End session
- `POST /api/marketplace/tutor/coaching/sessions/:id/token` - Get join token
- `DELETE /api/marketplace/tutor/coaching/sessions/:id` - Cancel session

**Admin:**
- `GET /api/admin/coaching/settings` - Get settings
- `PUT /api/admin/coaching/settings` - Update settings (Super Admin only)

### ✅ No Existing Endpoints Affected

**All existing endpoints continue to work exactly as before:**
- All tutor dashboard endpoints
- All course management endpoints
- All digital download endpoints
- All marketplace endpoints
- All admin endpoints
- All student endpoints

**This is a completely additive feature set with zero breaking changes.**

---

## Integration Notes

### For Frontend Developers

1. **Subscription Check:** Before creating courses/downloads, check subscription limits
2. **Coaching Hours:** Show balance and purchase option (unless unlimited)
3. **Session Creation:** Validate hours balance before allowing session creation
4. **Stream.io Integration:** Use join token to connect to Stream.io SDK
5. **Email Notifications:** Students receive email invitations automatically

### For Backend Developers

1. **Limit Checking:** Use `checkSubscriptionLimit()` helper before creating resources
2. **Hours Deduction:** Use `checkAndDeductHours()` before creating sessions
3. **Hours Refund:** Use `refundHours()` when sessions are cancelled/ended early
4. **Background Job:** Set up cron job to run `trackActiveSessions()` every minute

---

## Error Codes

| Code | Meaning |
|------|---------|
| 400 | Bad Request (validation error, insufficient balance, etc.) |
| 401 | Unauthorized (invalid/missing token) |
| 403 | Forbidden (wrong user type, insufficient permissions) |
| 404 | Not Found (session not found, etc.) |
| 500 | Internal Server Error |
| 503 | Service Unavailable (Stream.io not configured) |

---

## Support

For issues or questions:
1. Check this documentation
2. Review error messages in responses
3. Check database migration was run
4. Verify Stream.io configuration
5. Check coaching settings are configured

---

**Last Updated:** January 2024
**Version:** 1.0.0

