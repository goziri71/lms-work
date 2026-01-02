# Course Enhancement - Frontend Implementation Guide

## Table of Contents
1. [Overview](#overview)
2. [New Fields Summary](#new-fields-summary)
3. [Frontend Implementation Steps](#frontend-implementation-steps)
4. [API Endpoints](#api-endpoints)
5. [Request/Response Examples](#requestresponse-examples)
6. [Testing Guide](#testing-guide)
7. [Error Handling](#error-handling)

---

## Overview

This guide covers the implementation of new course creation fields in the frontend. The new fields enhance course creation with description, outline, category, duration, image upload, enrollment limits, and access duration controls.

### Key Points
- **Marketplace courses** require: `description`, `course_outline`, `category`
- **WPU courses** (non-marketplace): New fields are optional
- **Image upload** uses `multipart/form-data` when included
- All new fields are **nullable** for backward compatibility

---

## New Fields Summary

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `description` | TEXT | Marketplace only | Course description/overview |
| `course_outline` | TEXT | Marketplace only | Course benefits/outline |
| `category` | ENUM | Marketplace only | See category options below |
| `duration_days` | INTEGER | Optional | Course duration in days |
| `image` | FILE | Optional | JPEG, PNG, WebP (max 5MB) |
| `enrollment_limit` | INTEGER | Optional | Max enrollments (marketplace only) |
| `access_duration_days` | INTEGER | Optional | Access duration in days (marketplace only) |
| `pricing_type` | ENUM | Auto-set | "one_time" or "free" (based on price) |

### Category Options
- Business
- Tech
- Art
- Logistics
- Ebooks
- Podcast
- Videos
- Music
- Articles
- Code
- 2D/3D Files

---

## Frontend Implementation Steps

### Step 1: Update Form State Structure

Add new fields to your course form state:

```javascript
const [courseData, setCourseData] = useState({
  // Existing fields
  title: '',
  course_code: '',
  course_unit: '',
  price: '',
  currency: 'NGN',
  course_type: '',
  course_level: '',
  semester: '',
  program_id: null,
  faculty_id: null,
  marketplace_status: 'draft',
  is_marketplace: false,
  
  // NEW FIELDS - Add these
  description: '',
  course_outline: '',
  category: '',
  duration_days: '',
  enrollment_limit: '',
  access_duration_days: '',
  image: null, // File object for upload
  image_url: null, // URL if image already uploaded
});
```

### Step 2: Add Form Inputs to UI

#### 2.1 Description Field (Required for Marketplace)

```jsx
<div className="form-group">
  <label>
    Description {courseData.is_marketplace && <span className="required">*</span>}
  </label>
  <textarea
    value={courseData.description}
    onChange={(e) => setCourseData({...courseData, description: e.target.value})}
    rows={5}
    required={courseData.is_marketplace}
    placeholder="Enter course description..."
    className={formErrors.description ? 'error' : ''}
  />
  {formErrors.description && (
    <span className="error-message">{formErrors.description}</span>
  )}
</div>
```

#### 2.2 Course Outline Field (Required for Marketplace)

```jsx
<div className="form-group">
  <label>
    Course Outline / Benefits {courseData.is_marketplace && <span className="required">*</span>}
  </label>
  <textarea
    value={courseData.course_outline}
    onChange={(e) => setCourseData({...courseData, course_outline: e.target.value})}
    rows={5}
    required={courseData.is_marketplace}
    placeholder="What students will learn..."
    className={formErrors.course_outline ? 'error' : ''}
  />
  {formErrors.course_outline && (
    <span className="error-message">{formErrors.course_outline}</span>
  )}
</div>
```

#### 2.3 Category Dropdown (Required for Marketplace)

```jsx
<div className="form-group">
  <label>
    Category {courseData.is_marketplace && <span className="required">*</span>}
  </label>
  <select
    value={courseData.category}
    onChange={(e) => setCourseData({...courseData, category: e.target.value})}
    required={courseData.is_marketplace}
    className={formErrors.category ? 'error' : ''}
  >
    <option value="">Select Category</option>
    <option value="Business">Business</option>
    <option value="Tech">Tech</option>
    <option value="Art">Art</option>
    <option value="Logistics">Logistics</option>
    <option value="Ebooks">Ebooks</option>
    <option value="Podcast">Podcast</option>
    <option value="Videos">Videos</option>
    <option value="Music">Music</option>
    <option value="Articles">Articles</option>
    <option value="Code">Code</option>
    <option value="2D/3D Files">2D/3D Files</option>
  </select>
  {formErrors.category && (
    <span className="error-message">{formErrors.category}</span>
  )}
</div>
```

#### 2.4 Duration Field (Optional)

```jsx
<div className="form-group">
  <label>Duration (Days)</label>
  <input
    type="number"
    value={courseData.duration_days}
    onChange={(e) => setCourseData({...courseData, duration_days: e.target.value})}
    min="1"
    placeholder="e.g., 30"
    className={formErrors.duration_days ? 'error' : ''}
  />
  {formErrors.duration_days && (
    <span className="error-message">{formErrors.duration_days}</span>
  )}
</div>
```

#### 2.5 Image Upload Field (Optional)

```jsx
<div className="form-group">
  <label>Course Image</label>
  <input
    type="file"
    accept="image/jpeg,image/jpg,image/png,image/webp"
    onChange={(e) => {
      const file = e.target.files[0];
      if (file) {
        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
          setFormErrors({...formErrors, image: 'Image must be less than 5MB'});
          return;
        }
        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
          setFormErrors({...formErrors, image: 'Image must be JPEG, PNG, or WebP'});
          return;
        }
        setCourseData({...courseData, image: file});
        setFormErrors({...formErrors, image: null});
      }
    }}
  />
  {courseData.image && (
    <div className="image-preview">
      <p>Selected: {courseData.image.name}</p>
      <img 
        src={URL.createObjectURL(courseData.image)} 
        alt="Preview" 
        style={{maxWidth: '200px', marginTop: '10px'}}
      />
      <button onClick={() => setCourseData({...courseData, image: null})}>
        Remove
      </button>
    </div>
  )}
  {courseData.image_url && !courseData.image && (
    <div className="current-image">
      <p>Current Image:</p>
      <img src={courseData.image_url} alt="Current" style={{maxWidth: '200px'}} />
    </div>
  )}
  {formErrors.image && (
    <span className="error-message">{formErrors.image}</span>
  )}
</div>
```

#### 2.6 Enrollment Limit (Optional, Marketplace Only)

```jsx
{courseData.is_marketplace && (
  <div className="form-group">
    <label>Enrollment Limit</label>
    <input
      type="number"
      value={courseData.enrollment_limit}
      onChange={(e) => setCourseData({...courseData, enrollment_limit: e.target.value})}
      min="1"
      placeholder="Leave empty for unlimited"
      className={formErrors.enrollment_limit ? 'error' : ''}
    />
    <small>Maximum number of students who can enroll</small>
    {formErrors.enrollment_limit && (
      <span className="error-message">{formErrors.enrollment_limit}</span>
    )}
  </div>
)}
```

#### 2.7 Access Duration (Optional, Marketplace Only)

```jsx
{courseData.is_marketplace && (
  <div className="form-group">
    <label>Access Duration (Days)</label>
    <input
      type="number"
      value={courseData.access_duration_days}
      onChange={(e) => setCourseData({...courseData, access_duration_days: e.target.value})}
      min="1"
      placeholder="Leave empty for lifetime access"
      className={formErrors.access_duration_days ? 'error' : ''}
    />
    <small>How long students can access the course after enrollment</small>
    {formErrors.access_duration_days && (
      <span className="error-message">{formErrors.access_duration_days}</span>
    )}
  </div>
)}
```

### Step 3: Add Client-Side Validation

```javascript
const validateForm = () => {
  const errors = {};

  // Existing validations
  if (!courseData.title) errors.title = 'Title is required';
  if (!courseData.course_code) errors.course_code = 'Course code is required';

  // NEW VALIDATIONS - Only for marketplace courses
  if (courseData.is_marketplace) {
    if (!courseData.description) {
      errors.description = 'Description is required for marketplace courses';
    }
    if (!courseData.course_outline) {
      errors.course_outline = 'Course outline is required for marketplace courses';
    }
    if (!courseData.category) {
      errors.category = 'Category is required for marketplace courses';
    }
  }

  // Optional field validations
  if (courseData.duration_days && parseInt(courseData.duration_days) <= 0) {
    errors.duration_days = 'Duration must be a positive number';
  }
  if (courseData.enrollment_limit && parseInt(courseData.enrollment_limit) <= 0) {
    errors.enrollment_limit = 'Enrollment limit must be a positive number';
  }
  if (courseData.access_duration_days && parseInt(courseData.access_duration_days) <= 0) {
    errors.access_duration_days = 'Access duration must be a positive number';
  }

  // Image validation
  if (courseData.image) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(courseData.image.type)) {
      errors.image = 'Image must be JPEG, PNG, or WebP';
    }
    if (courseData.image.size > 5 * 1024 * 1024) {
      errors.image = 'Image must be less than 5MB';
    }
  }

  return errors;
};
```

### Step 4: Update Form Submission

```javascript
const handleSubmit = async (e) => {
  e.preventDefault();

  // Validate form
  const errors = validateForm();
  if (Object.keys(errors).length > 0) {
    setFormErrors(errors);
    return;
  }

  // Check if image is included
  const hasImage = courseData.image !== null;

  if (hasImage) {
    // Use FormData for multipart/form-data
    const formData = new FormData();
    
    // Add all text fields
    formData.append('title', courseData.title);
    formData.append('course_code', courseData.course_code);
    formData.append('description', courseData.description);
    formData.append('course_outline', courseData.course_outline);
    formData.append('category', courseData.category);
    formData.append('price', courseData.price || '0');
    formData.append('currency', courseData.currency);
    formData.append('marketplace_status', courseData.marketplace_status);
    
    // Add optional fields only if they have values
    if (courseData.duration_days) {
      formData.append('duration_days', courseData.duration_days);
    }
    if (courseData.enrollment_limit) {
      formData.append('enrollment_limit', courseData.enrollment_limit);
    }
    if (courseData.access_duration_days) {
      formData.append('access_duration_days', courseData.access_duration_days);
    }
    if (courseData.program_id) {
      formData.append('program_id', courseData.program_id);
    }
    if (courseData.faculty_id) {
      formData.append('faculty_id', courseData.faculty_id);
    }
    // ... add other existing fields
    
    // Add image file
    formData.append('image', courseData.image);

    // Make API call with FormData
    try {
      const response = await fetch('/api/marketplace/tutor/courses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type - browser will set it with boundary
        },
        body: formData
      });
      
      const data = await response.json();
      if (data.success) {
        // Handle success
        alert('Course created successfully!');
        // Redirect or reset form
      } else {
        // Handle error
        alert(data.message || 'Failed to create course');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred. Please try again.');
    }
  } else {
    // No image - use JSON
    const payload = {
      title: courseData.title,
      course_code: courseData.course_code,
      description: courseData.description,
      course_outline: courseData.course_outline,
      category: courseData.category,
      price: courseData.price || '0',
      currency: courseData.currency,
      marketplace_status: courseData.marketplace_status,
      duration_days: courseData.duration_days || null,
      enrollment_limit: courseData.enrollment_limit || null,
      access_duration_days: courseData.access_duration_days || null,
      program_id: courseData.program_id || null,
      faculty_id: courseData.faculty_id || null,
      // ... other fields
    };

    // Remove null/empty values if needed
    Object.keys(payload).forEach(key => {
      if (payload[key] === '' || payload[key] === null) {
        delete payload[key];
      }
    });

    try {
      const response = await fetch('/api/marketplace/tutor/courses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      if (data.success) {
        // Handle success
        alert('Course created successfully!');
      } else {
        // Handle error
        alert(data.message || 'Failed to create course');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred. Please try again.');
    }
  }
};
```

### Step 5: Update Course Display Components

#### Course Card/List Item

```jsx
<div className="course-card">
  {/* Show image if available */}
  {course.image_url && (
    <img src={course.image_url} alt={course.title} className="course-image" />
  )}
  
  <h3>{course.title}</h3>
  
  {/* Show category */}
  {course.category && (
    <span className="category-badge">{course.category}</span>
  )}
  
  {/* Show duration if available */}
  {course.duration_days && (
    <p className="duration">Duration: {course.duration_days} days</p>
  )}
  
  {/* Show pricing type */}
  <p className="pricing-type">
    {course.pricing_type === 'free' ? 'Free' : 'One-time Payment'}
  </p>
  
  {/* Show enrollment limit if set */}
  {course.enrollment_limit && (
    <p className="enrollment-limit">
      Enrollment Limit: {course.enrollment_limit} students
    </p>
  )}
  
  {/* Show access duration if set */}
  {course.access_duration_days && (
    <p className="access-duration">
      Access: {course.access_duration_days} days
    </p>
  )}
</div>
```

#### Course Detail Page

```jsx
<div className="course-details">
  <h1>{course.title}</h1>
  
  {/* Image */}
  {course.image_url && (
    <img src={course.image_url} alt={course.title} className="course-hero-image" />
  )}
  
  {/* Description section */}
  {course.description ? (
    <section className="description">
      <h2>Description</h2>
      <p>{course.description}</p>
    </section>
  ) : (
    <section className="description">
      <h2>Description</h2>
      <p className="text-muted">No description available</p>
    </section>
  )}
  
  {/* Course outline section */}
  {course.course_outline ? (
    <section className="outline">
      <h2>What You'll Learn</h2>
      <p>{course.course_outline}</p>
    </section>
  ) : (
    <section className="outline">
      <h2>What You'll Learn</h2>
      <p className="text-muted">No course outline available</p>
    </section>
  )}
  
  {/* Course info */}
  <div className="course-info">
    {course.category && (
      <div className="info-item">
        <strong>Category:</strong> {course.category}
      </div>
    )}
    {course.duration_days && (
      <div className="info-item">
        <strong>Duration:</strong> {course.duration_days} days
      </div>
    )}
    {course.enrollment_limit && (
      <div className="info-item">
        <strong>Enrollment Limit:</strong> {course.enrollment_limit} students
      </div>
    )}
    {course.access_duration_days && (
      <div className="info-item">
        <strong>Access Duration:</strong> {course.access_duration_days} days
      </div>
    )}
    {!course.access_duration_days && course.is_marketplace && (
      <div className="info-item">
        <strong>Access:</strong> Lifetime
      </div>
    )}
  </div>
</div>
```

---

## API Endpoints

### 1. Create Course (Tutor)

**Endpoint:** `POST /api/marketplace/tutor/courses`

**Authorization:** Bearer token (tutor token)

**Content-Type:** 
- `multipart/form-data` (if image included)
- `application/json` (if no image)

**Request Body (JSON):**

```json
{
  "title": "Introduction to JavaScript",
  "course_code": "JS101",
  "description": "Learn JavaScript from scratch",
  "course_outline": "You will learn variables, functions, objects, and more",
  "category": "Tech",
  "price": "5000",
  "currency": "NGN",
  "marketplace_status": "draft",
  "duration_days": 30,
  "enrollment_limit": 100,
  "access_duration_days": 365,
  "program_id": 1,
  "faculty_id": 1
}
```

**Request Body (FormData - with image):**

```
title: "Introduction to JavaScript"
course_code: "JS101"
description: "Learn JavaScript from scratch"
course_outline: "You will learn variables, functions, objects, and more"
category: "Tech"
price: "5000"
currency: "NGN"
marketplace_status: "draft"
duration_days: "30"
enrollment_limit: "100"
access_duration_days: "365"
program_id: "1"
faculty_id: "1"
image: [File object]
```

**Success Response (201 Created):**

```json
{
  "success": true,
  "message": "Course created successfully",
  "data": {
    "course": {
      "id": 123,
      "title": "Introduction to JavaScript",
      "course_code": "JS101",
      "description": "Learn JavaScript from scratch",
      "course_outline": "You will learn variables, functions, objects, and more",
      "pricing_type": "one_time",
      "price": 5000,
      "duration_days": 30,
      "image_url": "https://supabase.co/storage/v1/object/sign/courses/...",
      "category": "Tech",
      "enrollment_limit": 100,
      "access_duration_days": 365,
      "marketplace_status": "draft"
    }
  }
}
```

**Error Response (400 Bad Request):**

```json
{
  "success": false,
  "message": "Description is required",
  "code": 400
}
```

**Error Response (409 Conflict):**

```json
{
  "success": false,
  "message": "Course code already exists for your account",
  "code": 409
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "success": false,
  "message": "Image upload failed: [error details]",
  "code": 500
}
```

---

### 2. Update Course (Tutor)

**Endpoint:** `PUT /api/marketplace/tutor/courses/:id`

**Authorization:** Bearer token (tutor token)

**Content-Type:** 
- `multipart/form-data` (if image included)
- `application/json` (if no image)

**Request Body (JSON):**

```json
{
  "title": "Advanced JavaScript",
  "description": "Advanced JavaScript concepts",
  "course_outline": "You will learn advanced patterns and techniques",
  "category": "Tech",
  "duration_days": 60,
  "enrollment_limit": 50
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Course updated successfully",
  "data": {
    "course": {
      "id": 123,
      "title": "Advanced JavaScript",
      "course_code": "JS101",
      "description": "Advanced JavaScript concepts",
      "course_outline": "You will learn advanced patterns and techniques",
      "pricing_type": "one_time",
      "price": 5000,
      "duration_days": 60,
      "image_url": "https://supabase.co/storage/v1/object/sign/courses/...",
      "category": "Tech",
      "enrollment_limit": 50,
      "access_duration_days": 365,
      "marketplace_status": "draft"
    }
  }
}
```

---

### 3. Create Course (Admin)

**Endpoint:** `POST /api/admin/courses`

**Authorization:** Bearer token (admin token)

**Content-Type:** 
- `multipart/form-data` (if image included)
- `application/json` (if no image)

**Request Body (JSON):**

```json
{
  "title": "Introduction to Programming",
  "course_code": "CS101",
  "program_id": 1,
  "staff_id": 5,
  "price": "0",
  "currency": "NGN",
  "is_marketplace": false,
  "description": "Optional description for WPU course",
  "category": "Tech"
}
```

**Note:** For WPU courses (`is_marketplace: false`), `description`, `course_outline`, and `category` are optional.

**Success Response (201 Created):**

```json
{
  "success": true,
  "message": "Course created successfully",
  "data": {
    "course": {
      "id": 124,
      "title": "Introduction to Programming",
      "course_code": "CS101",
      "description": "Optional description for WPU course",
      "category": "Tech",
      "pricing_type": "free",
      "price": 0,
      "is_marketplace": false,
      "marketplace_status": null
    }
  }
}
```

---

### 4. Get Course by ID

**Endpoint:** `GET /api/marketplace/tutor/courses/:id`

**Authorization:** Bearer token (tutor token)

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Course retrieved successfully",
  "data": {
    "course": {
      "id": 123,
      "title": "Introduction to JavaScript",
      "course_code": "JS101",
      "description": "Learn JavaScript from scratch",
      "course_outline": "You will learn variables, functions, objects, and more",
      "pricing_type": "one_time",
      "price": 5000,
      "currency": "NGN",
      "duration_days": 30,
      "image_url": "https://supabase.co/storage/v1/object/sign/courses/...",
      "category": "Tech",
      "enrollment_limit": 100,
      "access_duration_days": 365,
      "marketplace_status": "published",
      "enrollment_count": 45,
      "program": {
        "id": 1,
        "title": "Computer Science"
      },
      "faculty": {
        "id": 1,
        "name": "Faculty of Science"
      }
    }
  }
}
```

---

### 5. Get All Courses (Tutor)

**Endpoint:** `GET /api/marketplace/tutor/courses?page=1&limit=20&status=published`

**Authorization:** Bearer token (tutor token)

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `status` (optional): Filter by status (draft, published, etc.)
- `search` (optional): Search by title or course code

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Courses retrieved successfully",
  "data": {
    "courses": [
      {
        "id": 123,
        "title": "Introduction to JavaScript",
        "course_code": "JS101",
        "description": "Learn JavaScript from scratch",
        "course_outline": "You will learn variables, functions, objects, and more",
        "pricing_type": "one_time",
        "price": 5000,
        "duration_days": 30,
        "image_url": "https://supabase.co/storage/v1/object/sign/courses/...",
        "category": "Tech",
        "enrollment_limit": 100,
        "access_duration_days": 365,
        "marketplace_status": "published",
        "enrollment_count": 45,
        "program": {
          "id": 1,
          "title": "Computer Science"
        },
        "faculty": {
          "id": 1,
          "name": "Faculty of Science"
        }
      }
    ],
    "pagination": {
      "total": 10,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

---

## Testing Guide

### Test Case 1: Create Marketplace Course with All Fields

**Request:**
```bash
curl -X POST http://localhost:3000/api/marketplace/tutor/courses \
  -H "Authorization: Bearer YOUR_TUTOR_TOKEN" \
  -F "title=Introduction to JavaScript" \
  -F "course_code=JS101" \
  -F "description=Learn JavaScript from scratch" \
  -F "course_outline=You will learn variables, functions, objects, and more" \
  -F "category=Tech" \
  -F "price=5000" \
  -F "currency=NGN" \
  -F "marketplace_status=draft" \
  -F "duration_days=30" \
  -F "enrollment_limit=100" \
  -F "access_duration_days=365" \
  -F "image=@/path/to/image.jpg"
```

**Expected Response:**
- Status: 201 Created
- Contains all new fields in response
- `pricing_type` should be "one_time" (since price > 0)

---

### Test Case 2: Create Marketplace Course without Optional Fields

**Request:**
```bash
curl -X POST http://localhost:3000/api/marketplace/tutor/courses \
  -H "Authorization: Bearer YOUR_TUTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Introduction to JavaScript",
    "course_code": "JS102",
    "description": "Learn JavaScript from scratch",
    "course_outline": "You will learn variables, functions, objects, and more",
    "category": "Tech",
    "price": "5000",
    "currency": "NGN",
    "marketplace_status": "draft"
  }'
```

**Expected Response:**
- Status: 201 Created
- Optional fields (`duration_days`, `enrollment_limit`, `access_duration_days`, `image_url`) should be `null`

---

### Test Case 3: Create Free Marketplace Course

**Request:**
```bash
curl -X POST http://localhost:3000/api/marketplace/tutor/courses \
  -H "Authorization: Bearer YOUR_TUTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Free JavaScript Basics",
    "course_code": "JS103",
    "description": "Free introduction to JavaScript",
    "course_outline": "Basic JavaScript concepts",
    "category": "Tech",
    "price": "0",
    "currency": "NGN",
    "marketplace_status": "published"
  }'
```

**Expected Response:**
- Status: 201 Created
- `pricing_type` should be "free" (since price = 0)

---

### Test Case 4: Create WPU Course (Non-Marketplace)

**Request:**
```bash
curl -X POST http://localhost:3000/api/admin/courses \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Introduction to Programming",
    "course_code": "CS101",
    "program_id": 1,
    "staff_id": 5,
    "price": "0",
    "currency": "NGN",
    "is_marketplace": false
  }'
```

**Expected Response:**
- Status: 201 Created
- New fields (`description`, `course_outline`, `category`) are optional and can be `null`

---

### Test Case 5: Validation Error - Missing Required Fields

**Request:**
```bash
curl -X POST http://localhost:3000/api/marketplace/tutor/courses \
  -H "Authorization: Bearer YOUR_TUTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Introduction to JavaScript",
    "course_code": "JS104"
  }'
```

**Expected Response:**
- Status: 400 Bad Request
- Error message about missing required fields

---

### Test Case 6: Validation Error - Invalid Category

**Request:**
```bash
curl -X POST http://localhost:3000/api/marketplace/tutor/courses \
  -H "Authorization: Bearer YOUR_TUTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Introduction to JavaScript",
    "course_code": "JS105",
    "description": "Learn JavaScript",
    "course_outline": "JavaScript basics",
    "category": "InvalidCategory",
    "price": "5000",
    "currency": "NGN"
  }'
```

**Expected Response:**
- Status: 400 Bad Request
- Error message: "Invalid category. Must be one of: Business, Tech, Art, ..."

---

### Test Case 7: Update Course with New Image

**Request:**
```bash
curl -X PUT http://localhost:3000/api/marketplace/tutor/courses/123 \
  -H "Authorization: Bearer YOUR_TUTOR_TOKEN" \
  -F "title=Updated Course Title" \
  -F "description=Updated description" \
  -F "image=@/path/to/new-image.jpg"
```

**Expected Response:**
- Status: 200 OK
- `image_url` should be updated with new image URL

---

### Test Case 8: Update Course without Image

**Request:**
```bash
curl -X PUT http://localhost:3000/api/marketplace/tutor/courses/123 \
  -H "Authorization: Bearer YOUR_TUTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Course Title",
    "description": "Updated description",
    "duration_days": 60
  }'
```

**Expected Response:**
- Status: 200 OK
- Only provided fields should be updated
- Existing `image_url` should remain unchanged

---

### Test Case 9: Image Upload Validation - File Too Large

**Request:**
```bash
# Create a file larger than 5MB and try to upload
curl -X POST http://localhost:3000/api/marketplace/tutor/courses \
  -H "Authorization: Bearer YOUR_TUTOR_TOKEN" \
  -F "title=Test Course" \
  -F "course_code=TEST101" \
  -F "description=Test" \
  -F "course_outline=Test" \
  -F "category=Tech" \
  -F "image=@/path/to/large-file.jpg"
```

**Expected Response:**
- Status: 400 Bad Request
- Error message about file size limit

---

### Test Case 10: Image Upload Validation - Invalid File Type

**Request:**
```bash
curl -X POST http://localhost:3000/api/marketplace/tutor/courses \
  -H "Authorization: Bearer YOUR_TUTOR_TOKEN" \
  -F "title=Test Course" \
  -F "course_code=TEST102" \
  -F "description=Test" \
  -F "course_outline=Test" \
  -F "category=Tech" \
  -F "image=@/path/to/document.pdf"
```

**Expected Response:**
- Status: 400 Bad Request
- Error message: "Only JPEG, PNG, and WebP images are allowed"

---

## Error Handling

### Common Error Responses

#### 400 Bad Request - Validation Error

```json
{
  "success": false,
  "message": "Description is required for marketplace courses",
  "code": 400
}
```

#### 400 Bad Request - Invalid Category

```json
{
  "success": false,
  "message": "Invalid category. Must be one of: Business, Tech, Art, Logistics, Ebooks, Podcast, Videos, Music, Articles, Code, 2D/3D Files",
  "code": 400
}
```

#### 400 Bad Request - Invalid Field Value

```json
{
  "success": false,
  "message": "Enrollment limit must be a positive number",
  "code": 400
}
```

#### 400 Bad Request - Image Upload Error

```json
{
  "success": false,
  "message": "Image upload failed: [error details]",
  "code": 500
}
```

#### 409 Conflict - Duplicate Course Code

```json
{
  "success": false,
  "message": "Course code already exists for your account",
  "code": 409
}
```

#### 404 Not Found - Course Not Found

```json
{
  "success": false,
  "message": "Course not found",
  "code": 404
}
```

### Frontend Error Handling Example

```javascript
const handleSubmit = async (e) => {
  e.preventDefault();
  
  try {
    const response = await fetch('/api/marketplace/tutor/courses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        // ... other headers
      },
      body: formData // or JSON
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      // Handle specific error codes
      switch (response.status) {
        case 400:
          // Validation errors
          if (data.message.includes('Description')) {
            setFormErrors({...formErrors, description: data.message});
          } else if (data.message.includes('Category')) {
            setFormErrors({...formErrors, category: data.message});
          } else if (data.message.includes('Image')) {
            setFormErrors({...formErrors, image: data.message});
          } else {
            alert(data.message);
          }
          break;
        case 409:
          // Duplicate course code
          setFormErrors({...formErrors, course_code: data.message});
          break;
        case 500:
          // Server error
          if (data.message.includes('Image upload')) {
            alert('Image upload failed. Please try again.');
          } else {
            alert('Server error. Please try again later.');
          }
          break;
        default:
          alert(data.message || 'An error occurred');
      }
      return;
    }
    
    // Success
    if (data.success) {
      alert('Course created successfully!');
      // Redirect or reset form
      navigate('/courses');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Network error. Please check your connection and try again.');
  }
};
```

---

## Summary Checklist

### Frontend Developer Checklist

- [ ] Add new fields to form state
- [ ] Add form inputs for all new fields
- [ ] Add client-side validation
- [ ] Update form submission to use FormData when image included
- [ ] Update course edit form to pre-populate new fields
- [ ] Update course display components to show new fields
- [ ] Handle null values safely (for existing courses)
- [ ] Update API service functions
- [ ] Add conditional requirements based on marketplace status
- [ ] Test all scenarios
- [ ] Add proper error handling
- [ ] Test image upload functionality
- [ ] Test with existing courses (null values)

### Testing Checklist

- [ ] Create marketplace course with all fields
- [ ] Create marketplace course without optional fields
- [ ] Create free marketplace course (price = 0)
- [ ] Create WPU course (new fields optional)
- [ ] Upload image during creation
- [ ] Create course without image
- [ ] Update course with new image
- [ ] Update course without changing image
- [ ] Validate required fields show errors
- [ ] Test with null values (existing courses)
- [ ] Test image validation (size, type)
- [ ] Test category validation
- [ ] Test enrollment limit validation
- [ ] Test access duration validation

---

## Notes

1. **Backward Compatibility**: All new fields are nullable, so existing courses will have `null` values. Frontend should handle this gracefully.

2. **Pricing Type**: Automatically set based on price:
   - `price = 0` → `pricing_type = "free"`
   - `price > 0` → `pricing_type = "one_time"`

3. **Image URLs**: If using private Supabase buckets, signed URLs expire after 1 year. Frontend may need to handle URL refresh if needed.

4. **Marketplace vs WPU**: 
   - Marketplace courses require: `description`, `course_outline`, `category`
   - WPU courses: All new fields are optional

5. **Enrollment Limit & Access Duration**: Only apply to marketplace purchases, not WPU course registrations.

---

## Support

For questions or issues, refer to:
- API Documentation: `TUTOR_DASHBOARD_API.md`
- Backend Implementation: Course controllers in `src/controllers/marketplace/tutorCourseManagement.js`
- Model Definition: `src/models/course/courses.js`

