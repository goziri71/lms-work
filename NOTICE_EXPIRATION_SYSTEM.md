# Notice Expiration Control System

## Overview

This document describes the notice system with expiration control. The system has been enhanced to allow super admins to configure when notices should expire, how long they stay active, and who can see them. **All existing admin endpoints remain fully functional** - new features are optional additions.

## System Flow Overview

### Previous System (Still Works)

**Admin Endpoints Only:**

- Super admins could create, view, update, and delete notices
- Notices were always visible (no expiration)
- No student/staff endpoints to view notices
- All notices were system-wide or course-specific

**Flow:**

```
Super Admin → POST /api/admin/notices → Creates notice
Super Admin → GET /api/admin/notices → Views all notices
Super Admin → PUT /api/admin/notices/:id → Updates notice
Super Admin → DELETE /api/admin/notices/:id → Deletes notice
```

### New System (Enhanced)

**Admin Endpoints (Enhanced but Backward Compatible):**

- All previous endpoints still work exactly as before
- New optional fields for expiration control
- Can now set expiration dates, duration, status, and target audience

**New Student/Staff Endpoints:**

- Students and staff can now view active notices
- Automatic filtering of expired/inactive notices
- Course-based access control

**Complete Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│                    SUPER ADMIN FLOW                          │
└─────────────────────────────────────────────────────────────┘

1. Create Notice (Enhanced)
   POST /api/admin/notices
   - Old way: { title, note, course_id } ✅ Still works
   - New way: + expiration fields (optional) ✅ Enhanced

2. View All Notices
   GET /api/admin/notices
   - Returns ALL notices (active, expired, draft)
   - Includes new fields in response
   - ✅ Works exactly as before

3. View Single Notice
   GET /api/admin/notices/:id
   - Returns notice with all fields
   - ✅ Works exactly as before

4. Update Notice (Enhanced)
   PUT /api/admin/notices/:id
   - Old way: { title, note, course_id } ✅ Still works
   - New way: + expiration fields (optional) ✅ Enhanced

5. Delete Notice
   DELETE /api/admin/notices/:id
   - ✅ Works exactly as before

┌─────────────────────────────────────────────────────────────┐
│              STUDENT/STAFF FLOW (NEW)                        │
└─────────────────────────────────────────────────────────────┘

1. View Active Notices
   GET /api/notices
   - Only returns active, non-expired notices
   - Filtered by target_audience
   - Shows system-wide + user's course notices
   - ✅ NEW ENDPOINT

2. View Notices for Specific Course
   GET /api/notices?course_id=739
   - Only if user has access to that course
   - ✅ NEW ENDPOINT
```

## How They Work Together

### Admin Creates Notice

**Option 1: Old Way (Still Works)**

```json
POST /api/admin/notices
{
  "title": "Welcome",
  "note": "Welcome message",
  "course_id": null
}
```

**Result:** Notice is created as permanent, active, visible to all (backward compatible)

**Option 2: New Way (With Expiration)**

```json
POST /api/admin/notices
{
  "title": "Exam Schedule",
  "note": "Exams next week",
  "course_id": null,
  "is_permanent": false,
  "duration_days": 7,
  "status": "active",
  "target_audience": "students"
}
```

**Result:** Notice expires in 7 days, only visible to students

### Students/Staff View Notices

**Automatic Filtering:**

- Only sees notices with `status = 'active'`
- Only sees non-expired notices (unless `is_permanent = true`)
- Only sees notices matching their `target_audience`
- Only sees system-wide notices + notices for their courses

**Example:**

```
Student calls: GET /api/notices

System checks:
1. status = 'active'? ✅
2. is_permanent = true OR expires_at > NOW()? ✅
3. target_audience includes 'students'? ✅
4. course_id = null (system-wide) OR student enrolled? ✅

Returns: Only matching notices
```

### Admin Views All Notices

**No Filtering:**

- Admin sees ALL notices (active, expired, draft)
- Can see expiration status
- Can see target audience
- Can manage all notices regardless of status

**Example:**

```
Admin calls: GET /api/admin/notices

Returns: All notices including:
- Active notices
- Expired notices
- Draft notices
- With full expiration details
```

## Database Changes

### New Columns Added to `notice` Table

1. **`expires_at`** (TIMESTAMP, nullable)

   - When the notice expires
   - `NULL` if permanent or no expiration set

2. **`is_permanent`** (BOOLEAN, default: `false`)

   - If `true`, notice never expires regardless of `expires_at`
   - If `false`, expiration is checked against `expires_at`

3. **`status`** (ENUM: 'active', 'expired', 'draft', default: 'active')

   - `active` = visible to students/staff
   - `expired` = hidden (manually expired)
   - `draft` = not published yet

4. **`target_audience`** (ENUM: 'all', 'students', 'staff', 'both', default: 'all')
   - `all` = everyone can see
   - `students` = only students
   - `staff` = only staff
   - `both` = students and staff (same as 'all' but explicit)

### Migration

Run the migration script to add these columns:

```bash
psql -U your_username -d your_database -f scripts/migrate-notice-expiration.sql
```

Or manually run the SQL in your database client.

## API Endpoints

### For Students and Staff

#### GET `/api/notices`

Get active notices visible to the authenticated user.

**Authentication:** Required (student or staff token)

**Query Parameters:**

- `course_id` (optional): Filter notices for a specific course

**Response:**

```json
{
  "status": true,
  "code": 200,
  "message": "Notices retrieved successfully",
  "data": [
    {
      "id": 1,
      "title": "Exam Schedule",
      "note": "Exams start next week",
      "date": "2024-01-15T10:00:00.000Z",
      "course_id": null,
      "expires_at": "2024-12-31T23:59:59.000Z",
      "is_permanent": false,
      "status": "active",
      "target_audience": "all",
      "course": null
    }
  ]
}
```

**Filtering Logic:**

- Only returns notices with `status = 'active'`
- Only returns non-expired notices:
  - `is_permanent = true` OR
  - `expires_at > NOW()` OR
  - `expires_at = NULL`
- Filters by `target_audience`:
  - Students see: `'all'`, `'students'`, `'both'`
  - Staff see: `'all'`, `'staff'`, `'both'`
- Course filtering:
  - System-wide notices (`course_id = null`) - everyone sees
  - Course-specific notices - only if user is enrolled (student) or teaching (staff)

### For Super Admins (Enhanced - Backward Compatible)

#### POST `/api/admin/notices`

Create a new notice with expiration control.

**Authentication:** Required (super admin token)

**Request Body:**

```json
{
  "title": "Important Announcement",
  "note": "All students are required to...",
  "course_id": null,
  "is_permanent": false,
  "expires_at": "2024-12-31T23:59:59.000Z",
  "duration_days": 7,
  "status": "active",
  "target_audience": "all"
}
```

**Fields:**

- `title` (required): Notice title
- `note` (required): Notice content
- `course_id` (optional): `null` for system-wide, or course ID for course-specific
- `is_permanent` (optional, default: `false`): If `true`, notice never expires
- `expires_at` (optional): Specific expiration date/time (ISO 8601 format)
- `duration_days` (optional): Number of days from creation date to expire (alternative to `expires_at`)
- `status` (optional, default: `'active'`): `'active'`, `'expired'`, or `'draft'`
- `target_audience` (optional, default: `'all'`): `'all'`, `'students'`, `'staff'`, or `'both'`

**Expiration Options (choose one):**

1. **Permanent:** Set `is_permanent: true` (ignores `expires_at` and `duration_days`)
2. **Specific Date:** Set `expires_at: "2024-12-31T23:59:59.000Z"`
3. **Duration:** Set `duration_days: 7` (auto-calculates `expires_at` from creation date)
4. **No expiration:** Don't set any expiration fields (defaults to permanent for backward compatibility)

**Response:**

```json
{
  "success": true,
  "message": "Notice created successfully",
  "data": {
    "notice": {
      "id": 1,
      "title": "Important Announcement",
      "note": "All students are required to...",
      "date": "2024-01-15T10:00:00.000Z",
      "course_id": null,
      "expires_at": "2024-01-22T10:00:00.000Z",
      "is_permanent": false,
      "status": "active",
      "target_audience": "all"
    }
  }
}
```

#### PUT `/api/admin/notices/:id`

Update a notice, including expiration settings.

**Authentication:** Required (super admin token)

**Request Body:** (all fields optional)

```json
{
  "title": "Updated Title",
  "note": "Updated content",
  "course_id": 123,
  "is_permanent": true,
  "expires_at": null,
  "duration_days": 30,
  "status": "active",
  "target_audience": "students"
}
```

**Notes:**

- If `is_permanent` is set to `true`, `expires_at` is automatically set to `null`
- If `duration_days` is provided, it calculates `expires_at` from the notice's original `date`
- All fields are optional - only provided fields will be updated

## Examples

### Example 1: Permanent System-Wide Notice

```json
POST /api/admin/notices
{
  "title": "Welcome to LMS",
  "note": "Welcome to our learning management system",
  "course_id": null,
  "is_permanent": true,
  "status": "active",
  "target_audience": "all"
}
```

### Example 2: Temporary Notice (7 Days)

```json
POST /api/admin/notices
{
  "title": "Exam Schedule",
  "note": "Exams start next week",
  "course_id": null,
  "is_permanent": false,
  "duration_days": 7,
  "status": "active",
  "target_audience": "all"
}
```

### Example 3: Course-Specific Notice for Students Only

```json
POST /api/admin/notices
{
  "title": "Assignment Due",
  "note": "Assignment 1 is due tomorrow",
  "course_id": 739,
  "is_permanent": false,
  "expires_at": "2024-12-31T23:59:59.000Z",
  "status": "active",
  "target_audience": "students"
}
```

### Example 4: Draft Notice (Not Published Yet)

```json
POST /api/admin/notices
{
  "title": "Upcoming Event",
  "note": "Save the date for our annual conference",
  "course_id": null,
  "is_permanent": false,
  "expires_at": "2024-12-31T23:59:59.000Z",
  "status": "draft",
  "target_audience": "all"
}
```

## Frontend Implementation Guide

### For Students/Staff

1. **Fetch Notices:**

   ```javascript
   // Get all active notices
   const response = await fetch("/api/notices", {
     headers: {
       Authorization: `Bearer ${token}`,
     },
   });

   // Get notices for specific course
   const response = await fetch("/api/notices?course_id=739", {
     headers: {
       Authorization: `Bearer ${token}`,
     },
   });
   ```

2. **Display Logic:**
   - Show notices sorted by `date` (newest first)
   - Display `title` and `note`
   - Show course name if `course_id` is not null
   - Optionally show expiration date if not permanent

### For Super Admins

1. **Create Notice Form:**

   - Title (required)
   - Note/Content (required)
   - Course (optional dropdown, null for system-wide)
   - Expiration Type (radio buttons):
     - Permanent
     - Specific Date (date picker)
     - Duration (number input for days)
   - Status (dropdown: active, draft, expired)
   - Target Audience (dropdown: all, students, staff, both)

2. **Update Notice:**
   - Same form as create, pre-filled with existing values
   - Allow changing expiration settings

## Testing Checklist

- [ ] Run migration script successfully
- [ ] Create permanent notice (should never expire)
- [ ] Create notice with specific expiration date
- [ ] Create notice with duration_days
- [ ] Student can see system-wide notices
- [ ] Student can see notices for enrolled courses
- [ ] Student cannot see notices for non-enrolled courses
- [ ] Staff can see system-wide notices
- [ ] Staff can see notices for their courses
- [ ] Staff cannot see notices for other courses
- [ ] Expired notices don't show to students/staff
- [ ] Draft notices don't show to students/staff
- [ ] Target audience filtering works correctly
- [ ] Admin can update expiration settings
- [ ] Admin can change notice status

## Backward Compatibility

### Database Migration

- Existing notices are automatically set to:
  - `status = 'active'`
  - `is_permanent = true`
  - `target_audience = 'all'`
- This ensures existing notices continue to work without changes

### API Compatibility

- **All existing admin endpoints work exactly as before**
- Old API calls without expiration fields still work:
  ```json
  // This still works - creates permanent notice
  POST /api/admin/notices
  {
    "title": "Notice",
    "note": "Content",
    "course_id": null
  }
  ```
- New fields are optional with sensible defaults
- Response format unchanged (just includes new fields)

### Migration Path

1. **Run migration script** to add new columns
2. **Existing notices** automatically become permanent
3. **Old API calls** continue to work
4. **Gradually adopt** new expiration features as needed
5. **No breaking changes** - everything works as before

## Summary: What Changed vs What Stayed the Same

### ✅ What Stayed the Same (No Changes)

- `GET /api/admin/notices` - Works exactly as before
- `GET /api/admin/notices/:id` - Works exactly as before
- `DELETE /api/admin/notices/:id` - Works exactly as before
- Request/Response format for basic fields (`title`, `note`, `course_id`)
- Admin can still create notices the old way

### ✨ What's New (Additions)

- New database columns for expiration control
- New optional fields in create/update requests
- New student/staff endpoint: `GET /api/notices`
- Automatic filtering of expired/inactive notices
- Target audience control
- Status management (active/draft/expired)

### 🔄 How They Work Together

- **Admin endpoints** see everything (for management)
- **Student/staff endpoints** see only active, non-expired notices (for viewing)
- **Same notice** can be managed by admin and viewed by students/staff
- **Expiration happens automatically** - no manual cleanup needed
- **Backward compatible** - old code continues to work
