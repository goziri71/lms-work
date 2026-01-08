# Learner Activity Tracking System - Backend Reference

## Overview

This document provides reference information for the existing backend activity tracking system. 

**For frontend implementation design, see [`FRONTEND_ACTIVITY_TRACKING_DESIGN.md`](./FRONTEND_ACTIVITY_TRACKING_DESIGN.md)**

## Backend API Endpoints

The backend has been updated with the following endpoints for frontend tracking:

### 1. Track Single Activity
**POST** `/api/courses/activity/track`

**Authentication**: `authorize` middleware (student auth)

**Request Body**:
```json
{
  "activity_type": "unit_view",
  "course_id": 5,
  "module_id": 3,
  "unit_id": 15,
  "duration_seconds": 300,
  "engagement_metrics": {
    "scroll_depth": 85,
    "video_watch_percentage": 90,
    "interaction_count": 5
  },
  "start_time": "2024-01-20T14:00:00Z",
  "end_time": "2024-01-20T14:05:00Z"
}
```

### 2. Send Heartbeat
**POST** `/api/courses/activity/heartbeat`

**Authentication**: `authorize` middleware (student auth)

**Request Body**:
```json
{
  "course_id": 5,
  "module_id": 3,
  "unit_id": 15,
  "is_active": true,
  "timestamp": "2024-01-20T14:05:30Z"
}
```

### 3. Track Batch Events
**POST** `/api/courses/activity/batch`

**Authentication**: `authorize` middleware (student auth)

**Request Body**:
```json
{
  "events": [
    {
      "activity_type": "unit_view",
      "course_id": 5,
      "module_id": 3,
      "unit_id": 15,
      "duration_seconds": 300,
      "start_time": "2024-01-20T14:00:00Z",
      "end_time": "2024-01-20T14:05:00Z"
    }
  ]
}
```

## Backend Code Changes

The following files have been updated:

1. **`src/controllers/student/activityTracking.js`** (NEW)
   - `trackActivity()` - Handle single activity tracking
   - `sendHeartbeat()` - Handle heartbeat pings
   - `trackBatch()` - Handle batch event tracking

2. **`src/routes/courses.js`** (UPDATED)
   - Added routes for activity tracking endpoints

3. **`src/middlewares/learnerActivityTracker.js`** (UPDATED)
   - `trackLearnerActivity()` - Now accepts `startTime`, `endTime`, `engagementMetrics`
   - `updateCourseProgress()` - Now stores engagement metrics in metadata

## Database Tables

The existing database tables support the new tracking:

- **`learner_activity_logs`**: Stores activity events with metadata (engagement metrics, timing info)
- **`course_progress`**: Stores course progress with engagement metrics in metadata field

## Validation Rules

- `activity_type` must be valid enum value
- `course_id`, `module_id`, `unit_id` must exist and student must have access
- `duration_seconds` must be positive number (if provided)
- `start_time` and `end_time` must be valid ISO timestamps
- `end_time` must be after `start_time`
- `engagement_metrics.scroll_depth` must be 0-100
- `engagement_metrics.video_watch_percentage` must be 0-100
- `engagement_metrics.interaction_count` must be non-negative integer

## Error Responses

- **400**: Invalid request data
- **401**: Unauthorized (not logged in as student)
- **403**: Forbidden (student doesn't have access to course/module/unit)
- **500**: Server error

---

**Note**: All backend adjustments have been completed. See `FRONTEND_ACTIVITY_TRACKING_DESIGN.md` for complete frontend implementation guide.
