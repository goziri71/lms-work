# 🚀 Postman Testing Guide - Step by Step

## 📋 Table of Contents

1. [Setup Postman](#step-0-setup-postman)
2. [Test Admin Login Flow](#test-1-admin-login-flow)
3. [Test Admin Managing Students](#test-2-admin-managing-students)
4. [Test Admin Managing Staff](#test-3-admin-managing-staff)
5. [Test Admin Managing Admins](#test-4-admin-managing-admins)
6. [Test Student/Staff User Flow](#test-5-studentstaff-user-flow)
7. [Verify Emails & Logs](#test-6-verify-emails--logs)

---

## 🗺️ Complete Testing Flow Map

Here's the **complete journey** of what we'll test:

```
📦 STEP 0: SETUP POSTMAN
    ↓
🔐 TEST 1: ADMIN AUTHENTICATION (4 steps)
    ├─ 1.1 Admin Login → Get Token ✅
    ├─ 1.2 Get Admin Profile
    ├─ 1.3 Update Admin Profile
    └─ 1.4 Admin Logout
    ↓
👨‍🎓 TEST 2: ADMIN MANAGING STUDENTS (8 steps)
    ├─ 2.1 Get All Students (with pagination, filters)
    ├─ 2.2 Get Student Statistics (dashboard data)
    ├─ 2.3 Get Single Student (full details)
    ├─ 2.4 Create New Student
    ├─ 2.5 Update Student Info
    ├─ 2.6 Deactivate Student (soft delete)
    ├─ 2.7 Activate Student (restore)
    └─ 2.8 Reset Student Password → 📧 Email sent!
    ↓
👨‍🏫 TEST 3: ADMIN MANAGING STAFF (5 steps)
    ├─ 3.1 Get All Staff
    ├─ 3.2 Create New Staff
    ├─ 3.3 Update Staff Info
    ├─ 3.4 Deactivate Staff
    └─ 3.5 Reset Staff Password → 📧 Email sent!
    ↓
🛡️ TEST 4: ADMIN MANAGING ADMINS (5 steps)
    ├─ 4.1 Get All Admins
    ├─ 4.2 Create New Admin → 📧 Welcome email sent!
    ├─ 4.3 Update Admin Info
    ├─ 4.4 Deactivate Admin
    └─ 4.5 View Activity Logs (audit trail)
    ↓
👤 TEST 5: STUDENT/STAFF USER FLOW (12 steps)
    │
    ├── STUDENT FLOW (6 steps)
    │   ├─ 5.1 Student Login → Get Token ✅
    │   ├─ 5.2 Get Student Profile
    │   ├─ 5.3 Update Student Profile (settings)
    │   ├─ 5.4 Request Password Reset → 📧 Reset link sent!
    │   ├─ 5.5 Reset Password → 📧 Confirmation sent!
    │   └─ 5.11 Student Logout
    │
    └── STAFF FLOW (6 steps)
        ├─ 5.6 Staff Login → Get Token ✅
        ├─ 5.7 Get Staff Profile
        ├─ 5.8 Update Staff Profile (settings)
        ├─ 5.9 Request Password Reset → 📧 Reset link sent!
        ├─ 5.10 Reset Password → 📧 Confirmation sent!
        └─ 5.12 Staff Logout
    ↓
✅ TEST 6: VERIFY EMAILS & LOGS (2 steps)
    ├─ 6.1 Check Email Logs in Database
    └─ 6.2 Check Activity Logs
```

---

## 📧 Emails You'll Receive During Testing

| Step | Email Type          | Recipient | Trigger                       |
| ---- | ------------------- | --------- | ----------------------------- |
| 4.2  | Welcome Email       | New Admin | Admin account created         |
| 2.8  | Password Changed    | Student   | Admin resets student password |
| 3.5  | Password Changed    | Staff     | Admin resets staff password   |
| 5.4  | Password Reset Link | Student   | Student forgot password       |
| 5.5  | Password Changed    | Student   | Student resets password       |
| 5.9  | Password Reset Link | Staff     | Staff forgot password         |
| 5.10 | Password Changed    | Staff     | Staff resets password         |

**Total: 7 email types to test!** 📧

---

## 🎯 Quick Testing Order (TL;DR)

1. **Setup Postman** → Create collection, add variables
2. **Login as Admin** → Test admin features
3. **Manage Students** → CRUD operations
4. **Manage Staff** → CRUD operations
5. **Manage Admins** → Create admins, view logs
6. **Test Student Flow** → Login, profile, password reset
7. **Test Staff Flow** → Login, profile, password reset
8. **Verify Everything** → Check emails and logs

**Total Steps: 38 endpoints to test!** 🚀

---

## STEP 0: Setup Postman

### **Create a New Collection**

1. Open Postman
2. Click **"New"** → **"Collection"**
3. Name it: **"WSP LMS - Admin System"**
4. Click **"Create"**

### **Set Collection Variables**

1. Click on your collection
2. Go to **"Variables"** tab
3. Add these variables:

| Variable Name   | Initial Value           | Current Value           |
| --------------- | ----------------------- | ----------------------- |
| `base_url`      | `http://localhost:3000` | `http://localhost:3000` |
| `admin_token`   | _(leave empty)_         | _(leave empty)_         |
| `student_token` | _(leave empty)_         | _(leave empty)_         |
| `staff_token`   | _(leave empty)_         | _(leave empty)_         |

4. Click **"Save"**

**✅ Now you're ready to test!**

---

## TEST 1: Admin Login Flow

### **📌 STEP 1.1: Admin Login**

**What it does:** Login as Super Admin and get access token

**Create Request:**

1. Click **"Add Request"**
2. Name: **"1.1 Admin Login"**
3. Method: **POST**
4. URL: `{{base_url}}/api/admin/login`

**Body:** (Select **"raw"** and **"JSON"**)

```json
{
  "email": "admin@pinnacleuniversity.co",
  "password": "Admin@123456"
}
```

**Expected Response:** ✅ Status `200 OK`

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "admin": {
      "id": 1,
      "email": "admin@pinnacleuniversity.co",
      "firstName": "Super",
      "lastName": "Admin",
      "role": "super_admin"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "expiresIn": 14400
  }
}
```

**📝 IMPORTANT - Save the Token:**

1. Copy the `accessToken` value from response
2. Go to your collection → **Variables** tab
3. Paste it in `admin_token` → **Current Value**
4. Click **"Save"**

**🎯 For Frontend:** This is the login endpoint. After user enters email/password, call this endpoint. Store the `accessToken` in localStorage/sessionStorage. Include it in all subsequent requests.

---

### **📌 STEP 1.2: Get Admin Profile**

**What it does:** Get logged-in admin's profile information

**Create Request:**

1. Name: **"1.2 Get Admin Profile"**
2. Method: **GET**
3. URL: `{{base_url}}/api/admin/profile`

**Headers:**
| Key | Value |
|-----|-------|
| `Authorization` | `Bearer {{admin_token}}` |

**Expected Response:** ✅ Status `200 OK`

```json
{
  "success": true,
  "message": "Admin profile retrieved successfully",
  "data": {
    "admin": {
      "id": 1,
      "firstName": "Super",
      "lastName": "Admin",
      "email": "admin@pinnacleuniversity.co",
      "role": "super_admin",
      "permissions": {
        "students": {
          "view": true,
          "create": true,
          "edit": true,
          "delete": true
        },
        "staff": {
          "view": true,
          "create": true,
          "edit": true,
          "delete": true
        }
      }
    }
  }
}
```

**🎯 For Frontend:** After login, call this to get admin details. Show their name in the header/navbar. Use `permissions` object to show/hide features based on role.

---

### **📌 STEP 1.3: Update Admin Profile**

**What it does:** Update admin's personal information

**Create Request:**

1. Name: **"1.3 Update Admin Profile"**
2. Method: **PUT**
3. URL: `{{base_url}}/api/admin/profile`

**Headers:**
| Key | Value |
|-----|-------|
| `Authorization` | `Bearer {{admin_token}}` |

**Body:**

```json
{
  "fname": "Super Updated",
  "phone": "+2348012345678"
}
```

**Expected Response:** ✅ Status `200 OK`

```json
{
  "success": true,
  "message": "Admin profile updated successfully",
  "data": {
    "admin": {
      "id": 1,
      "firstName": "Super Updated",
      "lastName": "Admin",
      "email": "admin@pinnacleuniversity.co",
      "role": "super_admin",
      "phone": "+2348012345678"
    }
  }
}
```

**🎯 For Frontend:** Settings/Profile page. Let admin update their name and phone.

---

### **📌 STEP 1.4: Admin Logout**

**What it does:** Logout admin (clear session)

**Create Request:**

1. Name: **"1.4 Admin Logout"**
2. Method: **POST**
3. URL: `{{base_url}}/api/admin/logout`

**Headers:**
| Key | Value |
|-----|-------|
| `Authorization` | `Bearer {{admin_token}}` |

**Expected Response:** ✅ Status `200 OK`

```json
{
  "success": true,
  "message": "Logout successful"
}
```

**🎯 For Frontend:** Logout button. Clear the stored token from localStorage/sessionStorage and redirect to login page.

---

## TEST 2: Admin Managing Students

### **📌 STEP 2.1: Get All Students**

**What it does:** List all students with pagination and filters

**Create Request:**

1. Name: **"2.1 Get All Students"**
2. Method: **GET**
3. URL: `{{base_url}}/api/admin/students?page=1&limit=10`

**Headers:**
| Key | Value |
|-----|-------|
| `Authorization` | `Bearer {{admin_token}}` |

**Query Params:** (Click "Params" tab)
| Key | Value | Description |
|-----|-------|-------------|
| `page` | `1` | Page number |
| `limit` | `10` | Items per page |
| `search` | _(optional)_ | Search by name/email |
| `level` | _(optional)_ | Filter by level (100, 200, etc.) |
| `status` | _(optional)_ | Filter by status (active/inactive) |

**Expected Response:** ✅ Status `200 OK`

```json
{
  "success": true,
  "message": "Students retrieved successfully",
  "data": {
    "students": [
      {
        "id": 1,
        "email": "student@example.com",
        "fname": "John",
        "lname": "Doe",
        "matric_number": "WSP/2024/001",
        "level": 100,
        "admin_status": "active",
        "program_id": 1
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 50,
      "itemsPerPage": 10
    }
  }
}
```

**🎯 For Frontend:**

- Students list page with table
- Add pagination controls (Previous/Next buttons)
- Add search box
- Add filter dropdowns (Level, Status)
- Show student cards/rows with their info

---

### **📌 STEP 2.2: Get Student Statistics**

**What it does:** Get overview statistics for all students

**Create Request:**

1. Name: **"2.2 Get Student Statistics"**
2. Method: **GET**
3. URL: `{{base_url}}/api/admin/students/stats`

**Headers:**
| Key | Value |
|-----|-------|
| `Authorization` | `Bearer {{admin_token}}` |

**Expected Response:** ✅ Status `200 OK`

```json
{
  "success": true,
  "message": "Student statistics retrieved successfully",
  "data": {
    "totalStudents": 150,
    "activeStudents": 145,
    "inactiveStudents": 5,
    "studentsByLevel": {
      "100": 50,
      "200": 45,
      "300": 35,
      "400": 20
    },
    "studentsByProgram": {
      "Computer Science": 80,
      "Business Administration": 70
    }
  }
}
```

**🎯 For Frontend:**

- Dashboard page
- Show statistics cards (Total, Active, Inactive)
- Show charts/graphs for level distribution
- Show program distribution pie chart

---

### **📌 STEP 2.3: Get Single Student**

**What it does:** Get detailed information about one student

**Create Request:**

1. Name: **"2.3 Get Single Student"**
2. Method: **GET**
3. URL: `{{base_url}}/api/admin/students/1` _(replace 1 with actual student ID)_

**Headers:**
| Key | Value |
|-----|-------|
| `Authorization` | `Bearer {{admin_token}}` |

**Expected Response:** ✅ Status `200 OK`

```json
{
  "success": true,
  "message": "Student retrieved successfully",
  "data": {
    "student": {
      "id": 1,
      "email": "student@example.com",
      "fname": "John",
      "lname": "Doe",
      "matric_number": "WSP/2024/001",
      "level": 100,
      "admin_status": "active",
      "program": {
        "id": 1,
        "program_name": "Computer Science"
      },
      "enrolledCourses": [
        {
          "course_id": 1,
          "course_name": "Introduction to Programming"
        }
      ]
    }
  }
}
```

**🎯 For Frontend:**

- Student details page
- Show all student information
- Show enrolled courses
- Edit/Delete buttons

---

### **📌 STEP 2.4: Create New Student**

**What it does:** Admin creates a new student account

**Create Request:**

1. Name: **"2.4 Create Student"**
2. Method: **POST**
3. URL: `{{base_url}}/api/admin/students`

**Headers:**
| Key | Value |
|-----|-------|
| `Authorization` | `Bearer {{admin_token}}` |

**Body:**

```json
{
  "email": "newstudent@example.com",
  "password": "Student123",
  "fname": "Jane",
  "lname": "Smith",
  "matric_number": "WSP/2024/999",
  "level": 100,
  "program_id": 1
}
```

**📝 Note:** The following fields are optional and will use defaults if not provided:

- `currency` (default: "NGN")
- `referral_code` (default: "")
- `designated_institute` (default: 0)
- `foreign_student` (default: 0 = domestic student)

**Expected Response:** ✅ Status `201 Created`

```json
{
  "success": true,
  "message": "Student created successfully",
  "data": {
    "student": {
      "id": 999,
      "email": "newstudent@example.com",
      "fname": "Jane",
      "lname": "Smith",
      "matric_number": "WSP/2024/999",
      "level": 100
    }
  }
}
```

**🎯 For Frontend:**

- "Add Student" button → Opens modal/form
- Form fields: Email, Password, First Name, Last Name, Matric Number, Level, Program (dropdown)
- Show success message after creation

---

### **📌 STEP 2.5: Update Student**

**What it does:** Update student information

**Create Request:**

1. Name: **"2.5 Update Student"**
2. Method: **PUT**
3. URL: `{{base_url}}/api/admin/students/1` _(replace 1 with student ID)_

**Headers:**
| Key | Value |
|-----|-------|
| `Authorization` | `Bearer {{admin_token}}` |

**Body:**

```json
{
  "fname": "Jane Updated",
  "level": 200,
  "phone": "+2348011111111"
}
```

**Expected Response:** ✅ Status `200 OK`

```json
{
  "success": true,
  "message": "Student updated successfully",
  "data": {
    "student": {
      "id": 1,
      "fname": "Jane Updated",
      "lname": "Smith",
      "level": 200,
      "phone": "+2348011111111"
    }
  }
}
```

**🎯 For Frontend:**

- Edit button on student details page
- Pre-fill form with current data
- Allow updating name, level, phone, address

---

### **📌 STEP 2.6: Deactivate Student**

**What it does:** Set student status to inactive (soft delete)

**Create Request:**

1. Name: **"2.6 Deactivate Student"**
2. Method: **PATCH**
3. URL: `{{base_url}}/api/admin/students/1/deactivate`

**Headers:**
| Key | Value |
|-----|-------|
| `Authorization` | `Bearer {{admin_token}}` |

**Expected Response:** ✅ Status `200 OK`

```json
{
  "success": true,
  "message": "Student deactivated successfully"
}
```

**🎯 For Frontend:**

- "Deactivate" button (show confirmation dialog first)
- After deactivation, student can't login
- Show "Inactive" badge in student list

---

### **📌 STEP 2.7: Activate Student**

**What it does:** Reactivate a previously deactivated student

**Create Request:**

1. Name: **"2.7 Activate Student"**
2. Method: **PATCH**
3. URL: `{{base_url}}/api/admin/students/1/activate`

**Headers:**
| Key | Value |
|-----|-------|
| `Authorization` | `Bearer {{admin_token}}` |

**Expected Response:** ✅ Status `200 OK`

```json
{
  "success": true,
  "message": "Student activated successfully"
}
```

**🎯 For Frontend:**

- "Activate" button (only show for inactive students)
- After activation, student can login again

---

### **📌 STEP 2.8: Reset Student Password**

**What it does:** Admin resets a student's password (student gets email notification)

**Create Request:**

1. Name: **"2.8 Reset Student Password"**
2. Method: **POST**
3. URL: `{{base_url}}/api/admin/students/1/reset-password`

**Headers:**
| Key | Value |
|-----|-------|
| `Authorization` | `Bearer {{admin_token}}` |

**Body:**

```json
{
  "newPassword": "NewPassword123"
}
```

**Expected Response:** ✅ Status `200 OK`

```json
{
  "success": true,
  "message": "Student password reset successfully. Notification email sent."
}
```

**📧 Check Email:** Student receives email with notification that admin changed their password

**🎯 For Frontend:**

- "Reset Password" button on student details
- Show confirmation dialog
- Display success message
- Tell admin that email was sent to student

---

## TEST 3: Admin Managing Staff

### **📌 STEP 3.1: Get All Staff**

**What it does:** List all staff members

**Create Request:**

1. Name: **"3.1 Get All Staff"**
2. Method: **GET**
3. URL: `{{base_url}}/api/admin/staff?page=1&limit=10`

**Headers:**
| Key | Value |
|-----|-------|
| `Authorization` | `Bearer {{admin_token}}` |

**Expected Response:** ✅ Status `200 OK`

```json
{
  "success": true,
  "message": "Staff retrieved successfully",
  "data": {
    "staff": [
      {
        "id": 1,
        "email": "staff@example.com",
        "fname": "Dr. John",
        "lname": "Professor",
        "title": "Senior Lecturer",
        "admin_status": "active"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 2,
      "totalItems": 15
    }
  }
}
```

**🎯 For Frontend:**

- Staff list page
- Similar to students list
- Add pagination

---

### **📌 STEP 3.2: Create Staff**

**What it does:** Admin creates a new staff account

**Create Request:**

1. Name: **"3.2 Create Staff"**
2. Method: **POST**
3. URL: `{{base_url}}/api/admin/staff`

**Headers:**
| Key | Value |
|-----|-------|
| `Authorization` | `Bearer {{admin_token}}` |

**Body:**

```json
{
  "email": "newstaff@example.com",
  "password": "Staff123",
  "fname": "Dr. Jane",
  "lname": "Lecturer",
  "title": "Assistant Lecturer",
  "phone": "+2348022222222"
}
```

**Expected Response:** ✅ Status `201 Created`

```json
{
  "success": true,
  "message": "Staff created successfully",
  "data": {
    "staff": {
      "id": 999,
      "email": "newstaff@example.com",
      "fname": "Dr. Jane",
      "lname": "Lecturer",
      "title": "Assistant Lecturer"
    }
  }
}
```

**🎯 For Frontend:**

- "Add Staff" button
- Form with: Email, Password, Name, Title, Phone

---

### **📌 STEP 3.3: Update Staff**

**What it does:** Update staff information

**Create Request:**

1. Name: **"3.3 Update Staff"**
2. Method: **PUT**
3. URL: `{{base_url}}/api/admin/staff/1`

**Headers:**
| Key | Value |
|-----|-------|
| `Authorization` | `Bearer {{admin_token}}` |

**Body:**

```json
{
  "fname": "Dr. Jane Updated",
  "title": "Senior Lecturer"
}
```

**Expected Response:** ✅ Status `200 OK`

```json
{
  "success": true,
  "message": "Staff updated successfully"
}
```

**🎯 For Frontend:** Edit staff details

---

### **📌 STEP 3.4: Deactivate Staff**

**What it does:** Deactivate staff account

**Create Request:**

1. Name: **"3.4 Deactivate Staff"**
2. Method: **PATCH**
3. URL: `{{base_url}}/api/admin/staff/1/deactivate`

**Headers:**
| Key | Value |
|-----|-------|
| `Authorization` | `Bearer {{admin_token}}` |

**Expected Response:** ✅ Status `200 OK`

```json
{
  "success": true,
  "message": "Staff deactivated successfully"
}
```

**🎯 For Frontend:** Deactivate button with confirmation

---

### **📌 STEP 3.5: Reset Staff Password**

**What it does:** Admin resets staff password (staff gets email)

**Create Request:**

1. Name: **"3.5 Reset Staff Password"**
2. Method: **POST**
3. URL: `{{base_url}}/api/admin/staff/1/reset-password`

**Headers:**
| Key | Value |
|-----|-------|
| `Authorization` | `Bearer {{admin_token}}` |

**Body:**

```json
{
  "newPassword": "NewStaffPassword123"
}
```

**Expected Response:** ✅ Status `200 OK`

```json
{
  "success": true,
  "message": "Staff password reset successfully. Notification email sent."
}
```

**📧 Check Email:** Staff receives password change notification

**🎯 For Frontend:** Reset password button on staff details

---

## TEST 4: Admin Managing Admins

### **📌 STEP 4.1: Get All Admins**

**What it does:** List all admin accounts (Super Admin only)

**Create Request:**

1. Name: **"4.1 Get All Admins"**
2. Method: **GET**
3. URL: `{{base_url}}/api/admin/admins`

**Headers:**
| Key | Value |
|-----|-------|
| `Authorization` | `Bearer {{admin_token}}` |

**Expected Response:** ✅ Status `200 OK`

```json
{
  "success": true,
  "message": "Admins retrieved successfully",
  "data": {
    "admins": [
      {
        "id": 1,
        "email": "admin@pinnacleuniversity.co",
        "fname": "Super",
        "lname": "Admin",
        "role": "super_admin",
        "status": "active"
      }
    ],
    "count": 1
  }
}
```

**🎯 For Frontend:**

- Admin management page (only visible to Super Admin)
- List all admins with their roles

---

### **📌 STEP 4.2: Create New Admin**

**What it does:** Super Admin creates a new admin account (WSP Admin or another Super Admin)

**Create Request:**

1. Name: **"4.2 Create Admin"**
2. Method: **POST**
3. URL: `{{base_url}}/api/admin/admins`

**Headers:**
| Key | Value |
|-----|-------|
| `Authorization` | `Bearer {{admin_token}}` |

**Body:**

```json
{
  "email": "newadmin@pinnacleuniversity.co",
  "password": "TempPassword123",
  "fname": "New",
  "lname": "Admin",
  "role": "wsp_admin"
}
```

**Role options:**

- `super_admin` - Full control
- `wsp_admin` - Content management only

**Expected Response:** ✅ Status `201 Created`

```json
{
  "success": true,
  "message": "Admin created successfully. Welcome email sent.",
  "data": {
    "admin": {
      "id": 2,
      "firstName": "New",
      "lastName": "Admin",
      "email": "newadmin@pinnacleuniversity.co",
      "role": "wsp_admin"
    }
  }
}
```

**📧 Check Email:** New admin receives welcome email with:

- Temporary password
- Login URL
- Their role and permissions

**🎯 For Frontend:**

- "Add Admin" button
- Form with: Email, Password, Name, Role (dropdown)
- Show role descriptions
- Display success message

---

### **📌 STEP 4.3: Update Admin**

**What it does:** Update admin information

**Create Request:**

1. Name: **"4.3 Update Admin"**
2. Method: **PUT**
3. URL: `{{base_url}}/api/admin/admins/2`

**Headers:**
| Key | Value |
|-----|-------|
| `Authorization` | `Bearer {{admin_token}}` |

**Body:**

```json
{
  "fname": "Updated",
  "lname": "Admin Name",
  "phone": "+2348033333333"
}
```

**Expected Response:** ✅ Status `200 OK`

```json
{
  "success": true,
  "message": "Admin updated successfully"
}
```

**🎯 For Frontend:** Edit admin details

---

### **📌 STEP 4.4: Deactivate Admin**

**What it does:** Deactivate an admin account

**Create Request:**

1. Name: **"4.4 Deactivate Admin"**
2. Method: **PATCH**
3. URL: `{{base_url}}/api/admin/admins/2/deactivate`

**Headers:**
| Key | Value |
|-----|-------|
| `Authorization` | `Bearer {{admin_token}}` |

**Expected Response:** ✅ Status `200 OK`

```json
{
  "success": true,
  "message": "Admin deactivated successfully"
}
```

**⚠️ Note:**

- Cannot deactivate yourself
- Cannot deactivate other Super Admins (only WSP Admins)

**🎯 For Frontend:**

- Deactivate button
- Show warning if trying to deactivate super admin

---

### **📌 STEP 4.5: View Activity Logs**

**What it does:** View all admin actions (audit trail)

**Create Request:**

1. Name: **"4.5 View Activity Logs"**
2. Method: **GET**
3. URL: `{{base_url}}/api/admin/activity-logs?page=1&limit=20`

**Headers:**
| Key | Value |
|-----|-------|
| `Authorization` | `Bearer {{admin_token}}` |

**Query Params:**
| Key | Value | Description |
|-----|-------|-------------|
| `page` | `1` | Page number |
| `limit` | `20` | Items per page |
| `action` | _(optional)_ | Filter by action (login, created*student, etc.) |
| `admin_id` | *(optional)\_ | Filter by specific admin |

**Expected Response:** ✅ Status `200 OK`

```json
{
  "success": true,
  "message": "Activity logs retrieved successfully",
  "data": {
    "logs": [
      {
        "id": 1,
        "action": "login",
        "target_type": "admin",
        "target_id": 1,
        "description": "Admin logged in",
        "ip_address": "127.0.0.1",
        "user_agent": "PostmanRuntime/7.32.3",
        "result": "success",
        "created_at": "2025-01-01T10:00:00Z",
        "admin": {
          "fname": "Super",
          "lname": "Admin",
          "email": "admin@pinnacleuniversity.co"
        }
      },
      {
        "id": 2,
        "action": "created_student",
        "target_type": "student",
        "target_id": 999,
        "description": "Created student: Jane Smith",
        "created_at": "2025-01-01T10:05:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 10,
      "totalItems": 200
    }
  }
}
```

**🎯 For Frontend:**

- Activity logs page
- Table showing: Date/Time, Admin, Action, Target, Result, IP Address
- Add filters (by action, by admin, by date range)
- Pagination
- Export to CSV button (future feature)

---

## TEST 5: Student/Staff User Flow

### **📌 STEP 5.1: Student Login**

**What it does:** Student logs into their account

**Create Request:**

1. Name: **"5.1 Student Login"**
2. Method: **POST**
3. URL: `{{base_url}}/api/auth/login`

**Body:**

```json
{
  "email": "student@example.com",
  "password": "student123",
  "userType": "student"
}
```

**Expected Response:** ✅ Status `200 OK`

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "email": "student@example.com",
      "fname": "John",
      "lname": "Doe"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "...",
    "expiresIn": 14400
  }
}
```

**📝 Save Token:**

- Copy `accessToken`
- Save to collection variable `student_token`

**🎯 For Frontend:**

- Student login page
- Separate from admin login
- Store token in localStorage

---

### **📌 STEP 5.2: Get Student Profile**

**What it does:** Student views their own profile

**Create Request:**

1. Name: **"5.2 Get Student Profile"**
2. Method: **GET**
3. URL: `{{base_url}}/api/auth/profile`

**Headers:**
| Key | Value |
|-----|-------|
| `Authorization` | `Bearer {{student_token}}` |

**Expected Response:** ✅ Status `200 OK`

```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "user": {
      "id": 1,
      "email": "student@example.com",
      "fname": "John",
      "lname": "Doe",
      "matric_number": "WSP/2024/001",
      "level": 100
    },
    "userType": "student"
  }
}
```

**🎯 For Frontend:** Student dashboard - show their info

---

### **📌 STEP 5.3: Update Student Profile**

**What it does:** Student updates their own profile

**Create Request:**

1. Name: **"5.3 Update Student Profile"**
2. Method: **PUT**
3. URL: `{{base_url}}/api/auth/profile/student`

**Headers:**
| Key | Value |
|-----|-------|
| `Authorization` | `Bearer {{student_token}}` |

**Body:**

```json
{
  "fname": "John Updated",
  "phone": "+2348044444444",
  "address": "123 Main Street, Lagos"
}
```

**Expected Response:** ✅ Status `200 OK`

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user": {
      "fname": "John Updated",
      "phone": "+2348044444444",
      "address": "123 Main Street, Lagos"
    }
  }
}
```

**⚠️ Note:** Students CANNOT update:

- Email
- Password (use password reset instead)
- Matric number
- Status

**🎯 For Frontend:**

- Student settings page
- Allow updating: Name, Phone, Address, Avatar
- Disable: Email, Matric Number

---

### **📌 STEP 5.4: Request Password Reset (Student)**

**What it does:** Student requests to reset their password (forgot password)

**Create Request:**

1. Name: **"5.4 Request Password Reset"**
2. Method: **POST**
3. URL: `{{base_url}}/api/auth/password/reset-request`

**Body:**

```json
{
  "email": "student@example.com"
}
```

**Expected Response:** ✅ Status `200 OK`

```json
{
  "success": true,
  "message": "If the email exists, a password reset link has been sent."
}
```

**📧 Check Email:** Student receives email with reset link

**🎯 For Frontend:**

- "Forgot Password?" link on login page
- Form with just email field
- Show generic success message (don't reveal if email exists)

---

### **📌 STEP 5.5: Reset Password (with Token)**

**What it does:** Student resets password using token from email

**Create Request:**

1. Name: **"5.5 Reset Password"**
2. Method: **POST**
3. URL: `{{base_url}}/api/auth/password/reset`

**Body:**

```json
{
  "token": "abc123def456...",
  "newPassword": "NewPassword123"
}
```

**⚠️ Note:** Get the `token` from the reset email

**Expected Response:** ✅ Status `200 OK`

```json
{
  "success": true,
  "message": "Password reset successful"
}
```

**📧 Check Email:** Student receives password changed confirmation

**🎯 For Frontend:**

- Reset password page (accessed from email link)
- URL: `/reset-password?token=abc123def456`
- Form with: New Password, Confirm Password
- After success, redirect to login

---

### **📌 STEP 5.6: Staff Login**

**What it does:** Staff member logs in

**Create Request:**

1. Name: **"5.6 Staff Login"**
2. Method: **POST**
3. URL: `{{base_url}}/api/auth/login`

**Body:**

```json
{
  "email": "staff@example.com",
  "password": "staff123",
  "userType": "staff"
}
```

**Expected Response:** ✅ Status `200 OK`

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "email": "staff@example.com",
      "fname": "Dr. John",
      "lname": "Professor"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 14400
  }
}
```

**📝 Save Token:** Save to `staff_token` variable

**🎯 For Frontend:** Same login page as students, but different `userType`

---

### **📌 STEP 5.7: Get Staff Profile**

**What it does:** Staff views their profile

**Create Request:**

1. Name: **"5.7 Get Staff Profile"**
2. Method: **GET**
3. URL: `{{base_url}}/api/auth/profile`

**Headers:**
| Key | Value |
|-----|-------|
| `Authorization` | `Bearer {{staff_token}}` |

**Expected Response:** ✅ Status `200 OK`

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "staff@example.com",
      "fname": "Dr. John",
      "lname": "Professor",
      "title": "Senior Lecturer"
    },
    "userType": "staff"
  }
}
```

**🎯 For Frontend:** Staff dashboard

---

### **📌 STEP 5.8: Update Staff Profile**

**What it does:** Staff updates their profile

**Create Request:**

1. Name: **"5.8 Update Staff Profile"**
2. Method: **PUT**
3. URL: `{{base_url}}/api/auth/profile/staff`

**Headers:**
| Key | Value |
|-----|-------|
| `Authorization` | `Bearer {{staff_token}}` |

**Body:**

```json
{
  "fname": "Dr. John Updated",
  "phone": "+2348055555555"
}
```

**Expected Response:** ✅ Status `200 OK`

```json
{
  "success": true,
  "message": "Profile updated successfully"
}
```

**🎯 For Frontend:** Staff settings page

---

### **📌 STEP 5.9: Request Password Reset (Staff)**

**What it does:** Staff requests to reset their password (forgot password)

**Create Request:**

1. Name: **"5.9 Request Password Reset (Staff)"**
2. Method: **POST**
3. URL: `{{base_url}}/api/auth/password/reset-request`

**Body:**

```json
{
  "email": "staff@example.com"
}
```

**Expected Response:** ✅ Status `200 OK`

```json
{
  "success": true,
  "message": "If the email exists, a password reset link has been sent."
}
```

**📧 Check Email:** Staff receives email with reset link

**🎯 For Frontend:**

- "Forgot Password?" link on staff login page
- Same flow as student password reset

---

### **📌 STEP 5.10: Reset Password (Staff with Token)**

**What it does:** Staff resets password using token from email

**Create Request:**

1. Name: **"5.10 Reset Password (Staff)"**
2. Method: **POST**
3. URL: `{{base_url}}/api/auth/password/reset`

**Body:**

```json
{
  "token": "xyz789abc123...",
  "newPassword": "NewStaffPassword123"
}
```

**Expected Response:** ✅ Status `200 OK`

```json
{
  "success": true,
  "message": "Password reset successful"
}
```

**📧 Check Email:** Staff receives password changed confirmation

**🎯 For Frontend:** Same reset password page - works for both students and staff

---

### **📌 STEP 5.11: Student Logout**

**What it does:** Logout student and clear session

**Create Request:**

1. Name: **"5.11 Student Logout"**
2. Method: **POST**
3. URL: `{{base_url}}/api/auth/logout`

**Headers:**
| Key | Value |
|-----|-------|
| `Authorization` | `Bearer {{student_token}}` |

**Expected Response:** ✅ Status `200 OK`

```json
{
  "success": true,
  "message": "Logout successful"
}
```

**🎯 For Frontend:**

- Logout button
- Clear token from localStorage
- Redirect to login

---

### **📌 STEP 5.12: Staff Logout**

**What it does:** Logout staff and clear session

**Create Request:**

1. Name: **"5.12 Staff Logout"**
2. Method: **POST**
3. URL: `{{base_url}}/api/auth/logout`

**Headers:**
| Key | Value |
|-----|-------|
| `Authorization` | `Bearer {{staff_token}}` |

**Expected Response:** ✅ Status `200 OK`

```json
{
  "success": true,
  "message": "Logout successful"
}
```

**🎯 For Frontend:** Same logout functionality

---

## TEST 6: Verify Emails & Logs

### **📌 STEP 6.1: Check Email Logs in Database**

**What it does:** Verify that emails are being sent and logged

**Run this SQL query in your database:**

```sql
SELECT
  id,
  recipient_email,
  recipient_type,
  email_type,
  subject,
  status,
  sent_at,
  created_at
FROM email_logs
ORDER BY created_at DESC
LIMIT 10;
```

**Expected Results:**
| id | recipient_email | recipient_type | email_type | status | sent_at |
|----|-----------------|----------------|------------|--------|---------|
| 1 | newadmin@pinnacleuniversity.co | admin | admin_welcome | sent | 2025-01-01... |
| 2 | student@example.com | student | password_changed | sent | 2025-01-01... |

**🎯 For Frontend:**

- Admin can view email logs in the system
- Build an "Email Logs" page showing this data
- Useful for debugging

---

### **📌 STEP 6.2: Check Activity Logs**

**Already tested in STEP 4.5!** ✅

Go back to **STEP 4.5** and verify all your actions are logged.

---

## 🎯 Testing Summary Checklist

### **Admin Authentication:** ✅

- [x] Admin can login
- [x] Admin can view profile
- [x] Admin can update profile
- [x] Admin can logout

### **Student Management:** ✅

- [x] Get all students with pagination
- [x] Get student statistics
- [x] Get single student
- [x] Create student
- [x] Update student
- [x] Deactivate/Activate student
- [x] Reset student password (email sent)

### **Staff Management:** ✅

- [x] Get all staff
- [x] Create staff
- [x] Update staff
- [x] Deactivate staff
- [x] Reset staff password (email sent)

### **Admin Management:** ✅

- [x] Get all admins
- [x] Create admin (welcome email sent)
- [x] Update admin
- [x] Deactivate admin
- [x] View activity logs

### **Student/Staff User Flow:** ✅

- [x] Student login
- [x] Student view/update profile
- [x] Student request password reset (email sent)
- [x] Student reset password (email sent)
- [x] Staff login
- [x] Staff view/update profile

### **Emails & Logs:** ✅

- [x] Email logs in database
- [x] Activity logs tracked
- [x] All actions logged

---

## 🚨 Common Errors & Solutions

### **401 Unauthorized**

**Problem:** Token missing or invalid

**Solution:**

1. Make sure you're logged in
2. Check token is saved in collection variables
3. Check header: `Authorization: Bearer {{admin_token}}`

---

### **403 Forbidden**

**Problem:** Insufficient permissions (WSP Admin trying Super Admin action)

**Solution:** Login as Super Admin

---

### **404 Not Found**

**Problem:** Wrong URL or resource doesn't exist

**Solution:**

- Check endpoint URL
- Verify ID exists in database

---

### **422 Validation Error**

**Problem:** Missing required fields

**Solution:** Check request body has all required fields

---

## 📝 For Your Frontend Team

### **Here's What They Need to Build:**

1. **Admin Portal:**

   - Admin Login Page
   - Admin Dashboard (stats, graphs)
   - Students Management (list, create, edit, view details)
   - Staff Management (list, create, edit, view details)
   - Admin Management (list, create, edit) - Super Admin only
   - Activity Logs Page
   - Settings/Profile Page

2. **Student Portal:**

   - Student Login Page
   - Student Dashboard
   - Student Profile/Settings
   - Forgot Password Page

3. **Staff Portal:**
   - Staff Login Page
   - Staff Dashboard
   - Staff Profile/Settings

### **Authentication Flow:**

```
1. User enters email/password
2. Call login endpoint with userType
3. Store accessToken in localStorage
4. Add token to all API calls: Authorization: Bearer {token}
5. If 401 error, redirect to login
6. Token expires after 4 hours
```

### **Key Points:**

- All admin endpoints start with `/api/admin/`
- Student/Staff endpoints start with `/api/auth/`
- Always include Authorization header with token
- Use pagination for lists (page, limit params)
- Show loading states
- Handle errors gracefully
- Show success messages after actions

---

**🎉 You're Ready to Test Everything!**

Follow the steps in order, and you'll understand the complete flow! 🚀
