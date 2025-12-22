# Tutor Dashboard API Documentation

## Overview

This document describes all API endpoints available for tutors (sole tutors and organizations) to manage their courses, view earnings, and manage their profiles on the LenerMe marketplace platform.

**Base URL:** `/api/marketplace/tutor`

**Authentication:** All endpoints require tutor authentication using the `tutorAuthorize` middleware. Include the JWT token in the Authorization header:

```
Authorization: Bearer <access_token>
```

**User Types Supported:**

- `sole_tutor` - Individual tutors (can access all dashboard endpoints)
- `organization` - Organization accounts (can access all dashboard endpoints + organization user management)
- `organization_user` - Users within an organization (can only login, cannot access dashboard - they teach courses on behalf of their organization)

**Important:**

- The dashboard automatically detects whether you're a `sole_tutor` or `organization` and filters data accordingly
- Organization user management endpoints are **ONLY** accessible by `organization` accounts (not `organization_user`)

---

## Table of Contents

1. [Dashboard](#dashboard)
2. [Profile Management](#profile-management)
3. [Course Management](#course-management)
4. [Earnings & Wallet](#earnings--wallet)
5. [Organization User Management](#organization-user-management) _(Organizations Only)_

---

## Dashboard

### Get Dashboard Overview

Get comprehensive dashboard statistics including courses, enrollments, revenue, and recent activity.

**Endpoint:** `GET /api/marketplace/tutor/dashboard`

**Headers:**

```
Authorization: Bearer <tutor_token>
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Dashboard data retrieved successfully",
  "data": {
    "overview": {
      "wallet_balance": 50000.0,
      "total_earnings": 150000.0,
      "total_payouts": 100000.0,
      "rating": 4.5,
      "total_reviews": 25
    },
    "courses": {
      "total": 15,
      "published": 10,
      "draft": 3,
      "pending": 2
    },
    "enrollments": {
      "total": 150
    },
    "revenue": {
      "total_revenue": 200000.0,
      "total_earnings": 170000.0,
      "last_30_days": {
        "revenue": 50000.0,
        "earnings": 42500.0,
        "transactions": 25
      }
    },
    "top_courses": [
      {
        "course_id": 123,
        "title": "Introduction to JavaScript",
        "course_code": "JS101",
        "price": 5000.0,
        "purchase_count": 45,
        "total_earnings": 191250.0
      }
    ],
    "recent_transactions": [
      {
        "id": 456,
        "course": {
          "id": 123,
          "title": "Introduction to JavaScript",
          "course_code": "JS101"
        },
        "course_price": 5000.0,
        "tutor_earnings": 4250.0,
        "currency": "NGN",
        "created_at": "2024-01-15T10:30:00Z"
      }
    ]
  }
}
```

---

## Profile Management

### Get Profile

Retrieve the tutor's profile information.

**Endpoint:** `GET /api/marketplace/tutor/profile`

**Headers:**

```
Authorization: Bearer <tutor_token>
```

**Response (200 OK) - Sole Tutor:**

```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "profile": {
      "id": 1,
      "email": "tutor@example.com",
      "fname": "John",
      "lname": "Doe",
      "mname": "Michael",
      "phone": "+2348012345678",
      "bio": "Experienced software developer and educator",
      "specialization": "Web Development, JavaScript",
      "qualifications": "MSc Computer Science",
      "experience_years": 10,
      "address": "123 Main St, Lagos",
      "country": "Nigeria",
      "timezone": "Africa/Lagos",
      "profile_image": "https://...",
      "status": "active",
      "verification_status": "verified",
      "wallet_balance": 50000.0,
      "total_earnings": 150000.0,
      "total_payouts": 100000.0,
      "commission_rate": 15.0,
      "rating": 4.5,
      "total_reviews": 25,
      "last_login": "2024-01-15T10:00:00Z",
      "created_at": "2023-06-01T00:00:00Z",
      "updated_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

**Response (200 OK) - Organization:**

```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "profile": {
      "id": 1,
      "email": "org@example.com",
      "name": "ABC Tutoring Services",
      "description": "Leading online education provider",
      "website": "https://abctutoring.com",
      "logo": "https://...",
      "phone": "+2348012345678",
      "address": "456 Business Ave, Lagos",
      "country": "Nigeria",
      "registration_number": "RC123456",
      "tax_id": "TAX789012",
      "contact_person": "Jane Smith",
      "contact_email": "contact@abctutoring.com",
      "contact_phone": "+2348098765432",
      "status": "active",
      "verification_status": "verified",
      "wallet_balance": 200000.0,
      "total_earnings": 500000.0,
      "total_payouts": 300000.0,
      "commission_rate": 15.0,
      "rating": 4.8,
      "total_reviews": 150,
      "last_login": "2024-01-15T10:00:00Z",
      "created_at": "2023-06-01T00:00:00Z",
      "updated_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

### Update Profile

Update tutor profile information.

**Endpoint:** `PUT /api/marketplace/tutor/profile`

**Headers:**

```
Authorization: Bearer <tutor_token>
Content-Type: application/json
```

**Request Body - Sole Tutor:**

```json
{
  "fname": "John",
  "lname": "Doe",
  "mname": "Michael",
  "phone": "+2348012345678",
  "bio": "Updated bio text",
  "specialization": "Web Development, JavaScript, React",
  "qualifications": "MSc Computer Science, BSc Software Engineering",
  "experience_years": 12,
  "address": "123 Main St, Lagos",
  "country": "Nigeria",
  "timezone": "Africa/Lagos",
  "profile_image": "https://..."
}
```

**Request Body - Organization:**

```json
{
  "name": "ABC Tutoring Services",
  "description": "Updated description",
  "website": "https://abctutoring.com",
  "logo": "https://...",
  "phone": "+2348012345678",
  "address": "456 Business Ave, Lagos",
  "country": "Nigeria",
  "registration_number": "RC123456",
  "tax_id": "TAX789012",
  "contact_person": "Jane Smith",
  "contact_email": "contact@abctutoring.com",
  "contact_phone": "+2348098765432"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "profile": {
      "id": 1,
      "email": "tutor@example.com",
      "fname": "John",
      "lname": "Doe",
      "status": "active",
      "wallet_balance": 50000.0,
      "total_earnings": 150000.0,
      "rating": 4.5
    }
  }
}
```

**Validation Rules:**

- For sole tutors: `fname` and `lname` are required if provided
- For organizations: `name` is required if provided
- All fields are optional (only provided fields will be updated)

---

## Course Management

### Get My Courses

Get a paginated list of all courses created by the tutor.

**Endpoint:** `GET /api/marketplace/tutor/courses`

**Headers:**

```
Authorization: Bearer <tutor_token>
```

**Query Parameters:**

- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 20) - Items per page
- `status` (optional) - Filter by status: `draft`, `pending`, `approved`, `rejected`, `published`
- `search` (optional) - Search by title or course code

**Example:**

```
GET /api/marketplace/tutor/courses?page=1&limit=20&status=published&search=javascript
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Courses retrieved successfully",
  "data": {
    "courses": [
      {
        "id": 123,
        "title": "Introduction to JavaScript",
        "course_code": "JS101",
        "course_unit": 3,
        "price": 5000.0,
        "course_type": "Core",
        "course_level": 100,
        "semester": "1ST",
        "program_id": 1,
        "faculty_id": 1,
        "currency": "NGN",
        "owner_type": "sole_tutor",
        "owner_id": 1,
        "is_marketplace": true,
        "marketplace_status": "published",
        "date": "2024-01-01T00:00:00Z",
        "enrollment_count": 45,
        "program": {
          "id": 1,
          "title": "Computer Science"
        },
        "faculty": {
          "id": 1,
          "name": "Faculty of Science"
        }
      }
    ],
    "pagination": {
      "total": 15,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

### Get Course by ID

Get detailed information about a specific course.

**Endpoint:** `GET /api/marketplace/tutor/courses/:id`

**Headers:**

```
Authorization: Bearer <tutor_token>
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Course retrieved successfully",
  "data": {
    "course": {
      "id": 123,
      "title": "Introduction to JavaScript",
      "course_code": "JS101",
      "course_unit": 3,
      "price": 5000.0,
      "course_type": "Core",
      "course_level": 100,
      "semester": "1ST",
      "program_id": 1,
      "faculty_id": 1,
      "currency": "NGN",
      "owner_type": "sole_tutor",
      "owner_id": 1,
      "is_marketplace": true,
      "marketplace_status": "published",
      "date": "2024-01-01T00:00:00Z",
      "enrollment_count": 45,
      "program": {
        "id": 1,
        "title": "Computer Science"
      },
      "faculty": {
        "id": 1,
        "name": "Faculty of Science"
      }
    }
  }
}
```

**Error (404 Not Found):**

```json
{
  "success": false,
  "message": "Course not found"
}
```

### Create Course

Create a new marketplace course.

**Endpoint:** `POST /api/marketplace/tutor/courses`

**Headers:**

```
Authorization: Bearer <tutor_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "title": "Introduction to JavaScript",
  "course_code": "JS101",
  "course_unit": 3,
  "price": 5000.0,
  "course_type": "Core",
  "course_level": 100,
  "semester": "1ST",
  "program_id": 1,
  "faculty_id": 1,
  "currency": "NGN",
  "marketplace_status": "draft"
}
```

**Required Fields:**

- `title` - Course title
- `course_code` - Unique course code (must be unique per tutor)

**Optional Fields:**

- `course_unit` - Course units/credits
- `price` - Course price (required if `marketplace_status` is `published`)
- `course_type` - Course type (e.g., "Core", "Elective")
- `course_level` - Course level (100, 200, 300, etc.)
- `semester` - Semester (e.g., "1ST", "2ND")
- `program_id` - Program ID
- `faculty_id` - Faculty ID
- `currency` - Currency code (default: "NGN")
- `marketplace_status` - Status: `draft` (default) or `published`

**Validation Rules:**

- `course_code` must be unique for the tutor's account
- If `marketplace_status` is `published`, `price` must be > 0

**Response (201 Created):**

```json
{
  "success": true,
  "message": "Course created successfully",
  "data": {
    "course": {
      "id": 123,
      "title": "Introduction to JavaScript",
      "course_code": "JS101",
      "marketplace_status": "draft",
      "price": 5000.0
    }
  }
}
```

**Error (400 Bad Request):**

```json
{
  "success": false,
  "message": "Title and course code are required"
}
```

**Error (409 Conflict):**

```json
{
  "success": false,
  "message": "Course code already exists for your account"
}
```

### Update Course

Update an existing course.

**Endpoint:** `PUT /api/marketplace/tutor/courses/:id`

**Headers:**

```
Authorization: Bearer <tutor_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "title": "Advanced JavaScript",
  "course_code": "JS201",
  "price": 7500.0,
  "marketplace_status": "published"
}
```

**All fields are optional** - only provided fields will be updated.

**Validation Rules:**

- `course_code` must be unique for the tutor's account (if changed)
- If `marketplace_status` is `published`, `price` must be > 0

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Course updated successfully",
  "data": {
    "course": {
      "id": 123,
      "title": "Advanced JavaScript",
      "course_code": "JS201",
      "marketplace_status": "published",
      "price": 7500.0
    }
  }
}
```

**Error (404 Not Found):**

```json
{
  "success": false,
  "message": "Course not found"
}
```

### Delete Course

Delete a course. Only courses with no enrollments can be deleted.

**Endpoint:** `DELETE /api/marketplace/tutor/courses/:id`

**Headers:**

```
Authorization: Bearer <tutor_token>
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Course deleted successfully"
}
```

**Error (400 Bad Request):**

```json
{
  "success": false,
  "message": "Cannot delete course with existing enrollments. Unpublish the course instead."
}
```

**Error (404 Not Found):**

```json
{
  "success": false,
  "message": "Course not found"
}
```

### Update Course Status

Publish or unpublish a course.

**Endpoint:** `PATCH /api/marketplace/tutor/courses/:id/status`

**Headers:**

```
Authorization: Bearer <tutor_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "marketplace_status": "published"
}
```

**Valid Values:**

- `draft` - Unpublish the course
- `published` - Publish the course

**Validation Rules:**

- To publish a course, it must have a valid price > 0

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Course published successfully",
  "data": {
    "course": {
      "id": 123,
      "title": "Introduction to JavaScript",
      "marketplace_status": "published"
    }
  }
}
```

**Error (400 Bad Request):**

```json
{
  "success": false,
  "message": "Cannot publish course without a valid price"
}
```

---

## Earnings & Wallet

### Get Earnings Summary

Get comprehensive earnings and wallet information.

**Endpoint:** `GET /api/marketplace/tutor/earnings/summary`

**Headers:**

```
Authorization: Bearer <tutor_token>
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Earnings summary retrieved successfully",
  "data": {
    "wallet": {
      "balance": 50000.0,
      "currency": "NGN"
    },
    "earnings": {
      "total_earnings": 150000.0,
      "total_payouts": 100000.0,
      "pending_payout": 50000.0
    },
    "revenue": {
      "all_time": {
        "total_revenue": 200000.0,
        "total_earnings": 170000.0,
        "transactions": 100
      },
      "last_30_days": {
        "total_revenue": 50000.0,
        "total_earnings": 42500.0,
        "transactions": 25
      },
      "last_7_days": {
        "total_revenue": 15000.0,
        "total_earnings": 12750.0,
        "transactions": 8
      }
    },
    "commission_rate": 15.0
  }
}
```

### Get Transactions

Get paginated list of all transactions (course purchases).

**Endpoint:** `GET /api/marketplace/tutor/earnings/transactions`

**Headers:**

```
Authorization: Bearer <tutor_token>
```

**Query Parameters:**

- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 20) - Items per page
- `start_date` (optional) - Filter from date (ISO 8601 format)
- `end_date` (optional) - Filter to date (ISO 8601 format)
- `payment_status` (optional) - Filter by status: `pending`, `completed`, `failed`, `refunded`

**Example:**

```
GET /api/marketplace/tutor/earnings/transactions?page=1&limit=20&payment_status=completed&start_date=2024-01-01&end_date=2024-01-31
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Transactions retrieved successfully",
  "data": {
    "transactions": [
      {
        "id": 456,
        "course": {
          "id": 123,
          "title": "Introduction to JavaScript",
          "course_code": "JS101"
        },
        "student": {
          "id": 789,
          "name": "Jane Smith",
          "email": "jane@example.com",
          "matric_number": "STU001"
        },
        "course_price": 5000.0,
        "tutor_earnings": 4250.0,
        "wsp_commission": 750.0,
        "commission_rate": 15.0,
        "currency": "NGN",
        "payment_status": "completed",
        "payment_method": "paystack",
        "payment_reference": "TXN123456",
        "tutor_paid": false,
        "payout_date": null,
        "created_at": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 20,
      "totalPages": 5
    }
  }
}
```

### Get Transaction by ID

Get detailed information about a specific transaction.

**Endpoint:** `GET /api/marketplace/tutor/earnings/transactions/:id`

**Headers:**

```
Authorization: Bearer <tutor_token>
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Transaction retrieved successfully",
  "data": {
    "transaction": {
      "id": 456,
      "course": {
        "id": 123,
        "title": "Introduction to JavaScript",
        "course_code": "JS101",
        "price": 5000.0
      },
      "student": {
        "id": 789,
        "name": "Jane Smith",
        "email": "jane@example.com",
        "matric_number": "STU001",
        "phone": "+2348012345678"
      },
      "course_price": 5000.0,
      "tutor_earnings": 4250.0,
      "wsp_commission": 750.0,
      "commission_rate": 15.0,
      "currency": "NGN",
      "payment_status": "completed",
      "payment_method": "paystack",
      "payment_reference": "TXN123456",
      "tutor_paid": false,
      "payout_date": null,
      "notes": null,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  }
}
```

**Error (404 Not Found):**

```json
{
  "success": false,
  "message": "Transaction not found"
}
```

---

## Error Responses

All endpoints may return the following error responses:

### 401 Unauthorized

```json
{
  "success": false,
  "message": "Authentication token required"
}
```

### 403 Forbidden

```json
{
  "success": false,
  "message": "Invalid user type for tutor access"
}
```

### 404 Not Found

```json
{
  "success": false,
  "message": "Resource not found"
}
```

### 400 Bad Request

```json
{
  "success": false,
  "message": "Validation error message"
}
```

### 500 Internal Server Error

```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

## Notes

1. **Authentication:** All endpoints require a valid JWT token obtained from the login endpoint (`/api/marketplace/login`).

2. **User Type:** The system automatically detects whether the authenticated user is a `sole_tutor` or `organization` and filters data accordingly.

3. **Commission Rate:** The default commission rate is 15%. This can be adjusted by administrators.

4. **Currency:** Currently, the system primarily supports NGN (Nigerian Naira). Multi-currency support may be added in the future.

5. **Course Statuses:**

   - `draft` - Course is not published and not visible to students
   - `pending` - Course is awaiting admin approval (not currently used for tutor courses)
   - `published` - Course is live and available for purchase

6. **Payouts:** Payout processing is handled by administrators. Tutors can view their wallet balance and pending payouts, but cannot initiate payouts directly through the API.

7. **Enrollments:** Enrollment counts reflect the number of students who have purchased the course (marketplace purchases only, not semester-based registrations).

8. **Organization User Management:** Organizations can manage their internal users (tutors, admins, managers) who teach courses on behalf of the organization. These users log in using `/api/marketplace/login/organization-user` and can teach courses owned by the organization.

---

## Organization User Management

**Note:** These endpoints are **ONLY** accessible by organization accounts (not organization users or sole tutors). Organizations can manage their internal users (tutors, admins, managers) who teach courses on behalf of the organization.

### Get All Organization Users

Get a paginated list of all users within the organization.

**Endpoint:** `GET /api/marketplace/tutor/organization/users`

**Headers:**

```
Authorization: Bearer <organization_token>
```

**Query Parameters:**

- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 20) - Items per page
- `role` (optional) - Filter by role: `admin`, `tutor`, `manager`
- `status` (optional) - Filter by status: `active`, `inactive`, `suspended`
- `search` (optional) - Search by name or email

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Organization users retrieved successfully",
  "data": {
    "users": [
      {
        "id": 1,
        "organization_id": 5,
        "email": "tutor1@org.com",
        "fname": "John",
        "lname": "Doe",
        "mname": null,
        "phone": "+2348012345678",
        "role": "tutor",
        "bio": "Experienced tutor",
        "specialization": "Mathematics",
        "qualifications": "MSc Math",
        "experience_years": 5,
        "status": "active",
        "rating": 4.5,
        "total_reviews": 20,
        "last_login": "2024-01-15T10:00:00Z",
        "created_at": "2023-06-01T00:00:00Z",
        "updated_at": "2024-01-15T10:00:00Z"
      }
    ],
    "pagination": {
      "total": 10,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

### Get Organization User by ID

Get detailed information about a specific organization user.

**Endpoint:** `GET /api/marketplace/tutor/organization/users/:id`

**Headers:**

```
Authorization: Bearer <organization_token>
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Organization user retrieved successfully",
  "data": {
    "user": {
      "id": 1,
      "organization_id": 5,
      "email": "tutor1@org.com",
      "fname": "John",
      "lname": "Doe",
      "role": "tutor",
      "status": "active"
    }
  }
}
```

### Create Organization User

Create a new user (tutor, admin, or manager) for the organization.

**Endpoint:** `POST /api/marketplace/tutor/organization/users`

**Headers:**

```
Authorization: Bearer <organization_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "newtutor@org.com",
  "password": "SecurePassword123",
  "fname": "Jane",
  "lname": "Smith",
  "mname": "Marie",
  "phone": "+2348098765432",
  "role": "tutor",
  "bio": "New tutor joining the team",
  "specialization": "Physics",
  "qualifications": "PhD Physics",
  "experience_years": 8
}
```

**Required Fields:**

- `email` - User email (must be unique)
- `password` - User password
- `fname` - First name
- `lname` - Last name

**Optional Fields:**

- `mname` - Middle name
- `phone` - Phone number
- `role` - Role: `admin`, `tutor` (default), or `manager`
- `bio` - Biography
- `specialization` - Subject specialization
- `qualifications` - Educational qualifications
- `experience_years` - Years of experience

**Response (201 Created):**

```json
{
  "success": true,
  "message": "Organization user created successfully",
  "data": {
    "user": {
      "id": 2,
      "email": "newtutor@org.com",
      "fname": "Jane",
      "lname": "Smith",
      "role": "tutor",
      "status": "active"
    }
  }
}
```

### Update Organization User

Update an organization user's information.

**Endpoint:** `PUT /api/marketplace/tutor/organization/users/:id`

**Headers:**

```
Authorization: Bearer <organization_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "fname": "Jane",
  "lname": "Smith",
  "role": "manager",
  "status": "active",
  "specialization": "Physics, Mathematics"
}
```

**All fields are optional** - only provided fields will be updated.

**Valid Roles:** `admin`, `tutor`, `manager`
**Valid Statuses:** `active`, `inactive`, `suspended`

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Organization user updated successfully",
  "data": {
    "user": {
      "id": 2,
      "email": "newtutor@org.com",
      "fname": "Jane",
      "lname": "Smith",
      "role": "manager",
      "status": "active"
    }
  }
}
```

### Delete Organization User

Delete an organization user.

**Endpoint:** `DELETE /api/marketplace/tutor/organization/users/:id`

**Headers:**

```
Authorization: Bearer <organization_token>
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Organization user deleted successfully"
}
```

### Reset Organization User Password

Reset a user's password.

**Endpoint:** `POST /api/marketplace/tutor/organization/users/:id/reset-password`

**Headers:**

```
Authorization: Bearer <organization_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "newPassword": "NewSecurePassword123"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

### Get Organization Users Statistics

Get statistics about organization users.

**Endpoint:** `GET /api/marketplace/tutor/organization/users/stats`

**Headers:**

```
Authorization: Bearer <organization_token>
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Organization users statistics retrieved successfully",
  "data": {
    "total": 15,
    "by_status": {
      "active": 12,
      "inactive": 2,
      "suspended": 1
    },
    "by_role": {
      "admin": 2,
      "tutor": 10,
      "manager": 3
    }
  }
}
```

---

## Support

For issues or questions regarding the Tutor Dashboard API, please contact the LenerMe support team.
