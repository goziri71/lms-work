# E-Book Marketplace Implementation Guide

## Overview

This document provides a comprehensive guide for implementing and using the e-book marketplace feature in the LenerMe platform. The e-book marketplace allows tutors (sole tutors and organizations) to create, manage, and sell PDF e-books to students.

---

## Table of Contents

1. [Database Setup](#database-setup)
2. [Features Overview](#features-overview)
3. [Tutor Endpoints](#tutor-endpoints)
4. [Student Endpoints](#student-endpoints)
5. [File Upload Implementation](#file-upload-implementation)
6. [Purchase Flow](#purchase-flow)
7. [Revenue Sharing](#revenue-sharing)
8. [Testing Guide](#testing-guide)

---

## Database Setup

### Step 1: Run Migration Script

Execute the migration script to create the necessary database tables:

```bash
node scripts/migrate-create-ebooks-tables.js
```

This will create:
- `ebooks` table: Stores e-book information
- `ebook_purchases` table: Tracks student purchases

### Step 2: Verify Tables

After running the migration, verify the tables were created:

```sql
-- Check ebooks table
SELECT * FROM information_schema.tables WHERE table_name = 'ebooks';

-- Check ebook_purchases table
SELECT * FROM information_schema.tables WHERE table_name = 'ebook_purchases';
```

---

## Features Overview

### For Tutors

- ✅ Create e-books with PDF files
- ✅ Manage e-book details (title, description, author, price, etc.)
- ✅ Upload cover images
- ✅ Set categories and tags
- ✅ Publish/unpublish e-books
- ✅ View sales statistics
- ✅ Track earnings from e-book sales

### For Students

- ✅ Browse published e-books
- ✅ Search and filter e-books
- ✅ View e-book details
- ✅ Purchase e-books using wallet balance
- ✅ Access purchased e-books library
- ✅ Download PDF files after purchase

---

## Tutor Endpoints

### Base URL
All tutor endpoints are prefixed with: `/api/marketplace/tutor`

### Authentication
All endpoints require tutor authentication:
```
Authorization: Bearer <tutor_token>
```

### 1. Get My E-Books

**Endpoint:** `GET /api/marketplace/tutor/ebooks`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `status` (optional): Filter by status (`draft` or `published`)
- `search` (optional): Search by title, author, or description

**Response:**
```json
{
  "success": true,
  "message": "E-books retrieved successfully",
  "data": {
    "ebooks": [
      {
        "id": 1,
        "title": "Introduction to JavaScript",
        "author": "John Doe",
        "pages": 250,
        "price": 5000.0,
        "currency": "NGN",
        "cover_image": "https://...",
        "category": "Technology",
        "tags": ["javascript", "programming"],
        "status": "published",
        "sales_count": 15,
        "created_at": "2024-01-15T10:00:00Z",
        "updated_at": "2024-01-15T10:00:00Z"
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

### 2. Get Single E-Book

**Endpoint:** `GET /api/marketplace/tutor/ebooks/:id`

**Response:**
```json
{
  "success": true,
  "message": "E-book retrieved successfully",
  "data": {
    "ebook": {
      "id": 1,
      "title": "Introduction to JavaScript",
      "description": "A comprehensive guide...",
      "author": "John Doe",
      "pages": 250,
      "price": 5000.0,
      "currency": "NGN",
      "pdf_url": "https://...",
      "cover_image": "https://...",
      "category": "Technology",
      "tags": ["javascript", "programming"],
      "status": "published",
      "sales_count": 15,
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

### 3. Create E-Book

**Endpoint:** `POST /api/marketplace/tutor/ebooks`

**Request Body:**
```json
{
  "title": "Introduction to JavaScript",
  "description": "A comprehensive guide to JavaScript programming",
  "author": "John Doe",
  "pages": 250,
  "price": 5000.0,
  "currency": "NGN",
  "pdf_url": "https://supabase.co/storage/v1/object/public/ebooks/...",
  "cover_image": "https://supabase.co/storage/v1/object/public/ebooks/...",
  "category": "Technology",
  "tags": ["javascript", "programming", "web"],
  "status": "draft"
}
```

**Required Fields:**
- `title`: E-book title
- `pdf_url`: URL of the PDF file in Supabase storage

**Optional Fields:**
- `description`: E-book description
- `author`: Author name
- `pages`: Number of pages
- `price`: Price (default: 0 for free e-books)
- `currency`: Currency code (default: "NGN")
- `cover_image`: Cover image URL
- `category`: Category name
- `tags`: Array of tags
- `status`: "draft" or "published" (default: "draft")

**Response:**
```json
{
  "success": true,
  "message": "E-book created successfully",
  "data": {
    "ebook": {
      "id": 1,
      "title": "Introduction to JavaScript",
      "author": "John Doe",
      "price": 5000.0,
      "status": "draft"
    }
  }
}
```

### 4. Update E-Book

**Endpoint:** `PUT /api/marketplace/tutor/ebooks/:id`

**Request Body:** (Same as create, all fields optional)

**Response:**
```json
{
  "success": true,
  "message": "E-book updated successfully",
  "data": {
    "ebook": {
      "id": 1,
      "title": "Introduction to JavaScript",
      "author": "John Doe",
      "price": 5000.0,
      "status": "published"
    }
  }
}
```

### 5. Delete E-Book

**Endpoint:** `DELETE /api/marketplace/tutor/ebooks/:id`

**Validation:**
- Cannot delete e-books with existing sales
- Use unpublish instead if e-book has sales

**Response:**
```json
{
  "success": true,
  "message": "E-book deleted successfully"
}
```

### 6. Update E-Book Status

**Endpoint:** `PATCH /api/marketplace/tutor/ebooks/:id/status`

**Request Body:**
```json
{
  "status": "published"
}
```

**Valid Values:**
- `draft`: Unpublish the e-book
- `published`: Publish the e-book

**Validation:**
- To publish, e-book must have a valid price (>= 0) and PDF URL

**Response:**
```json
{
  "success": true,
  "message": "E-book published successfully",
  "data": {
    "ebook": {
      "id": 1,
      "title": "Introduction to JavaScript",
      "status": "published"
    }
  }
}
```

---

## Student Endpoints

### Base URL
All student endpoints are prefixed with: `/api/marketplace`

### Authentication
All endpoints require student authentication:
```
Authorization: Bearer <student_token>
```

### 1. Browse E-Books

**Endpoint:** `GET /api/marketplace/ebooks`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `search` (optional): Search by title, author, or description
- `category` (optional): Filter by category
- `owner_id` (optional): Filter by tutor/organization ID
- `owner_type` (optional): Filter by owner type (`sole_tutor` or `organization`)
- `min_price` (optional): Minimum price filter
- `max_price` (optional): Maximum price filter
- `sort` (optional): Sort order (`newest`, `oldest`, `price_low`, `price_high`, `popular`)

**Response:**
```json
{
  "success": true,
  "message": "E-books retrieved successfully",
  "data": {
    "ebooks": [
      {
        "id": 1,
        "title": "Introduction to JavaScript",
        "description": "A comprehensive guide...",
        "author": "John Doe",
        "pages": 250,
        "price": 5000.0,
        "currency": "NGN",
        "cover_image": "https://...",
        "category": "Technology",
        "tags": ["javascript", "programming"],
        "sales_count": 15,
        "owner": {
          "id": 1,
          "name": "John Doe",
          "type": "sole_tutor"
        },
        "created_at": "2024-01-15T10:00:00Z"
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    }
  }
}
```

### 2. Get Single E-Book

**Endpoint:** `GET /api/marketplace/ebooks/:id`

**Response:**
```json
{
  "success": true,
  "message": "E-book retrieved successfully",
  "data": {
    "ebook": {
      "id": 1,
      "title": "Introduction to JavaScript",
      "description": "A comprehensive guide...",
      "author": "John Doe",
      "pages": 250,
      "price": 5000.0,
      "currency": "NGN",
      "cover_image": "https://...",
      "category": "Technology",
      "tags": ["javascript", "programming"],
      "sales_count": 15,
      "owner": {
        "id": 1,
        "name": "John Doe",
        "type": "sole_tutor",
        "bio": "Experienced developer..."
      },
      "is_purchased": false,
      "created_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

**Note:** `is_purchased` indicates if the authenticated student has already purchased this e-book.

### 3. Get My Purchased E-Books

**Endpoint:** `GET /api/marketplace/ebooks/my-ebooks`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `search` (optional): Search by title or author

**Response:**
```json
{
  "success": true,
  "message": "Purchased e-books retrieved successfully",
  "data": {
    "ebooks": [
      {
        "id": 1,
        "title": "Introduction to JavaScript",
        "description": "A comprehensive guide...",
        "author": "John Doe",
        "pages": 250,
        "cover_image": "https://...",
        "category": "Technology",
        "tags": ["javascript", "programming"],
        "pdf_url": "https://...",
        "purchased_at": "2024-01-20T10:00:00Z",
        "purchase_price": 5000.0,
        "purchase_currency": "NGN"
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

**Note:** The `pdf_url` is only included in the "my-ebooks" endpoint for purchased e-books.

### 4. Purchase E-Book

**Endpoint:** `POST /api/marketplace/ebooks/purchase`

**Request Body:**
```json
{
  "ebook_id": 1
}
```

**Purchase Flow:**
1. Validates e-book exists and is published
2. Checks if student already owns the e-book
3. Converts price to student's currency if needed
4. Checks wallet balance
5. Debits wallet (if price > 0)
6. Creates purchase record
7. Updates e-book sales count
8. Distributes revenue (commission to WPU, earnings to tutor)

**Response (Paid E-Book):**
```json
{
  "success": true,
  "message": "E-book purchased successfully",
  "data": {
    "purchase": {
      "ebook_id": 1,
      "price": 5000.0,
      "currency": "NGN",
      "transaction_ref": "EBOOK-1-1705747200000"
    },
    "wallet": {
      "previous_balance": 10000.0,
      "new_balance": 5000.0,
      "debited": 5000.0,
      "currency": "NGN",
      "ebook_price_original": null
    }
  }
}
```

**Response (Free E-Book):**
```json
{
  "success": true,
  "message": "Free e-book added to your library",
  "data": {
    "purchase": {
      "ebook_id": 1,
      "price": 0,
      "currency": "NGN",
      "transaction_ref": "EBOOK-FREE-1-1705747200000"
    }
  }
}
```

---

## File Upload Implementation

### PDF Upload

Tutors need to upload PDF files to Supabase storage before creating e-books. Here's a recommended implementation:

**1. Create Upload Endpoint (Recommended)**

Add to `src/controllers/marketplace/tutorEbookManagement.js`:

```javascript
import multer from "multer";
import { supabase } from "../../utils/supabase.js";

const uploadPDF = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"), false);
    }
  },
});

export const uploadEBookPDF = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;

  if (!req.file) {
    throw new ErrorClass("PDF file is required", 400);
  }

  const bucket = process.env.EBOOKS_BUCKET || "ebooks";
  const objectPath = `tutors/${tutorId}/${Date.now()}_${req.file.originalname}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(objectPath, req.file.buffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (error) {
    throw new ErrorClass(`Upload failed: ${error.message}`, 500);
  }

  // Generate public URL
  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(objectPath);

  res.status(200).json({
    success: true,
    message: "PDF uploaded successfully",
    data: {
      pdf_url: urlData.publicUrl,
      file_path: objectPath,
    },
  });
});
```

**2. Add Route**

In `src/routes/marketplace.js`:

```javascript
import { uploadEBookPDF } from "../controllers/marketplace/tutorEbookManagement.js";
import { uploadPDF } from "../controllers/marketplace/tutorEbookManagement.js";

router.post(
  "/tutor/ebooks/upload-pdf",
  tutorAuthorize,
  uploadPDF.single("pdf"),
  uploadEBookPDF
);
```

**3. Cover Image Upload**

Similar implementation for cover images (JPEG/PNG):

```javascript
const uploadCoverImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG and PNG images are allowed"), false);
    }
  },
});
```

### Supabase Bucket Setup

1. Create a bucket named `ebooks` in Supabase Storage
2. Set bucket to **public** if you want direct access, or **private** with signed URLs
3. Configure CORS if needed for frontend uploads

---

## Purchase Flow

### Step-by-Step Process

1. **Student browses e-books** → `GET /api/marketplace/ebooks`
2. **Student views e-book details** → `GET /api/marketplace/ebooks/:id`
3. **Student initiates purchase** → `POST /api/marketplace/ebooks/purchase`
4. **System validates:**
   - E-book exists and is published
   - Student doesn't already own it
   - Wallet has sufficient balance (if price > 0)
5. **Payment processing:**
   - Convert price to student's currency
   - Debit wallet (if price > 0)
   - Create Funding transaction record
   - Update student wallet balance
6. **Purchase recording:**
   - Create EBookPurchase record
   - Update e-book sales count
   - Distribute revenue (commission + tutor earnings)
7. **Response sent to student**

### Currency Conversion

The system automatically converts prices:
- **USD → NGN**: Multiply by exchange rate
- **NGN → USD**: Divide by exchange rate
- Exchange rate is fetched from `GeneralSetup.rate`

---

## Revenue Sharing

### Commission Structure

- **WPU Commission**: 15% (configurable via `MARKETPLACE_COMMISSION_RATE` env var)
- **Tutor Earnings**: 85% (remaining after commission)

### Example Calculation

For an e-book priced at **10,000 NGN**:
- **WPU Commission**: 1,500 NGN (15%)
- **Tutor Earnings**: 8,500 NGN (85%)

### Revenue Tracking

Revenue is tracked in the `ebook_purchases` table:
- `wsp_commission`: Amount WPU receives
- `tutor_earnings`: Amount tutor/organization receives
- `commission_rate`: Commission percentage at time of purchase

---

## Testing Guide

### 1. Tutor E-Book Management

**Test Create E-Book:**
```bash
curl -X POST http://localhost:3000/api/marketplace/tutor/ebooks \
  -H "Authorization: Bearer <tutor_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test E-Book",
    "description": "Test description",
    "author": "Test Author",
    "price": 5000,
    "currency": "NGN",
    "pdf_url": "https://example.com/test.pdf",
    "status": "draft"
  }'
```

**Test Publish E-Book:**
```bash
curl -X PATCH http://localhost:3000/api/marketplace/tutor/ebooks/1/status \
  -H "Authorization: Bearer <tutor_token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "published"}'
```

### 2. Student Browsing

**Test Browse E-Books:**
```bash
curl -X GET "http://localhost:3000/api/marketplace/ebooks?page=1&limit=20" \
  -H "Authorization: Bearer <student_token>"
```

**Test Purchase E-Book:**
```bash
curl -X POST http://localhost:3000/api/marketplace/ebooks/purchase \
  -H "Authorization: Bearer <student_token>" \
  -H "Content-Type: application/json" \
  -d '{"ebook_id": 1}'
```

### 3. Test Scenarios

- ✅ Create e-book as draft
- ✅ Publish e-book
- ✅ Update e-book details
- ✅ Browse published e-books
- ✅ Purchase paid e-book
- ✅ Purchase free e-book
- ✅ View purchased e-books library
- ✅ Prevent duplicate purchases
- ✅ Currency conversion (USD ↔ NGN)
- ✅ Wallet balance validation

---

## Module & Unit Management

### Tutor Endpoints for Course Modules/Units

Tutors can now manage modules and units for their marketplace courses:

**Base URL:** `/api/marketplace/tutor`

#### Module Management

- `POST /courses/:courseId/modules` - Create module
- `GET /courses/:courseId/modules` - Get all modules for a course
- `PATCH /modules/:moduleId` - Update module
- `DELETE /modules/:moduleId` - Delete module

#### Unit Management

- `POST /modules/:moduleId/units` - Create unit
- `GET /modules/:moduleId/units` - Get all units for a module
- `PATCH /units/:unitId` - Update unit
- `DELETE /units/:unitId` - Delete unit

**Example: Create Module**
```json
POST /api/marketplace/tutor/courses/123/modules
{
  "title": "Module 1: Introduction",
  "description": "Introduction to the course",
  "status": "draft"
}
```

**Example: Create Unit**
```json
POST /api/marketplace/tutor/modules/456/units
{
  "title": "Unit 1.1: Getting Started",
  "content": "<p>Content here...</p>",
  "content_type": "html",
  "order": 1,
  "status": "draft"
}
```

---

## Environment Variables

Add to your `.env` file:

```env
# E-Books Configuration
EBOOKS_BUCKET=ebooks
MARKETPLACE_COMMISSION_RATE=15
```

---

## Troubleshooting

### Common Issues

1. **"E-book not found"**
   - Verify e-book exists and tutor owns it
   - Check e-book status (must be published for students)

2. **"Insufficient wallet balance"**
   - Student needs to fund wallet first
   - Check currency conversion is correct

3. **"You already own this e-book"**
   - Student has already purchased this e-book
   - Check `ebook_purchases` table

4. **PDF upload fails**
   - Verify Supabase bucket exists
   - Check file size limits (50MB default)
   - Verify bucket permissions

---

## Next Steps

1. ✅ Run database migration
2. ✅ Set up Supabase bucket for e-books
3. ✅ Implement PDF upload endpoint (optional but recommended)
4. ✅ Test tutor e-book creation
5. ✅ Test student browsing and purchase
6. ✅ Update frontend to integrate e-book features

---

## Support

For issues or questions:
- Check API documentation in `TUTOR_DASHBOARD_API.md`
- Review error messages in server logs
- Verify database tables exist and have correct structure

---

**Last Updated:** 2024-01-20
**Version:** 1.0.0

