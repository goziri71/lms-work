# 📡 API Endpoints - Quick Reference

## Complete List of All Endpoints

---

## 🔐 ADMIN AUTHENTICATION

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/admin/login` | Admin login | No |
| GET | `/api/admin/profile` | Get admin profile | Yes (Admin) |
| PUT | `/api/admin/profile` | Update admin profile | Yes (Admin) |
| POST | `/api/admin/logout` | Admin logout | Yes (Admin) |
| POST | `/api/admin/password/reset-request` | Request password reset | No |
| POST | `/api/admin/password/reset` | Reset password with token | No |

---

## 👨‍🎓 ADMIN - STUDENT MANAGEMENT

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/admin/students` | Get all students (paginated) | Yes (Super Admin) |
| GET | `/api/admin/students/stats` | Get student statistics | Yes (Any Admin) |
| GET | `/api/admin/students/:id` | Get single student | Yes (Any Admin) |
| POST | `/api/admin/students` | Create new student | Yes (Super Admin) |
| PUT | `/api/admin/students/:id` | Update student | Yes (Super Admin) |
| PATCH | `/api/admin/students/:id/deactivate` | Deactivate student | Yes (Super Admin) |
| PATCH | `/api/admin/students/:id/activate` | Activate student | Yes (Super Admin) |
| POST | `/api/admin/students/:id/reset-password` | Reset student password | Yes (Super Admin) |

**Query Parameters for GET /students:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `search` - Search by name/email
- `level` - Filter by level (100, 200, etc.)
- `status` - Filter by status (active/inactive)
- `program_id` - Filter by program

---

## 👨‍🏫 ADMIN - STAFF MANAGEMENT

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/admin/staff` | Get all staff (paginated) | Yes (Any Admin) |
| POST | `/api/admin/staff` | Create new staff | Yes (Super Admin) |
| PUT | `/api/admin/staff/:id` | Update staff | Yes (Super Admin) |
| PATCH | `/api/admin/staff/:id/deactivate` | Deactivate staff | Yes (Super Admin) |
| POST | `/api/admin/staff/:id/reset-password` | Reset staff password | Yes (Super Admin) |

**Query Parameters for GET /staff:**
- `page` - Page number
- `limit` - Items per page
- `search` - Search by name/email
- `status` - Filter by status

---

## 🛡️ ADMIN - ADMIN MANAGEMENT

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/admin/admins` | Get all admins | Yes (Super Admin) |
| POST | `/api/admin/admins` | Create new admin | Yes (Super Admin) |
| PUT | `/api/admin/admins/:id` | Update admin | Yes (Super Admin) |
| PATCH | `/api/admin/admins/:id/deactivate` | Deactivate admin | Yes (Super Admin) |
| GET | `/api/admin/activity-logs` | View activity logs | Yes (Super Admin) |

**Query Parameters for GET /activity-logs:**
- `page` - Page number
- `limit` - Items per page
- `action` - Filter by action type
- `admin_id` - Filter by admin
- `target_type` - Filter by target type (student, staff, etc.)

---

## 👤 STUDENT/STAFF AUTHENTICATION

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/login` | Student/Staff login | No |
| GET | `/api/auth/profile` | Get user profile | Yes (Student/Staff) |
| PUT | `/api/auth/profile/student` | Update student profile | Yes (Student) |
| PUT | `/api/auth/profile/staff` | Update staff profile | Yes (Staff) |
| POST | `/api/auth/logout` | Logout | Yes (Student/Staff) |
| POST | `/api/auth/password/reset-request` | Request password reset | No |
| POST | `/api/auth/password/reset` | Reset password with token | No |

---

## 📧 EMAIL LOGS (DATABASE ONLY)

View in database:
```sql
SELECT * FROM email_logs ORDER BY created_at DESC LIMIT 10;
```

Track:
- Email type
- Recipient
- Status (sent/failed)
- Timestamp
- ZeptoMail message ID

---

## 📊 ACTIVITY LOGS (DATABASE + API)

View via API: `GET /api/admin/activity-logs`

Or in database:
```sql
SELECT * FROM admin_activity_logs ORDER BY created_at DESC LIMIT 20;
```

Track:
- Admin action
- Target (student, staff, admin, course, etc.)
- Description
- IP address
- Result (success/failed)
- Before/after changes

---

## 🔑 Authentication Headers

### **For Admin Endpoints:**
```
Authorization: Bearer {admin_token}
```

### **For Student Endpoints:**
```
Authorization: Bearer {student_token}
```

### **For Staff Endpoints:**
```
Authorization: Bearer {staff_token}
```

---

## 📝 Request Body Examples

### **Admin Login**
```json
{
  "email": "admin@pinnacleuniversity.co",
  "password": "Admin@123456"
}
```

### **Student Login**
```json
{
  "email": "student@example.com",
  "password": "student123",
  "userType": "student"
}
```

### **Staff Login**
```json
{
  "email": "staff@example.com",
  "password": "staff123",
  "userType": "staff"
}
```

### **Create Student**
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

### **Create Staff**
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

### **Create Admin**
```json
{
  "email": "newadmin@pinnacleuniversity.co",
  "password": "TempPassword123",
  "fname": "New",
  "lname": "Admin",
  "role": "wsp_admin"
}
```
**Roles:** `super_admin` or `wsp_admin`

### **Update Profile (Student)**
```json
{
  "fname": "John Updated",
  "phone": "+2348044444444",
  "address": "123 Main Street"
}
```

### **Reset Password**
```json
{
  "newPassword": "NewPassword123"
}
```

### **Password Reset Request**
```json
{
  "email": "user@example.com"
}
```

### **Password Reset with Token**
```json
{
  "token": "abc123def456...",
  "newPassword": "NewPassword123"
}
```

---

## 🎯 User Permissions

### **Super Admin**
- ✅ Full access to everything
- ✅ Manage students (CRUD + password reset)
- ✅ Manage staff (CRUD + password reset)
- ✅ Manage admins (create, edit, deactivate)
- ✅ View activity logs
- ✅ System settings

### **WSP Admin**
- ✅ View students (read-only)
- ✅ View staff (read-only)
- ✅ Create/edit courses (any course)
- ✅ Create/edit content (modules, units, quizzes, exams)
- ✅ View analytics
- ❌ Cannot manage admins
- ❌ Cannot view activity logs

### **Staff**
- ✅ View/update own profile
- ✅ Manage own courses
- ✅ Create/edit own content
- ✅ Grade students
- ✅ Password reset

### **Student**
- ✅ View/update own profile
- ✅ Enroll in courses
- ✅ Take quizzes/exams
- ✅ View grades
- ✅ Password reset

---

## 📧 Email Notifications

| Action | Email Sent |
|--------|------------|
| Admin creates new admin | Welcome email with credentials |
| Admin resets student password | Password changed notification |
| Admin resets staff password | Password changed notification |
| User requests password reset | Reset link email |
| User resets password | Password changed confirmation |
| Student registration | Welcome email |
| Staff registration | Welcome email |

---

## 🚨 Common Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created successfully |
| 400 | Bad request (validation error) |
| 401 | Unauthorized (token missing/invalid) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not found |
| 409 | Conflict (duplicate email, etc.) |
| 500 | Server error |

---

## 🎯 Quick URLs

**Base URL:** `http://localhost:3000`

**Admin Portal:** `/api/admin/*`  
**Student/Staff Portal:** `/api/auth/*`

---

**Total Endpoints: 30+** 🚀

For detailed testing instructions, see **POSTMAN_TESTING_STEP_BY_STEP.md**

