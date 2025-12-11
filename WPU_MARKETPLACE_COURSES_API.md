# WPU Marketplace Courses - API Integration Guide

## Overview

This document outlines all API endpoints affected by the WPU marketplace courses feature. WPU courses can now be listed on the marketplace, requiring payment from all students (including WPU students), with 100% revenue going to WPU.

---

## Table of Contents

1. [Admin Course Management](#admin-course-management)
2. [Student Course Registration](#student-course-registration)
3. [Marketplace Course Purchase](#marketplace-course-purchase)
4. [Course Allocation](#course-allocation)
5. [Available Courses Endpoint](#available-courses-endpoint)
6. [Exam Access (Payment Verification)](#exam-access-payment-verification)
7. [Frontend Integration Checklist](#frontend-integration-checklist)

---

## Admin Course Management

### 1. Create Course (Updated)

**Endpoint:** `POST /api/admin/courses`

**Authorization:** Admin/Super Admin

**New Request Body Fields:**

```json
{
  "title": "Introduction to Web Development",
  "course_code": "CS101",
  "program_id": 1,
  "staff_id": 5,
  "price": 5000,
  "currency": "NGN",
  // ... other existing fields ...

  // NEW FIELDS:
  "is_marketplace": true, // Optional, default: false
  "marketplace_status": "published" // Optional, default: "draft" if is_marketplace is true
}
```

**Marketplace Status Values:**

- `"draft"` - Not published (default)
- `"pending"` - Awaiting approval (not used for WPU courses)
- `"approved"` - Approved (not used for WPU courses)
- `"rejected"` - Rejected (not used for WPU courses)
- `"published"` - Live on marketplace

**Validation Rules:**

- If `is_marketplace = true` and `marketplace_status = "published"`, `price` must be set and > 0
- If `is_marketplace = false`, `marketplace_status` is ignored (set to `null`)

**Response:** (unchanged)

```json
{
  "success": true,
  "message": "Course created successfully",
  "data": {
    "course": {
      "id": 123,
      "title": "Introduction to Web Development",
      "is_marketplace": true,
      "marketplace_status": "published",
      "price": 5000
      // ... other fields
    }
  }
}
```

---

### 2. Update Course (Updated)

**Endpoint:** `PUT /api/admin/courses/:id`

**Authorization:** Admin/Super Admin

**New Request Body Fields:**

```json
{
  // ... existing fields ...

  // NEW FIELDS:
  "is_marketplace": true, // Optional
  "marketplace_status": "published" // Optional
}
```

**Behavior:**

- Setting `is_marketplace = true` with no `marketplace_status` defaults to `"draft"`
- Setting `is_marketplace = false` clears `marketplace_status` (sets to `null`)
- Setting `marketplace_status = "published"` requires `price > 0` and automatically sets `is_marketplace = true`

**Response:** (unchanged)

```json
{
  "success": true,
  "message": "Course updated successfully",
  "data": {
    "course": {
      "id": 123,
      "is_marketplace": true,
      "marketplace_status": "published"
      // ... other fields
    }
  }
}
```

**Error Responses:**

```json
// If publishing without price
{
  "status": false,
  "code": 400,
  "message": "Course price must be set and greater than 0 for published marketplace courses"
}

// Invalid marketplace_status
{
  "status": false,
  "code": 400,
  "message": "marketplace_status must be one of: draft, pending, approved, rejected, published"
}
```

---

## Student Course Registration

### 3. Register for Course (Updated)

**Endpoint:** `POST /api/courses/register`

**Authorization:** Student

**Request Body:** (unchanged)

```json
{
  "course_id": 123,
  "academic_year": "2024/2025",
  "semester": "1ST",
  "level": "100"
}
```

**New Behavior:**

- **Marketplace WPU courses** (`is_marketplace = true` + `marketplace_status = "published"`) are **BLOCKED** from free registration
- Students must use the purchase endpoint instead

**Error Response (New):**

```json
{
  "status": false,
  "code": 400,
  "message": "This WPU course is listed on marketplace and requires purchase. Please use the purchase endpoint: POST /api/marketplace/courses/purchase"
}
```

**Success Response:** (unchanged for non-marketplace courses)

```json
{
  "status": true,
  "code": 201,
  "message": "Course registered successfully (Free - WPU Course)",
  "data": {
    "id": 456,
    "course_id": 123,
    "academic_year": "2024/2025",
    "semester": "1ST",
    "course_title": "Introduction to Web Development",
    "course_code": "CS101",
    "is_marketplace": false,
    "owner_type": "wpu",
    "note": "This is a free WPU course"
  }
}
```

---

### 4. Get Available Courses (Updated)

**Endpoint:** `GET /api/courses/available`

**Authorization:** Student

**Query Parameters:** (unchanged)

- `academic_year` (optional)
- `semester` (optional)
- `program_id` (optional)

**Response Changes:**

The response now includes correct pricing information for marketplace WPU courses:

```json
{
  "status": true,
  "code": 200,
  "data": {
    "courses": [
      {
        "id": 123,
        "title": "Introduction to Web Development",
        "course_code": "CS101",
        "owner_type": "wpu",
        "is_marketplace": true,
        "marketplace_status": "published",
        "price": 5000, // NEW: Shows actual price for marketplace WPU courses
        "requires_purchase": true, // NEW: true for marketplace WPU courses
        "purchase_endpoint": "/api/marketplace/courses/purchase" // NEW: Provided for marketplace courses
        // ... other fields
      },
      {
        "id": 124,
        "title": "Database Management",
        "course_code": "CS102",
        "owner_type": "wpu",
        "is_marketplace": false,
        "price": 0, // Free for non-marketplace WPU courses
        "requires_purchase": false // No purchase needed
        // ... other fields
      }
    ]
  }
}
```

**Frontend Action:**

- If `requires_purchase === true`, show price and redirect to purchase flow
- If `requires_purchase === false`, allow free registration

---

## Marketplace Course Purchase

### 5. Purchase Marketplace Course (Updated)

**Endpoint:** `POST /api/marketplace/courses/purchase`

**Authorization:** Student

**Request Body:** (unchanged)

```json
{
  "course_id": 123,
  "payment_reference": "FLW-1234567890",
  "payment_method": "flutterwave"
}
```

**New Behavior:**

- **Now accepts WPU marketplace courses** (previously blocked)
- **No program restriction** for marketplace WPU courses (all students can purchase)
- **100% revenue to WPU** (no commission split)

**Response Changes:**

```json
{
  "success": true,
  "message": "Course purchased and enrollment successful",
  "data": {
    "transaction": {
      "id": 789,
      "course_price": 5000,
      "wsp_commission": 5000, // 100% for WPU courses
      "tutor_earnings": null, // NEW: null for WPU courses (was number for regular marketplace)
      "commission_rate": 0, // 0% commission for WPU courses
      "owner_type": "wpu", // NEW: Shows owner type
      "note": "WPU marketplace course - 100% revenue to WPU" // NEW: Helpful note
    },
    "enrollment": {
      "course_id": 123,
      "academic_year": "2024/2025",
      "semester": "1ST"
    }
  }
}
```

**Error Responses:**

```json
// Course not on marketplace
{
  "status": false,
  "code": 400,
  "message": "This course is not available on marketplace"
}

// Course not published
{
  "status": false,
  "code": 400,
  "message": "This course is not available on marketplace"
}

// Invalid price
{
  "status": false,
  "code": 400,
  "message": "Course price is invalid or not set"
}
```

**Previous Behavior (Removed):**

- ❌ Previously returned: `"This is a WPU course and is free. Please use the registration endpoint"`
- ✅ Now accepts WPU courses if they're on marketplace

---

## Course Allocation

### 6. Allocate Courses to Students (Updated)

**Endpoint:** `POST /api/admin/courses/allocate`

**Authorization:** Admin/Super Admin

**Request Body:** (unchanged)

```json
{
  "course_ids": [123, 124, 125],
  "allocation_type": "program",
  "program_id": 1,
  "academic_year": "2024/2025",
  "semester": "1ST"
}
```

**New Behavior:**

- **Marketplace WPU courses are automatically excluded** from allocation
- Only non-marketplace WPU courses can be allocated

**Error Response (New):**

```json
{
  "status": false,
  "code": 404,
  "message": "Some courses not found or not WPU courses: [123]"
}
```

This error occurs if:

- Course doesn't exist
- Course is not a WPU course (`owner_type` is not `"wpu"` or `"wsp"`)
- Course is a marketplace WPU course (`is_marketplace = true` + `marketplace_status = "published"`)

**Success Response:** (unchanged)

---

## Exam Access (Payment Verification)

### 7. Start Exam (Internal Change)

**Endpoint:** `POST /api/exams/student/exams/:examId/start`

**Authorization:** Student

**Internal Change:**

- Payment verification now treats **marketplace WPU courses as paid** (enrollment = payment)
- No changes to request/response format

**Behavior:**

- If student is enrolled in a marketplace WPU course → payment verified ✅
- If student is enrolled in a free WPU course → payment verified ✅
- If student is enrolled in a regular allocated course → checks `registration_status` and `course_reg_id`

**No frontend changes required** - this is handled automatically.

---

### 8. Get Student Exams (Internal Change)

**Endpoint:** `GET /api/exams/student/exams`

**Authorization:** Student

**Internal Change:**

- Exam list now includes exams for marketplace WPU courses (if enrolled)
- No changes to request/response format

**No frontend changes required** - this is handled automatically.

---

## Frontend Integration Checklist

### ✅ Admin Dashboard

- [ ] **Course Creation Form**

  - Add checkbox/toggle for `is_marketplace`
  - Add dropdown for `marketplace_status` (shown when `is_marketplace = true`)
  - Validate that `price > 0` when `marketplace_status = "published"`
  - Show warning: "Marketplace courses require payment from all students"

- [ ] **Course Edit Form**

  - Add same fields as creation form
  - Show current `is_marketplace` and `marketplace_status` values
  - Handle validation errors for marketplace fields

- [ ] **Course List/Table**
  - Display `is_marketplace` badge/indicator
  - Display `marketplace_status` badge (e.g., "Published", "Draft")
  - Filter/search by marketplace status

### ✅ Student Course Registration

- [ ] **Available Courses List**

  - Check `requires_purchase` flag
  - If `true`: Show price and "Purchase" button (redirects to purchase flow)
  - If `false`: Show "Register" button (free registration)
  - Display different UI for marketplace vs free courses

- [ ] **Registration Error Handling**
  - Handle new error: "This WPU course is listed on marketplace and requires purchase"
  - Show redirect button to purchase endpoint when this error occurs

### ✅ Marketplace Purchase

- [ ] **Purchase Flow**

  - Allow WPU marketplace courses (remove previous restriction)
  - Handle new response fields: `tutor_earnings: null`, `owner_type`, `note`
  - Display appropriate message for WPU courses: "100% revenue to WPU"

- [ ] **Transaction Display**
  - Show `tutor_earnings` only if not `null`
  - Display `note` field for clarity
  - Show `owner_type` if needed for admin views

### ✅ Course Allocation

- [ ] **Allocation Interface**
  - Filter out marketplace WPU courses from available courses list
  - Show message: "Marketplace courses cannot be allocated - students must purchase them"
  - Handle error: "Some courses not found or not WPU courses"

### ✅ General

- [ ] **Error Handling**

  - Handle all new error messages
  - Show user-friendly messages for marketplace-related errors

- [ ] **UI/UX Updates**
  - Add visual indicators for marketplace courses
  - Differentiate between free WPU courses and marketplace WPU courses
  - Show pricing clearly for marketplace courses

---

## Testing Checklist

### Admin Tests

- [ ] Create WPU course with `is_marketplace = true` and `marketplace_status = "published"`
- [ ] Create WPU course with `is_marketplace = true` and `marketplace_status = "draft"`
- [ ] Update existing WPU course to marketplace
- [ ] Update marketplace WPU course to non-marketplace
- [ ] Try to publish marketplace course without price (should fail)
- [ ] Try to allocate marketplace WPU course (should fail)

### Student Tests

- [ ] Try to register for marketplace WPU course (should fail with redirect message)
- [ ] Register for free WPU course (should succeed)
- [ ] Purchase marketplace WPU course (should succeed)
- [ ] View available courses (should show correct pricing)
- [ ] Take exam for marketplace WPU course (should work if enrolled)

---

## Summary of Changes

### New Fields

| Field                | Type         | Location                   | Description                                                     |
| -------------------- | ------------ | -------------------------- | --------------------------------------------------------------- |
| `is_marketplace`     | boolean      | Course model               | Whether course is on marketplace                                |
| `marketplace_status` | string       | Course model               | Status: "draft", "pending", "approved", "rejected", "published" |
| `requires_purchase`  | boolean      | Available courses response | Whether course requires purchase                                |
| `purchase_endpoint`  | string       | Available courses response | Endpoint to purchase course                                     |
| `tutor_earnings`     | number\|null | Purchase response          | null for WPU courses                                            |
| `owner_type`         | string       | Purchase response          | "wpu", "sole_tutor", or "organization"                          |
| `note`               | string       | Purchase response          | Helpful note about transaction                                  |

### Changed Behaviors

1. **WPU Courses on Marketplace:**

   - Require payment from all students (including WPU students)
   - No program restrictions
   - 100% revenue to WPU
   - Cannot be allocated (must be purchased)

2. **Free WPU Courses:**

   - Still free for WPU students
   - Program-restricted
   - Can be allocated

3. **Marketplace Purchase:**

   - Now accepts WPU courses
   - No program restrictions for marketplace courses

4. **Course Registration:**
   - Blocks marketplace WPU courses
   - Redirects to purchase endpoint

---

## Questions or Issues?

If you encounter any issues or have questions about these changes, please contact the backend team.

**Last Updated:** [Current Date]
**API Version:** v1
