# API Endpoints: Changes and New Features Documentation

This document outlines all **modified endpoints** (existing endpoints that changed) and **new endpoints** (completely new features) for the frontend team.

---

## 📋 Table of Contents

1. [Modified Endpoints](#modified-endpoints)
2. [New Features & Endpoints](#new-features--endpoints)
3. [Frontend Implementation Checklist](#frontend-implementation-checklist)

---

## 🔄 Modified Endpoints

### 1. **Membership Management** (`/api/marketplace/memberships`)

#### **POST `/api/marketplace/memberships`** - Create Membership
**CHANGES:**
- **NEW:** Now accepts `tiers` array in request body
- **NEW:** Automatically generates `slug` field
- **NEW:** Supports `is_featured`, `featured_at` fields

**Request Body (Updated):**
```json
{
  "name": "Premium Membership",
  "description": "...",
  "pricing_type": "tier_based", // NEW: Can be "tier_based" or "flat"
  "price": 0, // Ignored if tier_based
  "tiers": [ // NEW: Array of tier objects
    {
      "tier_name": "Basic",
      "description": "Basic tier access",
      "monthly_price": 5000,
      "yearly_price": 50000,
      "lifetime_price": 150000,
      "currency": "NGN",
      "display_order": 1
    },
    {
      "tier_name": "Premium",
      "monthly_price": 10000,
      "yearly_price": 100000,
      "lifetime_price": 300000,
      "display_order": 2
    }
  ],
  "slug": "auto-generated", // NEW: Auto-generated if not provided
  "is_featured": false, // NEW
  "cover_image_url": "..."
}
```

**Response (Updated):**
```json
{
  "success": true,
  "data": {
    "membership": {
      "id": 1,
      "name": "Premium Membership",
      "slug": "premium-membership", // NEW
      "tiers": [...], // NEW: Array of created tiers
      "is_featured": false, // NEW
      ...
    }
  }
}
```

#### **GET `/api/marketplace/memberships/:id`** - Get Membership Details
**CHANGES:**
- **NEW:** Response now includes `tiers` array with full tier details
- **NEW:** Includes `slug` field

**Response (Updated):**
```json
{
  "success": true,
  "data": {
    "membership": {
      "id": 1,
      "name": "...",
      "slug": "...", // NEW
      "tiers": [ // NEW
        {
          "id": 1,
          "tier_name": "Basic",
          "monthly_price": 5000,
          "yearly_price": 50000,
          "lifetime_price": 150000,
          "products": [...] // Products assigned to this tier
        }
      ],
      ...
    }
  }
}
```

### 2. **Membership Subscription** (`/api/marketplace/memberships/:id/subscribe`)

#### **POST `/api/marketplace/memberships/:id/subscribe`** - Subscribe to Membership
**CHANGES:**
- **REQUIRED:** Now requires `tier_id` and `pricing_type` in request body
- **NEW:** Response includes tier information

**Request Body (Updated):**
```json
{
  "tier_id": 1, // NEW: Required - ID of the tier to subscribe to
  "pricing_type": "monthly", // NEW: Required - "monthly", "yearly", or "lifetime"
  "payment_method": "wallet"
}
```

**Response (Updated):**
```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": 1,
      "tier_id": 1, // NEW
      "tier_name": "Basic", // NEW
      "pricing_type": "monthly", // NEW
      ...
    }
  }
}
```

### 3. **Tutor Wallet** (`/api/marketplace/tutor/wallet`)

#### **GET `/api/marketplace/tutor/wallet`** - Get Wallet Balance
**CHANGES:**
- **NEW:** Response now returns 3 currency balances instead of 1
- **NEW:** Includes `local_currency` field

**Response (Updated):**
```json
{
  "success": true,
  "data": {
    "wallet": {
      "primary_balance": 100000.00, // NEW: Local currency balance
      "primary_currency": "NGN", // NEW
      "usd_balance": 500.00, // NEW
      "gbp_balance": 300.00, // NEW
      "total_ngn_equivalent": 150000.00 // NEW: Total in NGN
    }
  }
}
```

#### **POST `/api/marketplace/tutor/wallet/fund`** - Fund Wallet
**CHANGES:**
- **NEW:** Automatically credits the correct wallet based on `currency` field
- **NEW:** Supports funding in NGN, USD, or GBP

**Request Body (Updated):**
```json
{
  "amount": 1000,
  "currency": "USD", // NEW: Can be "NGN", "USD", or "GBP"
  "payment_reference": "..."
}
```

### 4. **Product Models** (Courses, EBooks, Digital Downloads, Communities, Memberships)

**CHANGES:**
- **NEW:** All product responses now include `slug` field
- **NEW:** All product responses include `is_featured`, `featured_at`, `popularity_score`, `sales_count` fields

**Example Response (All Products):**
```json
{
  "id": 1,
  "title": "Course Title",
  "slug": "course-title", // NEW
  "is_featured": false, // NEW
  "featured_at": null, // NEW
  "popularity_score": 85.5, // NEW
  "sales_count": 150, // NEW
  ...
}
```

### 5. **Community Management** (`/api/marketplace/tutor/communities`)

#### **POST `/api/marketplace/tutor/communities`** - Create Community
**CHANGES:**
- **NEW:** Accepts `intro_video_url` and `intro_video_thumbnail_url` fields
- **NEW:** Supports file uploads for intro video and thumbnail
- **NEW:** `category` enum expanded with "Religious and Faith" and "Social and Impact"
- **NEW:** Auto-generates `slug` field

**Request Body (Updated):**
```json
{
  "name": "Community Name",
  "category": "Religious and Faith", // NEW: Can include new categories
  "intro_video_url": "https://...", // NEW: Optional
  "intro_video_thumbnail_url": "https://...", // NEW: Optional
  "slug": "auto-generated", // NEW
  ...
}
```

**Multipart Form Data (Updated):**
- `intro_video` - Video file (optional, max 100MB)
- `intro_video_thumbnail` - Image file (optional, max 5MB)

---

## ✨ New Features & Endpoints

### Feature 1: **Membership Tier System**

#### **Tier Management Endpoints**

**GET `/api/marketplace/tutor/memberships/:id/tiers`** - Get All Tiers
```json
{
  "success": true,
  "data": {
    "tiers": [
      {
        "id": 1,
        "tier_name": "Basic",
        "description": "...",
        "monthly_price": 5000,
        "yearly_price": 50000,
        "lifetime_price": 150000,
        "currency": "NGN",
        "display_order": 1,
        "status": "active",
        "products": [...] // Products in this tier
      }
    ]
  }
}
```

**POST `/api/marketplace/tutor/memberships/:id/tiers`** - Create Tier
```json
// Request
{
  "tier_name": "Premium",
  "description": "...",
  "monthly_price": 10000,
  "yearly_price": 100000,
  "lifetime_price": 300000,
  "currency": "NGN",
  "display_order": 2
}
```

**GET `/api/marketplace/tutor/memberships/:id/tiers/:tierId`** - Get Single Tier

**PUT `/api/marketplace/tutor/memberships/:id/tiers/:tierId`** - Update Tier

**DELETE `/api/marketplace/tutor/memberships/:id/tiers/:tierId`** - Delete Tier

**POST `/api/marketplace/tutor/memberships/:id/tiers/products`** - Bulk Assign Products to Tiers
```json
// Request
{
  "products": [
    {
      "tier_id": 1,
      "product_type": "course",
      "product_id": 1,
      "monthly_access_level": "View lessons only",
      "yearly_access_level": "View lessons + assignments",
      "lifetime_access_level": "All features + bonus content"
    }
  ]
}
```

**POST `/api/marketplace/tutor/memberships/:id/tiers/:tierId/products`** - Assign Single Product to Tier
```json
// Request
{
  "products": [
    {
      "product_type": "course",
      "product_id": 1,
      "monthly_access_level": "View lessons only",
      "yearly_access_level": "View lessons + assignments",
      "lifetime_access_level": "All features + bonus content"
    }
  ]
}
```

**PUT `/api/marketplace/memberships/:id/tiers/:tierId/products/:productType/:productId`** - Update Product Access Level

**DELETE `/api/marketplace/tutor/memberships/:id/tiers/:tierId/products/:productId`** - Remove Product from Tier

**POST `/api/marketplace/memberships/:id/change-tier`** - Change Tier (Upgrade/Downgrade)
```json
// Request
{
  "subscription_id": 1, // Optional if user has only one subscription
  "new_tier_id": 2,
  "pricing_type": "monthly" // Must match subscription period
}
```

**GET `/api/marketplace/memberships/my-subscriptions`** - Get My Subscriptions
```json
// Get all membership subscriptions for authenticated student
{
  "success": true,
  "data": {
    "subscriptions": [
      {
        "id": 1,
        "membership_id": 1,
        "membership_name": "Premium Membership",
        "tier_id": 1,
        "tier_name": "Basic",
        "pricing_type": "monthly",
        "status": "active",
        ...
      }
    ]
  }
}
```

**POST `/api/marketplace/memberships/:id/cancel`** - Cancel Subscription
```json
// Cancels the membership subscription
{
  "success": true,
  "message": "Subscription cancelled successfully"
}
```

**GET `/api/marketplace/products/:productType/:productId/access`** - Check Product Access
```json
// Check if authenticated student has access to a product
// Query: ?product_type=course&product_id=1
// Response
{
  "success": true,
  "data": {
    "has_access": true,
    "access_type": "purchased", // "purchased", "membership", "none"
    "membership_tier": {
      "id": 1,
      "tier_name": "Basic",
      "access_level": "View lessons only"
    }
  }
}
```
```json
// Request
{
  "subscription_id": 1, // Optional if user has only one subscription
  "new_tier_id": 2,
  "pricing_type": "monthly" // Must match subscription period
}
```
```json
// Request
{
  "new_tier_id": 2,
  "pricing_type": "monthly" // Must match subscription period
}
```

---

### Feature 2: **Multi-Currency Wallet System**

**POST `/api/marketplace/tutor/wallet/convert`** - Convert Currency
```json
// Request
{
  "from_currency": "NGN",
  "to_currency": "USD",
  "amount": 100000
}

// Response
{
  "success": true,
  "data": {
    "from_amount": 100000,
    "to_amount": 125.50,
    "exchange_rate": 0.001255,
    "conversion_fee": 0,
    "converted_at": "2024-01-15T10:30:00Z"
  }
}
```

**GET `/api/marketplace/tutor/wallet/convert/rate`** - Get Exchange Rate
```json
// Query: ?from=NGN&to=USD
{
  "success": true,
  "data": {
    "from_currency": "NGN",
    "to_currency": "USD",
    "rate": 0.001255,
    "updated_at": "2024-01-15T10:00:00Z"
  }
}
```

**GET `/api/marketplace/tutor/wallet/convert/history`** - Get Conversion History
```json
{
  "success": true,
  "data": {
    "conversions": [...],
    "pagination": {...}
  }
}
```

---

### Feature 3: **Product Links (Public Product Pages)**

**GET `/api/public/product/:slug`** - Get Product by Slug (Public)
```json
// No authentication required
{
  "success": true,
  "data": {
    "product_type": "course",
    "product": {
      "id": 1,
      "title": "Course Title",
      "slug": "course-title",
      "price": 5000,
      ...
    }
  }
}
```

**Note:** All product creation/update endpoints now auto-generate `slug` field.

---

### Feature 4: **Product Reviews**

**POST `/api/marketplace/reviews`** - Create Review
```json
// Request
{
  "product_type": "course",
  "product_id": 1,
  "rating": 5,
  "title": "Great course!",
  "comment": "Very helpful content"
}

// Response includes is_verified_purchaser flag
```

**GET `/api/marketplace/reviews`** - Get Product Reviews
```json
// Query: ?product_type=course&product_id=1&page=1&limit=10
{
  "success": true,
  "data": {
    "reviews": [
      {
        "id": 1,
        "rating": 5,
        "title": "...",
        "comment": "...",
        "is_verified_purchaser": true,
        "helpful_count": 10,
        "student": {...}
      }
    ],
    "statistics": {
      "average_rating": 4.5,
      "total_reviews": 100,
      "rating_distribution": {
        "5": 60,
        "4": 25,
        "3": 10,
        "2": 3,
        "1": 2
      }
    }
  }
}
```

**GET `/api/marketplace/reviews/my-review`** - Get My Review for Product
```json
// Query: ?product_type=course&product_id=1
// Returns the authenticated student's review for a specific product
```

**POST `/api/marketplace/reviews/:id/helpful`** - Mark Review as Helpful
```json
// Request
{
  "is_helpful": true
}
```

---

### Feature 5: **Store System (E-commerce)**

**GET `/api/marketplace/store/products`** - Browse Store (Public)
```json
// No authentication required
// Query: ?type=course&category=Technology&page=1&limit=20
{
  "success": true,
  "data": {
    "products": [...],
    "pagination": {...}
  }
}
```

**GET `/api/marketplace/store/products/:type/:id`** - Get Store Product (Public)

**GET `/api/marketplace/store/cart`** - Get Cart
```json
// Returns guest cart (by session_id) or user cart
{
  "success": true,
  "data": {
    "cart": {
      "id": 1,
      "items": [
        {
          "id": 1,
          "product_type": "course",
          "product_id": 1,
          "product_name": "Course Title",
          "quantity": 1,
          "price": 5000,
          "currency": "NGN"
        }
      ],
      "total": 5000,
      "currency": "NGN"
    }
  }
}
```

**POST `/api/marketplace/store/cart/add`** - Add to Cart
```json
// Request
{
  "product_type": "course",
  "product_id": 1,
  "quantity": 1
}
```

**PUT `/api/marketplace/store/cart/item/:id`** - Update Cart Item

**DELETE `/api/marketplace/store/cart/item/:id`** - Remove from Cart

**POST `/api/marketplace/store/cart/merge`** - Merge Guest Cart with User Cart (Auth Required)
```json
// Merges guest cart (by session_id) with authenticated user's cart
// Request body can include session_id if needed
```

**DELETE `/api/marketplace/store/cart`** - Clear Cart

**POST `/api/marketplace/store/checkout`** - Initiate Checkout
```json
// Redirects to login/register if not authenticated
// Merges guest cart with user cart on login
```

---

### Feature 6: **Sales Pages**

**GET `/api/marketplace/tutor/sales-pages`** - Get My Sales Pages

**GET `/api/marketplace/tutor/sales-pages/:id/analytics`** - Get Sales Page Analytics
```json
// Response
{
  "success": true,
  "data": {
    "views_count": 1500,
    "conversions_count": 45,
    "conversion_rate": 3.0,
    "recent_views": [...]
  }
}
```

**POST `/api/marketplace/tutor/sales-pages`** - Create Sales Page
```json
// Request
{
  "product_type": "course",
  "product_id": 1,
  "title": "Amazing Course - Get Started Today!",
  "hero_image_url": "...",
  "hero_video_url": "...",
  "content": "...",
  "features": [
    {
      "title": "Feature 1",
      "description": "...",
      "icon": "✓"
    }
  ],
  "testimonials": [...],
  "faq": [...],
  "status": "draft"
}
```

**GET `/api/marketplace/tutor/sales-pages/:id`** - Get Sales Page

**PUT `/api/marketplace/tutor/sales-pages/:id`** - Update Sales Page

**DELETE `/api/marketplace/tutor/sales-pages/:id`** - Delete Sales Page

**GET `/api/public/sales/:slug`** - View Sales Page (Public)
```json
// No authentication required
// Tracks views and conversions
```

---

### Feature 7: **Top/Featured/Trending Products**

**GET `/api/marketplace/products/featured`** - Get Featured Products
```json
// No authentication required
// Query: ?type=course&limit=10
{
  "success": true,
  "data": {
    "products": [...]
  }
}
```

**GET `/api/marketplace/products/trending`** - Get Trending Products
```json
// Sorted by popularity_score
```

**GET `/api/marketplace/products/top`** - Get Top Products
```json
// Query: ?type=course&limit=20&sort_by=sales|rating|popularity
```

---

### Feature 8: **Read-Only Digital Downloads**

**POST `/api/marketplace/digital-downloads/:id/read-session`** - Create Read Session
```json
// Request
{
  "expires_in_hours": 24 // Optional, default 24
}

// Response
{
  "success": true,
  "data": {
    "session_token": "secure-token-here",
    "expires_at": "2024-01-16T10:30:00Z",
    "current_page": 1,
    "total_pages": null
  }
}
```
```json
// Request
{
  "expires_in_hours": 24 // Optional, default 24
}

// Response
{
  "success": true,
  "data": {
    "session_token": "secure-token-here",
    "expires_at": "2024-01-16T10:30:00Z"
  }
}
```

**GET `/api/marketplace/digital-downloads/:id/read-session`** - Get Reading Progress
```json
// Query: ?session_token=secure-token-here
// Response
{
  "success": true,
  "data": {
    "current_page": 5,
    "total_pages": 20,
    "progress_percentage": 25.0,
    "expires_at": "2024-01-16T10:30:00Z"
  }
}
```

**GET `/api/marketplace/digital-downloads/:id/read`** - Read Document (Stream)
```json
// Query: ?session_token=secure-token-here&page=1
// Returns PDF stream with security headers (no download)
// Public endpoint but requires valid session_token
```

**PUT `/api/marketplace/digital-downloads/:id/read-session`** - Update Reading Progress
```json
// Request
{
  "session_token": "secure-token-here",
  "current_page": 5,
  "progress_percentage": 25.5
}
```

**Note:** Digital Downloads model now includes `is_read_only` field.

---

### Feature 9: **Invoice System**

**GET `/api/marketplace/invoices`** - Get My Invoices
```json
// Query: ?page=1&limit=20&status=paid
{
  "success": true,
  "data": {
    "invoices": [
      {
        "id": 1,
        "invoice_number": "INV-2024-01-0001",
        "item_type": "course",
        "item_name": "Course Title",
        "total_amount": 5000,
        "currency": "NGN",
        "payment_status": "paid",
        "paid_at": "2024-01-15T10:30:00Z",
        "pdf_url": "https://..."
      }
    ],
    "pagination": {...}
  }
}
```

**GET `/api/marketplace/invoices/:id`** - Get Invoice Details

**GET `/api/marketplace/invoices/:id/download`** - Download Invoice PDF

**POST `/api/marketplace/invoices/:id/send`** - Send Invoice via Email

**Note:** Invoices are automatically generated for all purchases/subscriptions.

---

### Feature 10: **Donation System**

**GET `/api/marketplace/donations/categories`** - Get Donation Categories (Public)

**POST `/api/marketplace/donations`** - Create Donation
```json
// Request (optional auth for anonymous donations)
{
  "amount": 5000,
  "currency": "NGN",
  "category_id": 1,
  "message": "Thank you!",
  "visibility": "public", // "public", "private", "anonymous"
  "donor_name": "John Doe", // Required if not logged in
  "donor_email": "john@example.com"
}
```

**GET `/api/marketplace/donations/wall`** - Get Donation Wall (Public)
```json
// Shows only public donations
// Query: ?category_id=1&page=1&limit=50&sort=recent|amount_high|amount_low
{
  "success": true,
  "data": {
    "donations": [...],
    "total_donations": 500000,
    "pagination": {...}
  }
}
```

**GET `/api/marketplace/donations/statistics`** - Get Donation Statistics (Public)

**GET `/api/marketplace/donations/my-donations`** - Get My Donations (Auth Required)

---

### Feature 11: **Next of Kin**

**GET `/api/marketplace/next-of-kin`** - Get Next of Kin Info

**POST `/api/marketplace/next-of-kin`** - Create/Update Next of Kin
```json
// Request (multipart/form-data)
{
  "full_name": "Jane Doe",
  "relationship": "Spouse",
  "email": "jane@example.com",
  "phone_number": "+1234567890",
  "address": "...",
  "identification_type": "national_id",
  "identification_number": "123456789",
  "bank_account_name": "Jane Doe",
  "bank_account_number": "1234567890",
  "bank_name": "Bank Name",
  "bank_code": "123",
  "identification_document": <file> // Optional file upload
}
```

**PUT `/api/marketplace/next-of-kin`** - Update Next of Kin

**DELETE `/api/marketplace/next-of-kin`** - Delete Next of Kin

**Admin Endpoints:**
- `POST /api/admin/fund-transfers` - Initiate Fund Transfer
- `GET /api/admin/fund-transfers` - Get All Fund Transfers
- `GET /api/admin/fund-transfers/:id` - Get Fund Transfer Details
- `PUT /api/admin/fund-transfers/:id/complete` - Complete Fund Transfer
- `PUT /api/admin/fund-transfers/:id/cancel` - Cancel Fund Transfer

---

### Feature 12: **KYC for Sole Tutors**

**GET `/api/marketplace/tutor/kyc`** - Get KYC Status

**POST `/api/marketplace/tutor/kyc`** - Submit KYC
```json
// Request (multipart/form-data)
{
  "bvn": "12345678901",
  "national_id_type": "national_id",
  "national_id_number": "123456789",
  "national_id": <file>, // Optional
  "proof_of_address": <file>, // Optional
  "passport_photo": <file>, // Optional
  "additional_documents": "[{...}]" // JSON string
}

// Response includes BVN verification status
{
  "success": true,
  "data": {
    "kyc": {
      "id": 1,
      "status": "pending",
      "bvn_verified": true,
      "submitted_at": "2024-01-15T10:30:00Z"
    },
    "bvn_verification": {
      "verified": true,
      "requires_manual_verification": false
    }
  }
}
```

**PUT `/api/marketplace/tutor/kyc`** - Update KYC

**Admin Endpoints:**
- `GET /api/admin/tutor-kyc` - Get All KYC Submissions
- `GET /api/admin/tutor-kyc/stats` - Get KYC Statistics
- `GET /api/admin/tutor-kyc/:id` - Get KYC Submission Details
- `PUT /api/admin/tutor-kyc/:id/approve` - Approve KYC
- `PUT /api/admin/tutor-kyc/:id/reject` - Reject KYC
- `PUT /api/admin/tutor-kyc/:id/request-resubmission` - Request Resubmission

---

### Feature 13: **External File Storage (Google Drive)**

**GET `/api/marketplace/google-drive/connect`** - Initiate Google Drive Connection
```json
// Response
{
  "success": true,
  "data": {
    "authorization_url": "https://accounts.google.com/...",
    "state": "csrf-token-here"
  }
}
```

**GET `/api/marketplace/google-drive/callback`** - Handle OAuth Callback
```json
// Query: ?code=authorization-code&state=csrf-token
```

**GET `/api/marketplace/google-drive/connection`** - Get Connection Status

**DELETE `/api/marketplace/google-drive/connection`** - Disconnect Google Drive

**GET `/api/marketplace/google-drive/files`** - List Google Drive Files
```json
// Query: ?folderId=xxx&pageSize=50&pageToken=xxx
{
  "success": true,
  "data": {
    "files": [
      {
        "id": "google-drive-file-id",
        "name": "file.pdf",
        "mimeType": "application/pdf",
        "size": "1024000",
        "webViewLink": "https://...",
        "thumbnailLink": "https://..."
      }
    ],
    "next_page_token": "..."
  }
}
```

**POST `/api/marketplace/google-drive/import`** - Import Files from Google Drive
```json
// Request
{
  "file_ids": ["id1", "id2"], // OR
  "folder_id": "folder-id", // Import all files from folder
  "tags": ["tag1", "tag2"],
  "description": "Imported files"
}

// Response
{
  "success": true,
  "data": {
    "imported": 2,
    "failed": 0,
    "files": [...],
    "errors": []
  }
}
```

**GET `/api/marketplace/google-drive/files/imported`** - Get Imported Files
```json
// Query: ?page=1&limit=20&status=active&storage_type=google_drive
```

**GET `/api/marketplace/google-drive/files/:id`** - Get External File
```json
// Returns embed_url for embedding in frontend
{
  "success": true,
  "data": {
    "file": {
      "id": 1,
      "file_name": "file.pdf",
      "embed_url": "https://drive.google.com/file/d/.../preview",
      "external_file_url": "https://...",
      "thumbnail_url": "https://..."
    }
  }
}
```

**DELETE `/api/marketplace/google-drive/files/:id`** - Delete External File

**GET `/api/marketplace/read-sessions`** - Get My Read Sessions
```json
// Get all active read sessions for the authenticated student
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": 1,
        "digital_download_id": 1,
        "digital_download_name": "Book Title",
        "current_page": 5,
        "progress_percentage": 25.0,
        "expires_at": "2024-01-16T10:30:00Z"
      }
    ]
  }
}
```

---

## ✅ Frontend Implementation Checklist

### **Priority 1: Critical Changes (Must Update)**

- [ ] **Membership Subscription Flow**
  - Update subscription form to include tier selection
  - Display tier pricing (monthly/yearly/lifetime)
  - Show tier change (upgrade/downgrade) options

- [ ] **Wallet Display**
  - Update wallet UI to show 3 currency balances
  - Add currency conversion UI
  - Display exchange rates

- [ ] **Product Links**
  - Update all product URLs to use `slug` instead of `id`
  - Implement public product page route (`/p/:slug`)
  - Add share button with product link

### **Priority 2: New Features (High Value)**

- [ ] **Store System**
  - Implement guest cart (localStorage/sessionStorage)
  - Create store browsing page (public)
  - Add cart merge on login
  - Implement checkout flow

- [ ] **Product Reviews**
  - Add review section to product pages
  - Implement review form
  - Display review statistics
  - Add "helpful" vote functionality

- [ ] **Sales Pages**
  - Create sales page builder UI
  - Implement public sales page view
  - Add analytics tracking

- [ ] **Top Products**
  - Create featured products section
  - Add trending products widget
  - Display top products by category

### **Priority 3: Additional Features**

- [ ] **Read-Only Downloads**
  - Implement PDF viewer component
  - Add reading progress tracking
  - Disable download buttons for read-only files

- [ ] **Invoice System**
  - Add invoice list page
  - Implement PDF download
  - Add email sending functionality

- [ ] **Donation System**
  - Create donation form
  - Implement donation wall
  - Add donation statistics display

- [ ] **Next of Kin**
  - Add next of kin form in tutor settings
  - Implement document upload
  - Display connection status

- [ ] **KYC for Tutors**
  - Create KYC submission form
  - Add document upload UI
  - Display KYC status and admin feedback

- [ ] **Google Drive Integration**
  - Implement OAuth flow
  - Create file browser UI
  - Add bulk import functionality
  - Implement file embed viewer

---

## 🔧 Environment Variables Required

Add these to your `.env` file:

```env
# Google Drive OAuth
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/marketplace/google-drive/callback

# BVN Verification (Optional)
VERIFYME_API_URL=https://api.verifyme.ng/v1
VERIFYME_API_KEY=your-api-key

# Exchange Rates (Optional, uses Fixer.io by default)
FIXER_API_KEY=your-api-key
EXCHANGE_RATE_API_KEY=your-api-key
```

---

## 📝 Notes for Frontend Team

1. **Slug Usage:** All product URLs should use `slug` instead of `id` for SEO and shareability
2. **Guest Cart:** Use `session_id` from backend or generate one client-side for guest carts
3. **Token Refresh:** Google Drive tokens auto-refresh, but handle token expiration errors gracefully
4. **File Embedding:** Use `embed_url` from external files API for embedding Google Drive files
5. **BVN Verification:** If API key not configured, BVN verification will be manual (admin review)
6. **Currency Display:** Always show currency code alongside amounts
7. **Pagination:** All list endpoints support pagination with `page` and `limit` query params

---

## 🚀 Migration Scripts

Run these migration scripts in order:

```bash
node scripts/migrate-add-membership-tiers.js
node scripts/migrate-add-multi-currency-wallet.js
node scripts/migrate-add-product-slugs.js
node scripts/migrate-add-product-reviews.js
node scripts/migrate-add-store-system.js
node scripts/migrate-add-sales-pages.js
node scripts/migrate-add-top-products.js
node scripts/migrate-add-read-only-downloads.js
node scripts/migrate-add-invoices.js
node scripts/migrate-add-community-category-intro.js
node scripts/migrate-add-donations.js
node scripts/migrate-add-next-of-kin.js
node scripts/migrate-add-tutor-kyc.js
node scripts/migrate-add-external-files.js
```

---

**Last Updated:** 2024-01-15
**Version:** 1.0.0
