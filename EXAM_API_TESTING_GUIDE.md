# Exam System API Testing Guide

Complete endpoint reference for testing the exam management system.

---

## 📋 Table of Contents

1. [Authentication](#authentication)
2. [Staff - Question Bank Management](#staff---question-bank-management)
3. [Staff - Exam Creation & Management](#staff---exam-creation--management)
4. [Student - Exam Taking](#student---exam-taking)
5. [Staff - Grading & Statistics](#staff---grading--statistics)
6. [Testing Workflow](#testing-workflow)

---

## Authentication

### Login as Staff

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "staff@example.com",
  "password": "password123"
}

Response:
{
  "status": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "userType": "staff",
    "id": 1
  }
}
```

### Login as Student

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "student@example.com",
  "password": "password123"
}

Response:
{
  "status": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "userType": "student",
    "id": 1
  }
}
```

---

## Staff - Question Bank Management

### 1. View Question Bank

Get all questions available for exam creation.

```http
GET /api/exams/bank/questions?course_id=18&question_type=objective&difficulty=medium
Authorization: Bearer <staff_token>

Query Parameters:
- course_id (required): Course ID
- question_type (optional): "objective" or "theory"
- difficulty (optional): "easy", "medium", "hard"
- status (optional): "approved", "draft", "archived" (default: "approved")

Response:
{
  "status": true,
  "code": 200,
  "message": "Bank questions retrieved successfully",
  "data": [
    {
      "id": 1,
      "course_id": 18,
      "created_by": 1,
      "question_type": "objective",
      "difficulty": "medium",
      "status": "approved",
      "source_type": "quiz",
      "source_id": 15,
      "objective": {
        "id": 1,
        "question_bank_id": 1,
        "question_text": "What is React?",
        "options": [
          {"id": "A", "text": "A JavaScript library"},
          {"id": "B", "text": "A programming language"}
        ],
        "correct_option": "A",
        "marks": 2
      }
    }
  ]
}
```

---

## Staff - Exam Creation & Management

### 2. Create Exam (Random Mode)

Create exam with automatic random question selection.

```http
POST /api/exams
Authorization: Bearer <staff_token>
Content-Type: application/json

{
  "course_id": 18,
  "academic_year": "2024/2025",
  "semester": "2ND",
  "title": "Final Exam - Web Development",
  "instructions": "Answer all questions. Time: 120 minutes. No external resources allowed.",
  "start_at": "2025-01-15T09:00:00Z",
  "end_at": "2025-01-15T12:00:00Z",
  "duration_minutes": 120,
  "visibility": "published",
  "randomize": true,
  "exam_type": "mixed",
  "selection_mode": "random",
  "objective_count": 30,
  "theory_count": 5
}

Response:
{
  "status": true,
  "code": 201,
  "message": "Exam created successfully",
  "data": {
    "id": 1,
    "course_id": 18,
    "academic_year": "2024/2025",
    "semester": "2ND",
    "title": "Final Exam - Web Development",
    "selection_mode": "random",
    "objective_count": 30,
    "theory_count": 5,
    "created_by": 1
  }
}
```

### 3. Create Exam (Manual Mode)

Create exam with pre-selected questions (all students get same questions).

```http
POST /api/exams
Authorization: Bearer <staff_token>
Content-Type: application/json

{
  "course_id": 18,
  "academic_year": "2024/2025",
  "semester": "2ND",
  "title": "Midterm Exam",
  "duration_minutes": 90,
  "visibility": "published",
  "exam_type": "objective-only",
  "selection_mode": "manual",
  "manual_question_ids": [1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
}

Response:
{
  "status": true,
  "code": 201,
  "message": "Exam created successfully",
  "data": {
    "id": 2,
    "selection_mode": "manual"
  }
}
```

### 4. Get All Exams (Staff)

```http
GET /api/exams?course_id=18&semester=2ND&visibility=published
Authorization: Bearer <staff_token>

Response:
{
  "status": true,
  "data": [
    {
      "id": 1,
      "title": "Final Exam - Web Development",
      "course_id": 18,
      "visibility": "published",
      "objective_count": 30,
      "theory_count": 5
    }
  ]
}
```

### 5. Get Exam Details

```http
GET /api/exams/1
Authorization: Bearer <staff_token>

Response:
{
  "status": true,
  "data": {
    "id": 1,
    "title": "Final Exam - Web Development",
    "items": [
      {
        "id": 1,
        "exam_id": 1,
        "question_bank_id": 5,
        "order": 1,
        "question": {
          "id": 5,
          "question_type": "objective",
          "objective": {
            "question_text": "What is JSX?",
            "options": [...],
            "marks": 2
          }
        }
      }
    ]
  }
}
```

### 6. Update Exam

```http
PUT /api/exams/1
Authorization: Bearer <staff_token>
Content-Type: application/json

{
  "visibility": "published",
  "objective_count": 25,
  "theory_count": 10,
  "duration_minutes": 150
}

Response:
{
  "status": true,
  "message": "Exam updated successfully",
  "data": {
    "id": 1,
    "objective_count": 25,
    "theory_count": 10
  }
}
```

### 7. Delete Exam

```http
DELETE /api/exams/1
Authorization: Bearer <staff_token>

Response:
{
  "status": true,
  "code": 200,
  "message": "Exam deleted successfully"
}
```

---

## Student - Exam Taking

### 8. Get Available Exams (Student)

```http
GET /api/exams/student/exams?academic_year=2024/2025&semester=2ND
Authorization: Bearer <student_token>

Response:
{
  "status": true,
  "data": [
    {
      "id": 1,
      "title": "Final Exam - Web Development",
      "course_id": 18,
      "start_at": "2025-01-15T09:00:00Z",
      "end_at": "2025-01-15T12:00:00Z",
      "duration_minutes": 120,
      "visibility": "published"
    }
  ]
}
```

### 9. Start Exam Attempt

**Critical**: This selects random questions for this specific student!

```http
POST /api/exams/student/exams/1/start
Authorization: Bearer <student_token>

Response:
{
  "status": true,
  "code": 200,
  "message": "Exam started successfully",
  "data": {
    "attempt_id": 123,
    "exam_id": 1,
    "started_at": "2025-01-15T09:05:00Z",
    "duration_minutes": 120,
    "questions": [
      {
        "exam_item_id": 45,
        "order": 1,
        "question_type": "objective",
        "question_text": "What is the Virtual DOM?",
        "options": [
          {"id": "A", "text": "A copy of the real DOM"},
          {"id": "B", "text": "A virtual machine"},
          {"id": "C", "text": "A browser feature"},
          {"id": "D", "text": "A React feature"}
        ],
        "max_marks": 2
      },
      {
        "exam_item_id": 46,
        "order": 2,
        "question_type": "theory",
        "question_text": "Explain the concept of React Hooks.",
        "max_marks": 10
      }
    ]
  }
}
```

### 10. Submit Answer (Objective)

Auto-saves answer with instant grading for objective questions.

```http
POST /api/exams/student/exams/attempts/123/answer
Authorization: Bearer <student_token>
Content-Type: application/json

{
  "exam_item_id": 45,
  "selected_option": "A"
}

Response:
{
  "status": true,
  "code": 200,
  "message": "Answer saved",
  "data": {
    "is_correct": true,
    "awarded_score": 2
  }
}
```

### 11. Submit Answer (Theory)

Auto-saves answer, pending manual grading.

```http
POST /api/exams/student/exams/attempts/123/answer
Authorization: Bearer <student_token>
Content-Type: application/json

{
  "exam_item_id": 46,
  "answer_text": "React Hooks are functions that let you use state and other React features without writing a class. The most common hooks are useState for state management and useEffect for side effects...",
  "file_url": "https://storage.example.com/answers/student123_answer.pdf"
}

Response:
{
  "status": true,
  "code": 200,
  "message": "Answer saved (pending grading)"
}
```

### 12. Submit Exam (Finalize)

```http
POST /api/exams/student/exams/attempts/123/submit
Authorization: Bearer <student_token>

Response:
{
  "status": true,
  "code": 200,
  "message": "Exam submitted successfully",
  "data": {
    "attempt_id": 123,
    "total_score": 45,
    "status": "submitted"
  }
}
```

### 13. Get Attempt Details (Student)

```http
GET /api/exams/student/exams/attempts/123
Authorization: Bearer <student_token>

Response:
{
  "status": true,
  "data": {
    "id": 123,
    "exam_id": 1,
    "student_id": 1,
    "started_at": "2025-01-15T09:05:00Z",
    "submitted_at": "2025-01-15T11:00:00Z",
    "status": "graded",
    "total_score": 87,
    "max_score": 100,
    "objectiveAnswers": [...],
    "theoryAnswers": [...]
  }
}
```

---

## Staff - Grading & Statistics

### 14. Get Exam Attempts

View all student attempts for grading.

```http
GET /api/exams/1/attempts?status=submitted
Authorization: Bearer <staff_token>

Query Parameters:
- status (optional): "in_progress", "submitted", "graded", "abandoned"

Response:
{
  "status": true,
  "data": [
    {
      "id": 123,
      "exam_id": 1,
      "student_id": 1,
      "status": "submitted",
      "submitted_at": "2025-01-15T11:00:00Z",
      "total_score": 45,
      "student": {
        "id": 1,
        "fname": "John",
        "lname": "Doe",
        "matric_number": "CS/2020/001"
      }
    }
  ]
}
```

### 15. Get Attempt for Grading

View detailed attempt with all answers.

```http
GET /api/exams/attempts/123/grade
Authorization: Bearer <staff_token>

Response:
{
  "status": true,
  "data": {
    "id": 123,
    "exam": {
      "id": 1,
      "title": "Final Exam"
    },
    "student": {
      "fname": "John",
      "lname": "Doe",
      "matric_number": "CS/2020/001"
    },
    "objectiveAnswers": [
      {
        "id": 1,
        "selected_option": "A",
        "is_correct": true,
        "awarded_score": 2,
        "examItem": {
          "question": {
            "objective": {
              "question_text": "What is React?",
              "correct_option": "A"
            }
          }
        }
      }
    ],
    "theoryAnswers": [
      {
        "id": 1,
        "answer_text": "React Hooks are...",
        "awarded_score": null,
        "examItem": {
          "question": {
            "theory": {
              "question_text": "Explain React Hooks",
              "max_marks": 10
            }
          }
        }
      }
    ]
  }
}
```

### 16. Grade Single Theory Answer

```http
POST /api/exams/answers/theory/1/grade
Authorization: Bearer <staff_token>
Content-Type: application/json

{
  "awarded_score": 8,
  "feedback": "Good explanation of React Hooks. You covered useState and useEffect well, but missed useContext and custom hooks."
}

Response:
{
  "status": true,
  "code": 200,
  "message": "Answer graded successfully",
  "data": {
    "id": 1,
    "awarded_score": 8,
    "feedback": "Good explanation...",
    "graded_by": 1,
    "graded_at": "2025-01-16T10:00:00Z"
  }
}
```

### 17. Bulk Grade Theory Answers

```http
POST /api/exams/attempts/123/grade-bulk
Authorization: Bearer <staff_token>
Content-Type: application/json

{
  "grades": [
    {
      "answer_id": 1,
      "awarded_score": 8,
      "feedback": "Good explanation"
    },
    {
      "answer_id": 2,
      "awarded_score": 9,
      "feedback": "Excellent work"
    },
    {
      "answer_id": 3,
      "awarded_score": 7,
      "feedback": "Missing key points"
    }
  ]
}

Response:
{
  "status": true,
  "code": 200,
  "message": "Answers graded successfully",
  "data": {
    "attempt_id": 123,
    "total_score": 87
  }
}
```

### 18. Get Exam Statistics

```http
GET /api/exams/1/statistics
Authorization: Bearer <staff_token>

Response:
{
  "status": true,
  "data": {
    "exam_id": 1,
    "total_attempts": 150,
    "average_score": "72.50",
    "highest_score": 95,
    "lowest_score": 45
  }
}
```

---

## Testing Workflow

### Complete Testing Sequence

#### Phase 1: Setup (Staff)

1. ✅ Login as staff
2. ✅ View question bank: `GET /api/exams/bank/questions?course_id=18`
3. ✅ Create exam: `POST /api/exams` (random mode)
4. ✅ Verify exam created: `GET /api/exams/1`

#### Phase 2: Student 1 Takes Exam

1. ✅ Login as student 1
2. ✅ Get available exams: `GET /api/exams/student/exams`
3. ✅ Start exam: `POST /api/exams/student/exams/1/start`
4. ✅ Save answers: `POST /api/exams/student/exams/attempts/123/answer` (repeat for each question)
5. ✅ Submit exam: `POST /api/exams/student/exams/attempts/123/submit`

#### Phase 3: Student 2 Takes Exam (Verify Different Questions)

1. ✅ Login as student 2
2. ✅ Start exam: `POST /api/exams/student/exams/1/start`
3. ✅ **Compare questions** - should be different from Student 1!
4. ✅ Submit answers and exam

#### Phase 4: Grading (Staff)

1. ✅ Login as staff
2. ✅ Get all attempts: `GET /api/exams/1/attempts?status=submitted`
3. ✅ Get attempt details: `GET /api/exams/attempts/123/grade`
4. ✅ Grade theory answers: `POST /api/exams/attempts/123/grade-bulk`
5. ✅ View statistics: `GET /api/exams/1/statistics`

#### Phase 5: Verify Auto-Sync

1. ✅ Create new quiz question: `POST /api/quiz/:quizId/questions`
2. ✅ Check question bank: `GET /api/exams/bank/questions?course_id=18`
3. ✅ Verify new question appears automatically!

---

## Postman Collection Variables

Set these in your Postman environment:

```javascript
// Variables
base_url = http://localhost:3000
staff_token = <from login response>
student_token = <from login response>
course_id = 18
exam_id = 1
attempt_id = 123
```

---

## Expected Results

### ✅ Random Question Selection

- Student 1 gets questions: [5, 12, 3, 18, 7, ...]
- Student 2 gets questions: [9, 4, 15, 1, 11, ...] (DIFFERENT!)

### ✅ Auto-Grading

- Objective answers: Instant score calculation
- Theory answers: Pending until staff grades

### ✅ Final Score

- Objective score: Auto-calculated
- Theory score: Manual grading
- Total score: Sum of both

### ✅ Auto-Sync

- Create quiz question → Appears in question bank
- Update quiz question → Updates in question bank
- Delete quiz question → Removed from question bank

---

## Common Test Scenarios

### Scenario 1: All Objective Exam

```json
{
  "exam_type": "objective-only",
  "selection_mode": "random",
  "objective_count": 50,
  "theory_count": 0
}
```

Result: Fully auto-graded, instant results

### Scenario 2: All Theory Exam

```json
{
  "exam_type": "theory-only",
  "selection_mode": "random",
  "objective_count": 0,
  "theory_count": 10
}
```

Result: Requires manual grading for all questions

### Scenario 3: Mixed Exam

```json
{
  "exam_type": "mixed",
  "objective_count": 30,
  "theory_count": 5
}
```

Result: Partial auto-grading + manual grading needed

### Scenario 4: Same Questions for All (Manual Mode)

```json
{
  "selection_mode": "manual",
  "manual_question_ids": [1, 2, 3, 4, 5]
}
```

Result: All students get identical questions

---

## Error Cases to Test

### 1. Student Not Enrolled

```http
POST /api/exams/student/exams/1/start
→ 403: "You are not enrolled in this course"
```

### 2. Exam Not Published

```http
POST /api/exams/student/exams/1/start
→ 403: "Exam is not available"
```

### 3. Exam Time Window

```http
POST /api/exams/student/exams/1/start
→ 403: "Exam has not started yet" or "Exam has ended"
```

### 4. Already Submitted

```http
POST /api/exams/student/exams/attempts/123/answer
→ 400: "Exam already submitted"
```

### 5. Insufficient Questions

Create exam with `objective_count: 100` but only 50 in bank
→ Will select all 50 available questions

---

## Success Indicators

✅ Question bank populated (7+ questions)  
✅ Exam created successfully  
✅ Student 1 gets unique question set  
✅ Student 2 gets different question set  
✅ Objective answers auto-graded  
✅ Theory answers pending grading  
✅ Staff can grade theory answers  
✅ Final score calculated correctly  
✅ Statistics generated  
✅ Auto-sync working (quiz → exam bank)

---

🎉 **All systems operational!**

