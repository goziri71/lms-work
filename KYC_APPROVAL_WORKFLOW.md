# KYC Document Approval Workflow

This document describes the approval workflow for student KYC documents.

---

## 📋 Workflow Overview

1. **Student uploads document** → Status: `pending`
2. **Admin reviews document** → Can approve or reject
3. **If approved** → Status: `approved` (student can see it)
4. **If rejected** → Status: `rejected` with reason (student sees rejection reason)

---

## 🔄 Complete Flow

### Step 1: Student Uploads Document

**Endpoint:** `POST /api/student/kyc/documents` or `POST /api/student/kyc/profile-image`

**What happens:**
- File is uploaded to Supabase
- Document URL is saved to `Students` table
- Approval record is created in `student_document_approvals` table with status: `pending`

**Response:**
```json
{
  "success": true,
  "message": "Document uploaded successfully. Pending admin approval.",
  "data": {
    "document_type": "birth_certificate",
    "file_url": "https://...",
    "status": "pending",
    "uploaded_at": "2024-01-01T12:00:00.000Z"
  }
}
```

---

### Step 2: Student Views Their Documents

**Endpoint:** `GET /api/student/kyc/documents`

**Response includes approval status:**
```json
{
  "success": true,
  "data": {
    "profile_image": {
      "url": "https://...",
      "status": "pending",
      "rejection_reason": null,
      "reviewed_at": null
    },
    "documents": {
      "birth_certificate": {
        "url": "https://...",
        "status": "approved",
        "rejection_reason": null,
        "reviewed_at": "2024-01-02T10:00:00.000Z"
      },
      "ref_letter": {
        "url": "https://...",
        "status": "rejected",
        "rejection_reason": "Document is unclear. Please upload a clearer version.",
        "reviewed_at": "2024-01-02T11:00:00.000Z"
      }
    }
  }
}
```

---

### Step 3: Admin Views Pending Documents

**Endpoint:** `GET /api/admin/students/kyc/pending`

**Response:**
```json
{
  "success": true,
  "message": "Pending documents retrieved successfully",
  "data": {
    "documents": [
      {
        "id": 1,
        "student_id": 123,
        "student_name": "John Doe",
        "student_email": "john@example.com",
        "matric_number": "STU001",
        "document_type": "birth_certificate",
        "file_url": "https://...",
        "uploaded_at": "2024-01-01T12:00:00.000Z"
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

### Step 4: Admin Views Specific Student's Documents

**Endpoint:** `GET /api/admin/students/:id/kyc`

**Response includes approval status:**
```json
{
  "success": true,
  "data": {
    "student": {
      "id": 123,
      "name": "John Doe",
      "email": "john@example.com",
      "matric_number": "STU001"
    },
    "profile_image": {
      "url": "https://...",
      "status": "pending",
      "rejection_reason": null,
      "reviewed_at": null,
      "reviewed_by": null
    },
    "documents": {
      "birth_certificate": {
        "url": "https://...",
        "status": "approved",
        "rejection_reason": null,
        "reviewed_at": "2024-01-02T10:00:00.000Z",
        "reviewed_by": 1
      }
    }
  }
}
```

---

### Step 5: Admin Approves Document

**Endpoint:** `PUT /api/admin/students/:id/kyc/documents/:document_type/approve`

**Request:**
- URL Parameters: `id` (student_id), `document_type`
- No body required

**Response:**
```json
{
  "success": true,
  "message": "Document approved successfully",
  "data": {
    "student_id": 123,
    "document_type": "birth_certificate",
    "status": "approved",
    "reviewed_by": 1,
    "reviewed_at": "2024-01-02T10:00:00.000Z"
  }
}
```

**What happens:**
- Approval record status updated to `approved`
- `reviewed_by` set to admin ID
- `reviewed_at` set to current timestamp
- Student can now see status as `approved`

---

### Step 6: Admin Rejects Document

**Endpoint:** `PUT /api/admin/students/:id/kyc/documents/:document_type/reject`

**Request Body:**
```json
{
  "rejection_reason": "Document is unclear. Please upload a clearer version with better lighting."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Document rejected successfully",
  "data": {
    "student_id": 123,
    "document_type": "ref_letter",
    "status": "rejected",
    "rejection_reason": "Document is unclear. Please upload a clearer version with better lighting.",
    "reviewed_by": 1,
    "reviewed_at": "2024-01-02T11:00:00.000Z"
  }
}
```

**What happens:**
- Approval record status updated to `rejected`
- `rejection_reason` saved
- `reviewed_by` set to admin ID
- `reviewed_at` set to current timestamp
- Student can see status as `rejected` with the reason

---

## 📊 Document Status Values

- **`pending`** - Document uploaded, awaiting admin review
- **`approved`** - Admin approved the document
- **`rejected`** - Admin rejected the document (with reason)

---

## 🔑 Admin Endpoints Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/students/kyc/pending` | GET | Get all pending documents for review |
| `/api/admin/students/:id/kyc` | GET | Get specific student's KYC documents with approval status |
| `/api/admin/students/:id/kyc/documents/:document_type/approve` | PUT | Approve a document |
| `/api/admin/students/:id/kyc/documents/:document_type/reject` | PUT | Reject a document (requires rejection_reason) |
| `/api/admin/students/kyc/status` | GET | Get KYC status for all students |
| `/api/admin/students/:id/kyc/signed-url` | POST | Get signed URL for private bucket documents |

---

## 📝 Student Endpoints Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/student/kyc/profile-image` | POST | Upload profile image (status: pending) |
| `/api/student/kyc/documents` | POST | Upload KYC document (status: pending) |
| `/api/student/kyc/documents` | GET | Get all documents with approval status |
| `/api/student/kyc/schools` | PUT | Update school information |

---

## 🗄️ Database Structure

### `student_document_approvals` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `student_id` | INTEGER | Foreign key to students |
| `document_type` | ENUM | Type of document |
| `status` | ENUM | `pending`, `approved`, `rejected` |
| `rejection_reason` | TEXT | Reason if rejected |
| `reviewed_by` | INTEGER | Admin ID who reviewed |
| `reviewed_at` | TIMESTAMP | When reviewed |
| `file_url` | VARCHAR(500) | URL of the document |
| `created_at` | TIMESTAMP | When uploaded |
| `updated_at` | TIMESTAMP | Last updated |

**Unique Constraint:** `(student_id, document_type)` - One approval record per document type per student

---

## 🔄 Re-upload After Rejection

When a student's document is rejected:
1. Student sees the rejection reason
2. Student can upload a new document (same endpoint)
3. New upload creates a new approval record with status: `pending`
4. Previous rejection reason is cleared
5. Admin can review the new upload

---

## 📋 Migration Required

Before using the approval workflow, run:

```bash
node scripts/migrate-student-document-approvals.js
```

This creates the `student_document_approvals` table in your database.

---

## ✅ Status Flow Diagram

```
Upload → pending → [Admin Review] → approved ✅
                          ↓
                      rejected ❌ (with reason)
                          ↓
                    [Student Re-uploads] → pending → ...
```

---

## 🎯 Frontend Implementation Notes

### For Students:
- Show status badge: `pending` (yellow), `approved` (green), `rejected` (red)
- If rejected, display rejection reason prominently
- Allow re-upload if rejected
- Show "Pending approval" message when status is pending

### For Admins:
- Show pending documents queue
- Display document preview/URL
- Approve/Reject buttons with reason input for reject
- Show review history (who reviewed, when)

---

**Last Updated:** January 2024

