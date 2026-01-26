# 📱 Student/Learner Mobile API Guide

This document provides a comprehensive guide for mobile developers implementing the student/learner features of the LMS platform.

## Base URL
```
https://your-api-domain.com/api
```

## Authentication
Most endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

---

## Table of Contents
1. [Authentication & Profile](#1-authentication--profile)
2. [WSP Courses (Institutional)](#2-wsp-courses-institutional)
3. [Marketplace Courses](#3-marketplace-courses)
4. [E-Books](#4-e-books)
5. [Digital Downloads](#5-digital-downloads)
6. [Store & Shopping Cart](#6-store--shopping-cart)
7. [Memberships](#7-memberships)
8. [Communities](#8-communities)
9. [Coaching Sessions](#9-coaching-sessions)
10. [Wallet](#10-wallet)
11. [KYC (Know Your Customer)](#11-kyc-know-your-customer)
12. [Exams & Quizzes](#12-exams--quizzes)
13. [Invoices](#13-invoices)
14. [Donations](#14-donations)
15. [Product Reviews](#15-product-reviews)
16. [Activity Tracking](#16-activity-tracking)

---

## 1. Authentication & Profile

### Register Student
**POST** `/auth/register/student`

**Request Body:**
```json
{
  "fname": "John",
  "lname": "Doe",
  "mname": "Middle",
  "email": "john.doe@example.com",
  "phone": "08012345678",
  "password": "SecurePassword123",
  "matric_number": "STU001",
  "program_id": 1,
  "level": 100
}
```

**Response:**
```json
{
  "status": true,
  "code": 201,
  "message": "Student registered successfully",
  "data": {
    "user": {
      "id": 1,
      "fname": "John",
      "lname": "Doe",
      "email": "john.doe@example.com"
    },
    "token": "jwt_token_here"
  }
}
```

---

### Login
**POST** `/auth/login` or `/auth/student/login`

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "password": "SecurePassword123"
}
```

**Response:**
```json
{
  "status": true,
  "code": 200,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "fname": "John",
      "lname": "Doe",
      "email": "john.doe@example.com",
      "userType": "student"
    },
    "token": "jwt_token_here"
  }
}
```

---

### Get Profile
**GET** `/auth/profile`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": true,
  "code": 200,
  "message": "Profile retrieved successfully",
  "data": {
    "user": {
      "id": 1,
      "fname": "John",
      "lname": "Doe",
      "email": "john.doe@example.com",
      "phone": "08012345678"
    }
  }
}
```

---

### Update Profile
**PUT** `/auth/profile/student`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "fname": "John",
  "lname": "Doe Updated",
  "phone": "08012345679",
  "address": "123 Main St"
}
```

---

### Change Password
**POST** `/auth/password/change`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewPassword123"
}
```

---

### Request Password Reset
**POST** `/auth/password/reset-request`

**Request Body:**
```json
{
  "email": "john.doe@example.com"
}
```

**Response:**
```json
{
  "status": true,
  "code": 200,
  "message": "If email exists, password reset link has been sent"
}
```

---

### Reset Password
**POST** `/auth/password/reset`

**Request Body:**
```json
{
  "token": "reset_token_from_email",
  "newPassword": "NewPassword123"
}
```

---

### Logout
**POST** `/auth/logout`

**Headers:**
```
Authorization: Bearer <token>
```

---

## 2. WSP Courses (Institutional)

### Get My Courses
**GET** `/courses/student`

**Query Parameters:**
- `academic_year` (optional): `2024/2025`
- `semester` (optional): `1ST` or `2ND`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": true,
  "code": 200,
  "data": {
    "courses": [
      {
        "id": 1,
        "course_code": "CSC101",
        "course_title": "Introduction to Computer Science",
        "credit_hours": 3,
        "semester": "1ST",
        "academic_year": "2024/2025"
      }
    ]
  }
}
```

---

### Get Course by ID
**GET** `/courses/single/:courseId`

**Headers:**
```
Authorization: Bearer <token>
```

---

### Get Course Participants
**GET** `/courses/:courseId/participants`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": true,
  "code": 200,
  "data": {
    "lecturer": {
      "id": 1,
      "name": "Dr. Smith"
    },
    "students": [
      {
        "id": 2,
        "name": "Jane Doe"
      }
    ]
  }
}
```

---

### Get My Allocated Courses
**GET** `/courses/allocated`

**Headers:**
```
Authorization: Bearer <token>
```

---

### Register Allocated Courses
**POST** `/courses/register-allocated`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "course_ids": [1, 2, 3]
}
```

---

### Get Available Semesters
**GET** `/courses/semesters`

**Headers:**
```
Authorization: Bearer <token>
```

---

## 3. Marketplace Courses

### Browse Marketplace Courses
**GET** `/marketplace/courses`

**Query Parameters:**
- `page` (optional): `1`
- `limit` (optional): `20`
- `owner_id` (optional): Filter by tutor ID
- `owner_type` (optional): `sole_tutor` or `organization`
- `level` (optional): Course level
- `program_id` (optional): Program ID
- `search` (optional): Search term

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": true,
  "code": 200,
  "data": {
    "courses": [
      {
        "id": 1,
        "course_title": "Advanced JavaScript",
        "price": 5000,
        "currency": "NGN",
        "owner": {
          "id": 1,
          "name": "John Tutor",
          "type": "sole_tutor"
        },
        "is_purchased": false
      }
    ],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 20,
      "totalPages": 5
    }
  }
}
```

---

### Get My Marketplace Courses
**GET** `/marketplace/courses/my-courses`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": true,
  "code": 200,
  "data": {
    "courses": [
      {
        "id": 1,
        "course_title": "Advanced JavaScript",
        "purchased_at": "2024-01-15T10:00:00Z",
        "access_type": "lifetime"
      }
    ]
  }
}
```

---

### Purchase Marketplace Course
**POST** `/marketplace/courses/purchase`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "course_id": 1,
  "payment_method": "wallet"
}
```

**Response:**
```json
{
  "status": true,
  "code": 200,
  "message": "Course purchased successfully",
  "data": {
    "purchase": {
      "id": 1,
      "course_id": 1,
      "amount": 5000,
      "currency": "NGN",
      "status": "completed"
    }
  }
}
```

---

### Get All Tutors
**GET** `/marketplace/tutors`

**Query Parameters:**
- `type` (optional): `sole_tutor` or `organization`
- `search` (optional): Search term

**Response:**
```json
{
  "status": true,
  "code": 200,
  "data": {
    "tutors": [
      {
        "id": 1,
        "name": "John Tutor",
        "type": "sole_tutor",
        "specialization": "Web Development"
      }
    ]
  }
}
```

---

### Get All Programs
**GET** `/marketplace/programs`

**Response:**
```json
{
  "status": true,
  "code": 200,
  "data": {
    "programs": [
      {
        "id": 1,
        "name": "Computer Science",
        "faculty": "Engineering"
      }
    ]
  }
}
```

---

### Get Categories
**GET** `/marketplace/categories`

**Response:**
```json
{
  "status": true,
  "code": 200,
  "data": {
    "categories": [
      {
        "id": 1,
        "name": "Technology",
        "slug": "technology"
      }
    ]
  }
}
```

---

## 4. E-Books

### Browse E-Books
**GET** `/marketplace/ebooks`

**Query Parameters:**
- `page` (optional): `1`
- `limit` (optional): `20`
- `search` (optional): Search term
- `category` (optional): Category filter
- `owner_id` (optional): Tutor ID
- `owner_type` (optional): `sole_tutor` or `organization`
- `min_price` (optional): Minimum price
- `max_price` (optional): Maximum price
- `sort` (optional): `newest`, `oldest`, `price_low`, `price_high`, `popular`

**Headers:**
```
Authorization: Bearer <token>
```

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
        "price": 29.99,
        "currency": "NGN",
        "cover_image": "https://...",
        "description": "...",
        "is_purchased": false
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

---

### Get E-Book Details
**GET** `/marketplace/ebooks/:id`

**Headers:**
```
Authorization: Bearer <token>
```

---

### Get My E-Books
**GET** `/marketplace/ebooks/my-ebooks`

**Headers:**
```
Authorization: Bearer <token>
```

---

### Purchase E-Book
**POST** `/marketplace/ebooks/purchase`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "ebook_id": 1,
  "payment_method": "wallet"
}
```

---

### Get E-Book Download URL
**POST** `/marketplace/ebooks/:id/signed-url`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "signed_url": "https://...",
    "expires_in": 3600
  }
}
```

---

## 5. Digital Downloads

### Browse Digital Downloads
**GET** `/marketplace/digital-downloads`

**Query Parameters:**
- `page` (optional): `1`
- `limit` (optional): `20`
- `search` (optional): Search term
- `category` (optional): Category filter
- `product_type` (optional): `ebook`, `podcast`, `video`, `music`, `art`, `article`, `code`, `2d_3d_files`
- `owner_id` (optional): Tutor ID
- `owner_type` (optional): `sole_tutor` or `organization`
- `min_price` (optional): Minimum price
- `max_price` (optional): Maximum price
- `sort` (optional): `newest`, `oldest`, `price_low`, `price_high`, `popular`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Digital downloads retrieved successfully",
  "data": {
    "digital_downloads": [
      {
        "id": 1,
        "title": "React Course Materials",
        "product_type": "ebook",
        "price": 49.99,
        "currency": "NGN",
        "cover_image": "https://...",
        "preview_url": "https://...",
        "is_purchased": false
      }
    ],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 20,
      "totalPages": 5
    }
  }
}
```

---

### Get Digital Download Details
**GET** `/marketplace/digital-downloads/:id`

**Headers:**
```
Authorization: Bearer <token>
```

---

### Get My Digital Downloads
**GET** `/marketplace/digital-downloads/my-downloads`

**Headers:**
```
Authorization: Bearer <token>
```

---

### Purchase Digital Download
**POST** `/marketplace/digital-downloads/purchase`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "digital_download_id": 1,
  "payment_method": "wallet"
}
```

---

### Get Download URL
**POST** `/marketplace/digital-downloads/:id/download-url`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "download_url": "https://...",
    "expires_in": 3600
  }
}
```

---

### Get Stream URL (for videos/audio)
**POST** `/marketplace/digital-downloads/:id/stream-url`

**Headers:**
```
Authorization: Bearer <token>
```

---

### Get Preview URL (Public)
**GET** `/marketplace/digital-downloads/:id/preview-url`

**Note:** No authentication required for previews

---

### Read-Only Digital Downloads

#### Create Read Session
**POST** `/marketplace/digital-downloads/:id/read-session`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "session_token": "session_token_here",
    "expires_at": "2024-01-20T12:00:00Z"
  }
}
```

---

#### Update Read Progress
**PUT** `/marketplace/digital-downloads/:id/read-session`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "current_page": 5,
  "total_pages": 100,
  "progress_percentage": 5.0
}
```

---

#### Get Read Progress
**GET** `/marketplace/digital-downloads/:id/read-session`

**Headers:**
```
Authorization: Bearer <token>
```

---

#### Stream Read-Only Document
**GET** `/marketplace/digital-downloads/:id/read?token=<session_token>`

**Note:** Uses session token from read session, not JWT

---

#### Get My Read Sessions
**GET** `/marketplace/read-sessions`

**Headers:**
```
Authorization: Bearer <token>
```

---

## 6. Store & Shopping Cart

### Browse Store Products
**GET** `/marketplace/store/products`

**Query Parameters:**
- `page` (optional): `1`
- `limit` (optional): `20`
- `type` (optional): `course`, `ebook`, `digital_download`, `membership`, `community`
- `search` (optional): Search term
- `category` (optional): Category filter
- `min_price` (optional): Minimum price
- `max_price` (optional): Maximum price
- `sort` (optional): `newest`, `oldest`, `price_low`, `price_high`, `popular`

**Note:** No authentication required (public endpoint)

**Response:**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": 1,
        "type": "course",
        "title": "Advanced JavaScript",
        "price": 5000,
        "currency": "NGN",
        "slug": "advanced-javascript"
      }
    ],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 20,
      "totalPages": 5
    }
  }
}
```

---

### Get Store Product
**GET** `/marketplace/store/products/:type/:id`

**Note:** No authentication required (public endpoint)

**Response:**
```json
{
  "success": true,
  "data": {
    "product": {
      "id": 1,
      "type": "course",
      "title": "Advanced JavaScript",
      "price": 5000,
      "currency": "NGN",
      "description": "...",
      "is_purchased": false
    }
  }
}
```

---

### Add to Cart
**POST** `/marketplace/store/cart`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "product_type": "course",
  "product_id": 1,
  "quantity": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Item added to cart",
  "data": {
    "cart_item": {
      "id": 1,
      "product_type": "course",
      "product_id": 1,
      "quantity": 1,
      "unit_price": 5000,
      "subtotal": 5000
    }
  }
}
```

---

### Get Cart
**GET** `/marketplace/store/cart`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
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
          "product_name": "Advanced JavaScript",
          "quantity": 1,
          "unit_price": 5000,
          "subtotal": 5000
        }
      ],
      "total": 5000,
      "currency": "NGN"
    }
  }
}
```

---

### Update Cart Item
**PUT** `/marketplace/store/cart/item/:id`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "quantity": 2
}
```

---

### Remove from Cart
**DELETE** `/marketplace/store/cart/item/:id`

**Headers:**
```
Authorization: Bearer <token>
```

---

### Clear Cart
**DELETE** `/marketplace/store/cart`

**Headers:**
```
Authorization: Bearer <token>
```

---

### Merge Guest Cart
**POST** `/marketplace/store/cart/merge`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "session_id": "guest_session_id" // Optional
}
```

---

### Initiate Checkout
**POST** `/marketplace/store/checkout`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "payment_method": "wallet",
  "billing_address": {
    "street": "123 Main St",
    "city": "Lagos",
    "state": "Lagos",
    "country": "Nigeria",
    "postal_code": "100001"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Checkout completed successfully",
  "data": {
    "order": {
      "id": 1,
      "total": 5000,
      "currency": "NGN",
      "status": "completed"
    },
    "invoices": [
      {
        "id": 1,
        "invoice_number": "INV-2024-0122-00001"
      }
    ]
  }
}
```

---

## 7. Memberships

### Browse Memberships
**GET** `/marketplace/memberships`

**Query Parameters:**
- `page` (optional): `1`
- `limit` (optional): `20`
- `search` (optional): Search term
- `category` (optional): Category filter
- `tutor_id` (optional): Tutor ID
- `tutor_type` (optional): `sole_tutor` or `organization`

**Note:** No authentication required (public endpoint)

**Response:**
```json
{
  "success": true,
  "data": {
    "memberships": [
      {
        "id": 1,
        "name": "Premium Access",
        "description": "...",
        "pricing_type": "monthly",
        "price": 99.99,
        "currency": "NGN",
        "tiers": [
          {
            "id": 1,
            "name": "Basic",
            "price": 99.99,
            "features": ["Feature 1", "Feature 2"]
          }
        ]
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

---

### Get Membership Details
**GET** `/marketplace/memberships/:id`

**Note:** No authentication required (public endpoint)

---

### Subscribe to Membership
**POST** `/marketplace/memberships/:id/subscribe`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "tier_id": 1, // Optional if membership has tiers
  "payment_method": "wallet"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Subscribed successfully",
  "data": {
    "subscription": {
      "id": 1,
      "membership_id": 1,
      "tier_id": 1,
      "status": "active",
      "expires_at": "2024-02-22T10:00:00Z"
    }
  }
}
```

---

### Get My Subscriptions
**GET** `/marketplace/memberships/my-subscriptions`

**Headers:**
```
Authorization: Bearer <token>
```

---

### Cancel Subscription
**POST** `/marketplace/memberships/:id/cancel`

**Headers:**
```
Authorization: Bearer <token>
```

---

### Change Membership Tier
**POST** `/marketplace/memberships/:id/change-tier`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "tier_id": 2,
  "payment_method": "wallet"
}
```

---

### Check Product Access
**GET** `/marketplace/memberships/check-access`

**Query Parameters:**
- `product_type`: `course`, `ebook`, `digital_download`
- `product_id`: Product ID

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "has_access": true,
    "access_type": "membership",
    "membership_id": 1,
    "tier_id": 1
  }
}
```

---

## 8. Communities

### Browse Communities
**GET** `/marketplace/communities`

**Query Parameters:**
- `page` (optional): `1`
- `limit` (optional): `20`
- `search` (optional): Search term
- `category` (optional): Category filter
- `tutor_id` (optional): Tutor ID

**Note:** No authentication required (public endpoint)

---

### Get Community Details
**GET** `/marketplace/communities/:id`

**Note:** No authentication required (public endpoint)

---

### Subscribe to Community
**POST** `/marketplace/communities/:id/subscribe`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "payment_method": "wallet"
}
```

---

### Get Community Posts
**GET** `/marketplace/communities/:id/posts`

**Query Parameters:**
- `page` (optional): `1`
- `limit` (optional): `20`
- `category` (optional): Category filter
- `search` (optional): Search term
- `featured` (optional): `true` or `false`

**Note:** Optional authentication (public can view published posts)

**Response:**
```json
{
  "status": true,
  "code": 200,
  "message": "Posts retrieved successfully",
  "data": {
    "posts": [
      {
        "id": 1,
        "title": "Welcome Post",
        "content": "...",
        "image_url": "https://...",
        "author": {
          "id": 1,
          "name": "John Tutor"
        },
        "created_at": "2024-01-20T10:00:00Z"
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

---

### Get Single Post
**GET** `/marketplace/communities/:id/posts/:postId`

**Note:** Optional authentication

---

### Create Post
**POST** `/marketplace/communities/:id/posts`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body (Form Data):**
- `title` (optional): Post title
- `content` (required): Post content
- `content_type` (optional): `text`, `rich_text`, `link`
- `category` (optional): Category
- `tags` (optional): JSON array of tags
- `image` (optional): Image file

**Response:**
```json
{
  "status": true,
  "code": 201,
  "message": "Post created successfully",
  "data": {
    "id": 1,
    "title": "My Post",
    "content": "...",
    "image_url": "https://...",
    "author": {
      "id": 1,
      "name": "John Student"
    }
  }
}
```

---

### Update Post
**PUT** `/marketplace/communities/:id/posts/:postId`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body (Form Data):**
- `title` (optional)
- `content` (optional)
- `image` (optional): New image file

---

### Delete Post
**DELETE** `/marketplace/communities/:id/posts/:postId`

**Headers:**
```
Authorization: Bearer <token>
```

---

### Create Comment
**POST** `/marketplace/communities/:id/posts/:postId/comments`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "content": "Great post!"
}
```

---

### Get Comments
**GET** `/marketplace/communities/:id/posts/:postId/comments`

**Query Parameters:**
- `page` (optional): `1`
- `limit` (optional): `20`

**Note:** Optional authentication

---

### Add Reaction
**POST** `/marketplace/communities/:id/posts/:postId/reactions`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "reaction_type": "like"
}
```

**Valid reaction types:** `like`, `love`, `laugh`, `wow`, `sad`, `angry`

---

### Get Reactions
**GET** `/marketplace/communities/:id/posts/:postId/reactions`

**Note:** Optional authentication

---

## 9. Coaching Sessions

### Browse Coaching Sessions
**GET** `/marketplace/coaching/sessions`

**Query Parameters:**
- `page` (optional): `1`
- `limit` (optional): `20`
- `search` (optional): Search term
- `tutor_id` (optional): Tutor ID

**Note:** Optional authentication (public can browse)

---

### Get Session Details
**GET** `/marketplace/coaching/sessions/:id`

**Note:** Optional authentication

---

### Purchase Session Access
**POST** `/marketplace/coaching/sessions/:id/purchase`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "payment_method": "wallet"
}
```

---

### Get My Sessions
**GET** `/marketplace/coaching/my-sessions`

**Headers:**
```
Authorization: Bearer <token>
```

---

### Get Join Token
**POST** `/marketplace/coaching/sessions/:id/join-token`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "join_token": "token_here",
    "expires_at": "2024-01-20T12:00:00Z"
  }
}
```

---

### Get Session Messages
**GET** `/marketplace/coaching/sessions/:sessionId/messages`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional): `1`
- `limit` (optional): `20`

---

### Mark Messages as Read
**PUT** `/marketplace/coaching/sessions/:sessionId/messages/read`

**Headers:**
```
Authorization: Bearer <token>
```

---

## 10. Wallet

### Get Wallet Balance
**GET** `/wallet/balance`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": true,
  "code": 200,
  "data": {
    "balance": 5000.00,
    "currency": "NGN",
    "balances": {
      "NGN": 5000.00,
      "USD": 0.00
    }
  }
}
```

---

### Fund Wallet
**POST** `/wallet/fund`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "amount": 10000,
  "currency": "NGN",
  "payment_method": "bank_transfer",
  "payment_reference": "REF123456"
}
```

**Response:**
```json
{
  "status": true,
  "code": 200,
  "message": "Wallet funded successfully",
  "data": {
    "transaction": {
      "id": 1,
      "amount": 10000,
      "currency": "NGN",
      "status": "pending"
    }
  }
}
```

---

### Get Funding History
**GET** `/wallet/transactions`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional): `1`
- `limit` (optional): `20`
- `type` (optional): `credit`, `debit`
- `status` (optional): `pending`, `completed`, `failed`

---

### Get Exchange Rate
**GET** `/wallet/rate`

**Query Parameters:**
- `from`: Source currency (e.g., `NGN`)
- `to`: Target currency (e.g., `USD`)

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": true,
  "code": 200,
  "data": {
    "from": "NGN",
    "to": "USD",
    "rate": 0.0012,
    "updated_at": "2024-01-20T10:00:00Z"
  }
}
```

---

## 11. KYC (Know Your Customer)

### Upload Profile Image
**POST** `/kyc/profile-image`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body (Form Data):**
- `image` (required): Image file

---

### Upload KYC Document
**POST** `/kyc/documents`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body (Form Data):**
- `document_type` (required): `national_id`, `passport`, `drivers_license`, `voters_card`, `birth_certificate`, `waec_result`, `jamb_result`, `other`
- `file` (required): Document file (PDF or image)
- `description` (optional): Description

---

### Get KYC Documents
**GET** `/kyc/documents`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": true,
  "code": 200,
  "data": {
    "documents": [
      {
        "id": 1,
        "document_type": "national_id",
        "status": "pending",
        "uploaded_at": "2024-01-20T10:00:00Z"
      }
    ]
  }
}
```

---

### Get Document Signed URL
**POST** `/kyc/documents/signed-url`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "document_id": 1
}
```

**Response:**
```json
{
  "status": true,
  "code": 200,
  "data": {
    "signed_url": "https://...",
    "expires_in": 3600
  }
}
```

---

### Update School Info
**PUT** `/kyc/schools`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "school_name": "ABC High School",
  "graduation_year": 2020
}
```

---

## 12. Exams & Quizzes

### Get Student Exams
**GET** `/exams/student/exams`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `academic_year` (optional)
- `semester` (optional)
- `course_id` (optional)

---

### Get Exam Attempt History
**GET** `/exams/student/attempts`

**Headers:**
```
Authorization: Bearer <token>
```

---

### Start Exam
**POST** `/exams/student/exams/:examId/start`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": true,
  "code": 200,
  "data": {
    "attempt": {
      "id": 1,
      "exam_id": 1,
      "started_at": "2024-01-20T10:00:00Z",
      "duration_minutes": 60
    }
  }
}
```

---

### Submit Answer
**POST** `/exams/student/exams/attempts/:attemptId/answer`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "question_id": 1,
  "answer": "Answer text",
  "selected_options": [1, 2] // For multiple choice
}
```

---

### Submit Exam
**POST** `/exams/student/exams/attempts/:attemptId/submit`

**Headers:**
```
Authorization: Bearer <token>
```

---

### Get Attempt Details
**GET** `/exams/student/exams/attempts/:attemptId`

**Headers:**
```
Authorization: Bearer <token>
```

---

### Get Student Quizzes
**GET** `/quiz`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `course_id` (optional)
- `module_id` (optional)

---

### Get Quiz
**GET** `/quiz/:quizId`

**Headers:**
```
Authorization: Bearer <token>
```

---

### Start Quiz Attempt
**POST** `/quiz/:quizId/attempts`

**Headers:**
```
Authorization: Bearer <token>
```

---

### Save Quiz Answers
**POST** `/quiz/attempts/:attemptId/answers`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "answers": [
    {
      "question_id": 1,
      "answer": "Answer text",
      "selected_options": [1, 2]
    }
  ]
}
```

---

### Submit Quiz Attempt
**POST** `/quiz/attempts/:attemptId/submit`

**Headers:**
```
Authorization: Bearer <token>
```

---

### Get My Latest Quiz Attempt
**GET** `/quiz/:quizId/my-latest`

**Headers:**
```
Authorization: Bearer <token>
```

---

### Get Quiz Stats
**GET** `/quiz/:quizId/stats`

**Headers:**
```
Authorization: Bearer <token>
```

---

## 13. Invoices

### Get My Invoices
**GET** `/marketplace/invoices`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional): `1`
- `limit` (optional): `20`
- `status` (optional): `paid`, `sent`, `overdue`

**Response:**
```json
{
  "success": true,
  "message": "Invoices retrieved successfully",
  "data": {
    "invoices": [
      {
        "id": 1,
        "invoice_number": "INV-2024-0122-00001",
        "product_name": "Advanced JavaScript Course",
        "total_amount": 5000,
        "currency": "NGN",
        "payment_status": "completed",
        "invoice_status": "paid",
        "issued_at": "2024-01-22T10:00:00Z"
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

### Get Invoice
**GET** `/marketplace/invoices/:id`

**Headers:**
```
Authorization: Bearer <token>
```

---

### Download Invoice PDF
**GET** `/marketplace/invoices/:id/download`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** PDF file download

---

### Send Invoice Email
**POST** `/marketplace/invoices/:id/send`

**Headers:**
```
Authorization: Bearer <token>
```

---

## 14. Donations

### Get Donation Categories
**GET** `/marketplace/donations/categories`

**Note:** No authentication required (public endpoint)

**Response:**
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": 1,
        "name": "Education",
        "description": "Support education initiatives"
      }
    ]
  }
}
```

---

### Get Donation Wall
**GET** `/marketplace/donations/wall`

**Query Parameters:**
- `page` (optional): `1`
- `limit` (optional): `20`
- `category_id` (optional): Category filter

**Note:** No authentication required (public endpoint)

**Response:**
```json
{
  "success": true,
  "data": {
    "donations": [
      {
        "id": 1,
        "amount": 1000,
        "currency": "NGN",
        "message": "Great cause!",
        "visibility": "public",
        "donor_name": "John Doe", // Only if visibility is public
        "created_at": "2024-01-20T10:00:00Z"
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

---

### Get Donation Statistics
**GET** `/marketplace/donations/statistics`

**Note:** No authentication required (public endpoint)

**Response:**
```json
{
  "success": true,
  "data": {
    "total_amount": 50000,
    "total_donations": 100,
    "by_category": [
      {
        "category_id": 1,
        "category_name": "Education",
        "total_amount": 30000,
        "count": 60
      }
    ]
  }
}
```

---

### Create Donation
**POST** `/marketplace/donations`

**Headers:**
```
Authorization: Bearer <token> // Optional (for anonymous donations)
```

**Request Body:**
```json
{
  "amount": 1000,
  "currency": "NGN",
  "category_id": 1,
  "message": "Great cause!",
  "visibility": "public", // "public", "private", or "anonymous"
  "payment_method": "wallet"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Donation created successfully",
  "data": {
    "donation": {
      "id": 1,
      "amount": 1000,
      "currency": "NGN",
      "status": "completed"
    }
  }
}
```

---

### Get My Donations
**GET** `/marketplace/donations/my-donations`

**Headers:**
```
Authorization: Bearer <token>
```

---

## 15. Product Reviews

### Create Review
**POST** `/marketplace/reviews`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "product_type": "course",
  "product_id": 1,
  "rating": 5,
  "title": "Great Course!",
  "content": "This course was very helpful..."
}
```

---

### Get Product Reviews
**GET** `/marketplace/reviews`

**Query Parameters:**
- `product_type`: `course`, `ebook`, `digital_download`, `membership`, `community`
- `product_id`: Product ID
- `page` (optional): `1`
- `limit` (optional): `20`
- `rating` (optional): Filter by rating (1-5)
- `sort` (optional): `newest`, `oldest`, `helpful`, `rating_high`, `rating_low`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reviews": [
      {
        "id": 1,
        "rating": 5,
        "title": "Great Course!",
        "content": "...",
        "author": {
          "id": 1,
          "name": "John Student"
        },
        "helpful_count": 10,
        "is_helpful": false, // Whether current user marked as helpful
        "created_at": "2024-01-20T10:00:00Z"
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    },
    "statistics": {
      "average_rating": 4.5,
      "total_reviews": 50,
      "rating_distribution": {
        "5": 30,
        "4": 15,
        "3": 3,
        "2": 1,
        "1": 1
      }
    }
  }
}
```

---

### Get My Review
**GET** `/marketplace/reviews/my-review`

**Query Parameters:**
- `product_type`: `course`, `ebook`, `digital_download`, `membership`, `community`
- `product_id`: Product ID

**Headers:**
```
Authorization: Bearer <token>
```

---

### Mark Review as Helpful
**POST** `/marketplace/reviews/:id/helpful`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Review marked as helpful",
  "data": {
    "helpful_count": 11,
    "is_helpful": true
  }
}
```

---

## 16. Activity Tracking

### Track Activity
**POST** `/courses/activity/track`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "course_id": 1,
  "module_id": 1,
  "unit_id": 1,
  "activity_type": "video_watched",
  "duration_seconds": 300,
  "progress_percentage": 50
}
```

---

### Send Heartbeat
**POST** `/courses/activity/heartbeat`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "course_id": 1,
  "module_id": 1,
  "unit_id": 1,
  "current_time": 300
}
```

---

### Track Batch Activities
**POST** `/courses/activity/batch`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "activities": [
    {
      "course_id": 1,
      "module_id": 1,
      "unit_id": 1,
      "activity_type": "video_watched",
      "duration_seconds": 300
    }
  ]
}
```

---

## 17. Featured/Top Products

### Get Featured Products
**GET** `/marketplace/products/featured`

**Query Parameters:**
- `type` (optional): `course`, `ebook`, `digital_download`, `membership`, `community`
- `limit` (optional): `10`

**Note:** No authentication required (public endpoint)

**Response:**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": 1,
        "type": "course",
        "title": "Advanced JavaScript",
        "price": 5000,
        "currency": "NGN",
        "slug": "advanced-javascript"
      }
    ]
  }
}
```

---

### Get Trending Products
**GET** `/marketplace/products/trending`

**Query Parameters:**
- `type` (optional): `course`, `ebook`, `digital_download`, `membership`, `community`
- `limit` (optional): `10`

**Note:** No authentication required (public endpoint)

---

### Get Top Products
**GET** `/marketplace/products/top`

**Query Parameters:**
- `type` (optional): `course`, `ebook`, `digital_download`, `membership`, `community`
- `limit` (optional): `10`
- `period` (optional): `daily`, `weekly`, `monthly`, `all_time`

**Note:** No authentication required (public endpoint)

---

## 18. Public Product Links

### Get Product by Slug
**GET** `/marketplace/public/product/:slug`

**Note:** No authentication required (public endpoint)

**Response:**
```json
{
  "success": true,
  "data": {
    "product": {
      "id": 1,
      "type": "course",
      "title": "Advanced JavaScript",
      "slug": "advanced-javascript",
      "price": 5000,
      "currency": "NGN"
    }
  }
}
```

---

### Get Sales Page by Slug
**GET** `/marketplace/public/sales/:slug`

**Note:** No authentication required (public endpoint)

**Response:**
```json
{
  "success": true,
  "data": {
    "sales_page": {
      "id": 1,
      "title": "Amazing Course - Get Started Today!",
      "hero_image_url": "https://...",
      "content": "...",
      "features": [...],
      "testimonials": [...],
      "faq": [...],
      "product": {
        "id": 1,
        "type": "course",
        "title": "Advanced JavaScript"
      }
    }
  }
}
```

---

## Error Responses

All endpoints may return the following error formats:

### 400 Bad Request
```json
{
  "status": false,
  "code": 400,
  "message": "Validation error message"
}
```

### 401 Unauthorized
```json
{
  "status": false,
  "code": 401,
  "message": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "status": false,
  "code": 403,
  "message": "You don't have permission to access this resource"
}
```

### 404 Not Found
```json
{
  "status": false,
  "code": 404,
  "message": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "status": false,
  "code": 500,
  "message": "Internal server error"
}
```

---

## Notes for Mobile Developers

1. **Token Storage**: Store JWT tokens securely (use secure storage, not plain text)
2. **Token Refresh**: Tokens expire after a set time. Implement token refresh or re-login flow
3. **File Uploads**: Use `multipart/form-data` for image/document uploads
4. **Pagination**: Most list endpoints support pagination. Always check `pagination` object in responses
5. **Error Handling**: Always check `status` field in responses. `false` indicates an error
6. **Optional Auth**: Some endpoints work without authentication but provide more data when authenticated
7. **Currency**: All prices are in the specified currency. Display currency symbol appropriately
8. **Date Formats**: All dates are in ISO 8601 format (e.g., `2024-01-20T10:00:00Z`)
9. **Image URLs**: Some images may be signed URLs that expire. Handle expiration gracefully
10. **Rate Limiting**: Be aware of rate limits on certain endpoints (especially exam/quiz submissions)

---

## Support

For API support or questions, contact the backend development team.

**Last Updated:** January 2024
