# Course Pricing & Registration - Frontend Integration Guide

## Overview

This document provides complete API documentation for the course pricing update and enhanced course registration system. All endpoints are backward compatible.

---

## Table of Contents

1. [New Endpoint - Update Course Price](#new-endpoint-update-course-price)
2. [Affected Endpoint - Course Registration](#affected-endpoint-course-registration)
3. [Affected Endpoint - Available Courses](#affected-endpoint-available-courses)
4. [Frontend Implementation Guide](#frontend-implementation-guide)

---

## New Endpoint - Update Course Price

### `PUT /api/admin/courses/:id/price`

**Authorization:** Super Admin

**Purpose:** Update the price of a single course

**Request Body:**

```json
{
  "price": 50000,
  "currency": "NGN"
}
```

**Request Parameters:**

- `id` (path parameter) - Course ID

**Request Body Fields:**

- `price` (number, required) - New price for the course (must be positive)
- `currency` (string, optional) - Currency code (defaults to existing currency or "NGN")

**Success Response (200):**

```json
{
  "success": true,
  "message": "Course price updated successfully",
  "data": {
    "course": {
      "id": 123,
      "title": "Introduction to Web Development",
      "course_code": "CS101",
      "price": 50000,
      "currency": "NGN"
    }
  }
}
```

**Error Responses:**

```json
// Course not found
{
  "status": false,
  "code": 404,
  "message": "Course not found"
}

// Invalid price
{
  "status": false,
  "code": 400,
  "message": "Price must be a positive number"
}

// Missing price
{
  "status": false,
  "code": 400,
  "message": "Price is required"
}
```

**cURL Example:**

```bash
curl -X PUT "https://api.example.com/api/admin/courses/123/price" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "price": 50000,
    "currency": "NGN"
  }'
```

**JavaScript Example:**

```javascript
const updateCoursePrice = async (courseId, price, currency = "NGN") => {
  const response = await fetch(
    `${API_URL}/api/admin/courses/${courseId}/price`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price: price,
        currency: currency,
      }),
    }
  );
  return response.json();
};

// Usage
await updateCoursePrice(123, 50000, "NGN");
```

---

## Affected Endpoint - Course Registration

### `POST /api/courses/register`

**Authorization:** Student

**Purpose:** Register for one or multiple courses

**Request Body (Single Course - Backward Compatible):**

```json
{
  "course_id": 123,
  "academic_year": "2024/2025",
  "semester": "1ST",
  "level": "100"
}
```

**Request Body (Multiple Courses - New):**

```json
{
  "course_ids": [123, 124, 125],
  "academic_year": "2024/2025",
  "semester": "1ST",
  "level": "100"
}
```

**Request Body Fields:**

- `course_id` (number, optional) - Single course ID (backward compatible)
- `course_ids` (array of numbers, optional) - Multiple course IDs (new)
- `academic_year` (string, required) - Academic year (e.g., "2024/2025")
- `semester` (string, required) - Semester ("1ST" or "2ND")
- `level` (string, optional) - Student level (defaults to student's current level)

**Note:** Either `course_id` OR `course_ids` must be provided.

**Success Response (201) - Multiple Courses (New Format):**

```json
{
  "status": true,
  "code": 201,
  "message": "Successfully registered for 3 course(s)",
  "data": {
    "total_amount": 125000,
    "currency": "NGN",
    "course_count": 3,
    "courses": [
      {
        "id": 456,
        "course_id": 123,
        "course_title": "Introduction to Web Development",
        "course_code": "CS101",
        "price": 50000
      },
      {
        "id": 457,
        "course_id": 124,
        "course_title": "Database Management",
        "course_code": "CS102",
        "price": 45000
      },
      {
        "id": 458,
        "course_id": 125,
        "course_title": "Data Structures",
        "course_code": "CS103",
        "price": 30000
      }
    ],
    "payment": {
      "order_id": 789,
      "transaction_id": 790,
      "amount_paid": 125000,
      "previous_balance": 150000,
      "new_balance": 25000
    },
    "note": "Total payment: 125000 NGN"
  }
}
```

**Success Response (201) - Free Courses (Total = 0):**

```json
{
  "status": true,
  "code": 201,
  "message": "Successfully registered for 2 course(s)",
  "data": {
    "total_amount": 0,
    "currency": "NGN",
    "course_count": 2,
    "courses": [
      {
        "id": 456,
        "course_id": 123,
        "course_title": "Introduction to Web Development",
        "course_code": "CS101",
        "price": 0
      },
      {
        "id": 457,
        "course_id": 124,
        "course_title": "Database Management",
        "course_code": "CS102",
        "price": 0
      }
    ],
    "payment": null,
    "note": "Free WPU courses - no payment required"
  }
}
```

**Success Response (201) - Single Course (Backward Compatible):**

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

**Error Responses:**

```json
// Insufficient wallet balance
{
  "status": false,
  "code": 400,
  "message": "Insufficient wallet balance. Required: 125000, Available: 50000"
}

// Some courses cannot be registered
{
  "status": false,
  "code": 400,
  "message": "Some courses cannot be registered: CS101, CS102"
}

// Already registered
{
  "status": false,
  "code": 400,
  "message": "Some courses cannot be registered: CS101 (Already registered for this course)"
}

// Missing required fields
{
  "status": false,
  "code": 400,
  "message": "Either course_id or course_ids array is required"
}

// No valid courses
{
  "status": false,
  "code": 400,
  "message": "No valid courses to register"
}
```

**cURL Example (Multiple Courses):**

```bash
curl -X POST "https://api.example.com/api/courses/register" \
  -H "Authorization: Bearer YOUR_STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "course_ids": [123, 124, 125],
    "academic_year": "2024/2025",
    "semester": "1ST"
  }'
```

**JavaScript Example:**

```javascript
// Register multiple courses
const registerMultipleCourses = async (courseIds, academicYear, semester) => {
  const response = await fetch(`${API_URL}/api/courses/register`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${studentToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      course_ids: courseIds,
      academic_year: academicYear,
      semester: semester,
    }),
  });
  return response.json();
};

// Register single course (backward compatible)
const registerSingleCourse = async (courseId, academicYear, semester) => {
  const response = await fetch(`${API_URL}/api/courses/register`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${studentToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      course_id: courseId,
      academic_year: academicYear,
      semester: semester,
    }),
  });
  return response.json();
};

// Usage
await registerMultipleCourses([123, 124, 125], "2024/2025", "1ST");
```

---

## Affected Endpoint - Available Courses

### `GET /api/courses/available`

**Authorization:** Student

**Purpose:** Get all available courses for registration

**Query Parameters (Optional):**

- `level` (number) - Filter by course level
- `program_id` (number) - Filter by program
- `faculty_id` (number) - Filter by faculty

**Success Response (200):**

```json
{
  "status": true,
  "code": 200,
  "message": "Available courses retrieved successfully",
  "data": [
    {
      "id": 123,
      "title": "Introduction to Web Development",
      "course_code": "CS101",
      "course_unit": 3,
      "course_type": "Core",
      "course_level": 100,
      "semester": "1ST",
      "price": 50000,
      "currency": "NGN",
      "exam_fee": 5000,
      "owner_type": "wpu",
      "is_marketplace": false,
      "marketplace_status": null,
      "requires_purchase": true
    },
    {
      "id": 124,
      "title": "Database Management",
      "course_code": "CS102",
      "course_unit": 3,
      "course_type": "Core",
      "course_level": 100,
      "semester": "1ST",
      "price": 0,
      "currency": "NGN",
      "exam_fee": 5000,
      "owner_type": "wpu",
      "is_marketplace": false,
      "marketplace_status": null,
      "requires_purchase": false
    },
    {
      "id": 125,
      "title": "Advanced Programming",
      "course_code": "CS201",
      "course_unit": 3,
      "course_type": "Core",
      "course_level": 200,
      "semester": "2ND",
      "price": 45000,
      "currency": "NGN",
      "exam_fee": 5000,
      "owner_type": "wpu",
      "is_marketplace": true,
      "marketplace_status": "published",
      "requires_purchase": true,
      "purchase_endpoint": "/api/marketplace/courses/purchase"
    }
  ],
  "note": "WPU courses are free. Marketplace courses require purchase."
}
```

**Response Fields:**

- `price` (number) - Course price from `courses.price` column (can be 0 for free)
- `currency` (string) - Currency code (always included, default: "NGN")
- `requires_purchase` (boolean) - Whether payment is required (true if price > 0)
- `purchase_endpoint` (string, optional) - Endpoint for marketplace courses

**cURL Example:**

```bash
curl -X GET "https://api.example.com/api/courses/available?level=100" \
  -H "Authorization: Bearer YOUR_STUDENT_TOKEN"
```

**JavaScript Example:**

```javascript
const getAvailableCourses = async (filters = {}) => {
  const queryParams = new URLSearchParams();
  if (filters.level) queryParams.append("level", filters.level);
  if (filters.program_id) queryParams.append("program_id", filters.program_id);
  if (filters.faculty_id) queryParams.append("faculty_id", filters.faculty_id);

  const response = await fetch(
    `${API_URL}/api/courses/available?${queryParams.toString()}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${studentToken}`,
      },
    }
  );
  return response.json();
};

// Usage
const courses = await getAvailableCourses({ level: 100 });
```

---

## Frontend Implementation Guide

### 1. Admin - Update Course Price

**UI Component:**

```jsx
// React Example
const CoursePriceEditor = ({ courseId, currentPrice, onUpdate }) => {
  const [price, setPrice] = useState(currentPrice);
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const response = await updateCoursePrice(courseId, price);
      if (response.success) {
        onUpdate(response.data.course);
        alert("Price updated successfully");
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        type="number"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        min="0"
        step="1000"
      />
      <button onClick={handleUpdate} disabled={loading}>
        {loading ? "Updating..." : "Update Price"}
      </button>
    </div>
  );
};
```

**Implementation Steps:**

1. Add price field to course edit form
2. Add "Update Price" button or inline editor
3. Call `PUT /api/admin/courses/:id/price` on submit
4. Show success/error message
5. Refresh course list after update

---

### 2. Student - Course Registration

**UI Component:**

```jsx
// React Example
const CourseRegistration = () => {
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [availableCourses, setAvailableCourses] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  // Calculate total
  const totalAmount = selectedCourses.reduce((sum, course) => {
    return sum + (parseFloat(course.price) || 0);
  }, 0);

  // Get available courses
  useEffect(() => {
    const fetchCourses = async () => {
      const response = await getAvailableCourses();
      if (response.status) {
        setAvailableCourses(response.data);
      }
    };
    fetchCourses();
  }, []);

  // Handle course selection
  const toggleCourse = (course) => {
    if (selectedCourses.find((c) => c.id === course.id)) {
      setSelectedCourses(selectedCourses.filter((c) => c.id !== course.id));
    } else {
      setSelectedCourses([...selectedCourses, course]);
    }
  };

  // Handle registration
  const handleRegister = async () => {
    if (selectedCourses.length === 0) {
      alert("Please select at least one course");
      return;
    }

    if (totalAmount > walletBalance) {
      alert(
        `Insufficient balance. Required: ${totalAmount}, Available: ${walletBalance}`
      );
      return;
    }

    setLoading(true);
    try {
      const courseIds = selectedCourses.map((c) => c.id);
      const response = await registerMultipleCourses(
        courseIds,
        "2024/2025",
        "1ST"
      );

      if (response.status) {
        // Show success message
        alert(
          `Successfully registered for ${response.data.course_count} course(s)`
        );

        // Display payment details if payment was made
        if (response.data.payment) {
          console.log("Payment Details:", response.data.payment);
        }

        // Clear selection and refresh
        setSelectedCourses([]);
        // Refresh course list
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Available Courses</h2>

      {/* Course List */}
      {availableCourses.map((course) => (
        <div key={course.id}>
          <input
            type="checkbox"
            checked={
              selectedCourses.find((c) => c.id === course.id) !== undefined
            }
            onChange={() => toggleCourse(course)}
          />
          <span>
            {course.course_code} - {course.title}
          </span>
          <span>
            {course.price > 0
              ? `${course.price.toLocaleString()} ${course.currency}`
              : "Free"}
          </span>
        </div>
      ))}

      {/* Selection Summary */}
      {selectedCourses.length > 0 && (
        <div>
          <h3>Selected Courses ({selectedCourses.length})</h3>
          {selectedCourses.map((course) => (
            <div key={course.id}>
              {course.course_code}:{" "}
              {course.price > 0
                ? `${course.price.toLocaleString()} ${course.currency}`
                : "Free"}
            </div>
          ))}
          <div>
            <strong>Total: {totalAmount.toLocaleString()} NGN</strong>
          </div>
          <div>Wallet Balance: {walletBalance.toLocaleString()} NGN</div>
          <div>
            Remaining: {(walletBalance - totalAmount).toLocaleString()} NGN
          </div>
          <button
            onClick={handleRegister}
            disabled={loading || totalAmount > walletBalance}
          >
            {loading ? "Registering..." : "Register and Pay"}
          </button>
        </div>
      )}
    </div>
  );
};
```

**Implementation Steps:**

1. **Course Selection Page:**

   - Display available courses with prices
   - Add checkbox for each course
   - Show running total as courses are selected
   - Display wallet balance
   - Disable registration if insufficient balance

2. **Registration Summary:**

   - Show selected courses with individual prices
   - Calculate and display total amount
   - Show wallet balance and remaining balance
   - Confirm button: "Register and Pay"

3. **Success Handling:**

   - Display success message with course count
   - Show payment details if payment was made
   - Show individual course registrations
   - Clear selection and refresh course list

4. **Error Handling:**
   - Handle insufficient balance error
   - Handle "already registered" errors
   - Handle "invalid courses" errors
   - Show user-friendly error messages

---

### 3. Student - Available Courses Display

**UI Component:**

```jsx
// React Example
const AvailableCoursesList = () => {
  const [courses, setCourses] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    const fetchCourses = async () => {
      const response = await getAvailableCourses();
      if (response.status) {
        setCourses(response.data);
      }
    };
    fetchCourses();
  }, []);

  // Calculate total for selected courses
  const selectedCourses = courses.filter((c) => selectedIds.includes(c.id));
  const total = selectedCourses.reduce(
    (sum, c) => sum + (parseFloat(c.price) || 0),
    0
  );

  return (
    <div>
      <h2>Available Courses</h2>

      {/* Total Display */}
      {selectedIds.length > 0 && (
        <div className="total-summary">
          <strong>
            Total: {total.toLocaleString()} NGN for {selectedIds.length}{" "}
            course(s)
          </strong>
        </div>
      )}

      {/* Course List */}
      {courses.map((course) => (
        <div key={course.id} className="course-card">
          <input
            type="checkbox"
            checked={selectedIds.includes(course.id)}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedIds([...selectedIds, course.id]);
              } else {
                setSelectedIds(selectedIds.filter((id) => id !== course.id));
              }
            }}
          />
          <div>
            <h3>
              {course.course_code} - {course.title}
            </h3>
            <p>
              Level: {course.course_level} | Units: {course.course_unit}
            </p>
            <p>
              <strong>
                {course.price > 0
                  ? `${course.price.toLocaleString()} ${course.currency}`
                  : "Free"}
              </strong>
            </p>
            {course.requires_purchase && (
              <span className="badge">Payment Required</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
```

**Implementation Steps:**

1. Display courses with prices from `price` field
2. Show currency from `currency` field
3. Calculate running total as courses are selected
4. Display "Free" badge if price = 0
5. Display "Payment Required" badge if `requires_purchase = true`

---

## Response Field Changes Summary

### `POST /api/courses/register` Response

**New Fields Added:**

- `total_amount` (number) - Total amount for all courses
- `currency` (string) - Currency code
- `course_count` (number) - Number of courses registered
- `courses` (array) - Array of registered courses with prices
- `payment` (object|null) - Payment details (null if free)
  - `order_id` (number)
  - `transaction_id` (number)
  - `amount_paid` (number)
  - `previous_balance` (number)
  - `new_balance` (number)
- `note` (string) - Helpful message

**Existing Fields (Still Present):**

- All original fields still exist for backward compatibility

---

### `GET /api/courses/available` Response

**Updated Fields:**

- `price` (number) - Now comes directly from `courses.price` (was from semester pricing)
- `currency` (string) - Now always included (was sometimes missing)

**No Breaking Changes:**

- All existing fields still present
- Same structure, just different data source

---

## Testing Checklist

### Admin Tests

- [ ] Update course price via `PUT /api/admin/courses/:id/price`
- [ ] Verify price updates in course list
- [ ] Test with invalid price (negative, zero, non-number)
- [ ] Verify admin activity log records the change

### Student Tests

- [ ] View available courses (verify prices display correctly)
- [ ] Register for single course (backward compatibility)
- [ ] Register for multiple courses (new feature)
- [ ] Verify total amount calculation
- [ ] Test with free courses (price = 0)
- [ ] Test with paid courses (price > 0)
- [ ] Test wallet balance check (insufficient balance)
- [ ] Verify payment processing for multiple courses
- [ ] Verify response includes total amount and breakdown

---

## Important Notes

1. **Backward Compatibility:**

   - Single course registration (`course_id`) still works
   - All existing response fields are preserved
   - No breaking changes

2. **Price Source:**

   - Prices now come from `courses.price` column directly
   - No semester-specific pricing lookup
   - One price per course

3. **Multiple Course Registration:**

   - Single payment transaction for total amount
   - All courses registered in one request
   - Individual course registrations linked to one `CourseOrder`

4. **Payment Handling:**
   - Free courses (price = 0) → No payment needed
   - Paid courses → Single payment for total amount
   - Wallet balance checked before registration

---

## Questions or Issues?

If you encounter any issues or have questions about these endpoints, please contact the backend team.

**Last Updated:** [Current Date]
**API Version:** v1
