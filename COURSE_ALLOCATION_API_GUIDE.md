# Course Allocation System - API Testing Guide

## Overview

This guide covers the new **Course Allocation & Pricing System** that allows super admins to:

1. Set semester-specific course prices
2. Allocate courses to students (by program, level, faculty, or individually)
3. Manage registration deadlines
4. Enable students to self-register for allocated courses

**Important Notes:**

- Students can only register for **allocated** courses (not arbitrary WPU courses)
- Registration is **all-or-nothing** (must register for all allocated courses at once)
- Prices can be set per course per semester
- Registration deadlines can be extended by super admins

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Course Pricing Management (Super Admin)](#course-pricing-management-super-admin)
3. [Course Allocation Management (Super Admin)](#course-allocation-management-super-admin)
4. [Student Course Allocation](#student-course-allocation)
5. [Registration Deadline Management](#registration-deadline-management)
6. [Complete Workflow Example](#complete-workflow-example)
7. [Frontend Implementation Guide](#frontend-implementation-guide)
8. [Error Handling](#error-handling)

---

## Prerequisites

### Environment Variables

Make sure you have these Postman environment variables set:

```
BASE_URL = https://your-api-url.com (or http://localhost:3000 for local)
ADMIN_TOKEN = (your super admin JWT token)
STUDENT_TOKEN = (your student JWT token)
```

### Authentication

All endpoints require authentication:

- **Super Admin endpoints**: Use `ADMIN_TOKEN` in the `Authorization` header
- **Student endpoints**: Use `STUDENT_TOKEN` in the `Authorization` header

**Header Format:**

```
Authorization: Bearer {{ADMIN_TOKEN}}
```

### Required Data Setup

Before testing, ensure you have:

1. ✅ Active semester created
2. ✅ Courses created (with `owner_type = "wpu"`)
3. ✅ Students created and assigned to programs
4. ✅ Programs and faculties set up

---

## Course Pricing Management (Super Admin)

### 1. Set Single Course Price

Set or update the price for a specific course in a specific semester.

**Endpoint:** `POST /api/admin/courses/pricing`

**Request Body:**

```json
{
  "course_id": 1,
  "academic_year": "2024/2025",
  "semester": "1ST",
  "price": 50000,
  "currency": "NGN"
}
```

**Response (201 Created / 200 Updated):**

```json
{
  "success": true,
  "message": "Course price set successfully",
  "data": {
    "pricing": {
      "id": 1,
      "course_id": 1,
      "course_title": "Introduction to Computer Science",
      "course_code": "CSC101",
      "academic_year": "2024/2025",
      "semester": "1ST",
      "price": 50000,
      "currency": "NGN"
    }
  }
}
```

**Postman Setup:**

- Method: `POST`
- URL: `{{BASE_URL}}/api/admin/courses/pricing`
- Headers: `Authorization: Bearer {{ADMIN_TOKEN}}`
- Body: Raw JSON (as shown above)

**Frontend Implementation:**

```javascript
const setCoursePrice = async (
  courseId,
  academicYear,
  semester,
  price,
  currency = "NGN"
) => {
  const response = await fetch(`${API_URL}/api/admin/courses/pricing`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      course_id: courseId,
      academic_year: academicYear,
      semester: semester,
      price: price,
      currency: currency,
    }),
  });
  return response.json();
};
```

---

### 2. Bulk Set Course Prices

Set prices for multiple courses at once.

**Endpoint:** `POST /api/admin/courses/pricing/bulk`

**Request Body:**

```json
{
  "academic_year": "2024/2025",
  "semester": "1ST",
  "prices": [
    {
      "course_id": 1,
      "price": 50000,
      "currency": "NGN"
    },
    {
      "course_id": 2,
      "price": 45000,
      "currency": "NGN"
    },
    {
      "course_id": 3,
      "price": 55000,
      "currency": "NGN"
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "message": "Bulk pricing set successfully",
  "data": {
    "created": 2,
    "updated": 1,
    "total": 3,
    "prices": [
      {
        "id": 1,
        "course_id": 1,
        "course_code": "CSC101",
        "price": 50000
      },
      {
        "id": 2,
        "course_id": 2,
        "course_code": "CSC102",
        "price": 45000
      },
      {
        "id": 3,
        "course_id": 3,
        "course_code": "CSC103",
        "price": 55000
      }
    ]
  }
}
```

**Frontend Implementation:**

```javascript
const bulkSetCoursePrices = async (academicYear, semester, prices) => {
  const response = await fetch(`${API_URL}/api/admin/courses/pricing/bulk`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      academic_year: academicYear,
      semester: semester,
      prices: prices,
    }),
  });
  return response.json();
};
```

---

### 3. Get Course Prices for Semester

Retrieve all course prices for a specific semester.

**Endpoint:** `GET /api/admin/courses/pricing`

**Query Parameters:**

- `academic_year` (required): e.g., "2024/2025"
- `semester` (required): "1ST" or "2ND"
- `course_id` (optional): Filter by specific course
- `program_id` (optional): Filter by program

**Example Request:**

```
GET {{BASE_URL}}/api/admin/courses/pricing?academic_year=2024/2025&semester=1ST
```

**Response:**

```json
{
  "success": true,
  "message": "Course prices retrieved successfully",
  "data": {
    "prices": [
      {
        "id": 1,
        "course_id": 1,
        "course_title": "Introduction to Computer Science",
        "course_code": "CSC101",
        "academic_year": "2024/2025",
        "semester": "1ST",
        "price": 50000,
        "currency": "NGN",
        "created_at": "2024-01-15T10:00:00Z"
      },
      {
        "id": 2,
        "course_id": 2,
        "course_title": "Data Structures",
        "course_code": "CSC102",
        "academic_year": "2024/2025",
        "semester": "1ST",
        "price": 45000,
        "currency": "NGN",
        "created_at": "2024-01-15T10:00:00Z"
      }
    ],
    "total": 2
  }
}
```

**Frontend Implementation:**

```javascript
const getCoursePrices = async (academicYear, semester, filters = {}) => {
  const params = new URLSearchParams({
    academic_year: academicYear,
    semester: semester,
    ...filters,
  });
  const response = await fetch(
    `${API_URL}/api/admin/courses/pricing?${params}`,
    {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    }
  );
  return response.json();
};
```

---

### 4. Copy Course Prices from Another Semester

Copy all course prices from one semester to another.

**Endpoint:** `POST /api/admin/courses/pricing/copy`

**Request Body:**

```json
{
  "from_academic_year": "2023/2024",
  "from_semester": "1ST",
  "to_academic_year": "2024/2025",
  "to_semester": "1ST",
  "program_id": 1
}
```

**Response:**

```json
{
  "success": true,
  "message": "Course prices copied successfully",
  "data": {
    "copied": 15,
    "from": {
      "academic_year": "2023/2024",
      "semester": "1ST"
    },
    "to": {
      "academic_year": "2024/2025",
      "semester": "1ST"
    }
  }
}
```

**Frontend Implementation:**

```javascript
const copyCoursePrices = async (
  fromAcademicYear,
  fromSemester,
  toAcademicYear,
  toSemester,
  programId = null
) => {
  const response = await fetch(`${API_URL}/api/admin/courses/pricing/copy`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from_academic_year: fromAcademicYear,
      from_semester: fromSemester,
      to_academic_year: toAcademicYear,
      to_semester: toSemester,
      program_id: programId,
    }),
  });
  return response.json();
};
```

---

## Course Allocation Management (Super Admin)

### 1. Allocate Courses to Students

Allocate courses to students based on different criteria.

**Endpoint:** `POST /api/admin/courses/allocate`

**Allocation Types:**

#### A. Program-Based Allocation

Allocate courses to all students in a program (optionally filtered by level).

**Request Body:**

```json
{
  "allocation_type": "program",
  "course_ids": [1, 2, 3],
  "academic_year": "2024/2025",
  "semester": "1ST",
  "program_id": 1,
  "level": "100"
}
```

#### B. Level-Based Allocation

Allocate courses to all students at a specific level across all programs.

**Request Body:**

```json
{
  "allocation_type": "level",
  "course_ids": [1, 2, 3],
  "academic_year": "2024/2025",
  "semester": "1ST",
  "level": "100"
}
```

#### C. Individual Allocation

Allocate courses to specific students by ID.

**Request Body:**

```json
{
  "allocation_type": "individual",
  "course_ids": [1, 2, 3],
  "academic_year": "2024/2025",
  "semester": "1ST",
  "student_ids": [10, 11, 12]
}
```

#### D. Faculty-Based Allocation

Allocate courses to all students in a faculty (optionally filtered by level).

**Request Body:**

```json
{
  "allocation_type": "faculty",
  "course_ids": [1, 2, 3],
  "academic_year": "2024/2025",
  "semester": "1ST",
  "faculty_id": 1,
  "level": "100"
}
```

**Optional: Exclude Students**

```json
{
  "allocation_type": "program",
  "course_ids": [1, 2, 3],
  "academic_year": "2024/2025",
  "semester": "1ST",
  "program_id": 1,
  "exclude_student_ids": [5, 6]
}
```

**Response:**

```json
{
  "success": true,
  "message": "Courses allocated: 45 allocations created, 3 skipped",
  "data": {
    "summary": {
      "students_count": 15,
      "courses_count": 3,
      "total_possible": 45,
      "allocated": 42,
      "skipped": 3,
      "errors": 0
    },
    "errors": []
  }
}
```

**Frontend Implementation:**

```javascript
const allocateCourses = async (allocationData) => {
  const response = await fetch(`${API_URL}/api/admin/courses/allocate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(allocationData),
  });
  return response.json();
};

// Example usage
await allocateCourses({
  allocation_type: "program",
  course_ids: [1, 2, 3],
  academic_year: "2024/2025",
  semester: "1ST",
  program_id: 1,
  level: "100",
});
```

---

### 2. Get All Allocations

Retrieve all course allocations with filtering options.

**Endpoint:** `GET /api/admin/courses/allocations`

**Query Parameters:**

- `academic_year` (optional)
- `semester` (optional)
- `student_id` (optional)
- `program_id` (optional)
- `level` (optional)
- `registration_status` (optional): "allocated", "registered", "cancelled"
- `page` (optional, default: 1)
- `limit` (optional, default: 20)

**Example Request:**

```
GET {{BASE_URL}}/api/admin/courses/allocations?academic_year=2024/2025&semester=1ST&registration_status=allocated&page=1&limit=20
```

**Response:**

```json
{
  "success": true,
  "message": "Allocated courses retrieved successfully",
  "data": {
    "allocations": [
      {
        "id": 1,
        "student": {
          "id": 10,
          "name": "John Doe",
          "email": "john@example.com",
          "matric_number": "2024/001",
          "level": "100"
        },
        "course": {
          "id": 1,
          "title": "Introduction to Computer Science",
          "course_code": "CSC101",
          "course_unit": 3
        },
        "academic_year": "2024/2025",
        "semester": "1ST",
        "registration_status": "allocated",
        "allocated_price": 50000,
        "allocated_at": "2024-01-15T10:00:00Z",
        "registered_at": null
      }
    ],
    "pagination": {
      "total": 45,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    }
  }
}
```

**Frontend Implementation:**

```javascript
const getAllocations = async (filters = {}) => {
  const params = new URLSearchParams(filters);
  const response = await fetch(
    `${API_URL}/api/admin/courses/allocations?${params}`,
    {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    }
  );
  return response.json();
};
```

---

### 3. Remove Single Allocation

Remove a specific course allocation (only if not yet registered).

**Endpoint:** `DELETE /api/admin/courses/allocate/:id`

**Example Request:**

```
DELETE {{BASE_URL}}/api/admin/courses/allocate/1
```

**Response:**

```json
{
  "success": true,
  "message": "Course allocation removed successfully"
}
```

**Error Response (if already registered):**

```json
{
  "success": false,
  "error": "Cannot remove allocation that is already registered. Student must unregister first.",
  "statusCode": 400
}
```

---

### 4. Bulk Remove Allocations

Remove multiple allocations at once.

**Endpoint:** `DELETE /api/admin/courses/allocate/bulk`

**Request Body:**

```json
{
  "academic_year": "2024/2025",
  "semester": "1ST",
  "student_ids": [10, 11, 12],
  "course_ids": [1, 2]
}
```

**Response:**

```json
{
  "success": true,
  "message": "15 allocations removed successfully",
  "data": {
    "deleted_count": 15
  }
}
```

**Note:** Only removes allocations with `registration_status = "allocated"`. Registered allocations cannot be bulk removed.

---

## Student Course Allocation

### 1. Get My Allocated Courses

Get all allocated courses for the current student in the active semester.

**Endpoint:** `GET /api/courses/allocated`

**Headers:**

```
Authorization: Bearer {{STUDENT_TOKEN}}
```

**Response:**

```json
{
  "success": true,
  "message": "Allocated courses retrieved successfully",
  "data": {
    "semester": {
      "id": 1,
      "academic_year": "2024/2025",
      "semester": "1ST",
      "status": "ACTIVE",
      "registration_deadline": "2024-02-15T00:00:00Z",
      "deadline_passed": false
    },
    "allocated_courses": [
      {
        "allocation_id": 1,
        "course": {
          "id": 1,
          "title": "Introduction to Computer Science",
          "course_code": "CSC101",
          "course_unit": 3
        },
        "price": 50000,
        "allocated_at": "2024-01-15T10:00:00Z"
      },
      {
        "allocation_id": 2,
        "course": {
          "id": 2,
          "title": "Data Structures",
          "course_code": "CSC102",
          "course_unit": 3
        },
        "price": 45000,
        "allocated_at": "2024-01-15T10:00:00Z"
      }
    ],
    "total_amount": 95000,
    "course_count": 2,
    "can_register": true
  }
}
```

**Frontend Implementation:**

```javascript
const getMyAllocatedCourses = async () => {
  const response = await fetch(`${API_URL}/api/courses/allocated`, {
    headers: {
      Authorization: `Bearer ${studentToken}`,
    },
  });
  return response.json();
};
```

**UI Display Example:**

```jsx
const AllocatedCoursesView = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    getMyAllocatedCourses().then(setData);
  }, []);

  if (!data) return <Loading />;

  return (
    <div>
      <h2>
        Allocated Courses - {data.semester.academic_year}{" "}
        {data.semester.semester}
      </h2>

      {data.semester.deadline_passed && (
        <Alert type="warning">
          Registration deadline has passed. Contact admin to extend.
        </Alert>
      )}

      <CourseList courses={data.allocated_courses} />

      <Summary>
        <div>Total Amount: ₦{data.total_amount.toLocaleString()}</div>
        <div>Courses: {data.course_count}</div>
      </Summary>

      {data.can_register && (
        <Button onClick={handleRegister}>Register for All Courses</Button>
      )}
    </div>
  );
};
```

---

### 2. Register for All Allocated Courses

Register for all allocated courses at once (all-or-nothing).

**Endpoint:** `POST /api/courses/register-allocated`

**Headers:**

```
Authorization: Bearer {{STUDENT_TOKEN}}
```

**Request Body:** None (automatically registers all allocated courses for current semester)

**Response:**

```json
{
  "success": true,
  "message": "All allocated courses registered successfully",
  "data": {
    "order": {
      "id": 123,
      "amount": 95000,
      "currency": "NGN",
      "date": "2024-01-20T10:00:00Z"
    },
    "courses": [
      {
        "allocation_id": 1,
        "course_id": 1,
        "course_code": "CSC101",
        "course_title": "Introduction to Computer Science",
        "price": 50000,
        "allocated_price": 50000
      },
      {
        "allocation_id": 2,
        "course_id": 2,
        "course_code": "CSC102",
        "course_title": "Data Structures",
        "price": 45000,
        "allocated_price": 45000
      }
    ],
    "payment": {
      "transaction_id": 456,
      "amount_debited": 95000,
      "previous_balance": 100000,
      "new_balance": 5000
    },
    "registered_count": 2
  }
}
```

**Frontend Implementation:**

```javascript
const registerAllocatedCourses = async () => {
  const response = await fetch(`${API_URL}/api/courses/register-allocated`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${studentToken}`,
      "Content-Type": "application/json",
    },
  });
  return response.json();
};
```

**UI Flow:**

```jsx
const handleRegister = async () => {
  // Show confirmation dialog
  const confirmed = await showConfirmDialog({
    title: "Confirm Registration",
    message: `Register for all ${
      data.course_count
    } allocated courses? Total: ₦${data.total_amount.toLocaleString()}`,
    confirmText: "Register",
    cancelText: "Cancel",
  });

  if (!confirmed) return;

  try {
    setLoading(true);
    const result = await registerAllocatedCourses();

    // Show success message
    showSuccessToast(
      `Successfully registered for ${result.registered_count} courses!`
    );

    // Refresh allocated courses (should now be empty)
    await refreshAllocatedCourses();

    // Show payment receipt
    showReceiptModal(result.data);
  } catch (error) {
    showErrorToast(error.message);
  } finally {
    setLoading(false);
  }
};
```

**Error Responses:**

**Insufficient Wallet Balance:**

```json
{
  "success": false,
  "error": "Insufficient wallet balance. Required: 95000, Available: 50000",
  "statusCode": 400
}
```

**Deadline Passed:**

```json
{
  "success": false,
  "error": "Registration deadline has passed. Please contact admin to extend the deadline.",
  "statusCode": 400
}
```

**No Allocated Courses:**

```json
{
  "success": false,
  "error": "No allocated courses found for current semester",
  "statusCode": 404
}
```

---

## Registration Deadline Management

### Extend Registration Deadline

Extend the registration deadline for a semester.

**Endpoint:** `PATCH /api/admin/semesters/:id/extend-deadline`

**Request Body:**

```json
{
  "registration_deadline": "2024-03-15"
}
```

**Example Request:**

```
PATCH {{BASE_URL}}/api/admin/semesters/1/extend-deadline
```

**Response:**

```json
{
  "success": true,
  "message": "Registration deadline extended successfully",
  "data": {
    "semester": {
      "id": 1,
      "academic_year": "2024/2025",
      "semester": "1ST",
      "registration_deadline": "2024-03-15T00:00:00Z"
    }
  }
}
```

**Frontend Implementation:**

```javascript
const extendRegistrationDeadline = async (semesterId, newDeadline) => {
  const response = await fetch(
    `${API_URL}/api/admin/semesters/${semesterId}/extend-deadline`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        registration_deadline: newDeadline, // Format: "YYYY-MM-DD"
      }),
    }
  );
  return response.json();
};
```

---

## Complete Workflow Example

### Step-by-Step: Setting Up Course Allocation for a Semester

#### 1. Create/Verify Active Semester

```
GET {{BASE_URL}}/api/admin/semesters/current
```

#### 2. Set Course Prices for Semester

```json
POST {{BASE_URL}}/api/admin/courses/pricing/bulk
{
  "academic_year": "2024/2025",
  "semester": "1ST",
  "prices": [
    { "course_id": 1, "price": 50000, "currency": "NGN" },
    { "course_id": 2, "price": 45000, "currency": "NGN" },
    { "course_id": 3, "price": 55000, "currency": "NGN" }
  ]
}
```

#### 3. Set Registration Deadline

```json
PATCH {{BASE_URL}}/api/admin/semesters/1/extend-deadline
{
  "registration_deadline": "2024-02-15"
}
```

#### 4. Allocate Courses to Students

```json
POST {{BASE_URL}}/api/admin/courses/allocate
{
  "allocation_type": "program",
  "course_ids": [1, 2, 3],
  "academic_year": "2024/2025",
  "semester": "1ST",
  "program_id": 1,
  "level": "100"
}
```

#### 5. Verify Allocations (Admin View)

```
GET {{BASE_URL}}/api/admin/courses/allocations?academic_year=2024/2025&semester=1ST&registration_status=allocated
```

#### 6. Student Views Allocated Courses

```
GET {{BASE_URL}}/api/courses/allocated
(With STUDENT_TOKEN)
```

#### 7. Student Registers for All Courses

```
POST {{BASE_URL}}/api/courses/register-allocated
(With STUDENT_TOKEN)
```

#### 8. Verify Registration (Admin View)

```
GET {{BASE_URL}}/api/admin/courses/allocations?academic_year=2024/2025&semester=1ST&registration_status=registered
```

---

## Frontend Implementation Guide

### Super Admin Dashboard - Course Allocation

#### 1. Course Pricing Management UI

```jsx
const CoursePricingManager = ({ academicYear, semester }) => {
  const [courses, setCourses] = useState([]);
  const [prices, setPrices] = useState({});

  // Load courses for program
  useEffect(() => {
    loadCourses().then(setCourses);
    loadCoursePrices(academicYear, semester).then(setPrices);
  }, [academicYear, semester]);

  const handleBulkPriceUpdate = async () => {
    const priceArray = Object.entries(prices).map(([courseId, price]) => ({
      course_id: parseInt(courseId),
      price: parseFloat(price),
      currency: "NGN",
    }));

    await bulkSetCoursePrices(academicYear, semester, priceArray);
    showSuccessToast("Prices updated successfully");
  };

  return (
    <div>
      <h2>
        Set Course Prices - {academicYear} {semester}
      </h2>
      <Table>
        <thead>
          <tr>
            <th>Course Code</th>
            <th>Course Title</th>
            <th>Price (₦)</th>
          </tr>
        </thead>
        <tbody>
          {courses.map((course) => (
            <tr key={course.id}>
              <td>{course.course_code}</td>
              <td>{course.title}</td>
              <td>
                <Input
                  type="number"
                  value={prices[course.id] || ""}
                  onChange={(e) =>
                    setPrices({
                      ...prices,
                      [course.id]: e.target.value,
                    })
                  }
                  placeholder="Enter price"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Button onClick={handleBulkPriceUpdate}>Save All Prices</Button>
    </div>
  );
};
```

#### 2. Course Allocation UI

```jsx
const CourseAllocationManager = () => {
  const [allocationType, setAllocationType] = useState("program");
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [filters, setFilters] = useState({});

  const handleAllocate = async () => {
    const allocationData = {
      allocation_type: allocationType,
      course_ids: selectedCourses,
      academic_year: currentSemester.academic_year,
      semester: currentSemester.semester,
      ...filters,
    };

    const result = await allocateCourses(allocationData);
    showSuccessToast(
      `${result.summary.allocated} courses allocated to ${result.summary.students_count} students`
    );
  };

  return (
    <div>
      <h2>Allocate Courses</h2>

      <Select
        value={allocationType}
        onChange={(e) => setAllocationType(e.target.value)}
      >
        <option value="program">By Program</option>
        <option value="level">By Level</option>
        <option value="faculty">By Faculty</option>
        <option value="individual">Individual Students</option>
      </Select>

      {allocationType === "program" && (
        <ProgramSelector
          value={filters.program_id}
          onChange={(id) => setFilters({ ...filters, program_id: id })}
        />
      )}

      {allocationType === "faculty" && (
        <FacultySelector
          value={filters.faculty_id}
          onChange={(id) => setFilters({ ...filters, faculty_id: id })}
        />
      )}

      {allocationType === "individual" && (
        <StudentMultiSelect
          value={filters.student_ids}
          onChange={(ids) => setFilters({ ...filters, student_ids: ids })}
        />
      )}

      <CourseMultiSelect
        value={selectedCourses}
        onChange={setSelectedCourses}
      />

      <Button onClick={handleAllocate} disabled={selectedCourses.length === 0}>
        Allocate Courses
      </Button>
    </div>
  );
};
```

#### 3. Student Registration UI

```jsx
const StudentCourseRegistration = () => {
  const [allocationData, setAllocationData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAllocatedCourses().then(setAllocationData);
  }, []);

  const handleRegister = async () => {
    if (!allocationData.can_register) {
      showErrorToast(
        "Cannot register. Deadline may have passed or no courses allocated."
      );
      return;
    }

    const confirmed = await showConfirmDialog({
      title: "Confirm Registration",
      message: `Register for ${
        allocationData.course_count
      } courses? Total: ₦${allocationData.total_amount.toLocaleString()}`,
    });

    if (!confirmed) return;

    try {
      setLoading(true);
      const result = await registerAllocatedCourses();
      showSuccessToast("Registration successful!");
      setAllocationData(null); // Refresh
    } catch (error) {
      showErrorToast(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!allocationData) return <Loading />;

  return (
    <div>
      <h2>
        Course Registration - {allocationData.semester.academic_year}{" "}
        {allocationData.semester.semester}
      </h2>

      {allocationData.semester.deadline_passed && (
        <Alert type="warning">
          Registration deadline has passed. Please contact admin.
        </Alert>
      )}

      {allocationData.allocated_courses.length === 0 ? (
        <EmptyState message="No courses allocated for this semester" />
      ) : (
        <>
          <CourseList courses={allocationData.allocated_courses} />

          <SummaryCard>
            <div>
              Total Amount: ₦{allocationData.total_amount.toLocaleString()}
            </div>
            <div>Number of Courses: {allocationData.course_count}</div>
            <div>
              Deadline:{" "}
              {formatDate(allocationData.semester.registration_deadline)}
            </div>
          </SummaryCard>

          <Button
            onClick={handleRegister}
            disabled={!allocationData.can_register || loading}
            loading={loading}
          >
            Register for All Courses
          </Button>
        </>
      )}
    </div>
  );
};
```

---

## Error Handling

### Common Error Responses

#### 1. Validation Errors (400)

```json
{
  "success": false,
  "error": "course_id, academic_year, semester, and price are required",
  "statusCode": 400
}
```

#### 2. Not Found Errors (404)

```json
{
  "success": false,
  "error": "Course not found",
  "statusCode": 404
}
```

#### 3. Authorization Errors (403)

```json
{
  "success": false,
  "error": "Only students can access this endpoint",
  "statusCode": 403
}
```

#### 4. Insufficient Balance (400)

```json
{
  "success": false,
  "error": "Insufficient wallet balance. Required: 95000, Available: 50000",
  "statusCode": 400
}
```

#### 5. Deadline Passed (400)

```json
{
  "success": false,
  "error": "Registration deadline has passed. Please contact admin to extend the deadline.",
  "statusCode": 400
}
```

### Frontend Error Handling

```javascript
const handleApiError = (error) => {
  if (error.statusCode === 400) {
    // Validation or business logic error
    showErrorToast(error.error);
  } else if (error.statusCode === 401) {
    // Unauthorized - redirect to login
    redirectToLogin();
  } else if (error.statusCode === 403) {
    // Forbidden - show access denied
    showErrorToast("You don't have permission to perform this action");
  } else if (error.statusCode === 404) {
    // Not found
    showErrorToast("Resource not found");
  } else {
    // Server error
    showErrorToast("An error occurred. Please try again later.");
  }
};

// Usage
try {
  const result = await registerAllocatedCourses();
  // Handle success
} catch (error) {
  handleApiError(error);
}
```

---

## Testing Checklist

### Super Admin Tests

- [ ] Set single course price
- [ ] Bulk set course prices
- [ ] Get course prices for semester
- [ ] Copy prices from another semester
- [ ] Allocate courses by program
- [ ] Allocate courses by level
- [ ] Allocate courses by faculty
- [ ] Allocate courses to individual students
- [ ] Exclude specific students from allocation
- [ ] View all allocations with filters
- [ ] Remove single allocation (unregistered)
- [ ] Bulk remove allocations
- [ ] Extend registration deadline
- [ ] Verify cannot remove registered allocations

### Student Tests

- [ ] View allocated courses
- [ ] See total amount and course count
- [ ] See registration deadline status
- [ ] Register for all allocated courses
- [ ] Verify wallet balance is checked
- [ ] Verify deadline is checked
- [ ] Verify all-or-nothing registration
- [ ] Verify payment transaction is created
- [ ] Verify wallet balance is updated
- [ ] Handle insufficient balance error
- [ ] Handle deadline passed error

---

## Important Notes

1. **All-or-Nothing Registration**: Students must register for ALL allocated courses at once. Partial registration is not supported.

2. **Price Updates**: If course prices change after allocation but before registration, the student will pay the CURRENT price (not the allocated price).

3. **Registration Status Flow**:

   - `allocated` → Course allocated by admin, student hasn't registered
   - `registered` → Student has registered and paid
   - `cancelled` → Registration cancelled (future feature)

4. **Deadline Extension**: Only super admins can extend registration deadlines. Students cannot register after the deadline unless it's extended.

5. **Marketplace Courses**: This system only applies to WPU program courses (`owner_type = "wpu"`). Marketplace courses use a separate registration flow.

6. **Wallet Balance**: Students must have sufficient wallet balance to register. The system automatically debits the wallet upon registration.

---

## ⚠️ Breaking Changes & Affected Endpoints

### Deprecated Endpoints

#### 1. `POST /api/courses/register` (DEPRECATED)

**Status:** ⚠️ **DEPRECATED** - Use new allocation system instead

**Reason:** This endpoint allowed students to register for WPU courses individually for free. With the new allocation system, students must register for allocated courses through the new endpoint.

**Replacement:** Use `POST /api/courses/register-allocated` instead

**Migration Guide for Frontend:**

- **Old Flow:**

  ```javascript
  // OLD - Individual course registration (FREE)
  POST /api/courses/register
  {
    "course_id": 1,
    "academic_year": "2024/2025",
    "semester": "1ST"
  }
  ```

- **New Flow:**
  ```javascript
  // NEW - Register for all allocated courses (PAID)
  POST / api / courses / register - allocated;
  // No body needed - automatically registers all allocated courses
  ```

**Action Required:**

- Remove or disable the old individual registration UI
- Update to use the new allocated courses registration flow
- Show students their allocated courses first via `GET /api/courses/allocated`

---

### Modified Endpoints (Response Changes)

#### 2. `GET /api/courses/student` - Student's Registered Courses

**Endpoint:** `GET /api/courses/student` or `GET /api/courses/student/:startYear/:endYear/:semester`

**Change:** Registration objects now include new fields (if available)

**Previous Response Structure:**

```json
{
  "status": true,
  "code": 200,
  "message": "Courses fetched successfully",
  "data": [
    {
      "id": 1,
      "title": "Introduction to Computer Science",
      "course_code": "CSC101",
      "registration": {
        "id": 123,
        "academic_year": "2024/2025",
        "semester": "1ST",
        "level": "100",
        "first_ca": 0,
        "second_ca": 0,
        "third_ca": 0,
        "exam_score": 0,
        "date": "2024-01-15",
        "ref": null
      }
    }
  ]
}
```

**New Response Structure (Note: Fields may not be included yet):**

```json
{
  "status": true,
  "code": 200,
  "message": "Courses fetched successfully",
  "data": [
    {
      "id": 1,
      "title": "Introduction to Computer Science",
      "course_code": "CSC101",
      "registration": {
        "id": 123,
        "academic_year": "2024/2025",
        "semester": "1ST",
        "level": "100",
        "first_ca": 0,
        "second_ca": 0,
        "third_ca": 0,
        "exam_score": 0,
        "date": "2024-01-15",
        "ref": null
        // Note: New fields (registration_status, allocated_price, etc.)
        // are NOT currently included in this endpoint's response
        // They exist in the database but are not exposed here yet
      }
    }
  ]
}
```

**Frontend Action Required:**

- **No immediate changes needed** - The endpoint response structure hasn't changed
- The new fields exist in the database but are not currently returned by this endpoint
- If you need allocation status, use `GET /api/courses/allocated` to check for allocated courses
- Old registrations will continue to work as before

---

#### 3. `GET /api/courses/available` - Available Courses

**Endpoint:** `GET /api/courses/available`

**Change:** Should now indicate which courses are allocated to the student

**Current Response:**

```json
{
  "status": true,
  "code": 200,
  "message": "Available courses retrieved successfully",
  "data": [
    {
      "id": 1,
      "title": "Introduction to Computer Science",
      "course_code": "CSC101",
      "price": 0,
      "owner_type": "wpu",
      "is_marketplace": false,
      "requires_purchase": false
    }
  ],
  "note": "WPU courses are free. Marketplace courses require purchase."
}
```

**Recommended Frontend Update:**

- Check `GET /api/courses/allocated` first to see allocated courses
- Only show courses from `GET /api/courses/available` that are NOT in the allocated list
- Or update the endpoint to include allocation status (future enhancement)

**Note:** This endpoint behavior hasn't changed yet, but the workflow should be:

1. First check `GET /api/courses/allocated` for allocated courses
2. Then check `GET /api/courses/available` for other available courses (if needed)

---

#### 4. `DELETE /api/courses/register/:id` - Unregister from Course

**Endpoint:** `DELETE /api/courses/register/:id`

**Change:** May need restrictions for paid registrations

**Current Behavior:**

- Allows unregistering from any course
- No restrictions

**Potential Future Change:**

- May prevent unregistering from courses registered through the allocation system (paid registrations)
- Or may require refund processing

**Frontend Action Required:**

- Currently no changes needed
- Monitor for future updates regarding paid registration cancellations

---

### New Endpoints (No Breaking Changes)

These are **new** endpoints and don't affect existing functionality:

1. ✅ `GET /api/courses/allocated` - Get allocated courses (NEW)
2. ✅ `POST /api/courses/register-allocated` - Register for allocated courses (NEW)
3. ✅ `POST /api/admin/courses/pricing` - Set course prices (NEW)
4. ✅ `GET /api/admin/courses/pricing` - Get course prices (NEW)
5. ✅ `POST /api/admin/courses/allocate` - Allocate courses (NEW)
6. ✅ `GET /api/admin/courses/allocations` - Get allocations (NEW)
7. ✅ `PATCH /api/admin/semesters/:id/extend-deadline` - Extend deadline (NEW)

---

### Migration Checklist for Frontend

- [ ] **Remove/Disable** old `POST /api/courses/register` endpoint usage
- [ ] **Update** course registration UI to use `GET /api/courses/allocated` and `POST /api/courses/register-allocated`
- [ ] **Handle** new optional fields in `GET /api/courses/student` response (`registration_status`, `allocated_price`, etc.)
- [ ] **Update** course listing to prioritize allocated courses
- [ ] **Add** wallet balance check UI before registration
- [ ] **Add** registration deadline display and warnings
- [ ] **Update** error handling for insufficient balance and deadline passed errors
- [ ] **Test** backward compatibility with old registrations (fields may be null)

---

## Support

For issues or questions:

1. Check error messages in API responses
2. Verify authentication tokens are valid
3. Ensure required data (semesters, courses, students) exists
4. Check database migration has been run (`npm run migrate:course-allocation`)

---

**Last Updated:** 2024-01-20
**Version:** 1.0.0
