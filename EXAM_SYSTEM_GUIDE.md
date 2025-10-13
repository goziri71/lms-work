# Exam Management System - Implementation Guide

## Overview

The exam system extends the LMS with a comprehensive examination platform that:

- **Auto-syncs quiz questions** to an exam bank
- **Supports random question selection** per student attempt
- **Handles both objective and theory questions**
- **Auto-grades objective questions** and provides manual grading for theory
- **Ensures unique question sets** for each student

---

## Architecture

### Database Design

All exam-related tables are stored in the **Library DB** (`wsp_library`):

1. **Question Bank** (`question_bank`, `question_objective`, `question_theory`)

   - Central repository of all questions
   - Auto-populated from quizzes
   - Tagged with difficulty, topic, source

2. **Exam Definition** (`exams`, `exam_items`)

   - Exam metadata and settings
   - Question count templates (not pre-selected questions)
   - Manual or random selection mode

3. **Exam Delivery** (`exam_attempts`, `exam_answers_objective`, `exam_answers_theory`)
   - Per-student attempts with unique question sets
   - Auto-graded objective answers
   - Manual grading for theory answers

### Auto-Sync Flow

```
Quiz Question Created/Updated → Auto-sync to question_bank
Quiz Question Deleted → Auto-delete from question_bank
```

### Random Selection Flow

```
Student starts exam →
  System selects N random questions from bank →
  Shuffles and assigns to exam_items (with attempt_id) →
  Student gets unique question set
```

---

## API Endpoints

### Staff - Exam Management

#### Create Exam

```http
POST /api/exams
Authorization: Bearer <staff_token>

{
  "course_id": 18,
  "academic_year": "2024/2025",
  "semester": "2ND",
  "title": "Final Exam - Web Development",
  "instructions": "Answer all questions. Time: 120 minutes",
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
```

#### Get All Exams (Staff)

```http
GET /api/exams?course_id=18&semester=2ND
Authorization: Bearer <staff_token>
```

#### Get Exam Details

```http
GET /api/exams/:examId
Authorization: Bearer <staff_token>
```

#### Update Exam

```http
PUT /api/exams/:examId
Authorization: Bearer <staff_token>

{
  "visibility": "published",
  "objective_count": 25,
  "theory_count": 10
}
```

#### Get Question Bank

```http
GET /api/exams/bank/questions?course_id=18&question_type=objective&difficulty=medium
Authorization: Bearer <staff_token>
```

### Student - Exam Taking

#### Get Available Exams

```http
GET /api/exams/student/exams?academic_year=2024/2025&semester=2ND
Authorization: Bearer <student_token>
```

#### Start Exam

```http
POST /api/exams/student/exams/:examId/start
Authorization: Bearer <student_token>

Response:
{
  "status": true,
  "data": {
    "attempt_id": 123,
    "exam_id": 45,
    "started_at": "2025-01-15T09:00:00Z",
    "duration_minutes": 120,
    "questions": [
      {
        "exam_item_id": 1,
        "order": 1,
        "question_type": "objective",
        "question_text": "What is React?",
        "options": [
          {"id": "A", "text": "A library"},
          {"id": "B", "text": "A framework"}
        ],
        "max_marks": 2
      }
    ]
  }
}
```

#### Submit Answer

```http
POST /api/exams/student/exams/attempts/:attemptId/answer
Authorization: Bearer <student_token>

{
  "exam_item_id": 1,
  "selected_option": "A"  // For objective
}

OR

{
  "exam_item_id": 2,
  "answer_text": "React is a JavaScript library...",  // For theory
  "file_url": "https://..."  // Optional
}
```

#### Submit Exam

```http
POST /api/exams/student/exams/attempts/:attemptId/submit
Authorization: Bearer <student_token>
```

#### Get Attempt Details

```http
GET /api/exams/student/exams/attempts/:attemptId
Authorization: Bearer <student_token>
```

### Staff - Grading

#### Get Exam Attempts

```http
GET /api/exams/:examId/attempts?status=submitted
Authorization: Bearer <staff_token>
```

#### Get Attempt for Grading

```http
GET /api/exams/attempts/:attemptId/grade
Authorization: Bearer <staff_token>
```

#### Grade Theory Answer

```http
POST /api/exams/answers/theory/:answerId/grade
Authorization: Bearer <staff_token>

{
  "awarded_score": 8,
  "feedback": "Good explanation, but missing key points about hooks."
}
```

#### Bulk Grade Theory

```http
POST /api/exams/attempts/:attemptId/grade-bulk
Authorization: Bearer <staff_token>

{
  "grades": [
    {"answer_id": 1, "awarded_score": 7, "feedback": "Good"},
    {"answer_id": 2, "awarded_score": 9, "feedback": "Excellent"}
  ]
}
```

#### Get Exam Statistics

```http
GET /api/exams/:examId/statistics
Authorization: Bearer <staff_token>

Response:
{
  "exam_id": 45,
  "total_attempts": 150,
  "average_score": "72.50",
  "highest_score": 95,
  "lowest_score": 45
}
```

---

## Migration & Setup

### 1. Sync Exam Tables

```bash
node sync-exam-tables.js
```

### 2. Migrate Existing Quizzes to Exam Bank

```bash
node migrate-quizzes-to-bank.js
```

This will import all existing quiz questions into the exam bank.

---

## How It Works

### Quiz Auto-Sync

When staff creates/updates/deletes quiz questions:

1. **Create**: Question is automatically added to `question_bank`
2. **Update**: Question is updated in `question_bank`
3. **Delete**: Question is removed from `question_bank`

### Random Question Selection

When a student starts an exam with `selection_mode: "random"`:

1. System counts available questions:

   - Objective questions: 100 in bank
   - Theory questions: 50 in bank

2. Exam specifies:

   - `objective_count: 30`
   - `theory_count: 5`

3. System randomly selects:

   - 30 random objective questions
   - 5 random theory questions

4. System shuffles and creates `exam_items` with `attempt_id`

5. **Each student gets a different set!**

### Grading Flow

1. **Objective questions**: Auto-graded on submit
2. **Theory questions**: Staff manually grades
3. **Final score**: Calculated when all theory answers are graded
4. **Attempt status**:
   - `in_progress` → `submitted` → `graded`

---

## Key Features

### ✅ Automatic Quiz Sync

- All quiz questions automatically become exam bank questions
- No manual copying needed
- Edit quiz → exam bank updates automatically

### ✅ Unique Questions Per Student

- Each student gets different questions
- Questions are shuffled per attempt
- No two students have identical exams

### ✅ Flexible Exam Types

- **Objective only**: MCQ exams
- **Theory only**: Essay exams
- **Mixed**: Both objective and theory

### ✅ Manual Mode (Optional)

For exams where all students should get the same questions:

```json
{
  "selection_mode": "manual",
  "manual_question_ids": [1, 5, 7, 12, 20]
}
```

### ✅ Smart Grading

- Objective: Auto-graded instantly
- Theory: Manual grading with feedback
- Auto-calculates final score

---

## Database Schema Summary

### question_bank

- Central repository of all questions
- Links to `question_objective` or `question_theory`
- Tracks source (quiz, manual, import)

### exams

- Exam metadata and settings
- `objective_count`, `theory_count` (not actual questions)
- `selection_mode`: "random" or "manual"

### exam_items

- Links questions to exams
- **Critical**: `attempt_id` field
  - `NULL` = manual mode (shared by all students)
  - `NOT NULL` = random mode (unique per student)

### exam_attempts

- Student's exam session
- Tracks start time, submit time, score
- Links to student via `student_id`

### exam*answers*\*

- Stores student responses
- Objective: auto-graded
- Theory: manual grading required

---

## Testing Checklist

- [ ] Create quiz with questions → Check question_bank
- [ ] Update quiz question → Check question_bank updates
- [ ] Delete quiz question → Check question_bank removes it
- [ ] Create exam with random mode
- [ ] Student 1 starts exam → Note their questions
- [ ] Student 2 starts exam → Verify different questions
- [ ] Submit objective answers → Check auto-grading
- [ ] Submit theory answers → Grade manually
- [ ] Check final score calculation
- [ ] Verify exam statistics

---

## Notes

1. **Cross-DB References**: Exam tables are in Library DB but reference students/courses in LMS DB (soft references via IDs)

2. **Performance**: Random selection uses Fisher-Yates shuffle for unbiased randomization

3. **Security**: All endpoints validate:

   - Staff owns the course
   - Student is enrolled
   - Exam time window

4. **Scalability**: Question bank grows over time as more quizzes are created

---

## Frontend Integration

### Student Flow

```javascript
// 1. Get available exams
GET /api/exams/student/exams

// 2. Start exam
POST /api/exams/student/exams/:examId/start
→ Receive unique question set

// 3. Save answers (auto-save)
POST /api/exams/student/exams/attempts/:attemptId/answer

// 4. Submit exam
POST /api/exams/student/exams/attempts/:attemptId/submit
```

### Staff Flow

```javascript
// 1. View question bank
GET /api/exams/bank/questions?course_id=18

// 2. Create exam
POST /api/exams
{
  objective_count: 30,
  theory_count: 5,
  selection_mode: "random"
}

// 3. View submissions
GET /api/exams/:examId/attempts?status=submitted

// 4. Grade theory answers
POST /api/exams/answers/theory/:answerId/grade
```

---

## Conclusion

The exam system is fully integrated with:

- ✅ Auto-sync from quizzes
- ✅ Random question selection per student
- ✅ Auto-grading for objective questions
- ✅ Manual grading for theory questions
- ✅ Comprehensive statistics
- ✅ Complete REST API
- ✅ Proper access control

**Status: Ready for testing!** 🎉
