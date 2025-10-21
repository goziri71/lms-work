# 🚀 Quick Postman Testing Guide

## 📥 **Step 1: Import Collection**

1. Open Postman
2. Click **Import** button
3. Select `Postman_Test_Sample.json` file
4. Collection will be imported with 21 ready-to-use requests

## 🔧 **Step 2: Set Up Variables**

1. Click on the collection name "LMS Exam API - Quick Test"
2. Go to **Variables** tab
3. Update these values:

```
baseUrl: http://localhost:3000/api
staffToken: YOUR_STAFF_JWT_TOKEN_HERE
studentToken: YOUR_STUDENT_JWT_TOKEN_HERE
```

## 🔑 **Step 3: Get Authentication Tokens**

You need JWT tokens to test. Get them from your auth endpoints:

### For Staff Token:

```bash
POST /api/auth/login
{
  "email": "staff@example.com",
  "password": "password123",
  "userType": "staff"
}
```

### For Student Token:

```bash
POST /api/auth/login
{
  "email": "student@example.com",
  "password": "password123",
  "userType": "student"
}
```

Copy the `token` from the response and paste it in the collection variables.

## 🧪 **Step 4: Test Complete Workflow**

### **Staff Testing Sequence:**

1. **Create Exam (Random Mode)** - Creates exam with auto-selected questions
2. **Create Exam (Manual Mode)** - Creates exam with pre-selected questions
3. **Get All Staff Exams** - View created exams
4. **Get Exam by ID** - View specific exam details
5. **Update Exam** - Change exam settings
6. **Get Question Bank** - View available questions
7. **Get Exam Attempts** - View student submissions
8. **Grade Theory Answer** - Grade individual answers
9. **Get Exam Statistics** - View exam analytics

### **Student Testing Sequence:**

1. **Get Student Available Exams** - View published exams
2. **Start Exam** - Begin exam attempt
3. **Submit Objective Answer** - Answer multiple choice
4. **Submit Theory Answer** - Answer text questions
5. **Submit Exam** - Complete the exam
6. **Get Attempt Details** - View results

## 📊 **Sample Data Used**

### **Exam Creation:**

- **Course ID**: 1
- **Academic Year**: "2024/2025"
- **Semester**: "1ST"
- **Duration**: 120 minutes (random), 180 minutes (manual)
- **Question Count**: 10 objective + 3 theory (random mode)
- **Manual Questions**: [1, 2, 3, 4, 5] (manual mode)

### **Answer Submission:**

- **Objective**: Selected option "A"
- **Theory**: Sample text answer with detailed explanation

### **Grading:**

- **Marks**: 8.5/10
- **Feedback**: Constructive comments

## ⚠️ **Important Notes**

1. **Replace IDs**: Update exam IDs (1) and attempt IDs (1) with actual values from your responses
2. **Course Ownership**: Ensure staff user owns course_id = 1
3. **Student Enrollment**: Ensure student is enrolled in course_id = 1
4. **Question Bank**: Make sure you have questions in your question bank
5. **Exam Visibility**: Change from "draft" to "published" for students to see exams

## 🔄 **Testing Tips**

### **Quick Test Sequence:**

1. Run **Create Exam (Random Mode)** → Copy exam ID from response
2. Run **Update Exam** → Change visibility to "published"
3. Switch to student token in variables
4. Run **Get Student Available Exams** → Should see your exam
5. Run **Start Exam** → Copy attempt ID from response
6. Run **Submit Objective Answer** and **Submit Theory Answer**
7. Run **Submit Exam** → Complete the exam
8. Switch back to staff token
9. Run **Get Exam Attempts** → Should see student's attempt
10. Run **Grade Theory Answer** → Grade the submitted answer

### **Error Handling:**

- **403 Forbidden**: Check user permissions and course ownership
- **404 Not Found**: Verify exam/attempt IDs exist
- **400 Bad Request**: Check required fields in request body
- **401 Unauthorized**: Verify JWT token is valid and not expired

## 📈 **Expected Responses**

### **Success Response Format:**

```json
{
  "status": true,
  "code": 200,
  "message": "Operation successful",
  "data": { ... }
}
```

### **Error Response Format:**

```json
{
  "status": false,
  "code": 400,
  "message": "Error description"
}
```

## 🎯 **Ready to Test!**

Your Postman collection is now ready with:

- ✅ 21 pre-configured requests
- ✅ Sample data for all endpoints
- ✅ Proper headers and authentication
- ✅ Both staff and student workflows
- ✅ Complete exam lifecycle testing

Just import the collection, set your tokens, and start testing! 🚀
