# Exam Payment Verification - API Changes for Frontend

## ⚠️ Breaking Changes to Existing Endpoints

This document outlines changes made to existing exam endpoints that require frontend updates.

---

## 📋 Summary of Changes

Two existing endpoints have been modified to enforce payment verification:

1. **GET `/api/exams/student/exams`** - Now filters out exams for unpaid courses
2. **POST `/api/exams/student/exams/:examId/start`** - Now requires payment verification before allowing exam start

---

## 🔴 Changed Endpoints

### 1. GET `/api/exams/student/exams`

**Endpoint:** `GET /api/exams/student/exams`

**What Changed:**
- **Before:** Returned all published exams for enrolled courses
- **After:** Only returns exams for courses where:
  - ✅ School fees are paid for the current academic year
  - ✅ Course fees are paid (or course is free)

**Impact:**
- Students will see **fewer exams** if they haven't paid school fees or course fees
- Exams for unpaid courses are automatically filtered out
- Response structure remains the same, just fewer items

**Response Format (Unchanged):**
```json
{
  "status": true,
  "code": 200,
  "message": "Exams retrieved successfully",
  "data": [...], // Filtered list of exams
  "pagination": {
    "total": 5,
    "page": 1,
    "limit": 10,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

**Frontend Action Required:**
- ✅ No code changes needed if you're already handling empty arrays
- ⚠️ Consider showing a message when no exams are available: "No exams available. Please ensure your school fees and course fees are paid."
- ⚠️ Consider checking payment status before showing exam list

---

### 2. POST `/api/exams/student/exams/:examId/start`

**Endpoint:** `POST /api/exams/student/exams/:examId/start`

**What Changed:**
- **Before:** Only checked enrollment and exam availability
- **After:** Now also checks:
  - ✅ School fees payment status
  - ✅ Course fees payment status
  - Returns **403 Forbidden** with error message if payments not completed

**New Error Responses:**

**School Fees Not Paid:**
```json
{
  "status": false,
  "code": 403,
  "message": "You cannot take this exam. Please pay your school fees for the current academic year first."
}
```

**Course Fees Not Paid:**
```json
{
  "status": false,
  "code": 403,
  "message": "You cannot take this exam. Please complete course registration payment first."
}
```

**Not Enrolled:**
```json
{
  "status": false,
  "code": 403,
  "message": "You are not enrolled in this course."
}
```

**Success Response (Unchanged):**
```json
{
  "status": true,
  "code": 200,
  "message": "Exam started successfully",
  "data": {
    "attempt_id": 123,
    "exam_id": 456,
    "started_at": "2025-01-15T10:00:00Z",
    "duration_minutes": 60,
    "remaining_attempts": 2,
    "questions": [...]
  }
}
```

**Frontend Action Required:**
- ⚠️ **CRITICAL:** Update error handling to catch 403 errors
- ⚠️ Display user-friendly error messages based on the error response
- ⚠️ Consider redirecting to payment page when payment errors occur
- ⚠️ Show payment status before allowing exam start

**Example Error Handling:**
```javascript
try {
  const response = await axios.post(`/api/exams/student/exams/${examId}/start`);
  // Handle success...
} catch (error) {
  if (error.response?.status === 403) {
    const message = error.response.data?.message || "Payment required";
    
    // Check if it's a payment error
    if (message.includes("school fees")) {
      // Redirect to school fees payment page
      navigate('/payments/school-fees');
    } else if (message.includes("course registration payment")) {
      // Redirect to course registration payment page
      navigate('/payments/courses');
    }
    
    // Show error message
    showError(message);
  }
}
```

---

## 🆕 New Optional Query Parameter

### Admin Override (For Admin Users Only)

**Endpoint:** `POST /api/exams/student/exams/:examId/start?override_payment=true`

**Purpose:** Allows admins to bypass payment checks for special cases

**Usage:**
- Only works for admin users (`userType === "admin"`)
- Add `?override_payment=true` to the request URL
- Use case: Late payments, special approvals, manual overrides

**Example:**
```javascript
// Admin can override payment checks
const response = await axios.post(
  `/api/exams/student/exams/${examId}/start?override_payment=true`
);
```

**Frontend Action Required:**
- ✅ Optional: Add admin UI to allow payment override
- ✅ Only show this option to admin users

---

## 📝 Payment Status Checking

### Recommended: Check Payment Status Before Showing Exams

**New Endpoint Available:**
- `GET /api/courses/school-fees` - Returns school fees status + wallet balance
- `GET /api/wallet/balance` - Returns wallet balance

**Recommended Flow:**
1. Check school fees payment status before showing exam list
2. Show payment warnings/notifications if fees not paid
3. Disable "Start Exam" button if payments not completed
4. Show clear messages about what needs to be paid

**Example Implementation:**
```javascript
// Before showing exams, check payment status
const checkPayments = async () => {
  try {
    // Check school fees
    const schoolFeesResponse = await axios.get('/api/courses/school-fees');
    const { payment_status, wallet } = schoolFeesResponse.data.data;
    
    if (payment_status !== 'paid') {
      showWarning('Please pay your school fees to access exams');
      return false;
    }
    
    // Check wallet balance if needed
    if (wallet.balance < requiredAmount) {
      showWarning('Insufficient wallet balance');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Payment check failed:', error);
    return false;
  }
};

// Use before fetching exams
const canAccessExams = await checkPayments();
if (canAccessExams) {
  // Fetch and display exams
}
```

---

## 🔄 Migration Guide

### Step 1: Update Error Handling

**Before:**
```javascript
try {
  await startExam(examId);
} catch (error) {
  alert('Failed to start exam');
}
```

**After:**
```javascript
try {
  await startExam(examId);
} catch (error) {
  if (error.response?.status === 403) {
    const message = error.response.data?.message;
    
    // Handle payment errors
    if (message.includes('school fees')) {
      navigate('/payments/school-fees');
    } else if (message.includes('course registration')) {
      navigate('/payments/courses');
    } else {
      alert(message);
    }
  } else {
    alert('Failed to start exam');
  }
}
```

### Step 2: Add Payment Status Checks

**Before:**
```javascript
// Just fetch exams
const exams = await fetchExams();
```

**After:**
```javascript
// Check payments first
const paymentStatus = await checkPaymentStatus();
if (!paymentStatus.schoolFeesPaid) {
  showPaymentWarning('school-fees');
}

// Then fetch exams (will be filtered automatically)
const exams = await fetchExams();
```

### Step 3: Update UI Messages

**Add payment status indicators:**
- Show "Payment Required" badge on exams if fees not paid
- Disable "Start Exam" button with tooltip explaining why
- Show payment links/buttons when payments are required

---

## ✅ Testing Checklist

- [ ] Test exam list shows fewer exams when payments not completed
- [ ] Test exam start fails with 403 when school fees not paid
- [ ] Test exam start fails with 403 when course fees not paid
- [ ] Test error messages are displayed correctly
- [ ] Test payment redirects work correctly
- [ ] Test admin override works (if implementing admin UI)
- [ ] Test free WPU courses still work (no payment required)
- [ ] Test marketplace courses work (enrollment = payment)

---

## 📞 Support

If you encounter any issues or need clarification:
1. Check the error message in the response
2. Verify payment status using `/api/courses/school-fees`
3. Check wallet balance using `/api/wallet/balance`
4. Contact backend team for payment verification logic questions

---

## 🎯 Key Takeaways

1. **GET exams endpoint** - Now filters unpaid exams (no breaking change to response structure)
2. **POST start exam endpoint** - Now returns 403 errors for unpaid fees (requires error handling update)
3. **Error messages** - Clear messages indicate what needs to be paid
4. **Admin override** - Optional feature for special cases
5. **Payment checks** - Recommended to check payment status before showing exams

---

**Last Updated:** January 2025

