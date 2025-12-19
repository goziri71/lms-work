# KYC (Know Your Customer) API Documentation

This document describes the KYC endpoints for student document uploads, profile image management, and school information updates.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Endpoints](#endpoints)
   - [Upload Profile Image](#1-upload-profile-image)
   - [Upload KYC Document](#2-upload-kyc-document)
   - [Get KYC Documents](#3-get-kyc-documents)
   - [Update School Information](#4-update-school-information)
4. [File Upload Specifications](#file-upload-specifications)
5. [Error Handling](#error-handling)
6. [Examples](#examples)

---

## Overview

The KYC system allows students to:
- Upload profile pictures
- Upload required documents (birth certificate, reference letter, valid ID, resume/CV, certificates, etc.)
- View their uploaded documents
- Update previous school information

**Base URL:** `/api/student/kyc`

---

## Authentication

All endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer {jwt_token}
```

**User Type:** Only students can access these endpoints.

---

## Endpoints

### 1. Upload Profile Image

Upload or update student profile picture.

**Endpoint:** `POST /api/student/kyc/profile-image`

**Content-Type:** `multipart/form-data`

**Request:**
- **Field Name:** `profile_image`
- **File Types:** JPEG, JPG, PNG only
- **Max File Size:** 5MB

**cURL Example:**
```bash
curl -X POST \
  https://your-api.com/api/student/kyc/profile-image \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -F 'profile_image=@/path/to/image.jpg'
```

**JavaScript/Fetch Example:**
```javascript
const formData = new FormData();
formData.append('profile_image', fileInput.files[0]);

const response = await fetch('/api/student/kyc/profile-image', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const data = await response.json();
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Profile image uploaded successfully",
  "data": {
    "profile_image_url": "https://supabase-url.com/storage/v1/object/public/student-documents/students/123/profile/profile_1704067200000.jpg"
  }
}
```

**Error Responses:**
- `400` - Invalid file type or file missing
- `403` - Not a student account
- `404` - Student not found
- `500` - Upload failed

---

### 2. Upload KYC Document

Upload a KYC document (birth certificate, reference letter, valid ID, etc.).

**Endpoint:** `POST /api/student/kyc/documents`

**Content-Type:** `multipart/form-data`

**Request Fields:**
- `document_type` (string, required) - One of: `birth_certificate`, `ref_letter`, `valid_id`, `resume_cv`, `certificate_file`, `other_file`
- `file` (file, required) - The document file

**File Specifications:**
- **File Types:** JPEG, JPG, PNG, PDF
- **Max File Size:** 10MB

**Valid Document Types:**
- `birth_certificate` - Birth certificate document
- `ref_letter` - Reference letter
- `valid_id` - Valid ID card (National ID, Driver's License, etc.)
- `resume_cv` - Resume or CV
- `certificate_file` - Certificate document
- `other_file` - Other supporting documents

**cURL Example:**
```bash
curl -X POST \
  https://your-api.com/api/student/kyc/documents \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -F 'document_type=birth_certificate' \
  -F 'file=@/path/to/birth_certificate.pdf'
```

**JavaScript/Fetch Example:**
```javascript
const formData = new FormData();
formData.append('document_type', 'birth_certificate');
formData.append('file', fileInput.files[0]);

const response = await fetch('/api/student/kyc/documents', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const data = await response.json();
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Document uploaded successfully",
  "data": {
    "document_type": "birth_certificate",
    "file_url": "https://supabase-url.com/storage/v1/object/public/student-documents/students/123/documents/birth_certificate/birth_certificate_1704067200000.pdf",
    "uploaded_at": "2024-01-01T12:00:00.000Z"
  }
}
```

**Error Responses:**
- `400` - Invalid document type, file missing, or invalid file type
- `403` - Not a student account
- `404` - Student not found
- `500` - Upload failed

---

### 3. Get KYC Documents

Retrieve all uploaded KYC documents and school information for the authenticated student.

**Endpoint:** `GET /api/student/kyc/documents`

**cURL Example:**
```bash
curl -X GET \
  https://your-api.com/api/student/kyc/documents \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

**JavaScript/Fetch Example:**
```javascript
const response = await fetch('/api/student/kyc/documents', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const data = await response.json();
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "KYC documents retrieved successfully",
  "data": {
    "profile_image": "https://supabase-url.com/.../profile_image.jpg",
    "documents": {
      "birth_certificate": "https://supabase-url.com/.../birth_certificate.pdf",
      "ref_letter": "https://supabase-url.com/.../ref_letter.pdf",
      "valid_id": "https://supabase-url.com/.../valid_id.jpg",
      "resume_cv": "https://supabase-url.com/.../resume_cv.pdf",
      "certificate_file": null,
      "other_file": null
    },
    "schools": {
      "school1": {
        "name": "ABC High School",
        "date": "2015-2020"
      },
      "school2": {
        "name": "XYZ Secondary School",
        "date": "2010-2015"
      },
      "general_school": {
        "name": "Previous University",
        "date": "2020-01-01T00:00:00.000Z"
      }
    }
  }
}
```

**Note:** Document URLs will be `null` if not uploaded yet.

**Error Responses:**
- `403` - Not a student account
- `404` - Student not found

---

### 4. Update School Information

Update previous school information (up to 2 schools).

**Endpoint:** `PUT /api/student/kyc/schools`

**Content-Type:** `application/json`

**Request Body:**
```json
{
  "school1": "ABC High School",
  "school1_date": "2015-2020",
  "school2": "XYZ Secondary School",
  "school2_date": "2010-2015",
  "school": "Previous University",
  "school_date": "2020-01-01"
}
```

**Fields (all optional):**
- `school1` (string) - Name of first previous school
- `school1_date` (string) - Date/period for first school
- `school2` (string) - Name of second previous school
- `school2_date` (string) - Date/period for second school
- `school` (string) - General school name
- `school_date` (string/date) - General school date

**cURL Example:**
```bash
curl -X PUT \
  https://your-api.com/api/student/kyc/schools \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "school1": "ABC High School",
    "school1_date": "2015-2020",
    "school2": "XYZ Secondary School",
    "school2_date": "2010-2015"
  }'
```

**JavaScript/Fetch Example:**
```javascript
const response = await fetch('/api/student/kyc/schools', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    school1: 'ABC High School',
    school1_date: '2015-2020',
    school2: 'XYZ Secondary School',
    school2_date: '2010-2015'
  })
});

const data = await response.json();
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "School information updated successfully",
  "data": {
    "schools": {
      "school1": {
        "name": "ABC High School",
        "date": "2015-2020"
      },
      "school2": {
        "name": "XYZ Secondary School",
        "date": "2010-2015"
      },
      "general_school": {
        "name": null,
        "date": null
      }
    }
  }
}
```

**Error Responses:**
- `400` - No school information provided
- `403` - Not a student account
- `404` - Student not found

---

## File Upload Specifications

### Profile Image
- **Allowed Types:** JPEG, JPG, PNG
- **Max Size:** 5MB
- **Field Name:** `profile_image`
- **Storage Path:** `students/{student_id}/profile/profile_{timestamp}.{ext}`

### KYC Documents
- **Allowed Types:** JPEG, JPG, PNG, PDF
- **Max Size:** 10MB
- **Field Name:** `file`
- **Storage Path:** `students/{student_id}/documents/{document_type}/{document_type}_{timestamp}.{ext}`

### File Naming
Files are automatically renamed with timestamps to prevent conflicts:
- Profile: `profile_1704067200000.jpg`
- Documents: `birth_certificate_1704067200000.pdf`

---

## Error Handling

### Common Error Responses

**400 Bad Request:**
```json
{
  "success": false,
  "message": "Invalid file type. Only JPEG, PNG, and PDF files are allowed",
  "error": "Error details..."
}
```

**403 Forbidden:**
```json
{
  "success": false,
  "message": "Only students can upload documents",
  "error": "Error details..."
}
```

**404 Not Found:**
```json
{
  "success": false,
  "message": "Student not found",
  "error": "Error details..."
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "message": "Upload failed: Error message from storage service",
  "error": "Error details..."
}
```

### Frontend Error Handling Example

```javascript
try {
  const response = await fetch('/api/student/kyc/documents', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  const data = await response.json();

  if (!response.ok) {
    // Handle error
    console.error('Upload failed:', data.message);
    alert(data.message);
    return;
  }

  // Handle success
  console.log('Upload successful:', data.data.file_url);
  alert('Document uploaded successfully!');
} catch (error) {
  console.error('Network error:', error);
  alert('Network error. Please try again.');
}
```

---

## Examples

### Complete KYC Upload Flow

```javascript
// 1. Upload Profile Image
async function uploadProfileImage(file, token) {
  const formData = new FormData();
  formData.append('profile_image', file);

  const response = await fetch('/api/student/kyc/profile-image', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });

  return await response.json();
}

// 2. Upload KYC Document
async function uploadDocument(documentType, file, token) {
  const formData = new FormData();
  formData.append('document_type', documentType);
  formData.append('file', file);

  const response = await fetch('/api/student/kyc/documents', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });

  return await response.json();
}

// 3. Get All Documents
async function getKycDocuments(token) {
  const response = await fetch('/api/student/kyc/documents', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  return await response.json();
}

// 4. Update School Information
async function updateSchoolInfo(schoolData, token) {
  const response = await fetch('/api/student/kyc/schools', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(schoolData)
  });

  return await response.json();
}

// Usage Example
const token = 'your_jwt_token';

// Upload profile image
const profileResult = await uploadProfileImage(profileFile, token);
console.log('Profile URL:', profileResult.data.profile_image_url);

// Upload birth certificate
const docResult = await uploadDocument('birth_certificate', birthCertFile, token);
console.log('Document URL:', docResult.data.file_url);

// Get all documents
const allDocs = await getKycDocuments(token);
console.log('All documents:', allDocs.data);

// Update school info
const schoolResult = await updateSchoolInfo({
  school1: 'ABC High School',
  school1_date: '2015-2020',
  school2: 'XYZ Secondary School',
  school2_date: '2010-2015'
}, token);
console.log('Schools updated:', schoolResult.data.schools);
```

### React Component Example

```jsx
import React, { useState } from 'react';

function KYCUpload() {
  const [file, setFile] = useState(null);
  const [documentType, setDocumentType] = useState('birth_certificate');
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      alert('Please select a file');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('document_type', documentType);
    formData.append('file', file);

    try {
      const response = await fetch('/api/student/kyc/documents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        alert('Document uploaded successfully!');
        console.log('File URL:', data.data.file_url);
      } else {
        alert(`Upload failed: ${data.message}`);
      }
    } catch (error) {
      alert('Network error. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <select value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
        <option value="birth_certificate">Birth Certificate</option>
        <option value="ref_letter">Reference Letter</option>
        <option value="valid_id">Valid ID</option>
        <option value="resume_cv">Resume/CV</option>
        <option value="certificate_file">Certificate</option>
        <option value="other_file">Other Document</option>
      </select>
      <input type="file" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png" />
      <button onClick={handleUpload} disabled={uploading}>
        {uploading ? 'Uploading...' : 'Upload Document'}
      </button>
    </div>
  );
}
```

---

## Notes for Frontend Developers

1. **File Validation:** Always validate file type and size on the frontend before uploading to provide immediate feedback to users.

2. **Progress Indicators:** For large files, consider showing upload progress using `XMLHttpRequest` or libraries like `axios` with progress tracking.

3. **File Preview:** Show previews of uploaded images before submission.

4. **Error Messages:** Display user-friendly error messages based on the API response.

5. **Token Management:** Ensure JWT tokens are stored securely and refreshed when expired.

6. **File Size Limits:**
   - Profile images: 5MB max
   - Documents: 10MB max

7. **Allowed File Types:**
   - Profile images: JPEG, JPG, PNG
   - Documents: JPEG, JPG, PNG, PDF

8. **URL Storage:** The API returns Supabase public URLs. These URLs can be used directly in `<img>` tags or `<a>` links for document viewing.

---

## Support

For questions or issues, contact the backend development team.

**Last Updated:** January 2024

