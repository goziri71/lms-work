# Automatic Course Allocation System - Implementation Guide

## Overview

This document describes the automatic course allocation system that automatically assigns courses to students every semester based on their program, level, and the current semester. Students can then view and register for their allocated courses.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [What Changed](#what-changed)
3. [How It Works](#how-it-works)
4. [API Endpoints](#api-endpoints)
5. [Matching Logic](#matching-logic)
6. [Frontend Integration](#frontend-integration)
7. [Examples](#examples)

---

## System Overview

### Previous System (Removed)
- Students could browse **all courses** via `GET /api/courses/available`
- Students could **directly register** for any course via `POST /api/courses/register`
- Admin had to **manually allocate** courses to students

### New System (Current)
- **Automatic allocation**: Courses are automatically allocated to students when a semester is created/activated
- **Manual trigger**: Admin can manually trigger allocation via endpoint
- **Students see only allocated courses**: Students can only see and register for courses that were allocated to them
- **No browsing**: Students cannot browse all courses anymore

---

## What Changed

### ❌ Removed Endpoints

The following endpoints have been **removed/disabled**:

1. **`GET /api/courses/available`**
   - **Previous**: Students could browse all available courses
   - **Now**: Removed - students use `GET /api/courses/allocated` instead

2. **`POST /api/courses/register`**
   - **Previous**: Students could directly register for any course
   - **Now**: Removed - students use `POST /api/courses/register-allocated` instead

3. **`DELETE /api/courses/register/:registrationId`**
   - **Previous**: Students could unregister from courses
   - **Now**: Removed

### ✅ Kept Endpoints

These endpoints remain **unchanged**:

1. **`GET /api/courses/allocated`** - Students view their allocated courses
2. **`POST /api/courses/register-allocated`** - Students register for allocated courses
3. **`POST /api/admin/courses/allocate`** - Admin manual allocation (if needed)

### ✨ New Endpoints

1. **`POST /api/admin/courses/allocate-all-students`** - Manual trigger for automatic allocation

---

## How It Works

### Automatic Allocation Triggers

Courses are automatically allocated to all active students in two scenarios:

#### 1. When Semester is Created as Active
When admin creates a new semester with `status: "active"`, the system automatically:
- Finds all active WPU students
- Matches courses based on program, level, and semester
- Creates `CourseReg` records with `status = "allocated"`

#### 2. When Semester is Activated
When admin activates a semester via `PATCH /api/admin/semesters/:id/activate`, the system automatically:
- Finds all active WPU students
- Matches courses based on program, level, and semester
- Creates `CourseReg` records with `status = "allocated"`

### Manual Trigger

Admin can manually trigger allocation at any time via:
- **`POST /api/admin/courses/allocate-all-students`**

---

## API Endpoints

### 1. Automatic Allocation (Manual Trigger)

**Endpoint:** `POST /api/admin/courses/allocate-all-students`

**Authorization:** Super Admin only

**Request Body (Optional):**

```json
{
  "academic_year": "2024/2025",
  "semester": "1ST"
}
```

**If body is empty**, uses current active semester.

**Success Response (200):**

```json
{
  "success": true,
  "message": "Course allocation completed for 1ST semester 2024/2025",
  "data": {
    "academic_year": "2024/2025",
    "semester": "1ST",
    "allocation": {
      "allocated": 150,
      "skipped": 25,
      "errors": 0
    },
    "errors": null
  }
}
```

**Error Responses:**

```json
// No active semester found (when body is empty)
{
  "status": false,
  "code": 404,
  "message": "No active semester found. Please provide academic_year and semester, or activate a semester first."
}

// Invalid semester format
{
  "status": false,
  "code": 400,
  "message": "Invalid semester format. Must be \"1ST\" or \"2ND\", got: INVALID"
}
```

**cURL Example:**

```bash
# Use current active semester
curl -X POST "https://api.example.com/api/admin/courses/allocate-all-students" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"

# Specify semester
curl -X POST "https://api.example.com/api/admin/courses/allocate-all-students" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "academic_year": "2024/2025",
    "semester": "1ST"
  }'
```

**JavaScript Example:**

```javascript
// Trigger allocation for current semester
const allocateAllStudents = async () => {
  const response = await fetch(
    `${API_URL}/api/admin/courses/allocate-all-students`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      // Body is optional - omit to use current semester
    }
  );
  return response.json();
};

// Trigger allocation for specific semester
const allocateForSemester = async (academicYear, semester) => {
  const response = await fetch(
    `${API_URL}/api/admin/courses/allocate-all-students`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        academic_year: academicYear,
        semester: semester, // "1ST" or "2ND"
      }),
    }
  );
  return response.json();
};

// Usage
await allocateAllStudents();
await allocateForSemester("2024/2025", "1ST");
```

---

### 2. Student - View Allocated Courses

**Endpoint:** `GET /api/courses/allocated`

**Authorization:** Student

**Success Response (200):**

```json
{
  "success": true,
  "message": "Allocated courses retrieved successfully",
  "data": {
    "semester": {
      "id": 5,
      "academic_year": "2024/2025",
      "semester": "1ST",
      "status": "active",
      "registration_deadline": "2024-10-15T00:00:00.000Z",
      "deadline_passed": false
    },
    "allocated_courses": [
      {
        "allocation_id": 123,
        "course": {
          "id": 45,
          "title": "Introduction to Web Development",
          "course_code": "CS101",
          "course_unit": 3
        },
        "price": 50000,
        "allocated_at": "2024-09-01T10:00:00.000Z"
      },
      {
        "allocation_id": 124,
        "course": {
          "id": 46,
          "title": "Database Management",
          "course_code": "CS102",
          "course_unit": 3
        },
        "price": 45000,
        "allocated_at": "2024-09-01T10:00:00.000Z"
      }
    ],
    "total_amount": 95000,
    "course_count": 2,
    "can_register": true
  }
}
```

---

### 3. Student - Register for Allocated Courses

**Endpoint:** `POST /api/courses/register-allocated`

**Authorization:** Student

**Request Body:** None (uses current semester)

**Success Response (200):**

```json
{
  "success": true,
  "message": "Successfully registered for 2 course(s)",
  "data": {
    "order_id": 789,
    "total_amount": 95000,
    "currency": "NGN",
    "courses_registered": 2,
    "wallet_balance_before": 100000,
    "wallet_balance_after": 5000,
    "courses": [
      {
        "allocation_id": 123,
        "course_id": 45,
        "course_code": "CS101",
        "course_title": "Introduction to Web Development",
        "price": 50000
      },
      {
        "allocation_id": 124,
        "course_id": 46,
        "course_code": "CS102",
        "course_title": "Database Management",
        "price": 45000
      }
    ]
  }
}
```

---

## Matching Logic

### Course Allocation Criteria

For a course to be allocated to a student, **ALL** of the following must match:

1. **Program Match:**
   ```
   courses.program_id = students.program_id
   ```

2. **Level Match:**
   ```
   courses.course_level = Number(students.level)
   ```
   - `students.level` is STRING (e.g., "100", "200")
   - `courses.course_level` is INTEGER (e.g., 100, 200)
   - Converted for comparison

3. **Semester Match:**
   ```
   courses.semester = current_semester.semester
   ```
   - Must be "1ST" or "2ND" (case-sensitive)

4. **Course Type:**
   ```
   courses.owner_type IN ('wpu', 'wsp')
   ```
   - Only WPU-owned courses

5. **Not Marketplace:**
   ```
   courses.is_marketplace = false
   ```
   - Marketplace courses are excluded

6. **Student Status:**
   ```
   students.admin_status = 'active'
   ```
   - Only active students get allocations

7. **No Duplicate:**
   ```
   NOT EXISTS (
     CourseReg WHERE 
       student_id = student.id AND
       course_id = course.id AND
       academic_year = current_semester.academic_year AND
       semester = current_semester.semester
   )
   ```
   - Prevents duplicate allocations

### Example Matching

**Student:**
- `program_id`: 5
- `level`: "100"
- `admin_status`: "active"

**Course 1:**
- `program_id`: 5 ✅
- `course_level`: 100 ✅
- `semester`: "1ST" ✅
- `owner_type`: "wpu" ✅
- `is_marketplace`: false ✅
- **Result:** ✅ **ALLOCATED**

**Course 2:**
- `program_id`: 5 ✅
- `course_level`: 200 ❌ (Level mismatch)
- `semester`: "1ST" ✅
- `owner_type`: "wpu" ✅
- `is_marketplace`: false ✅
- **Result:** ❌ **NOT ALLOCATED** (level doesn't match)

**Course 3:**
- `program_id`: 6 ❌ (Program mismatch)
- `course_level`: 100 ✅
- `semester`: "1ST" ✅
- `owner_type`: "wpu" ✅
- `is_marketplace`: false ✅
- **Result:** ❌ **NOT ALLOCATED** (program doesn't match)

---

## Frontend Integration

### Admin Dashboard - Send Out Course Registration

**UI Component:**

```jsx
// React Example
const CourseAllocationButton = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleAllocateAll = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/admin/courses/allocate-all-students`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${adminToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      const data = await response.json();
      if (data.success) {
        setResult(data.data);
        alert(
          `Allocation completed: ${data.data.allocation.allocated} courses allocated`
        );
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleAllocateAll} disabled={loading}>
        {loading ? "Allocating..." : "Send Out Course Registration"}
      </button>
      {result && (
        <div>
          <p>Allocated: {result.allocation.allocated}</p>
          <p>Skipped: {result.allocation.skipped}</p>
          <p>Errors: {result.allocation.errors}</p>
        </div>
      )}
    </div>
  );
};
```

**Implementation Steps:**

1. Add "Send Out Course Registration" button to admin dashboard
2. Call `POST /api/admin/courses/allocate-all-students` on click
3. Show loading state during allocation
4. Display results (allocated, skipped, errors)
5. Show success/error message

---

### Student - Course Registration Page

**UI Component:**

```jsx
// React Example
const StudentCourseRegistration = () => {
  const [allocatedCourses, setAllocatedCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);

  // Fetch allocated courses
  useEffect(() => {
    const fetchAllocated = async () => {
      const response = await fetch(`${API_URL}/api/courses/allocated`, {
        headers: {
          Authorization: `Bearer ${studentToken}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setAllocatedCourses(data.data.allocated_courses);
      }
    };
    fetchAllocated();
  }, []);

  // Register for all allocated courses
  const handleRegister = async () => {
    setRegistering(true);
    try {
      const response = await fetch(
        `${API_URL}/api/courses/register-allocated`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${studentToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      const data = await response.json();
      if (data.success) {
        alert(`Successfully registered for ${data.data.courses_registered} courses`);
        // Refresh allocated courses
        window.location.reload();
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setRegistering(false);
    }
  };

  const totalAmount = allocatedCourses.reduce(
    (sum, course) => sum + (course.price || 0),
    0
  );

  return (
    <div>
      <h2>My Allocated Courses</h2>
      {allocatedCourses.length === 0 ? (
        <p>No courses allocated for this semester</p>
      ) : (
        <>
          <div>
            {allocatedCourses.map((course) => (
              <div key={course.allocation_id}>
                <h3>{course.course.course_code} - {course.course.title}</h3>
                <p>Price: {course.price.toLocaleString()} NGN</p>
              </div>
            ))}
          </div>
          <div>
            <h3>Total: {totalAmount.toLocaleString()} NGN</h3>
            <button onClick={handleRegister} disabled={registering}>
              {registering ? "Registering..." : "Register All Courses"}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
```

**Implementation Steps:**

1. **Fetch Allocated Courses:**
   - Call `GET /api/courses/allocated` on page load
   - Display courses with prices
   - Show total amount

2. **Registration:**
   - Call `POST /api/courses/register-allocated` on button click
   - Show loading state
   - Display success message
   - Refresh course list

3. **Error Handling:**
   - Handle insufficient wallet balance
   - Handle registration deadline passed
   - Handle no active semester

---

## Examples

### Example 1: Automatic Allocation on Semester Creation

**Admin creates semester:**

```bash
POST /api/admin/semesters
{
  "academic_year": "2024/2025",
  "semester": 1,
  "start_date": "2024-09-01",
  "end_date": "2024-12-31",
  "status": "active"
}
```

**System automatically:**
1. Finds all active students (e.g., 100 students)
2. For each student, finds matching courses:
   - Student in Program 5, Level 100 → finds courses with `program_id=5`, `course_level=100`, `semester="1ST"`
   - Student in Program 5, Level 200 → finds courses with `program_id=5`, `course_level=200`, `semester="1ST"`
3. Creates allocations (e.g., 150 allocations total)
4. Returns result in response

**Response includes:**

```json
{
  "success": true,
  "message": "Semester created successfully",
  "data": {
    "semester": { ... },
    "allocation": {
      "allocated": 150,
      "skipped": 25,
      "errors": 0
    }
  }
}
```

---

### Example 2: Manual Trigger

**Admin clicks "Send Out Course Registration":**

```bash
POST /api/admin/courses/allocate-all-students
```

**System:**
1. Gets current active semester (2024/2025, 1ST)
2. Finds all active students
3. Allocates matching courses
4. Returns summary

**Response:**

```json
{
  "success": true,
  "message": "Course allocation completed for 1ST semester 2024/2025",
  "data": {
    "academic_year": "2024/2025",
    "semester": "1ST",
    "allocation": {
      "allocated": 150,
      "skipped": 25,
      "errors": 0
    }
  }
}
```

---

### Example 3: Student Registration Flow

**Step 1: Student views allocated courses**

```bash
GET /api/courses/allocated
```

**Response:**

```json
{
  "success": true,
  "data": {
    "allocated_courses": [
      {
        "allocation_id": 123,
        "course": {
          "id": 45,
          "title": "Introduction to Web Development",
          "course_code": "CS101"
        },
        "price": 50000
      },
      {
        "allocation_id": 124,
        "course": {
          "id": 46,
          "title": "Database Management",
          "course_code": "CS102"
        },
        "price": 45000
      }
    ],
    "total_amount": 95000,
    "can_register": true
  }
}
```

**Step 2: Student registers**

```bash
POST /api/courses/register-allocated
```

**System:**
1. Checks wallet balance (e.g., 100,000 NGN)
2. Verifies sufficient balance (100,000 >= 95,000) ✅
3. Creates `CourseOrder`
4. Creates `Funding` transaction (Debit)
5. Updates wallet balance (100,000 - 95,000 = 5,000)
6. Updates all `CourseReg` records to `status = "registered"`

**Response:**

```json
{
  "success": true,
  "message": "Successfully registered for 2 course(s)",
  "data": {
    "order_id": 789,
    "total_amount": 95000,
    "wallet_balance_after": 5000,
    "courses_registered": 2
  }
}
```

---

## Important Notes

### 1. Data Types

- **`academic_year`**: Stored as VARCHAR (e.g., "2024/2025"), always use `.toString()`
- **`semester`**: Stored as VARCHAR ("1ST" or "2ND"), always use `.toString()`
- **`students.level`**: STRING (e.g., "100"), convert to INTEGER for comparison
- **`courses.course_level`**: INTEGER (e.g., 100)

### 2. Duplicate Prevention

- System checks if `CourseReg` exists for `student_id + course_id + academic_year + semester`
- If exists with **any status** (allocated, registered, cancelled), skips allocation
- Prevents duplicate allocations

### 3. Active Students Only

- Only students with `admin_status = 'active'` get allocations
- Inactive students are skipped

### 4. Marketplace Courses

- Marketplace courses (`is_marketplace = true`) are **excluded** from automatic allocation
- Students must purchase marketplace courses separately

### 5. Error Handling

- If allocation fails during semester creation/activation, semester creation/activation still succeeds
- Errors are logged to console
- Allocation results are included in response (if successful)

---

## Testing Checklist

### Admin Tests

- [ ] Create semester with `status: "active"` → verify automatic allocation
- [ ] Activate existing semester → verify automatic allocation
- [ ] Manually trigger allocation → verify courses allocated
- [ ] Check allocation results (allocated, skipped, errors)
- [ ] Verify only active students get allocations
- [ ] Verify marketplace courses are excluded

### Student Tests

- [ ] View allocated courses → verify only allocated courses shown
- [ ] Register for allocated courses → verify payment processed
- [ ] Check wallet balance after registration
- [ ] Verify courses appear in enrolled courses list
- [ ] Test with insufficient wallet balance → verify error message
- [ ] Test after registration deadline → verify error message

---

## Questions or Issues?

If you encounter any issues or have questions about the automatic course allocation system, please contact the backend team.

**Last Updated:** [Current Date]  
**API Version:** v1

