# Endpoint Changes Summary - Course Allocation System

## ⚠️ CRITICAL: Database Migration Required

**Before using any new endpoints, run:**

```bash
npm run migrate:course-allocation
```

This creates the necessary database columns (`registration_deadline`, `registration_status`, etc.)

---

## 📋 Table of Contents

1. [Deprecated Endpoints](#deprecated-endpoints)
2. [Modified Endpoints (Response Changes)](#modified-endpoints-response-changes)
3. [New Endpoints](#new-endpoints)
4. [Potentially Broken Endpoints](#potentially-broken-endpoints)
5. [Frontend Migration Guide](#frontend-migration-guide)

---

## 🚫 Deprecated Endpoints

### 1. `POST /api/courses/register` - **DEPRECATED**

**Status:** ⚠️ **DO NOT USE** - Replaced by new allocation system

**Reason:** This endpoint allowed individual course registration (free). The new system requires students to register for allocated courses (paid).

**Replacement:**

- Use `GET /api/courses/allocated` to see allocated courses
- Use `POST /api/courses/register-allocated` to register for all allocated courses

**Action Required:**

- Remove this endpoint from frontend
- Update UI to use new allocation flow

---

## 🔄 Modified Endpoints (Response Changes)

### 1. `GET /api/admin/semesters` - **MODIFIED**

**Endpoint:** `GET /api/admin/semesters`

**Change:** Response now includes `registration_deadline` field

**Previous Response:**

```json
{
  "success": true,
  "message": "Semesters retrieved successfully",
  "data": {
    "semesters": [
      {
        "id": 1,
        "academic_year": "2024/2025",
        "semester": "1ST",
        "status": "ACTIVE",
        "start_date": "2024-01-15",
        "end_date": "2024-05-15"
      }
    ],
    "pagination": {...}
  }
}
```

**New Response (Added Field):**

```json
{
  "success": true,
  "message": "Semesters retrieved successfully",
  "data": {
    "semesters": [
      {
        "id": 1,
        "academic_year": "2024/2025",
        "semester": "1ST",
        "status": "ACTIVE",
        "start_date": "2024-01-15",
        "end_date": "2024-05-15",
        "registration_deadline": "2024-02-15"  // ⬅️ NEW FIELD (may be null)
      }
    ],
    "pagination": {...}
  }
}
```

**Frontend Action:**

- `registration_deadline` may be `null` for old semesters
- Handle `null` gracefully in UI
- Display deadline if present

---

### 2. `GET /api/admin/semesters/:id` - **MODIFIED**

**Endpoint:** `GET /api/admin/semesters/:id`

**Change:** Response now includes `registration_deadline` field

**New Response:**

```json
{
  "success": true,
  "message": "Semester retrieved successfully",
  "data": {
    "semester": {
      "id": 1,
      "academic_year": "2024/2025",
      "semester": "1ST",
      "status": "ACTIVE",
      "start_date": "2024-01-15",
      "end_date": "2024-05-15",
      "registration_deadline": "2024-02-15" // ⬅️ NEW FIELD (may be null)
    }
  }
}
```

**Frontend Action:**

- Same as above - handle `null` values

---

### 3. `GET /api/admin/semesters/current` - **MODIFIED**

**Endpoint:** `GET /api/admin/semesters/current`

**Change:** Response now includes `registration_deadline` field

**New Response:**

```json
{
  "success": true,
  "message": "Current semester retrieved successfully",
  "data": {
    "semester": {
      "id": 1,
      "academic_year": "2024/2025",
      "semester": "1ST",
      "status": "ACTIVE",
      "start_date": "2024-01-15",
      "end_date": "2024-05-15",
      "registration_deadline": "2024-02-15" // ⬅️ NEW FIELD (may be null)
    }
  }
}
```

**Frontend Action:**

- Same as above

---

### 4. `GET /api/admin/dashboard/stats` - **POTENTIALLY AFFECTED**

**Endpoint:** `GET /api/admin/dashboard/stats`

**Potential Issue:** May fail if `registration_deadline` column doesn't exist in database

**Response Structure (Unchanged):**

```json
{
  "success": true,
  "message": "Dashboard statistics retrieved successfully",
  "data": {
    "overview": {
      "students": {
        "total": 100,
        "active": 85,
        "inactive": 15
      },
      "staff": {
        "total": 20,
        "active": 18
      },
      "admins": {
        "total": 5
      },
      "academic": {
        "programs": {
          "total": 10,
          "active": 8
        },
        "courses": 50,
        "faculties": 5
      },
      "enrollments": 200
    },
    "currentSemester": {
      "id": 1,
      "academic_year": "2024/2025",
      "semester": "1ST",
      "start_date": "2024-01-15",
      "end_date": "2024-05-15",
      "status": "ACTIVE"
      // Note: registration_deadline NOT included in dashboard response
    },
    "studentsByLevel": [...],
    "topPrograms": [...],
    "recentActivity": {...}
  }
}
```

**Frontend Action:**

- No changes needed to response structure
- If endpoint fails, check if migration was run

---

## ✨ New Endpoints

### Course Pricing Management

1. **`POST /api/admin/courses/pricing`** - Set single course price
2. **`POST /api/admin/courses/pricing/bulk`** - Bulk set course prices
3. **`GET /api/admin/courses/pricing`** - Get course prices for semester
4. **`POST /api/admin/courses/pricing/copy`** - Copy prices from another semester

### Course Allocation Management

5. **`POST /api/admin/courses/allocate`** - Allocate courses to students
6. **`GET /api/admin/courses/allocations`** - Get all allocations
7. **`DELETE /api/admin/courses/allocate/:id`** - Remove single allocation
8. **`DELETE /api/admin/courses/allocate/bulk`** - Bulk remove allocations

### Student Course Allocation

9. **`GET /api/courses/allocated`** - Get my allocated courses (student)
10. **`POST /api/courses/register-allocated`** - Register for all allocated courses (student)

### Registration Deadline Management

11. **`PATCH /api/admin/semesters/:id/extend-deadline`** - Extend registration deadline

**Note:** All new endpoints are documented in `COURSE_ALLOCATION_API_GUIDE.md`

---

## ⚠️ Potentially Broken Endpoints

### 1. `GET /api/admin/semesters` - **MAY FAIL**

**Issue:** If `registration_deadline` column doesn't exist in database

**Error:**

```
column "registration_deadline" does not exist
```

**Fix:** Run migration:

```bash
npm run migrate:course-allocation
```

**Temporary Workaround:** None - migration is required

---

### 2. `GET /api/admin/semesters/:id` - **MAY FAIL**

**Issue:** Same as above - missing `registration_deadline` column

**Fix:** Run migration

---

### 3. `GET /api/admin/semesters/current` - **MAY FAIL**

**Issue:** Same as above - missing `registration_deadline` column

**Fix:** Run migration

---

### 4. `GET /api/admin/dashboard/stats` - **MAY FAIL**

**Issue:** If `registration_deadline` column doesn't exist, the Semester query might fail

**Error:**

```
column "registration_deadline" does not exist
```

**Fix:** Run migration:

```bash
npm run migrate:course-allocation
```

**Note:** Dashboard doesn't use `registration_deadline` in response, but Sequelize will try to load it if the column exists in the model.

---

### 5. `GET /api/admin/courses/pricing` - **MAY FAIL**

**Issue:** If `course_semester_pricing` table doesn't exist

**Error:**

```
relation "course_semester_pricing" does not exist
```

**Fix:** Run migration:

```bash
npm run migrate:course-allocation
```

---

### 6. `POST /api/admin/courses/pricing` - **MAY FAIL**

**Issue:** Same as above - missing `course_semester_pricing` table

**Fix:** Run migration

---

### 7. `POST /api/admin/courses/allocate` - **MAY FAIL**

**Issue:** If `registration_status` column doesn't exist in `course_reg` table

**Error:**

```
column "registration_status" does not exist
```

**Fix:** Run migration:

```bash
npm run migrate:course-allocation
```

---

### 8. `GET /api/courses/allocated` - **MAY FAIL**

**Issue:** Same as above - missing `registration_status` column

**Fix:** Run migration

---

### 9. `POST /api/courses/register-allocated` - **MAY FAIL**

**Issue:** Same as above - missing `registration_status` column

**Fix:** Run migration

---

## 🔧 Frontend Migration Guide

### Step 1: Verify Migration

Before making any changes, verify the migration has been run:

- Check if endpoints return data (not errors)
- Check if `registration_deadline` appears in semester responses

### Step 2: Update Semester Endpoints

**Files to Update:**

- Semester listing components
- Semester detail components
- Current semester display

**Changes:**

```javascript
// OLD
const semester = response.data.semester;
const deadline = null; // Not available

// NEW
const semester = response.data.semester;
const deadline = semester.registration_deadline; // May be null
```

**Handle Null:**

```javascript
const deadline = semester.registration_deadline
  ? new Date(semester.registration_deadline)
  : null;
```

### Step 3: Remove Old Registration Endpoint

**Remove:**

- `POST /api/courses/register` usage
- Individual course registration UI
- Free registration flow

**Replace With:**

- `GET /api/courses/allocated` - Show allocated courses
- `POST /api/courses/register-allocated` - Register for all courses

### Step 4: Update Error Handling

**Add Error Handling for:**

- Missing database columns (migration not run)
- Insufficient wallet balance
- Registration deadline passed
- No allocated courses

**Example:**

```javascript
try {
  const response = await fetch("/api/admin/semesters");
  const data = await response.json();
  // Handle response
} catch (error) {
  if (error.message.includes("registration_deadline")) {
    // Show message: "Please run database migration"
  }
}
```

### Step 5: Test All Endpoints

**Test Checklist:**

- [ ] `GET /api/admin/semesters` - Returns with `registration_deadline`
- [ ] `GET /api/admin/semesters/current` - Returns with `registration_deadline`
- [ ] `GET /api/admin/dashboard/stats` - Works correctly
- [ ] `GET /api/admin/courses/pricing` - Works (if migration run)
- [ ] `POST /api/admin/courses/pricing` - Works (if migration run)
- [ ] `GET /api/courses/allocated` - Works (if migration run)
- [ ] `POST /api/courses/register-allocated` - Works (if migration run)

---

## 📝 Summary

### Deprecated (Remove from Frontend):

- ❌ `POST /api/courses/register`

### Modified (Update Frontend):

- 🔄 `GET /api/admin/semesters` - Added `registration_deadline`
- 🔄 `GET /api/admin/semesters/:id` - Added `registration_deadline`
- 🔄 `GET /api/admin/semesters/current` - Added `registration_deadline`

### New (Add to Frontend):

- ✨ All endpoints in `COURSE_ALLOCATION_API_GUIDE.md`

### Critical Action:

1. **Run migration:** `npm run migrate:course-allocation`
2. **Update semester components** to handle `registration_deadline`
3. **Remove old registration endpoint** usage
4. **Add new allocation endpoints** to frontend

---

## 🆘 Troubleshooting

### Error: "column registration_deadline does not exist"

**Solution:** Run `npm run migrate:course-allocation`

### Error: "relation course_semester_pricing does not exist"

**Solution:** Run `npm run migrate:course-allocation`

### Error: "column registration_status does not exist"

**Solution:** Run `npm run migrate:course-allocation`

### Dashboard endpoint returns 500 error

**Solution:**

1. Check if migration was run
2. Check server logs for specific error
3. Verify `registration_deadline` column exists in `semester` table

---

**Last Updated:** 2024-01-20
**Version:** 1.0.0
