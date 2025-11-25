# 🚀 Complete Postman API Testing Guide - Frontend Implementation

## 📋 Table of Contents

1. [Setup & Configuration](#setup--configuration)
2. [Student Endpoints](#student-endpoints)
3. [Staff Endpoints](#staff-endpoints)
4. [Admin Endpoints](#admin-endpoints)
5. [Super Admin Endpoints](#super-admin-endpoints)
6. [Marketplace Endpoints](#marketplace-endpoints)
7. [Course Management](#course-management)
8. [Testing Flow](#testing-flow)

---

## 🔧 Setup & Configuration

### **Base URL**

```
Development: http://localhost:3000
Production: https://your-production-url.com
```

### **Postman Environment Variables**

Create these variables in Postman:

- `base_url` = `http://localhost:3000`
- `student_token` = (will be set after login)
- `staff_token` = (will be set after login)
- `admin_token` = (will be set after login)
- `super_admin_token` = (will be set after login)
- `tutor_token` = (will be set after login)

### **Headers for Authenticated Requests**

```
Authorization: Bearer {{token}}
Content-Type: application/json
```

---

## 👨‍🎓 STUDENT ENDPOINTS

### **1. Student Registration**

**POST** `/api/auth/register/student`

**Body:**

```json
{
  "email": "student@example.com",
  "password": "Student123",
  "fname": "John",
  "lname": "Doe",
  "phone": "08012345678",
  "level": "100",
  "program_id": 1
}
```

**Response:**

```json
{
  "status": true,
  "code": 201,
  "message": "Student registered successfully",
  "data": {
    "user": { ... }
  }
}
```

**For Frontend:**

- Show success message
- Redirect to login page
- Email will be sent automatically

---

### **2. Student Login**

**POST** `/api/auth/login` or `/api/auth/student/login`

**Body:**

```json
{
  "email": "student@example.com",
  "password": "Student123"
}
```

**Response:**

```json
{
  "status": true,
  "code": 200,
  "message": "Login successful",
  "data": {
    "user": { ... },
    "token": "jwt_token_here",
    "userType": "student"
  }
}
```

**For Frontend:**

- Save token to localStorage/sessionStorage
- Store user data
- Redirect to student dashboard

---

### **3. Get Student Profile**

**GET** `/api/auth/profile`

**Headers:**

```
Authorization: Bearer {{student_token}}
```

**Response:**

```json
{
  "status": true,
  "code": 200,
  "message": "Profile retrieved successfully",
  "data": {
    "user": {
      "id": 1,
      "fname": "John",
      "lname": "Doe",
      "email": "student@example.com",
      ...
    }
  }
}
```

---

### **4. Update Student Profile**

**PUT** `/api/auth/profile/student`

**Headers:**

```
Authorization: Bearer {{student_token}}
```

**Body:**

```json
{
  "fname": "John",
  "lname": "Doe Updated",
  "phone": "08012345678",
  "address": "123 Main St"
}
```

---

### **5. Request Password Reset**

**POST** `/api/auth/password/reset-request`

**Body:**

```json
{
  "email": "student@example.com"
}
```

**For Frontend:**

- Show message: "If email exists, reset link sent"
- Email will be sent with reset token

---

### **6. Reset Password**

**POST** `/api/auth/password/reset`

**Body:**

```json
{
  "token": "reset_token_from_email",
  "newPassword": "NewPassword123"
}
```

---

### **7. Student Logout**

**POST** `/api/auth/logout`

**Headers:**

```
Authorization: Bearer {{student_token}}
```

---

### **8. Get Student Courses**

**GET** `/api/courses/student`

**Query Parameters:**

- `academic_year` (optional): `2024/2025`
- `semester` (optional): `1ST` or `2ND`

**Headers:**

```
Authorization: Bearer {{student_token}}
```

**For Frontend:**

- Display enrolled courses
- Show course details, grades, progress

---

### **9. Get Available Courses**

**GET** `/api/courses/available`

**Query Parameters:**

- `level` (optional): Filter by level
- `program_id` (optional): Filter by program
- `faculty_id` (optional): Filter by faculty

**Headers:**

```
Authorization: Bearer {{student_token}}
```

**Response:**

```json
{
  "status": true,
  "code": 200,
  "message": "Available courses retrieved successfully",
  "data": [
    {
      "id": 1,
      "title": "Introduction to Economics",
      "course_code": "ECO101",
      "price": 0,
      "owner_type": "wsp",
      "is_marketplace": false,
      "requires_purchase": false
    },
    {
      "id": 2,
      "title": "Advanced Mathematics",
      "course_code": "MATH301",
      "price": 15000,
      "owner_type": "sole_tutor",
      "is_marketplace": true,
      "requires_purchase": true,
      "purchase_endpoint": "/api/marketplace/courses/purchase"
    }
  ],
  "note": "WPU courses are free. Marketplace courses require purchase."
}
```

**For Frontend:**

- Show FREE badge for WPU courses
- Show PRICE for marketplace courses
- Use different buttons: "Register" vs "Purchase"

---

### **10. Register for WPU Course (FREE)**

**POST** `/api/courses/register`

**Headers:**

```
Authorization: Bearer {{student_token}}
```

**Body:**

```json
{
  "course_id": 1,
  "academic_year": "2024/2025",
  "semester": "1ST",
  "level": "100"
}
```

**Response:**

```json
{
  "status": true,
  "code": 201,
  "message": "Course registered successfully (Free - WPU Course)",
  "data": {
    "id": 123,
    "course_id": 1,
    "academic_year": "2024/2025",
    "semester": "1ST",
    "course_title": "Introduction to Economics",
    "course_code": "ECO101",
    "is_marketplace": false,
    "owner_type": "wsp",
    "note": "This is a free WPU course"
  }
}
```

**For Frontend:**

- Show success message
- Update course list
- Redirect to course page

---

### **11. Purchase Marketplace Course (PAID)**

**POST** `/api/marketplace/courses/purchase`

**Headers:**

```
Authorization: Bearer {{student_token}}
```

**Body:**

```json
{
  "course_id": 2,
  "payment_reference": "PAY-123456789",
  "payment_method": "paystack"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Course purchased and enrollment successful",
  "data": {
    "transaction": {
      "id": 1,
      "course_price": 15000,
      "wsp_commission": 2250,
      "tutor_earnings": 12750,
      "commission_rate": 15
    },
    "enrollment": {
      "course_id": 2,
      "academic_year": "2024/2025",
      "semester": "1ST"
    }
  }
}
```

**For Frontend:**

- Integrate with payment gateway first
- After successful payment, call this endpoint
- Show transaction details
- Redirect to course page

---

### **12. Unregister from Course**

**DELETE** `/api/courses/register/:registrationId`

**Headers:**

```
Authorization: Bearer {{student_token}}
```

---

### **13. Get Course Participants**

**GET** `/api/courses/:courseId/participants`

**Query Parameters:**

- `academic_year` (optional)
- `semester` (optional)
- `search` (optional)
- `includeSelf` (optional): `true` or `false`

**Headers:**

```
Authorization: Bearer {{student_token}}
```

**For Frontend:**

- Show lecturer info
- Show classmates list
- Enable messaging

---

### **14. Get Available Semesters**

**GET** `/api/courses/semesters`

**Headers:**

```
Authorization: Bearer {{student_token}}
```

---

## 👨‍🏫 STAFF ENDPOINTS

### **1. Staff Registration**

**POST** `/api/auth/register/staff`

**Body:**

```json
{
  "email": "staff@example.com",
  "password": "Staff123",
  "fname": "Jane",
  "lname": "Smith",
  "phone": "08012345679",
  "department": "Computer Science"
}
```

---

### **2. Staff Login**

**POST** `/api/auth/login` or `/api/auth/staff/login`

**Body:**

```json
{
  "email": "staff@example.com",
  "password": "Staff123"
}
```

**For Frontend:**

- Save token
- Redirect to staff dashboard

---

### **3. Get Staff Profile**

**GET** `/api/auth/profile`

**Headers:**

```
Authorization: Bearer {{staff_token}}
```

---

### **4. Update Staff Profile**

**PUT** `/api/auth/profile/staff`

**Headers:**

```
Authorization: Bearer {{staff_token}}
```

**Body:**

```json
{
  "fname": "Jane",
  "lname": "Smith Updated",
  "phone": "08012345679"
}
```

---

### **5. Request Password Reset**

**POST** `/api/auth/password/reset-request`

**Body:**

```json
{
  "email": "staff@example.com"
}
```

---

### **6. Reset Password**

**POST** `/api/auth/password/reset`

**Body:**

```json
{
  "token": "reset_token_from_email",
  "newPassword": "NewPassword123"
}
```

---

### **7. Staff Logout**

**POST** `/api/auth/logout`

**Headers:**

```
Authorization: Bearer {{staff_token}}
```

---

### **8. Get Staff Courses**

**GET** `/api/courses/staff`

**Query Parameters:**

- `academic_year` (optional)
- `semester` (optional)
- `includeStudents` (optional): `true` or `false`

**Headers:**

```
Authorization: Bearer {{staff_token}}
```

**For Frontend:**

- Show courses assigned to staff
- Display enrolled students count
- Enable course management

---

### **9. Get Course by ID**

**GET** `/api/courses/single/:courseId`

**Headers:**

```
Authorization: Bearer {{staff_token}}
```

**For Frontend:**

- Show full course details
- Enable editing if staff owns the course

---

## 🛡️ ADMIN ENDPOINTS

### **1. Admin Login**

**POST** `/api/admin/login`

**Body:**

```json
{
  "email": "admin@pinnacleuniversity.co",
  "password": "Admin@123456"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Admin login successful",
  "data": {
    "admin": {
      "id": 1,
      "firstName": "Super",
      "lastName": "Admin",
      "email": "admin@pinnacleuniversity.co",
      "role": "super_admin",
      "permissions": { ... }
    },
    "accessToken": "jwt_token_here",
    "userType": "admin",
    "expiresIn": 14400
  }
}
```

**For Frontend:**

- Save token
- Check role (super_admin or wpu_admin, wsp_admin is legacy)
- Redirect based on permissions

---

### **2. Get Admin Profile**

**GET** `/api/admin/profile`

**Headers:**

```
Authorization: Bearer {{admin_token}}
```

---

### **3. Update Admin Profile**

**PUT** `/api/admin/profile`

**Headers:**

```
Authorization: Bearer {{admin_token}}
```

**Body:**

```json
{
  "fname": "Super",
  "lname": "Admin",
  "phone": "08012345680"
}
```

---

### **4. Admin Logout**

**POST** `/api/admin/logout`

**Headers:**

```
Authorization: Bearer {{admin_token}}
```

---

### **5. Request Admin Password Reset**

**POST** `/api/admin/password/reset-request`

**Body:**

```json
{
  "email": "admin@pinnacleuniversity.co"
}
```

---

### **6. Reset Admin Password**

**POST** `/api/admin/password/reset`

**Body:**

```json
{
  "token": "reset_token_from_email",
  "newPassword": "NewAdminPassword123"
}
```

---

## 🔐 SUPER ADMIN ENDPOINTS

> **Note:** All Super Admin endpoints require `role: "super_admin"` in token

### **STUDENT MANAGEMENT**

#### **1. Get All Students**

**GET** `/api/admin/students`

**Query Parameters:**

- `page` (optional): `1`
- `limit` (optional): `20`
- `search` (optional): Search by name/email
- `status` (optional): `active` or `inactive`
- `level` (optional): Filter by level
- `program_id` (optional): Filter by program

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**For Frontend:**

- Display student list with pagination
- Enable search and filters
- Show action buttons (edit, deactivate, reset password)

---

#### **2. Get Student Statistics**

**GET** `/api/admin/students/stats`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**Response:**

```json
{
  "success": true,
  "message": "Student statistics retrieved successfully",
  "data": {
    "total": 150,
    "active": 140,
    "inactive": 10,
    "byLevel": [
      { "level": "100", "count": 50 },
      { "level": "200", "count": 40 }
    ],
    "byProgram": [
      { "program_id": 1, "count": 30, "program": { "title": "BSc Economics" } }
    ]
  }
}
```

**For Frontend:**

- Display dashboard cards
- Show charts/graphs
- Update in real-time

---

#### **3. Get Student by ID** (Basic)

**GET** `/api/admin/students/:id`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**For Frontend:**

- Show basic student profile
- Display course registrations (limited)
- Enable editing

**Response:**

```json
{
  "success": true,
  "message": "Student retrieved successfully",
  "data": {
    "student": {
      "id": 1,
      "fname": "John",
      "lname": "Doe",
      "email": "john@example.com",
      "program": { "id": 1, "title": "BSc Economics" },
      "courseRegistrations": [...]
    }
  }
}
```

---

#### **3a. Get Student Full Details** (Comprehensive - Recommended for Student Profile Page)

**GET** `/api/admin/students/:id/full`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**Description:**
This endpoint returns **comprehensive student information** similar to what students see in their dashboard. It includes personal information, faculty, program, registrations, courses, exams, results, wallet, and payment history - all in one response.

**For Frontend:**

- **Use this endpoint** when building a detailed student profile page
- Perfect for a student detail view with tabs/sections
- All data in one call - no need for multiple API requests
- Matches the student dashboard structure

---

### **📋 COMPREHENSIVE STUDENT DETAILS - STEP BY STEP GUIDE**

#### **Step 1: Understanding the Response Structure**

The response is organized into logical sections that match a typical student dashboard:

```json
{
  "success": true,
  "message": "Student full details retrieved successfully",
  "data": {
    "personalInformation": { ... },    // Tab 1: Personal Info
    "faculty": { ... },                // Tab 1: Faculty Info
    "program": { ... },                // Tab 1: Program Info
    "registrations": [ ... ],         // Tab 2: Registrations
    "courses": [ ... ],                // Tab 3: Courses
    "exams": [ ... ],                  // Tab 4: Exams
    "wallet": { ... },                 // Tab 5: Wallet
    "payments": { ... },               // Tab 6: Payments
    "currentSemester": { ... }         // Used across tabs
  }
}
```

---

#### **Step 2: Building the UI - Tab Structure**

**Recommended UI Layout:**

```
┌─────────────────────────────────────────────────┐
│  Student Profile: John Doe                      │
│  [Personal Info] [Registrations] [Courses]      │
│  [Exams] [Results] [Wallet] [Payments]          │
└─────────────────────────────────────────────────┘
```

**Tab 1: Personal Information**

- Display: `data.personalInformation`
- Show: `data.faculty` and `data.program` in the same section
- Use for: Student bio, contact info, academic details

**Tab 2: Registrations**

- Display: `data.registrations` (array)
- Show: Registration history grouped by semester
- Use for: Semester registration status, course registration summary

**Tab 3: Courses**

- Display: `data.courses` (array)
- Show: All courses with results
- Use for: Course list, grades, progress

**Tab 4: Exams**

- Display: `data.exams` (array)
- Show: Exam attempts and scores
- Use for: Exam history, performance

**Tab 5: Wallet**

- Display: `data.wallet`
- Show: Balance, transactions, summary
- Use for: Financial overview

**Tab 6: Payments**

- Display: `data.payments`
- Show: School fees, course orders
- Use for: Payment history, outstanding fees

---

#### **Step 3: Data Flow Explanation**

**How the Data Relates:**

1. **Personal Information → Program → Faculty**

   ```
   Student belongs to Program → Program belongs to Faculty
   ```

2. **Registrations → Courses**

   ```
   Each registration in "registrations" array links to courses
   Check "courses" array for detailed course info with results
   ```

3. **Courses → Exams**

   ```
   Each course can have exams
   Check "exams" array and match by course_id
   ```

4. **Registrations → Payments**

   ```
   Each registration has school_fees info
   Check "payments.schoolFees" for payment status
   ```

5. **Wallet → Payments**
   ```
   Wallet transactions fund payments
   Check "wallet.transactions" for funding history
   ```

---

#### **Step 4: Complete Response Structure**

**Full Response Example:**

```json
{
  "success": true,
  "message": "Student full details retrieved successfully",
  "data": {
    "personalInformation": {
      "id": 1,
      "fname": "John",
      "mname": "Michael",
      "lname": "Doe",
      "email": "john.doe@example.com",
      "phone": "08012345678",
      "gender": "Male",
      "dob": "2000-01-15",
      "address": "123 Main Street",
      "state_origin": "Lagos",
      "lcda": "Ikeja",
      "country": "Nigeria",
      "matric_number": "WSP/2024/001",
      "level": "200",
      "admin_status": "active",
      "g_status": "active",
      "study_mode": "Full-time",
      "application_code": "APP123",
      "referral_code": "REF456",
      "date": "2024-01-10T00:00:00.000Z"
    },
    "faculty": {
      "id": 1,
      "name": "Faculty of Social Sciences",
      "description": "Social Sciences Department"
    },
    "program": {
      "id": 1,
      "title": "BSc Economics",
      "description": "Bachelor of Science in Economics",
      "status": "Y"
    },
    "registrations": [
      {
        "academic_year": "2024/2025",
        "semester": "1ST",
        "course_count": 5,
        "courses": [
          {
            "id": 1,
            "title": "Introduction to Economics",
            "course_code": "ECO101",
            "registration_id": 101,
            "registration_date": "2024-09-01"
          }
        ],
        "registration_date": "2024-09-01",
        "school_fees": {
          "id": 201,
          "amount": 50000,
          "status": "Paid",
          "date": "2024-09-01",
          "type": "Semester Registration",
          "teller_no": "TXN123456",
          "currency": "NGN"
        },
        "registration_status": "registered"
      },
      {
        "academic_year": "2023/2024",
        "semester": "2ND",
        "course_count": 4,
        "courses": [...],
        "registration_date": "2024-01-15",
        "school_fees": {
          "id": 150,
          "amount": 50000,
          "status": "Paid",
          "date": "2024-01-15",
          "type": "Semester Registration",
          "teller_no": "TXN123455",
          "currency": "NGN"
        },
        "registration_status": "registered"
      }
    ],
    "courses": [
      {
        "registration": {
          "id": 101,
          "academic_year": "2024/2025",
          "semester": "1ST",
          "level": "200",
          "date": "2024-09-01",
          "ref": "REG001"
        },
        "course": {
          "id": 1,
          "title": "Introduction to Economics",
          "course_code": "ECO101",
          "course_unit": 3,
          "course_type": "Core",
          "course_level": 200,
          "price": "0",
          "exam_fee": 5000,
          "currency": "NGN",
          "program": {
            "id": 1,
            "title": "BSc Economics"
          },
          "faculty": {
            "id": 1,
            "name": "Faculty of Social Sciences"
          },
          "instructor": {
            "id": 1,
            "full_name": "Dr. Jane Smith",
            "email": "jane.smith@example.com"
          }
        },
        "results": {
          "first_ca": 15,
          "second_ca": 18,
          "third_ca": 20,
          "exam_score": 45,
          "total_score": 98
        }
      }
    ],
    "exams": [
      {
        "id": 501,
        "exam_id": 10,
        "attempt_no": 1,
        "status": "graded",
        "started_at": "2024-12-01T10:00:00.000Z",
        "submitted_at": "2024-12-01T11:30:00.000Z",
        "graded_at": "2024-12-02T09:00:00.000Z",
        "total_score": 85.5,
        "max_score": 100,
        "exam": {
          "id": 10,
          "title": "ECO101 Final Examination",
          "course_id": 1,
          "exam_type": "mixed",
          "duration_minutes": 90,
          "academic_year": "2024/2025",
          "semester": "1ST",
          "course": {
            "id": 1,
            "title": "Introduction to Economics",
            "course_code": "ECO101"
          }
        }
      }
    ],
    "wallet": {
      "balance": 25000,
      "currency": "NGN",
      "transactions": [
        {
          "id": 301,
          "service_name": "Wallet Funding",
          "amount": 50000,
          "type": "Credit",
          "date": "2024-09-01",
          "ref": "FUND001",
          "balance": "50000",
          "currency": "NGN"
        },
        {
          "id": 302,
          "service_name": "Course Payment",
          "amount": 25000,
          "type": "Debit",
          "date": "2024-09-05",
          "ref": "PAY001",
          "balance": "25000",
          "currency": "NGN"
        }
      ],
      "summary": {
        "total_credits": 100000,
        "total_debits": 75000,
        "net_balance": 25000
      }
    },
    "payments": {
      "schoolFees": {
        "history": [
          {
            "id": 201,
            "student_id": 1,
            "amount": 50000,
            "status": "Paid",
            "academic_year": "2024/2025",
            "semester": "1ST",
            "date": "2024-09-01",
            "type": "Semester Registration",
            "teller_no": "TXN123456",
            "currency": "NGN"
          }
        ],
        "currentSemester": {
          "id": 201,
          "amount": 50000,
          "status": "Paid",
          "academic_year": "2024/2025",
          "semester": "1ST",
          "date": "2024-09-01",
          "type": "Semester Registration",
          "paid": true
        }
      },
      "courseOrders": [
        {
          "id": 401,
          "student_id": 1,
          "academic_year": "2024/2025",
          "date": "2024-09-05",
          "semester": "1ST",
          "amount": "25000",
          "level": "200",
          "currency": "NGN"
        }
      ]
    },
    "currentSemester": {
      "id": 15,
      "academic_year": "2025/2026",
      "semester": "2ND",
      "status": "Active",
      "start_date": "2025-06-16",
      "end_date": "2025-09-30"
    }
  }
}
```

---

#### **Step 5: Frontend Implementation Guide**

**1. Personal Information Tab**

```javascript
// Display personal info
const personalInfo = data.personalInformation;
const faculty = data.faculty;
const program = data.program;

// UI Structure:
<div className="personal-info">
  <h2>Personal Information</h2>
  <div className="info-grid">
    <div>
      Name: {personalInfo.fname} {personalInfo.mname} {personalInfo.lname}
    </div>
    <div>Email: {personalInfo.email}</div>
    <div>Phone: {personalInfo.phone}</div>
    <div>Matric Number: {personalInfo.matric_number}</div>
    <div>Level: {personalInfo.level}</div>
    <div>Status: {personalInfo.admin_status}</div>
  </div>

  <h3>Academic Information</h3>
  <div>Program: {program?.title}</div>
  <div>Faculty: {faculty?.name}</div>
</div>;
```

**2. Registrations Tab**

```javascript
// Display registrations
const registrations = data.registrations;

// UI Structure:
<div className="registrations">
  <h2>Registration History</h2>
  {registrations.map((reg, index) => (
    <div key={index} className="registration-card">
      <div className="semester-header">
        <h3>
          {reg.academic_year} - {reg.semester} Semester
        </h3>
        <span className={`status-badge ${reg.registration_status}`}>
          {reg.registration_status === "registered"
            ? "✓ Registered"
            : reg.registration_status === "pending_payment"
            ? "⏳ Pending Payment"
            : "⚠️ Pending"}
        </span>
      </div>

      <div className="registration-details">
        <p>Courses Registered: {reg.course_count}</p>
        <p>Registration Date: {reg.registration_date}</p>

        {reg.school_fees && (
          <div className="school-fees">
            <p>
              School Fees: {reg.school_fees.amount} {reg.school_fees.currency}
            </p>
            <p>Status: {reg.school_fees.status}</p>
            {reg.school_fees.teller_no && (
              <p>Teller Number: {reg.school_fees.teller_no}</p>
            )}
          </div>
        )}

        <div className="courses-list">
          <h4>Registered Courses:</h4>
          <ul>
            {reg.courses.map((course, idx) => (
              <li key={idx}>
                {course.course_code} - {course.title}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  ))}
</div>;
```

**3. Courses Tab**

```javascript
// Display courses with results
const courses = data.courses;

// UI Structure:
<div className="courses">
  <h2>Courses & Results</h2>
  <table className="courses-table">
    <thead>
      <tr>
        <th>Course Code</th>
        <th>Course Title</th>
        <th>Unit</th>
        <th>Instructor</th>
        <th>1st CA</th>
        <th>2nd CA</th>
        <th>3rd CA</th>
        <th>Exam</th>
        <th>Total</th>
        <th>Grade</th>
      </tr>
    </thead>
    <tbody>
      {courses.map((course, index) => {
        const total = course.results.total_score;
        const grade =
          total >= 70
            ? "A"
            : total >= 60
            ? "B"
            : total >= 50
            ? "C"
            : total >= 45
            ? "D"
            : "F";

        return (
          <tr key={index}>
            <td>{course.course.course_code}</td>
            <td>{course.course.title}</td>
            <td>{course.course.course_unit}</td>
            <td>{course.course.instructor?.full_name}</td>
            <td>{course.results.first_ca}</td>
            <td>{course.results.second_ca}</td>
            <td>{course.results.third_ca}</td>
            <td>{course.results.exam_score}</td>
            <td>{total}</td>
            <td className={`grade-${grade}`}>{grade}</td>
          </tr>
        );
      })}
    </tbody>
  </table>
</div>;
```

**4. Exams Tab**

```javascript
// Display exam attempts
const exams = data.exams;

// UI Structure:
<div className="exams">
  <h2>Exam History</h2>
  {exams.map((exam, index) => (
    <div key={index} className="exam-card">
      <div className="exam-header">
        <h3>{exam.exam?.title}</h3>
        <span className={`status-badge ${exam.status}`}>{exam.status}</span>
      </div>

      <div className="exam-details">
        <p>
          Course: {exam.exam?.course?.course_code} - {exam.exam?.course?.title}
        </p>
        <p>Attempt: #{exam.attempt_no}</p>
        <p>
          Score: {exam.total_score} / {exam.max_score}
        </p>
        <p>
          Percentage: {((exam.total_score / exam.max_score) * 100).toFixed(1)}%
        </p>
        <p>Started: {new Date(exam.started_at).toLocaleString()}</p>
        {exam.submitted_at && (
          <p>Submitted: {new Date(exam.submitted_at).toLocaleString()}</p>
        )}
        {exam.graded_at && (
          <p>Graded: {new Date(exam.graded_at).toLocaleString()}</p>
        )}
      </div>
    </div>
  ))}
</div>;
```

**5. Wallet Tab**

```javascript
// Display wallet information
const wallet = data.wallet;

// UI Structure:
<div className="wallet">
  <h2>Wallet</h2>

  <div className="wallet-summary">
    <div className="balance-card">
      <h3>Current Balance</h3>
      <p className="balance-amount">
        {wallet.balance} {wallet.currency}
      </p>
    </div>

    <div className="summary-stats">
      <div>
        <label>Total Credits:</label>
        <span>
          {wallet.summary.total_credits} {wallet.currency}
        </span>
      </div>
      <div>
        <label>Total Debits:</label>
        <span>
          {wallet.summary.total_debits} {wallet.currency}
        </span>
      </div>
      <div>
        <label>Net Balance:</label>
        <span>
          {wallet.summary.net_balance} {wallet.currency}
        </span>
      </div>
    </div>
  </div>

  <div className="transactions">
    <h3>Transaction History</h3>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Service</th>
          <th>Type</th>
          <th>Amount</th>
          <th>Balance</th>
          <th>Reference</th>
        </tr>
      </thead>
      <tbody>
        {wallet.transactions.map((txn, index) => (
          <tr key={index} className={`txn-${txn.type.toLowerCase()}`}>
            <td>{txn.date}</td>
            <td>{txn.service_name}</td>
            <td>
              <span className={`type-badge ${txn.type}`}>{txn.type}</span>
            </td>
            <td>
              {txn.amount} {txn.currency}
            </td>
            <td>
              {txn.balance} {txn.currency}
            </td>
            <td>{txn.ref}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>;
```

**6. Payments Tab**

```javascript
// Display payment information
const payments = data.payments;
const currentSemester = data.currentSemester;

// UI Structure:
<div className="payments">
  <h2>Payments</h2>

  {/* Current Semester School Fees */}
  {payments.schoolFees.currentSemester && (
    <div className="current-semester-fees">
      <h3>Current Semester School Fees</h3>
      <div className="fee-card">
        <p>
          Semester: {currentSemester?.academic_year} -{" "}
          {currentSemester?.semester}
        </p>
        <p>
          Amount: {payments.schoolFees.currentSemester.amount}{" "}
          {payments.schoolFees.currentSemester.currency}
        </p>
        <p
          className={`status-${payments.schoolFees.currentSemester.status.toLowerCase()}`}
        >
          Status: {payments.schoolFees.currentSemester.status}
        </p>
        {payments.schoolFees.currentSemester.teller_no && (
          <p>Teller: {payments.schoolFees.currentSemester.teller_no}</p>
        )}
      </div>
    </div>
  )}

  {/* School Fees History */}
  <div className="school-fees-history">
    <h3>School Fees History</h3>
    <table>
      <thead>
        <tr>
          <th>Academic Year</th>
          <th>Semester</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Date</th>
          <th>Type</th>
        </tr>
      </thead>
      <tbody>
        {payments.schoolFees.history.map((fee, index) => (
          <tr key={index}>
            <td>{fee.academic_year}</td>
            <td>{fee.semester}</td>
            <td>
              {fee.amount} {fee.currency}
            </td>
            <td className={`status-${fee.status.toLowerCase()}`}>
              {fee.status}
            </td>
            <td>{fee.date}</td>
            <td>{fee.type}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>

  {/* Course Orders */}
  <div className="course-orders">
    <h3>Course Orders</h3>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Academic Year</th>
          <th>Semester</th>
          <th>Level</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        {payments.courseOrders.map((order, index) => (
          <tr key={index}>
            <td>{new Date(order.date).toLocaleDateString()}</td>
            <td>{order.academic_year}</td>
            <td>{order.semester}</td>
            <td>{order.level}</td>
            <td>
              {order.amount} {order.currency}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>;
```

---

#### **Step 6: Error Handling**

```javascript
// Handle API call
try {
  const response = await fetch(`/api/admin/students/${studentId}/full`, {
    headers: {
      Authorization: `Bearer ${superAdminToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      // Student not found
      showError("Student not found");
    } else if (response.status === 403) {
      // Unauthorized - not super admin
      showError("Access denied. Super admin privileges required.");
    } else {
      // Other errors
      showError("Failed to load student details");
    }
    return;
  }

  const result = await response.json();

  if (result.success) {
    // Use result.data for UI
    setStudentData(result.data);
  } else {
    showError(result.message || "Failed to load student details");
  }
} catch (error) {
  console.error("Error fetching student details:", error);
  showError("Network error. Please try again.");
}
```

---

#### **Step 7: Loading States**

```javascript
// Show loading state while fetching
const [loading, setLoading] = useState(true);
const [studentData, setStudentData] = useState(null);

useEffect(() => {
  const fetchStudentDetails = async () => {
    setLoading(true);
    try {
      // API call here
      setStudentData(data);
    } catch (error) {
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  fetchStudentDetails();
}, [studentId]);

// In your JSX:
{loading ? (
  <div className="loading-spinner">Loading student details...</div>
) : studentData ? (
  // Render tabs and content
) : (
  <div className="error-message">Failed to load student details</div>
)}
```

---

#### **Step 8: Key Points for Frontend Developers**

1. **Single API Call**: This endpoint returns all student data in one request - no need for multiple API calls
2. **Tab Navigation**: Use the data structure to build tabs matching the response sections
3. **Current Semester**: Use `data.currentSemester` to highlight current semester information across tabs
4. **Registration Status**: Check `registration_status` in registrations array to show visual indicators (badges, colors)
5. **Empty States**: Handle cases where arrays might be empty (no courses, no exams, etc.)
6. **Date Formatting**: Format dates using JavaScript Date objects or a library like `date-fns`
7. **Currency Formatting**: Format currency amounts with proper symbols and commas
8. **Status Badges**: Use different colors/styles for different statuses (Paid/Pending, Registered/Not Registered)
9. **Responsive Design**: Make sure tables and cards are responsive for mobile devices
10. **Performance**: Consider lazy loading or pagination for large lists (exams, transactions)

---

#### **Step 9: Example Use Cases**

**Use Case 1: Student Profile Page**

```
Route: /admin/students/:id
Component: StudentProfilePage
Tabs: Personal Info | Registrations | Courses | Exams | Wallet | Payments
Data Source: GET /api/admin/students/:id/full
```

**Use Case 2: Quick Student Overview**

```
Route: /admin/students/:id/overview
Component: StudentOverviewCard
Show: Name, Program, Current Semester Status, Wallet Balance
Data Source: GET /api/admin/students/:id/full (use only needed fields)
```

**Use Case 3: Registration Management**

```
Route: /admin/students/:id/registrations
Component: RegistrationManagement
Focus: data.registrations array
Actions: View registration history, check payment status
```

---

#### **Step 10: Testing in Postman**

1. **Set up environment variable:**

   - `super_admin_token` = (get from admin login)

2. **Make the request:**

   ```
   GET {{base_url}}/api/admin/students/1/full
   Headers:
     Authorization: Bearer {{super_admin_token}}
   ```

3. **Verify response:**

   - Check `success: true`
   - Verify all sections are present
   - Check data structure matches documentation

4. **Test with different student IDs:**
   - Active student with full data
   - New student with minimal data
   - Inactive student

---

**For Frontend:**

- ✅ Use this endpoint for comprehensive student profile pages
- ✅ Build tabbed interface matching the data structure
- ✅ Handle loading and error states
- ✅ Format dates, currency, and statuses properly
- ✅ Show visual indicators for registration and payment status
- ✅ Make it responsive for all devices

---

#### **4. Create Student**

**POST** `/api/admin/students`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**Body:**

```json
{
  "email": "newstudent@example.com",
  "password": "Student123",
  "fname": "New",
  "lname": "Student",
  "phone": "08012345681",
  "level": "100",
  "program_id": 1,
  "currency": "NGN",
  "referral_code": "REF123",
  "designated_institute": "WSP",
  "foreign_student": false
}
```

**For Frontend:**

- Show form with all fields
- Validate required fields
- Show success message

---

#### **5. Update Student**

**PUT** `/api/admin/students/:id`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**Body:**

```json
{
  "fname": "Updated",
  "lname": "Name",
  "phone": "08012345682",
  "level": "200"
}
```

---

#### **6. Deactivate Student**

**PATCH** `/api/admin/students/:id/deactivate`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**For Frontend:**

- Show confirmation dialog
- Update UI after deactivation

---

#### **7. Activate Student**

**PATCH** `/api/admin/students/:id/activate`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

#### **8. Reset Student Password**

**POST** `/api/admin/students/:id/reset-password`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**Body:**

```json
{
  "newPassword": "NewPassword123"
}
```

**For Frontend:**

- Show confirmation
- Email will be sent automatically
- Log activity

---

### **STAFF MANAGEMENT**

#### **1. Get All Staff**

**GET** `/api/admin/staff`

**Query Parameters:**

- `page` (optional): `1`
- `limit` (optional): `20`
- `search` (optional)
- `status` (optional): `active` or `inactive`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

#### **2. Create Staff**

**POST** `/api/admin/staff`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**Body:**

```json
{
  "email": "newstaff@example.com",
  "password": "Staff123",
  "fname": "New",
  "lname": "Staff",
  "phone": "08012345683",
  "department": "Computer Science"
}
```

---

#### **3. Update Staff**

**PUT** `/api/admin/staff/:id`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

#### **4. Deactivate Staff**

**PATCH** `/api/admin/staff/:id/deactivate`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

#### **5. Reset Staff Password**

**POST** `/api/admin/staff/:id/reset-password`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**Body:**

```json
{
  "newPassword": "NewPassword123"
}
```

---

### **ADMIN MANAGEMENT** (Super Admin Only)

#### **1. Get All Admins**

**GET** `/api/admin/admins`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**For Frontend:**

- Show admin list
- Display roles (super_admin, wpu_admin, wsp_admin is legacy)
- Show permissions

---

#### **2. Create Admin**

**POST** `/api/admin/admins`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**Body:**

```json
{
  "email": "newadmin@example.com",
  "password": "Admin123",
  "fname": "New",
  "lname": "Admin",
  "role": "wpu_admin",
  "permissions": {
    "students": {
      "view": true,
      "create": false,
      "edit": false,
      "delete": false
    },
    "staff": { "view": true, "create": false, "edit": false, "delete": false },
    "courses": { "view": true, "create": true, "edit": true, "delete": false }
  }
}
```

**For Frontend:**

- Show permission matrix
- Enable granular permission selection
- Email will be sent automatically

---

#### **3. Update Admin**

**PUT** `/api/admin/admins/:id`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

#### **4. Deactivate Admin**

**PATCH** `/api/admin/admins/:id/deactivate`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

#### **5. Get Activity Logs**

**GET** `/api/admin/activity-logs`

**Query Parameters:**

- `page` (optional): `1`
- `limit` (optional): `20`
- `admin_id` (optional): Filter by admin
- `action` (optional): Filter by action type
- `start_date` (optional)
- `end_date` (optional)

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**For Frontend:**

- Show audit trail
- Enable filtering
- Display in timeline format

---

### **PROGRAM MANAGEMENT** (Super Admin Only)

#### **1. Get All Programs**

**GET** `/api/admin/programs`

**Query Parameters:**

- `page` (optional): `1`
- `limit` (optional): `20`
- `search` (optional)
- `facultyId` (optional)
- `status` (optional): `Y` or `N`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**Response:**

```json
{
  "success": true,
  "message": "Programs retrieved successfully",
  "data": {
    "programs": [
      {
        "id": 1,
        "title": "BSc Economics",
        "description": "...",
        "faculty_id": 1,
        "faculty": { "id": 1, "name": "Social Sciences" },
        "courses": [
          { "id": 1, "title": "Microeconomics", "course_code": "ECO101" }
        ]
      }
    ],
    "pagination": {
      "total": 30,
      "page": 1,
      "limit": 20,
      "totalPages": 2
    }
  }
}
```

**For Frontend:**

- Display program list
- Show courses count per program
- Enable CRUD operations

---

#### **2. Get Program Statistics**

**GET** `/api/admin/programs/stats`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

#### **3. Get Program by ID**

**GET** `/api/admin/programs/:id`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**For Frontend:**

- Show program details
- Display all courses in program
- Enable editing

---

#### **4. Create Program**

**POST** `/api/admin/programs`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**Body:**

```json
{
  "title": "BSc Computer Science",
  "description": "Computer Science degree program",
  "faculty_id": 2,
  "status": "Y"
}
```

---

#### **5. Update Program**

**PUT** `/api/admin/programs/:id`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

#### **6. Delete Program**

**DELETE** `/api/admin/programs/:id`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

### **COURSE MANAGEMENT** (Super Admin Only)

#### **1. Get All Courses**

**GET** `/api/admin/courses`

**Query Parameters:**

- `page` (optional): `1`
- `limit` (optional): `20`
- `search` (optional)
- `programId` (optional)
- `facultyId` (optional)
- `staffId` (optional)
- `level` (optional)
- `semester` (optional)

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**For Frontend:**

- Show course list with filters
- Display owner type (WPU/Marketplace)
- Enable CRUD operations

---

#### **2. Get Course Statistics**

**GET** `/api/admin/courses/stats`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

#### **3. Get Courses by Program**

**GET** `/api/admin/courses/program/:programId`

**Query Parameters:**

- `page` (optional)
- `limit` (optional)
- `search` (optional)

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

#### **4. Get Course by ID**

**GET** `/api/admin/courses/:id`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

#### **5. Create Course**

**POST** `/api/admin/courses`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**Body:**

```json
{
  "title": "Introduction to Programming",
  "course_code": "CSC101",
  "course_unit": 3,
  "price": "0",
  "course_type": "Core",
  "course_level": 100,
  "semester": "1ST",
  "staff_id": 1,
  "program_id": 1,
  "faculty_id": 1,
  "currency": "NGN",
  "owner_type": "wsp",
  "is_marketplace": false
}
```

**For Frontend:**

- Show form with all fields
- Allow setting owner_type (wpu/sole_tutor/organization, wsp is legacy)
- If marketplace, require owner_id

---

#### **6. Update Course**

**PUT** `/api/admin/courses/:id`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

#### **7. Delete Course**

**DELETE** `/api/admin/courses/:id`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

### **SEMESTER MANAGEMENT** (Super Admin Only)

#### **1. Get All Semesters**

**GET** `/api/admin/semesters`

**Query Parameters:**

- `page` (optional): `1`
- `limit` (optional): `20`
- `academicYear` (optional)
- `status` (optional): `active`, `closed`, `pending`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

#### **2. Get Current Semester**

**GET** `/api/admin/semesters/current`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**For Frontend:**

- Display current semester prominently
- Show dates and status

---

#### **3. Get Semester Statistics**

**GET** `/api/admin/semesters/stats`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

#### **4. Get Semester by ID**

**GET** `/api/admin/semesters/:id`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

#### **5. Create Semester**

**POST** `/api/admin/semesters`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**Body:**

```json
{
  "academic_year": "2024/2025",
  "semester": "1ST",
  "start_date": "2024-09-01",
  "end_date": "2024-12-31",
  "status": "pending"
}
```

**For Frontend:**

- Show date pickers
- Validate dates
- Status options: pending, active, closed

---

#### **6. Update Semester**

**PUT** `/api/admin/semesters/:id`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

#### **7. Close Semester**

**PATCH** `/api/admin/semesters/:id/close`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**Body:**

```json
{
  "reason": "End of academic session"
}
```

**For Frontend:**

- Show confirmation dialog
- Require reason input

---

#### **8. Extend Semester**

**PATCH** `/api/admin/semesters/:id/extend`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**Body:**

```json
{
  "new_end_date": "2025-01-15",
  "reason": "Extended due to holidays"
}
```

---

#### **9. Activate Semester**

**PATCH** `/api/admin/semesters/:id/activate`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**For Frontend:**

- Show warning: "This will close all other active semesters"
- Require confirmation

---

#### **10. Delete Semester**

**DELETE** `/api/admin/semesters/:id`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**Note:** Cannot delete active semester

---

### **FACULTY MANAGEMENT** (Super Admin Only)

#### **1. Get All Faculties**

**GET** `/api/admin/faculties`

**Query Parameters:**

- `page` (optional): `1`
- `limit` (optional): `20`
- `search` (optional)

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

#### **2. Get Faculty Statistics**

**GET** `/api/admin/faculties/stats`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

#### **3. Get Faculty by ID**

**GET** `/api/admin/faculties/:id`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**For Frontend:**

- Show faculty details
- Display programs and courses
- Show counts

---

#### **4. Create Faculty**

**POST** `/api/admin/faculties`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**Body:**

```json
{
  "name": "Faculty of Engineering",
  "description": "Engineering programs and courses"
}
```

---

#### **5. Update Faculty**

**PUT** `/api/admin/faculties/:id`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

#### **6. Delete Faculty**

**DELETE** `/api/admin/faculties/:id`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**Note:** Cannot delete if has programs or courses

---

### **SYSTEM SETTINGS** (Super Admin Only)

#### **1. Get System Settings**

**GET** `/api/admin/settings`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**Response:**

```json
{
  "success": true,
  "message": "System settings retrieved successfully",
  "data": {
    "settings": {
      "id": 1,
      "name": "Western Pinnacle University",
      "address": "Ontario, Canada",
      "rate": "1500"
    }
  }
}
```

**For Frontend:**

- Display in settings page
- Enable editing

---

#### **2. Update System Settings**

**PUT** `/api/admin/settings`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**Body:**

```json
{
  "name": "Western Pinnacle University",
  "address": "Ontario, Canada",
  "rate": "1500"
}
```

---

### **NOTICE MANAGEMENT** (Super Admin Only)

#### **1. Get All Notices**

**GET** `/api/admin/notices`

**Query Parameters:**

- `page` (optional): `1`
- `limit` (optional): `20`
- `course_id` (optional)
- `search` (optional)

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

#### **2. Get Notice by ID**

**GET** `/api/admin/notices/:id`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

#### **3. Create Notice**

**POST** `/api/admin/notices`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**Body:**

```json
{
  "title": "Important Announcement",
  "note": "All students are required to...",
  "course_id": null
}
```

**For Frontend:**

- course_id = null for system-wide notice
- course_id = number for course-specific notice

---

#### **4. Update Notice**

**PUT** `/api/admin/notices/:id`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

#### **5. Delete Notice**

**DELETE** `/api/admin/notices/:id`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

### **PAYMENT MANAGEMENT** (Super Admin Only)

#### **1. Get Payment Overview**

**GET** `/api/admin/payments/overview`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**For Frontend:**

- Show summary cards
- Display all payment types

---

#### **2. Get All Funding Transactions**

**GET** `/api/admin/payments/fundings`

**Query Parameters:**

- `page` (optional): `1`
- `limit` (optional): `20`
- `student_id` (optional)
- `type` (optional): `Credit` or `Debit`
- `semester` (optional)
- `academic_year` (optional)
- `currency` (optional)
- `start_date` (optional)
- `end_date` (optional)

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

#### **3. Get Funding Statistics**

**GET** `/api/admin/payments/fundings/stats`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

#### **4. Get All School Fees**

**GET** `/api/admin/payments/school-fees`

**Query Parameters:**

- `page` (optional): `1`
- `limit` (optional): `20`
- `student_id` (optional)
- `status` (optional): `Paid`, `Pending`
- `semester` (optional)
- `academic_year` (optional)
- `start_date` (optional)
- `end_date` (optional)

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

#### **5. Get School Fees Statistics**

**GET** `/api/admin/payments/school-fees/stats`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

#### **6. Get All Course Orders**

**GET** `/api/admin/payments/course-orders`

**Query Parameters:**

- `page` (optional): `1`
- `limit` (optional): `20`
- `student_id` (optional)
- `semester` (optional)
- `academic_year` (optional)
- `level` (optional)
- `start_date` (optional)
- `end_date` (optional)

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

#### **7. Get Course Order Statistics**

**GET** `/api/admin/payments/course-orders/stats`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

### **TUTOR MANAGEMENT** (Super Admin Only)

#### **Sole Tutors**

##### **1. Get All Sole Tutors**

**GET** `/api/admin/tutors/sole-tutors`

**Query Parameters:**

- `page` (optional): `1`
- `limit` (optional): `20`
- `status` (optional): `pending`, `active`, `suspended`, `rejected`
- `verification_status` (optional): `unverified`, `verified`, `rejected`
- `search` (optional)

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**For Frontend:**

- Show tutor list
- Display status badges
- Enable approve/reject actions

---

##### **2. Get Sole Tutor by ID**

**GET** `/api/admin/tutors/sole-tutors/:id`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**For Frontend:**

- Show full tutor profile
- Display courses
- Show earnings/wallet

---

##### **3. Approve Sole Tutor**

**PATCH** `/api/admin/tutors/sole-tutors/:id/approve`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**For Frontend:**

- Show confirmation
- Email will be sent automatically
- Update status in UI

---

##### **4. Reject Sole Tutor**

**PATCH** `/api/admin/tutors/sole-tutors/:id/reject`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**Body:**

```json
{
  "reason": "Incomplete documentation"
}
```

---

##### **5. Update Sole Tutor Status**

**PATCH** `/api/admin/tutors/sole-tutors/:id/status`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**Body:**

```json
{
  "status": "suspended"
}
```

**Valid values:** `active`, `suspended`

---

#### **Organizations**

##### **1. Get All Organizations**

**GET** `/api/admin/tutors/organizations`

**Query Parameters:**

- `page` (optional): `1`
- `limit` (optional): `20`
- `status` (optional): `pending`, `active`, `suspended`, `rejected`
- `verification_status` (optional)
- `search` (optional)

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

##### **2. Get Organization by ID**

**GET** `/api/admin/tutors/organizations/:id`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**For Frontend:**

- Show organization details
- Display users (tutors)
- Show courses
- Display earnings

---

##### **3. Approve Organization**

**PATCH** `/api/admin/tutors/organizations/:id/approve`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

---

##### **4. Reject Organization**

**PATCH** `/api/admin/tutors/organizations/:id/reject`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**Body:**

```json
{
  "reason": "Invalid registration documents"
}
```

---

##### **5. Update Organization Status**

**PATCH** `/api/admin/tutors/organizations/:id/status`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**Body:**

```json
{
  "status": "suspended"
}
```

---

##### **6. Get Tutor Statistics**

**GET** `/api/admin/tutors/stats`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**Response:**

```json
{
  "success": true,
  "message": "Tutor statistics retrieved successfully",
  "data": {
    "soleTutors": {
      "total": 25,
      "active": 20,
      "pending": 5
    },
    "organizations": {
      "total": 10,
      "active": 8,
      "pending": 2
    },
    "tutorCourses": 150
  }
}
```

---

### **REVENUE MANAGEMENT** (Super Admin Only)

#### **1. Get All Marketplace Transactions**

**GET** `/api/admin/revenue/transactions`

**Query Parameters:**

- `page` (optional): `1`
- `limit` (optional): `20`
- `owner_type` (optional): `sole_tutor` or `organization`
- `owner_id` (optional)
- `payment_status` (optional): `pending`, `completed`, `failed`, `refunded`
- `start_date` (optional)
- `end_date` (optional)

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**Response:**

```json
{
  "success": true,
  "message": "Marketplace transactions retrieved successfully",
  "data": {
    "transactions": [
      {
        "id": 1,
        "course_id": 2,
        "student_id": 10,
        "owner_type": "sole_tutor",
        "owner_id": 5,
        "course_price": 15000,
        "currency": "NGN",
        "commission_rate": 15,
        "wpu_commission": 2250,
        "tutor_earnings": 12750,
        "payment_status": "completed",
        "course": { "id": 2, "title": "Advanced Mathematics", "course_code": "MATH301" },
        "student": { "id": 10, "fname": "John", "lname": "Doe", "email": "john@example.com" },
        "wpuCommission": { "id": 1, "amount": 2250, "status": "collected" }
      }
    ],
    "pagination": { ... }
  }
}
```

**For Frontend:**

- Display transaction table
- Show revenue breakdown
- Enable filtering
- Export functionality

---

#### **2. Get WPU Revenue Statistics**

**GET** `/api/admin/revenue/wsp-stats`

**Query Parameters:**

- `start_date` (optional)
- `end_date` (optional)

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**Response:**

```json
{
  "success": true,
  "message": "WPU revenue statistics retrieved successfully",
  "data": {
    "totalCommission": 50000,
    "totalRevenue": 333333,
    "totalTransactions": 25,
    "byOwnerType": [
      {
        "owner_type": "sole_tutor",
        "count": 15,
        "total_revenue": 200000,
        "total_commission": 30000
      },
      {
        "owner_type": "organization",
        "count": 10,
        "total_revenue": 133333,
        "total_commission": 20000
      }
    ],
    "pendingPayouts": 150000,
    "topEarners": [
      {
        "owner_type": "sole_tutor",
        "owner_id": 5,
        "sales_count": 10,
        "total_revenue": 150000,
        "total_commission": 22500
      }
    ]
  }
}
```

**For Frontend:**

- Display revenue dashboard
- Show charts/graphs
- Highlight top earners
- Show pending payouts

---

#### **3. Get Tutor Revenue Details**

**GET** `/api/admin/revenue/tutor/:owner_type/:owner_id`

**Example:** `/api/admin/revenue/tutor/sole_tutor/5`

**Query Parameters:**

- `start_date` (optional)
- `end_date` (optional)

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**For Frontend:**

- Show individual tutor revenue
- Display transaction history
- Show wallet balance
- Enable payout processing

---

### **DASHBOARD** (Super Admin Only)

#### **Get Dashboard Statistics**

**GET** `/api/admin/dashboard/stats`

**Headers:**

```
Authorization: Bearer {{super_admin_token}}
```

**Response:**

```json
{
  "success": true,
  "message": "Dashboard statistics retrieved successfully",
  "data": {
    "overview": {
      "students": { "total": 150, "active": 140, "inactive": 10 },
      "staff": { "total": 25, "active": 23 },
      "admins": { "total": 5 },
      "academic": {
        "programs": { "total": 30, "active": 28 },
        "courses": 200,
        "faculties": 5
      },
      "enrollments": 500
    },
    "currentSemester": {
      "id": 1,
      "academic_year": "2024/2025",
      "semester": "1ST",
      "start_date": "2024-09-01",
      "end_date": "2024-12-31",
      "status": "active"
    },
    "studentsByLevel": [
      { "level": "100", "count": 50 },
      { "level": "200", "count": 40 }
    ],
    "topPrograms": [
      { "program_id": 1, "program_title": "BSc Economics", "student_count": 30 }
    ],
    "recentActivity": {
      "enrollmentsLast7Days": 25,
      "fundingsLast30Days": 100,
      "schoolFeesLast30Days": 80
    }
  }
}
```

**For Frontend:**

- Display main dashboard
- Show key metrics cards
- Display charts
- Show recent activity feed

---

## 🏪 MARKETPLACE ENDPOINTS

### **TUTOR REGISTRATION & AUTHENTICATION**

#### **1. Register Sole Tutor**

**POST** `/api/marketplace/register/sole-tutor`

**Body:**

```json
{
  "email": "tutor@example.com",
  "password": "Tutor123",
  "fname": "Tutor",
  "lname": "Name",
  "phone": "08012345684",
  "bio": "Experienced mathematics tutor",
  "specialization": "Mathematics, Physics",
  "qualifications": "MSc Mathematics",
  "experience_years": 5,
  "address": "Lagos, Nigeria",
  "country": "Nigeria"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Registration successful! Your account is pending approval. You will be notified once approved.",
  "data": {
    "tutor": {
      "id": 1,
      "email": "tutor@example.com",
      "fname": "Tutor",
      "lname": "Name",
      "status": "pending"
    }
  }
}
```

**For Frontend:**

- Show pending approval message
- Explain approval process
- Set up email notifications

---

#### **2. Register Organization**

**POST** `/api/marketplace/register/organization`

**Body:**

```json
{
  "name": "ABC Tutoring Services",
  "email": "info@abctutoring.com",
  "password": "Org123",
  "description": "Professional tutoring organization",
  "website": "https://abctutoring.com",
  "phone": "08012345685",
  "address": "Lagos, Nigeria",
  "country": "Nigeria",
  "registration_number": "RC123456",
  "tax_id": "TAX123456",
  "contact_person": "John Manager",
  "contact_email": "contact@abctutoring.com",
  "contact_phone": "08012345686"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Registration successful! Your organization account is pending approval. You will be notified once approved.",
  "data": {
    "organization": {
      "id": 1,
      "name": "ABC Tutoring Services",
      "email": "info@abctutoring.com",
      "status": "pending"
    }
  }
}
```

---

#### **3. Sole Tutor Login**

**POST** `/api/marketplace/login/sole-tutor`

**Body:**

```json
{
  "email": "tutor@example.com",
  "password": "Tutor123"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "tutor": {
      "id": 1,
      "fname": "Tutor",
      "lname": "Name",
      "email": "tutor@example.com",
      "status": "active",
      "wallet_balance": 0,
      "rating": 0
    },
    "accessToken": "jwt_token_here",
    "userType": "sole_tutor",
    "expiresIn": 14400
  }
}
```

**For Frontend:**

- Check status before allowing login
- If pending: Show "Awaiting approval"
- If rejected: Show "Account rejected"
- If suspended: Show "Account suspended"

---

#### **4. Organization Login**

**POST** `/api/marketplace/login/organization`

**Body:**

```json
{
  "email": "info@abctutoring.com",
  "password": "Org123"
}
```

---

#### **5. Organization User Login**

**POST** `/api/marketplace/login/organization-user`

**Body:**

```json
{
  "email": "tutor@abctutoring.com",
  "password": "User123"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "fname": "Org",
      "lname": "Tutor",
      "email": "tutor@abctutoring.com",
      "role": "tutor",
      "organization": {
        "id": 1,
        "name": "ABC Tutoring Services"
      }
    },
    "accessToken": "jwt_token_here",
    "userType": "organization_user",
    "expiresIn": 14400
  }
}
```

---

### **COURSE PURCHASE** (Student Only)

#### **Purchase Marketplace Course**

**POST** `/api/marketplace/courses/purchase`

**Headers:**

```
Authorization: Bearer {{student_token}}
```

**Body:**

```json
{
  "course_id": 2,
  "payment_reference": "PAY-123456789",
  "payment_method": "paystack"
}
```

**For Frontend:**

1. Integrate payment gateway (Paystack, Stripe, etc.)
2. After successful payment, get `payment_reference`
3. Call this endpoint with `payment_reference`
4. Show transaction details
5. Redirect to course page

**Important:**

- Only works for marketplace courses (`is_marketplace: true`, `owner_type: sole_tutor` or `organization`)
- WPU courses are FREE - use `/api/courses/register` instead

---

## 📝 TESTING FLOW

### **Recommended Testing Order**

1. **Setup**

   - Create Postman environment
   - Set base_url variable

2. **Student Flow**

   - Register student
   - Login student
   - Get profile
   - View available courses
   - Register for WSP course (FREE)
   - Purchase marketplace course (PAID)

3. **Staff Flow**

   - Register staff
   - Login staff
   - Get profile
   - View assigned courses

4. **Admin Flow**

   - Login as Super Admin
   - Test all Super Admin endpoints
   - Create WPU Admin
   - Test WPU Admin permissions

5. **Marketplace Flow**
   - Register sole tutor
   - Register organization
   - Login as tutor
   - (Tutor features - coming soon)

---

## 🔑 AUTHENTICATION FLOW

### **Token Management**

1. **After Login:**

   - Extract `accessToken` from response
   - Save to Postman variable: `{{student_token}}` or `{{admin_token}}`
   - Use in Authorization header: `Bearer {{token}}`

2. **Token Expiration:**

   - Tokens expire after 4 hours (14400 seconds)
   - Re-login when token expires

3. **Logout:**
   - Call logout endpoint
   - Clear token from storage

---

## 📧 EMAIL NOTIFICATIONS

### **When Emails Are Sent:**

| Action                        | Email Type       | Recipient    |
| ----------------------------- | ---------------- | ------------ |
| Student Registration          | Welcome          | Student      |
| Staff Registration            | Welcome          | Staff        |
| Admin Created                 | Welcome          | Admin        |
| Password Reset Request        | Reset Link       | User         |
| Password Reset                | Password Changed | User         |
| Admin Resets Student Password | Password Changed | Student      |
| Admin Resets Staff Password   | Password Changed | Staff        |
| Tutor Approved                | Welcome          | Tutor        |
| Organization Approved         | Welcome          | Organization |

**For Frontend:**

- Show success messages
- Inform users to check email
- Provide email verification status

---

## ⚠️ IMPORTANT NOTES FOR FRONTEND

### **Course Registration vs Purchase**

1. **WPU Courses** (`owner_type: "wpu"` or `"wsp"` for legacy):

   - FREE for WPU students
   - Use: `POST /api/courses/register`
   - No payment required

2. **Marketplace Courses** (`owner_type: "sole_tutor"` or `"organization"`):
   - PAID courses
   - Use: `POST /api/marketplace/courses/purchase`
   - Payment required first
   - Revenue sharing applies

### **Permission Levels**

1. **Super Admin:**

   - Full access to all endpoints
   - Can manage everything

2. **WPU Admin:**

   - Limited permissions
   - Can view students/staff
   - Can manage courses (if permission granted)
   - Cannot manage admins

3. **Students:**

   - Can view their courses
   - Can register for WPU courses
   - Can purchase marketplace courses

4. **Staff:**
   - Can view assigned courses
   - Can manage course content
   - Cannot manage other staff

### **Error Handling**

All endpoints return consistent error format:

```json
{
  "status": false,
  "code": 400,
  "message": "Error message here"
}
```

**For Frontend:**

- Check `status` field
- Display `message` to user
- Handle `code` appropriately (401 = re-login, 403 = no permission, etc.)

---

## 🎯 QUICK REFERENCE

### **Base URLs**

- Auth: `/api/auth`
- Admin: `/api/admin`
- Courses: `/api/courses`
- Marketplace: `/api/marketplace`

### **Common Headers**

```
Authorization: Bearer {{token}}
Content-Type: application/json
```

### **Common Query Parameters**

- `page`: Pagination page number
- `limit`: Items per page
- `search`: Search term
- `start_date`: Filter start date
- `end_date`: Filter end date

---

**Last Updated:** Current Session
**Total Endpoints:** 100+
**Status:** Production Ready
