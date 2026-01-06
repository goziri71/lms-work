# 🎓 LMS System - Complete Overview

## 📊 System Architecture

### **Multi-Tenant SaaS Platform**

- **WSP (Platform Owner)**: Own courses, students, staff
- **Sole Tutors**: Individual tutors selling courses
- **Organizations**: Companies/institutions with multiple tutors
- **Data Isolation**: Automatic filtering based on ownership

---

## 👥 USER TYPES & AUTHENTICATION

### 1. **Students** (WSP Students)

- **Registration**: `POST /api/auth/register/student`
- **Login**: `POST /api/auth/login` or `POST /api/auth/student/login`
- **Profile**: View/Update profile
- **Password Reset**: Available
- **Access**:
  - FREE access to WSP courses
  - PAID access to marketplace courses

### 2. **Staff** (WSP Lecturers)

- **Registration**: `POST /api/auth/register/staff`
- **Login**: `POST /api/auth/login` or `POST /api/auth/staff/login`
- **Profile**: View/Update profile
- **Access**: Manage their assigned courses, modules, quizzes, exams

### 3. **WSP Admins**

- **Super Admin**: Full system control
- **WSP Admin**: Limited permissions (assist staff)
- **Login**: `POST /api/admin/login`
- **Access**: Manage students, staff, courses, content

### 4. **Sole Tutors** (Marketplace)

- **Registration**: `POST /api/marketplace/register/sole-tutor`
- **Login**: `POST /api/marketplace/login/sole-tutor`
- **Status**: Pending → Active (requires Super Admin approval)
- **Access**: Create/manage their marketplace courses

### 5. **Organizations** (Marketplace)

- **Registration**: `POST /api/marketplace/register/organization`
- **Login**: `POST /api/marketplace/login/organization`
- **Status**: Pending → Active (requires Super Admin approval)
- **Access**: Manage organization courses and users

### 6. **Organization Users** (Tutors within Organizations)

- **Login**: `POST /api/marketplace/login/organization-user`
- **Roles**: Admin, Tutor, Manager
- **Access**: Teach courses owned by their organization

---

## 🗄️ DATABASE MODELS (Tables)

### **Authentication & Users**

- `students` - WPU students
- `staff` - WPU lecturers/staff
- `wsp_admins` - Admin accounts (Super Admin + WPU Admin)
- `users` - Legacy user table (for reference)
- `semester` - Academic semesters

### **Marketplace**

- `sole_tutors` - Individual tutor accounts
- `organizations` - Organization accounts
- `organization_users` - Tutors within organizations
- `marketplace_transactions` - Course purchase transactions
- `wsp_commissions` - WPU commission records

### **Academic Structure**

- `programs` - Academic programs (BSc Economics, etc.)
- `courses` - All courses (WPU + Marketplace)
- `faculty` - Academic faculties/departments
- `course_reg` - Student course registrations
- `school_attended` - Student educational history

### **Content & Learning**

- `modules` - Course modules
- `units` - Module units
- `unit_notes` - Unit content/notes
- `quiz` - Quizzes
- `quiz_questions` - Quiz questions
- `quiz_options` - Quiz answer options
- `quiz_attempts` - Student quiz attempts
- `quiz_answers` - Student quiz answers
- `discussions` - Course discussions

### **Examinations**

- `question_bank` - Question bank
- `question_objective` - Objective questions
- `question_theory` - Theory questions
- `exams` - Exam records
- `exam_items` - Exam questions
- `exam_attempts` - Student exam attempts
- `exam_answer_objective` - Objective answers
- `exam_answer_theory` - Theory answers

### **Payments & Finance**

- `funding` - Student wallet funding transactions
- `school_fees` - School fee payments
- `course_order` - Course order records
- `payment_setup` - Payment configuration

### **Communication**

- `direct_messages` - Direct chat messages
- `discussion_messages` - Discussion messages
- `notice` - System/course notices

### **System**

- `general_setup` - System settings (university name, address, exchange rate)
- `email_logs` - Email sending history
- `email_preferences` - User email notification preferences
- `admin_activity_logs` - Admin action audit trail

### **Video**

- `video_calls` - Video call sessions
- `video_call_participants` - Call participants

---

## 🎯 SUPER ADMIN CAPABILITIES

### **1. Student Management** (7 endpoints)

- ✅ View all students (pagination, search, filters)
- ✅ View student details (with course registrations)
- ✅ Create new students
- ✅ Update student information
- ✅ Activate/Deactivate students
- ✅ Reset student passwords (sends email)
- ✅ View student statistics (by level, program, status)

### **2. Staff Management** (5 endpoints)

- ✅ View all staff (with courses)
- ✅ Create new staff
- ✅ Update staff information
- ✅ Deactivate staff
- ✅ Reset staff passwords (sends email)

### **3. Admin Management** (5 endpoints)

- ✅ View all admins (Super Admin + WSP Admin)
- ✅ Create new admins (sends welcome email)
- ✅ Update admin information
- ✅ Deactivate admins
- ✅ View activity logs (all admin actions)

### **4. Program Management** (6 endpoints)

- ✅ View all programs (with courses)
- ✅ View program details
- ✅ Create programs
- ✅ Update programs
- ✅ Delete/Deactivate programs
- ✅ View program statistics

### **5. Course Management** (7 endpoints)

- ✅ View all courses (filters: program, faculty, staff, level, semester)
- ✅ View courses by program
- ✅ View course details
- ✅ Create courses
- ✅ Update courses
- ✅ Delete courses
- ✅ View course statistics

### **6. Semester Management** (9 endpoints)

- ✅ View all semesters
- ✅ View current active semester
- ✅ Create semesters manually
- ✅ Update semester dates
- ✅ Close semester (manual control)
- ✅ Extend semester (update end date)
- ✅ Activate semester (sets as active, closes others)
- ✅ Delete semester
- ✅ View semester statistics

### **7. Faculty Management** (6 endpoints)

- ✅ View all faculties (with programs)
- ✅ View faculty details (with programs & courses)
- ✅ Create faculties
- ✅ Update faculties
- ✅ Delete faculties
- ✅ View faculty statistics

### **8. System Settings** (2 endpoints)

- ✅ View system settings (name, address, exchange rate)
- ✅ Update system settings

### **9. Notice Management** (5 endpoints)

- ✅ View all notices (filters: course, search)
- ✅ View notice details
- ✅ Create notices
- ✅ Update notices
- ✅ Delete notices

### **10. Payment Management** (7 endpoints)

- ✅ View payment overview (all payment types)
- ✅ View all funding transactions
- ✅ View funding statistics
- ✅ View all school fees
- ✅ View school fees statistics
- ✅ View all course orders
- ✅ View course order statistics

### **11. Tutor Management** (11 endpoints)

- ✅ View all sole tutors (filters: status, verification, search)
- ✅ View sole tutor details (with courses)
- ✅ Approve sole tutor applications
- ✅ Reject sole tutor applications
- ✅ Suspend/Activate sole tutors
- ✅ View all organizations (with users)
- ✅ View organization details (with users & courses)
- ✅ Approve organization applications
- ✅ Reject organization applications
- ✅ Suspend/Activate organizations
- ✅ View tutor statistics

### **12. Revenue Management** (3 endpoints)

- ✅ View all marketplace transactions
- ✅ View WSP revenue statistics (total commission, top earners, pending payouts)
- ✅ View individual tutor revenue details

### **13. Dashboard** (1 endpoint)

- ✅ Consolidated statistics (students, staff, programs, courses, faculties)
- ✅ Current semester information
- ✅ Students by level and program
- ✅ Recent activity tracking

---

## 💰 REVENUE SHARING SYSTEM

### **How It Works**

1. **Student purchases marketplace course** → Payment processed
2. **System calculates automatically**:
   - WPU Commission = Course Price × Commission Rate (default 15%)
   - Tutor Earnings = Course Price - WPU Commission
3. **Records created**:
   - `marketplace_transactions` - Full transaction details
   - `wsp_commissions` - WPU commission record
4. **Automatic updates**:
   - Tutor wallet balance increases
   - Tutor total earnings increases
   - WPU commission marked as "collected"

### **Revenue Tracking**

- ✅ Every purchase tracked
- ✅ Commission calculated automatically
- ✅ Wallet balances updated in real-time
- ✅ Full audit trail
- ✅ Multi-currency support
- ✅ Payout tracking ready

### **Important Rules**

- **WPU Courses**: FREE for WPU students (no revenue sharing)
- **Marketplace Courses**: PAID (revenue sharing applies)
- **Commission Rate**: Configurable per tutor/organization (default 15%)

---

## 🔐 AUTHENTICATION & AUTHORIZATION

### **JWT Token System**

- All user types use JWT tokens
- Token expiration: 4 hours
- Role-based access control (RBAC)

### **Middleware**

- `authorize` - Student/Staff authentication
- `adminAuthorize` - Admin authentication
- `requireSuperAdmin` - Super Admin only
- `requirePermission` - Granular permissions
- `tutorAuthorize` - Tutor authentication
- `dataIsolation` - Multi-tenant data filtering

---

## 📧 EMAIL SYSTEM

### **Email Service** (ZeptoMail)

- ✅ Welcome emails (students, staff, admins, tutors)
- ✅ Password reset emails
- ✅ Password changed notifications
- ✅ Course enrollment notifications
- ✅ Exam reminders
- ✅ Grade notifications
- ✅ Admin welcome emails

### **Email Features**

- HTML templates
- Email logging
- User preferences
- Configurable sender

---

## 🎓 COURSE SYSTEM

### **Course Types**

1. **WPU Courses** (`owner_type = "wpu"` or `"wsp"` for legacy)

   - Free for WPU students
   - Registration: `POST /api/courses/register`
   - No payment required

2. **Marketplace Courses** (`owner_type = "sole_tutor"` or `"organization"`)
   - Paid courses
   - Purchase: `POST /api/marketplace/courses/purchase`
   - Payment required
   - Revenue sharing applies

### **Course Features**

- Modules & Units
- Quizzes
- Exams
- Discussions
- Video calls
- Notices

---

## 📚 CONTENT MANAGEMENT

### **Modules**

- Create modules for courses
- Organize content

### **Units**

- Unit notes/content
- Attachments

### **Quizzes**

- Create quizzes
- Multiple choice questions
- Student attempts
- Automatic grading

### **Exams**

- Create exams
- Question bank integration
- Objective & Theory questions
- Student attempts
- Manual/Auto grading

---

## 💬 COMMUNICATION

### **Direct Messaging**

- Student-to-Student
- Student-to-Staff
- Real-time chat

### **Discussions**

- Course discussions
- Real-time updates

### **Notices**

- System-wide notices
- Course-specific notices

---

## 📹 VIDEO SYSTEM

### **Video Calls**

- Create video call sessions
- Generate access tokens
- Participant management
- End calls

---

## 📊 STATISTICS & ANALYTICS

### **Dashboard Statistics**

- Total students, staff, admins
- Active/inactive counts
- Program & course counts
- Current semester info
- Recent activity

### **Revenue Statistics**

- Total WSP commission
- Total marketplace revenue
- Top earning tutors
- Pending payouts
- Revenue by owner type

### **Student Statistics**

- By level
- By program
- By status

### **Course Statistics**

- By program
- By faculty

---

## 🔒 SECURITY FEATURES

- ✅ Password hashing (MD5 - legacy, can upgrade)
- ✅ JWT authentication
- ✅ Role-based access control
- ✅ Data isolation (multi-tenant)
- ✅ Activity logging (admin actions)
- ✅ Rate limiting
- ✅ Input validation
- ✅ CORS protection

---

## 📡 API ENDPOINTS SUMMARY

### **Total Endpoints: 100+**

#### **Authentication** (`/api/auth`)

- Student/Staff registration & login
- Password reset
- Profile management

#### **Admin** (`/api/admin`)

- 70+ endpoints for Super Admin management

#### **Marketplace** (`/api/marketplace`)

- Tutor/Organization registration & login
- Course purchase

#### **Courses** (`/api/courses`)

- Course listing
- Registration (WSP courses)
- Course details
- Participants

#### **Exams** (`/api/exams`)

- Exam creation & management
- Question bank
- Student attempts
- Grading

#### **Quiz** (`/api/quiz`)

- Quiz creation
- Student attempts
- Grading

#### **Chat** (`/api/chat`)

- Direct messaging

#### **Video** (`/api/video`)

- Video call management

---

## 🛠️ SERVICES & UTILITIES

### **Services**

- `emailService` - Email sending (ZeptoMail)
- `revenueSharingService` - Commission calculation & distribution
- `authService` - Authentication utilities
- `courseService` - Course-related operations

### **Middleware**

- `authorize` - User authentication
- `adminAuthorize` - Admin authentication
- `tutorAuthorize` - Tutor authentication
- `dataIsolation` - Multi-tenant filtering
- `rateLimiter` - Rate limiting
- `cacheMiddleware` - Response caching
- `performanceMonitor` - Performance tracking

---

## 🎯 KEY FEATURES

### ✅ **Implemented**

1. Multi-tenant architecture
2. Tutor marketplace (sole + organizations)
3. Revenue sharing system
4. Super Admin management
5. Student/Staff management
6. Course management
7. Content management (modules, units, quizzes)
8. Exam system
9. Email notifications
10. Payment tracking
11. Activity logging
12. Data isolation
13. Dashboard & analytics

### ⏳ **Ready for Implementation**

1. Tutor dashboards
2. Course creation for tutors
3. Payout processing
4. Marketplace course listing/discovery
5. Reviews & ratings
6. Advanced analytics
7. Content management for tutors

---

## 📈 SYSTEM STATISTICS

- **Database Tables**: 40+
- **API Endpoints**: 100+
- **User Types**: 6 (Student, Staff, Super Admin, WSP Admin, Sole Tutor, Organization)
- **Models**: 40+
- **Controllers**: 20+
- **Services**: 4+
- **Middleware**: 8+

---

## 🚀 DEPLOYMENT READY

- ✅ Environment configuration
- ✅ Database migrations
- ✅ Error handling
- ✅ Logging
- ✅ Security middleware
- ✅ Production-ready structure

---

**Last Updated**: Current Session
**Status**: Production Ready (Core Features Complete)
