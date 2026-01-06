# Digital Downloads Marketplace - Frontend Implementation Guide

## Table of Contents
1. [Overview](#overview)
2. [Product Types](#product-types)
3. [API Endpoints](#api-endpoints)
4. [Tutor Implementation](#tutor-implementation)
5. [Student Implementation](#student-implementation)
6. [File Upload Implementation](#file-upload-implementation)
7. [Streaming vs Download](#streaming-vs-download)
8. [UI/UX Recommendations](#uiux-recommendations)
9. [Testing Guide](#testing-guide)

---

## Overview

The Digital Downloads marketplace allows tutors to sell various types of digital products:
- **Ebooks** (PDF, EPUB)
- **Podcasts** (MP3, WAV, M4A)
- **Videos** (MP4, MOV, AVI)
- **Music** (MP3, FLAC, WAV)
- **Art** (PNG, JPEG, SVG, PDF)
- **Articles** (PDF, DOCX, TXT)
- **Code** (ZIP, TAR, GZ)
- **2D/3D Files** (OBJ, BLEND, STEP)

### Key Features
- Multi-product type support
- Streaming for media (videos, podcasts, music)
- Download for all types
- Preview system for streaming products
- Revenue sharing with tutors
- Wallet-based purchases

---

## Product Types

### Product Type Configuration

```javascript
const PRODUCT_TYPES = {
  ebook: {
    name: "Ebook",
    fileTypes: ["application/pdf", "application/epub+zip"],
    maxSize: 100 * 1024 * 1024, // 100MB
    streamingEnabled: false,
    downloadEnabled: true,
    icon: "📚",
    color: "#4A90E2",
  },
  podcast: {
    name: "Podcast",
    fileTypes: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/m4a"],
    maxSize: 500 * 1024 * 1024, // 500MB
    streamingEnabled: true,
    downloadEnabled: false,
    icon: "🎙️",
    color: "#E94B3C",
  },
  video: {
    name: "Video",
    fileTypes: ["video/mp4", "video/quicktime", "video/webm"],
    maxSize: 5 * 1024 * 1024 * 1024, // 5GB
    streamingEnabled: true,
    downloadEnabled: false,
    icon: "🎬",
    color: "#FF6B6B",
  },
  music: {
    name: "Music",
    fileTypes: ["audio/mpeg", "audio/mp3", "audio/flac", "audio/wav"],
    maxSize: 100 * 1024 * 1024, // 100MB
    streamingEnabled: true,
    downloadEnabled: false,
    icon: "🎵",
    color: "#9B59B6",
  },
  art: {
    name: "Art",
    fileTypes: ["image/png", "image/jpeg", "image/svg+xml", "application/pdf"],
    maxSize: 500 * 1024 * 1024, // 500MB
    streamingEnabled: false,
    downloadEnabled: true,
    icon: "🎨",
    color: "#F39C12",
  },
  article: {
    name: "Article",
    fileTypes: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    maxSize: 50 * 1024 * 1024, // 50MB
    streamingEnabled: false,
    downloadEnabled: true,
    icon: "📄",
    color: "#3498DB",
  },
  code: {
    name: "Code",
    fileTypes: ["application/zip", "application/x-tar", "application/gzip"],
    maxSize: 500 * 1024 * 1024, // 500MB
    streamingEnabled: false,
    downloadEnabled: true,
    icon: "💻",
    color: "#2ECC71",
  },
  "2d_3d_files": {
    name: "2D/3D Files",
    fileTypes: ["application/octet-stream", "model/obj", "application/x-blender"],
    maxSize: 2 * 1024 * 1024 * 1024, // 2GB
    streamingEnabled: false,
    downloadEnabled: true,
    icon: "🎯",
    color: "#E67E22",
  },
};
```

---

## API Endpoints

### Base URL
```
/api/marketplace
```

### Tutor Endpoints

#### 1. Get My Digital Downloads
```http
GET /api/marketplace/tutor/digital-downloads
Authorization: Bearer <tutor_token>
Query Parameters:
  - page (default: 1)
  - limit (default: 20)
  - status (optional: "draft" | "published")
  - product_type (optional)
  - search (optional)
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
        "title": "Introduction to React",
        "author": "John Doe",
        "product_type": "ebook",
        "price": 29.99,
        "currency": "NGN",
        "cover_image": "https://...",
        "category": "Tech",
        "tags": ["react", "javascript"],
        "status": "published",
        "sales_count": 15,
        "duration": null,
        "file_size": 5242880,
        "streaming_enabled": false,
        "download_enabled": true,
        "created_at": "2024-01-20T10:00:00Z",
        "updated_at": "2024-01-20T10:00:00Z"
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

#### 2. Get Single Digital Download
```http
GET /api/marketplace/tutor/digital-downloads/:id
Authorization: Bearer <tutor_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Digital download retrieved successfully",
  "data": {
    "digital_download": {
      "id": 1,
      "title": "Introduction to React",
      "description": "Complete guide to React...",
      "author": "John Doe",
      "pages": 250,
      "product_type": "ebook",
      "price": 29.99,
      "currency": "NGN",
      "file_url": "https://...",
      "file_type": "PDF",
      "file_size": 5242880,
      "cover_image": "https://...",
      "preview_url": null,
      "category": "Tech",
      "tags": ["react", "javascript"],
      "status": "draft",
      "sales_count": 0,
      "duration": null,
      "dimensions": null,
      "resolution": null,
      "streaming_enabled": false,
      "download_enabled": true,
      "created_at": "2024-01-20T10:00:00Z",
      "updated_at": "2024-01-20T10:00:00Z"
    }
  }
}
```

#### 3. Create Digital Download
```http
POST /api/marketplace/tutor/digital-downloads
Authorization: Bearer <tutor_token>
Content-Type: application/json

Body:
{
  "title": "Introduction to React",
  "description": "Complete guide to React development",
  "author": "John Doe",
  "pages": 250,
  "price": 29.99,
  "currency": "NGN",
  "file_url": "https://...", // From upload endpoint
  "product_type": "ebook",
  "category": "Tech",
  "tags": ["react", "javascript"],
  "status": "draft",
  "file_type": "PDF",
  "file_size": 5242880
}
```

**Response:**
```json
{
  "success": true,
  "message": "Digital download created successfully",
  "data": {
    "digital_download": {
      "id": 1,
      "title": "Introduction to React",
      "product_type": "ebook",
      "price": 29.99,
      "status": "draft"
    }
  }
}
```

#### 4. Update Digital Download
```http
PUT /api/marketplace/tutor/digital-downloads/:id
Authorization: Bearer <tutor_token>
Content-Type: application/json

Body: (all fields optional)
{
  "title": "Updated Title",
  "description": "Updated description",
  "price": 39.99,
  "status": "published"
}
```

#### 5. Delete Digital Download
```http
DELETE /api/marketplace/tutor/digital-downloads/:id
Authorization: Bearer <tutor_token>
```

#### 6. Update Status (Publish/Unpublish)
```http
PATCH /api/marketplace/tutor/digital-downloads/:id/status
Authorization: Bearer <tutor_token>
Content-Type: application/json

Body:
{
  "status": "published" // or "draft"
}
```

#### 7. Upload File
```http
POST /api/marketplace/tutor/digital-downloads/upload-file
Authorization: Bearer <tutor_token>
Content-Type: multipart/form-data

Form Data:
  - file: <file>
  - product_type: "ebook" | "podcast" | "video" | "music" | "art" | "article" | "code" | "2d_3d_files"
```

**Response:**
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "file_url": "https://...",
    "file_path": "tutors/1/ebooks/1234567890_file.pdf",
    "file_type": "PDF",
    "file_size": 5242880,
    "product_type": "ebook"
  }
}
```

#### 8. Upload Cover Image
```http
POST /api/marketplace/tutor/digital-downloads/upload-cover
Authorization: Bearer <tutor_token>
Content-Type: multipart/form-data

Form Data:
  - cover_image: <image_file>
```

**Response:**
```json
{
  "success": true,
  "message": "Cover image uploaded successfully",
  "data": {
    "cover_image": "https://...",
    "file_path": "tutors/1/covers/1234567890_cover.jpg"
  }
}
```

#### 9. Upload Preview File (for videos/podcasts/music)
```http
POST /api/marketplace/tutor/digital-downloads/upload-preview
Authorization: Bearer <tutor_token>
Content-Type: multipart/form-data

Form Data:
  - preview_file: <file>
  - product_type: "video" | "podcast" | "music"
```

**Response:**
```json
{
  "success": true,
  "message": "Preview file uploaded successfully",
  "data": {
    "preview_url": "https://...",
    "file_path": "tutors/1/previews/1234567890_preview.mp4"
  }
}
```

### Student Endpoints

#### 1. Browse Digital Downloads
```http
GET /api/marketplace/digital-downloads
Authorization: Bearer <student_token>
Query Parameters:
  - page (default: 1)
  - limit (default: 20)
  - search (optional)
  - category (optional)
  - product_type (optional)
  - owner_id (optional)
  - owner_type (optional)
  - min_price (optional)
  - max_price (optional)
  - sort (optional: "newest" | "oldest" | "price_low" | "price_high" | "popular")
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
        "title": "Introduction to React",
        "description": "Complete guide...",
        "author": "John Doe",
        "product_type": "ebook",
        "price": 29.99,
        "currency": "NGN",
        "cover_image": "https://...",
        "preview_url": null,
        "category": "Tech",
        "tags": ["react", "javascript"],
        "sales_count": 15,
        "duration": null,
        "file_size": 5242880,
        "streaming_enabled": false,
        "download_enabled": true,
        "owner": {
          "id": 1,
          "name": "John Doe",
          "type": "sole_tutor"
        },
        "created_at": "2024-01-20T10:00:00Z"
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

#### 2. Get Single Digital Download Details
```http
GET /api/marketplace/digital-downloads/:id
Authorization: Bearer <student_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Digital download retrieved successfully",
  "data": {
    "digital_download": {
      "id": 1,
      "title": "Introduction to React",
      "description": "Complete guide...",
      "author": "John Doe",
      "pages": 250,
      "product_type": "ebook",
      "price": 29.99,
      "currency": "NGN",
      "cover_image": "https://...",
      "preview_url": null,
      "category": "Tech",
      "tags": ["react", "javascript"],
      "sales_count": 15,
      "duration": null,
      "dimensions": null,
      "resolution": null,
      "file_size": 5242880,
      "file_type": "PDF",
      "streaming_enabled": false,
      "download_enabled": true,
      "owner": {
        "id": 1,
        "name": "John Doe",
        "type": "sole_tutor",
        "bio": "Experienced developer..."
      },
      "is_purchased": false,
      "created_at": "2024-01-20T10:00:00Z"
    }
  }
}
```

#### 3. Get My Purchased Downloads
```http
GET /api/marketplace/digital-downloads/my-downloads
Authorization: Bearer <student_token>
Query Parameters:
  - page (default: 1)
  - limit (default: 20)
  - search (optional)
  - product_type (optional)
```

**Response:**
```json
{
  "success": true,
  "message": "Purchased digital downloads retrieved successfully",
  "data": {
    "digital_downloads": [
      {
        "id": 1,
        "title": "Introduction to React",
        "description": "Complete guide...",
        "author": "John Doe",
        "product_type": "ebook",
        "cover_image": "https://...",
        "preview_url": null,
        "category": "Tech",
        "tags": ["react", "javascript"],
        "file_url": "https://...", // Signed URL (expires in 1 hour)
        "file_type": "PDF",
        "file_size": 5242880,
        "duration": null,
        "streaming_enabled": false,
        "download_enabled": true,
        "purchased_at": "2024-01-21T10:00:00Z",
        "purchase_price": 29.99,
        "purchase_currency": "NGN"
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

#### 4. Purchase Digital Download
```http
POST /api/marketplace/digital-downloads/purchase
Authorization: Bearer <student_token>
Content-Type: application/json

Body:
{
  "digital_download_id": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Product purchased successfully",
  "data": {
    "purchase": {
      "digital_download_id": 1,
      "product_type": "ebook",
      "price": 29.99,
      "currency": "NGN",
      "transaction_ref": "DIGITAL-DOWNLOAD-1-1705747200000"
    },
    "revenue": {
      "wsp_commission": 4.50,
      "tutor_earnings": 25.49,
      "commission_rate": 15
    },
    "wallet": {
      "previous_balance": 100.00,
      "new_balance": 70.01,
      "debited": 29.99,
      "currency": "NGN"
    }
  }
}
```

#### 5. Get Download URL (for purchased products)
```http
POST /api/marketplace/digital-downloads/:id/download-url
Authorization: Bearer <student_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Download URL generated successfully",
  "data": {
    "digital_download_id": 1,
    "download_url": "https://...", // Signed URL (expires in 7 days)
    "expires_in": 604800
  }
}
```

#### 6. Get Streaming URL (for videos/podcasts/music)
```http
POST /api/marketplace/digital-downloads/:id/stream-url
Authorization: Bearer <student_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Streaming URL generated successfully",
  "data": {
    "digital_download_id": 1,
    "stream_url": "https://...", // Signed URL (expires in 1 hour)
    "expires_in": 3600,
    "product_type": "video"
  }
}
```

#### 7. Get Preview URL (public, no purchase required)
```http
GET /api/marketplace/digital-downloads/:id/preview-url
```

**Response:**
```json
{
  "success": true,
  "message": "Preview URL retrieved successfully",
  "data": {
    "digital_download_id": 1,
    "preview_url": "https://...",
    "expires_in": 3600
  }
}
```

---

## Tutor Implementation

### Step 1: Create Digital Download Form

```jsx
import React, { useState } from 'react';
import { PRODUCT_TYPES } from './constants';

const CreateDigitalDownloadForm = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    author: '',
    pages: '',
    price: '',
    currency: 'NGN',
    product_type: 'ebook',
    category: '',
    tags: [],
    status: 'draft',
    file_url: '',
    cover_image: '',
    preview_url: '',
    file_type: '',
    file_size: '',
    duration: '',
    dimensions: '',
    resolution: '',
  });

  const [uploading, setUploading] = useState(false);
  const [fileUploadProgress, setFileUploadProgress] = useState(0);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileUpload = async (file, uploadType) => {
    setUploading(true);
    setFileUploadProgress(0);

    const formData = new FormData();
    
    if (uploadType === 'file') {
      formData.append('file', file);
      formData.append('product_type', formData.product_type);
    } else if (uploadType === 'cover') {
      formData.append('cover_image', file);
    } else if (uploadType === 'preview') {
      formData.append('preview_file', file);
      formData.append('product_type', formData.product_type);
    }

    try {
      const endpoint = uploadType === 'file' 
        ? '/api/marketplace/tutor/digital-downloads/upload-file'
        : uploadType === 'cover'
        ? '/api/marketplace/tutor/digital-downloads/upload-cover'
        : '/api/marketplace/tutor/digital-downloads/upload-preview';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('tutor_token')}`
        },
        body: formData,
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setFileUploadProgress(percentCompleted);
        }
      });

      const data = await response.json();
      
      if (data.success) {
        if (uploadType === 'file') {
          setFormData(prev => ({
            ...prev,
            file_url: data.data.file_url,
            file_type: data.data.file_type,
            file_size: data.data.file_size
          }));
        } else if (uploadType === 'cover') {
          setFormData(prev => ({
            ...prev,
            cover_image: data.data.cover_image
          }));
        } else if (uploadType === 'preview') {
          setFormData(prev => ({
            ...prev,
            preview_url: data.data.preview_url
          }));
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setFileUploadProgress(0);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.title || !formData.file_url) {
      alert('Title and file are required');
      return;
    }

    try {
      const response = await fetch('/api/marketplace/tutor/digital-downloads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('tutor_token')}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      
      if (data.success) {
        alert('Digital download created successfully!');
        // Reset form or navigate
      } else {
        alert(data.message || 'Failed to create digital download');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred. Please try again.');
    }
  };

  const currentProductType = PRODUCT_TYPES[formData.product_type];

  return (
    <form onSubmit={handleSubmit} className="digital-download-form">
      <h2>Create Digital Download</h2>

      {/* Product Type Selector */}
      <div className="form-group">
        <label>Product Type *</label>
        <select
          name="product_type"
          value={formData.product_type}
          onChange={handleInputChange}
          required
        >
          {Object.entries(PRODUCT_TYPES).map(([key, type]) => (
            <option key={key} value={key}>
              {type.icon} {type.name}
            </option>
          ))}
        </select>
      </div>

      {/* Title */}
      <div className="form-group">
        <label>Title *</label>
        <input
          type="text"
          name="title"
          value={formData.title}
          onChange={handleInputChange}
          required
        />
      </div>

      {/* Description */}
      <div className="form-group">
        <label>Description</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          rows={4}
        />
      </div>

      {/* Author */}
      <div className="form-group">
        <label>Author</label>
        <input
          type="text"
          name="author"
          value={formData.author}
          onChange={handleInputChange}
        />
      </div>

      {/* Product Type Specific Fields */}
      {formData.product_type === 'ebook' && (
        <div className="form-group">
          <label>Pages</label>
          <input
            type="number"
            name="pages"
            value={formData.pages}
            onChange={handleInputChange}
            min="1"
          />
        </div>
      )}

      {(formData.product_type === 'video' || 
        formData.product_type === 'podcast' || 
        formData.product_type === 'music') && (
        <>
          <div className="form-group">
            <label>Duration (seconds)</label>
            <input
              type="number"
              name="duration"
              value={formData.duration}
              onChange={handleInputChange}
              min="1"
            />
          </div>
          {formData.product_type === 'video' && (
            <>
              <div className="form-group">
                <label>Resolution (e.g., 1080p, 4K)</label>
                <input
                  type="text"
                  name="resolution"
                  value={formData.resolution}
                  onChange={handleInputChange}
                />
              </div>
            </>
          )}
        </>
      )}

      {formData.product_type === 'art' && (
        <div className="form-group">
          <label>Dimensions (e.g., 1920x1080)</label>
          <input
            type="text"
            name="dimensions"
            value={formData.dimensions}
            onChange={handleInputChange}
          />
        </div>
      )}

      {/* Price */}
      <div className="form-group">
        <label>Price *</label>
        <div className="price-input-group">
          <input
            type="number"
            name="price"
            value={formData.price}
            onChange={handleInputChange}
            step="0.01"
            min="0"
            required
          />
          <select
            name="currency"
            value={formData.currency}
            onChange={handleInputChange}
          >
            <option value="NGN">NGN</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      {/* Category */}
      <div className="form-group">
        <label>Category</label>
        <input
          type="text"
          name="category"
          value={formData.category}
          onChange={handleInputChange}
        />
      </div>

      {/* Tags */}
      <div className="form-group">
        <label>Tags (comma-separated)</label>
        <input
          type="text"
          name="tags"
          value={formData.tags.join(', ')}
          onChange={(e) => {
            const tags = e.target.value.split(',').map(tag => tag.trim()).filter(Boolean);
            setFormData(prev => ({ ...prev, tags }));
          }}
          placeholder="react, javascript, tutorial"
        />
      </div>

      {/* File Upload */}
      <div className="form-group">
        <label>Main File *</label>
        <input
          type="file"
          accept={currentProductType.fileTypes.join(',')}
          onChange={(e) => {
            const file = e.target.files[0];
            if (file) {
              // Validate file size
              if (file.size > currentProductType.maxSize) {
                alert(`File size exceeds maximum of ${currentProductType.maxSize / (1024 * 1024)}MB`);
                return;
              }
              handleFileUpload(file, 'file');
            }
          }}
        />
        {uploading && <div>Uploading... {fileUploadProgress}%</div>}
        {formData.file_url && (
          <div className="file-info">
            <span>✓ File uploaded</span>
            <span>Size: {(formData.file_size / (1024 * 1024)).toFixed(2)} MB</span>
          </div>
        )}
        <small>
          Max size: {currentProductType.maxSize / (1024 * 1024)}MB
          <br />
          Allowed types: {currentProductType.fileTypes.join(', ')}
        </small>
      </div>

      {/* Cover Image Upload */}
      <div className="form-group">
        <label>Cover Image</label>
        <input
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={(e) => {
            const file = e.target.files[0];
            if (file) {
              handleFileUpload(file, 'cover');
            }
          }}
        />
        {formData.cover_image && (
          <img src={formData.cover_image} alt="Cover" style={{ maxWidth: '200px', marginTop: '10px' }} />
        )}
      </div>

      {/* Preview File Upload (for streaming products) */}
      {currentProductType.streamingEnabled && (
        <div className="form-group">
          <label>Preview File (Optional)</label>
          <input
            type="file"
            accept={currentProductType.fileTypes.join(',')}
            onChange={(e) => {
              const file = e.target.files[0];
              if (file) {
                handleFileUpload(file, 'preview');
              }
            }}
          />
          <small>Upload a short preview/trailer for this product</small>
        </div>
      )}

      {/* Status */}
      <div className="form-group">
        <label>Status</label>
        <select
          name="status"
          value={formData.status}
          onChange={handleInputChange}
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </div>

      <button type="submit" disabled={uploading}>
        {uploading ? 'Creating...' : 'Create Digital Download'}
      </button>
    </form>
  );
};

export default CreateDigitalDownloadForm;
```

### Step 2: Digital Downloads List (Tutor)

```jsx
import React, { useState, useEffect } from 'react';

const TutorDigitalDownloadsList = () => {
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    status: '',
    product_type: '',
    search: ''
  });
  const [pagination, setPagination] = useState({});

  useEffect(() => {
    fetchDownloads();
  }, [filters]);

  const fetchDownloads = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: filters.page,
        limit: filters.limit,
        ...(filters.status && { status: filters.status }),
        ...(filters.product_type && { product_type: filters.product_type }),
        ...(filters.search && { search: filters.search })
      });

      const response = await fetch(
        `/api/marketplace/tutor/digital-downloads?${queryParams}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('tutor_token')}`
          }
        }
      );

      const data = await response.json();
      
      if (data.success) {
        setDownloads(data.data.digital_downloads);
        setPagination(data.data.pagination);
      }
    } catch (error) {
      console.error('Error fetching downloads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const response = await fetch(
        `/api/marketplace/tutor/digital-downloads/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('tutor_token')}`
          }
        }
      );

      const data = await response.json();
      
      if (data.success) {
        fetchDownloads();
      } else {
        alert(data.message || 'Failed to delete product');
      }
    } catch (error) {
      console.error('Error deleting download:', error);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const response = await fetch(
        `/api/marketplace/tutor/digital-downloads/${id}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('tutor_token')}`
          },
          body: JSON.stringify({ status: newStatus })
        }
      );

      const data = await response.json();
      
      if (data.success) {
        fetchDownloads();
      } else {
        alert(data.message || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="digital-downloads-list">
      <h2>My Digital Downloads</h2>

      {/* Filters */}
      <div className="filters">
        <input
          type="text"
          placeholder="Search..."
          value={filters.search}
          onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
        />
        <select
          value={filters.status}
          onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
        <select
          value={filters.product_type}
          onChange={(e) => setFilters(prev => ({ ...prev, product_type: e.target.value, page: 1 }))}
        >
          <option value="">All Types</option>
          <option value="ebook">Ebook</option>
          <option value="podcast">Podcast</option>
          <option value="video">Video</option>
          <option value="music">Music</option>
          <option value="art">Art</option>
          <option value="article">Article</option>
          <option value="code">Code</option>
          <option value="2d_3d_files">2D/3D Files</option>
        </select>
      </div>

      {/* Downloads Grid */}
      <div className="downloads-grid">
        {downloads.map(download => (
          <div key={download.id} className="download-card">
            {download.cover_image && (
              <img src={download.cover_image} alt={download.title} />
            )}
            <h3>{download.title}</h3>
            <p>{download.author}</p>
            <div className="download-meta">
              <span className="product-type">{download.product_type}</span>
              <span className="price">{download.currency} {download.price}</span>
              <span className="sales">{download.sales_count} sales</span>
            </div>
            <div className="download-actions">
              <button onClick={() => handleStatusChange(
                download.id,
                download.status === 'published' ? 'draft' : 'published'
              )}>
                {download.status === 'published' ? 'Unpublish' : 'Publish'}
              </button>
              <button onClick={() => handleDelete(download.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="pagination">
          <button
            disabled={filters.page === 1}
            onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
          >
            Previous
          </button>
          <span>Page {filters.page} of {pagination.totalPages}</span>
          <button
            disabled={filters.page === pagination.totalPages}
            onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default TutorDigitalDownloadsList;
```

---

## Student Implementation

### Step 1: Browse Digital Downloads

```jsx
import React, { useState, useEffect } from 'react';

const BrowseDigitalDownloads = () => {
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    search: '',
    category: '',
    product_type: '',
    min_price: '',
    max_price: '',
    sort: 'newest'
  });
  const [pagination, setPagination] = useState({});

  useEffect(() => {
    fetchDownloads();
  }, [filters]);

  const fetchDownloads = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: filters.page,
        limit: filters.limit,
        sort: filters.sort,
        ...(filters.search && { search: filters.search }),
        ...(filters.category && { category: filters.category }),
        ...(filters.product_type && { product_type: filters.product_type }),
        ...(filters.min_price && { min_price: filters.min_price }),
        ...(filters.max_price && { max_price: filters.max_price })
      });

      const response = await fetch(
        `/api/marketplace/digital-downloads?${queryParams}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('student_token')}`
          }
        }
      );

      const data = await response.json();
      
      if (data.success) {
        setDownloads(data.data.digital_downloads);
        setPagination(data.data.pagination);
      }
    } catch (error) {
      console.error('Error fetching downloads:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="browse-downloads">
      <h2>Digital Downloads Marketplace</h2>

      {/* Filters */}
      <div className="filters">
        <input
          type="text"
          placeholder="Search..."
          value={filters.search}
          onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
        />
        <select
          value={filters.product_type}
          onChange={(e) => setFilters(prev => ({ ...prev, product_type: e.target.value, page: 1 }))}
        >
          <option value="">All Types</option>
          <option value="ebook">📚 Ebook</option>
          <option value="podcast">🎙️ Podcast</option>
          <option value="video">🎬 Video</option>
          <option value="music">🎵 Music</option>
          <option value="art">🎨 Art</option>
          <option value="article">📄 Article</option>
          <option value="code">💻 Code</option>
          <option value="2d_3d_files">🎯 2D/3D Files</option>
        </select>
        <select
          value={filters.sort}
          onChange={(e) => setFilters(prev => ({ ...prev, sort: e.target.value }))}
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="price_low">Price: Low to High</option>
          <option value="price_high">Price: High to Low</option>
          <option value="popular">Most Popular</option>
        </select>
      </div>

      {/* Downloads Grid */}
      <div className="downloads-grid">
        {downloads.map(download => (
          <div key={download.id} className="download-card">
            {download.cover_image && (
              <img src={download.cover_image} alt={download.title} />
            )}
            <h3>{download.title}</h3>
            <p>{download.author}</p>
            <div className="download-meta">
              <span className="product-type">{download.product_type}</span>
              <span className="price">{download.currency} {download.price}</span>
            </div>
            <button onClick={() => window.location.href = `/digital-downloads/${download.id}`}>
              View Details
            </button>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="pagination">
          <button
            disabled={filters.page === 1}
            onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
          >
            Previous
          </button>
          <span>Page {filters.page} of {pagination.totalPages}</span>
          <button
            disabled={filters.page === pagination.totalPages}
            onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default BrowseDigitalDownloads;
```

### Step 2: Digital Download Details Page

```jsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const DigitalDownloadDetails = () => {
  const { id } = useParams();
  const [download, setDownload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    fetchDownloadDetails();
  }, [id]);

  const fetchDownloadDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/marketplace/digital-downloads/${id}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('student_token')}`
          }
        }
      );

      const data = await response.json();
      
      if (data.success) {
        setDownload(data.data.digital_download);
        
        // Fetch preview URL if available
        if (data.data.digital_download.preview_url) {
          fetchPreviewUrl();
        }
      }
    } catch (error) {
      console.error('Error fetching download details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPreviewUrl = async () => {
    try {
      const response = await fetch(
        `/api/marketplace/digital-downloads/${id}/preview-url`
      );

      const data = await response.json();
      
      if (data.success) {
        setPreviewUrl(data.data.preview_url);
      }
    } catch (error) {
      console.error('Error fetching preview:', error);
    }
  };

  const handlePurchase = async () => {
    if (!confirm(`Purchase "${download.title}" for ${download.currency} ${download.price}?`)) {
      return;
    }

    setPurchasing(true);
    try {
      const response = await fetch(
        '/api/marketplace/digital-downloads/purchase',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('student_token')}`
          },
          body: JSON.stringify({
            digital_download_id: parseInt(id)
          })
        }
      );

      const data = await response.json();
      
      if (data.success) {
        alert('Purchase successful!');
        // Refresh download details to show as purchased
        fetchDownloadDetails();
      } else {
        alert(data.message || 'Purchase failed');
      }
    } catch (error) {
      console.error('Error purchasing:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!download) return <div>Digital download not found</div>;

  return (
    <div className="download-details">
      <div className="download-header">
        {download.cover_image && (
          <img src={download.cover_image} alt={download.title} className="cover-image" />
        )}
        <div className="download-info">
          <h1>{download.title}</h1>
          <p className="author">By {download.author}</p>
          <div className="download-meta">
            <span className="product-type">{download.product_type}</span>
            <span className="price">{download.currency} {download.price}</span>
            <span className="sales">{download.sales_count} sales</span>
          </div>
          {download.owner && (
            <p className="owner">Created by {download.owner.name}</p>
          )}
        </div>
      </div>

      <div className="download-content">
        <div className="description">
          <h2>Description</h2>
          <p>{download.description}</p>
        </div>

        {download.tags && download.tags.length > 0 && (
          <div className="tags">
            {download.tags.map((tag, index) => (
              <span key={index} className="tag">{tag}</span>
            ))}
          </div>
        )}

        {/* Preview Section (for streaming products) */}
        {download.streaming_enabled && previewUrl && (
          <div className="preview-section">
            <h2>Preview</h2>
            {download.product_type === 'video' ? (
              <video controls src={previewUrl} style={{ width: '100%', maxWidth: '800px' }} />
            ) : (
              <audio controls src={previewUrl} style={{ width: '100%' }} />
            )}
          </div>
        )}

        {/* Product Details */}
        <div className="product-details">
          <h2>Product Details</h2>
          <ul>
            {download.pages && <li>Pages: {download.pages}</li>}
            {download.duration && <li>Duration: {formatDuration(download.duration)}</li>}
            {download.file_size && <li>File Size: {(download.file_size / (1024 * 1024)).toFixed(2)} MB</li>}
            {download.resolution && <li>Resolution: {download.resolution}</li>}
            {download.dimensions && <li>Dimensions: {download.dimensions}</li>}
            <li>Category: {download.category || 'N/A'}</li>
          </ul>
        </div>
      </div>

      {/* Purchase/Access Section */}
      <div className="purchase-section">
        {download.is_purchased ? (
          <div className="purchased-actions">
            <h3>You own this product</h3>
            {download.streaming_enabled ? (
              <button onClick={handleStreamAccess}>Stream Now</button>
            ) : null}
            {download.download_enabled ? (
              <button onClick={handleDownloadAccess}>Download</button>
            ) : null}
          </div>
        ) : (
          <div className="purchase-actions">
            <h3>Purchase for {download.currency} {download.price}</h3>
            <button onClick={handlePurchase} disabled={purchasing}>
              {purchasing ? 'Processing...' : 'Purchase Now'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

export default DigitalDownloadDetails;
```

### Step 3: My Purchased Downloads

```jsx
import React, { useState, useEffect } from 'react';

const MyPurchasedDownloads = () => {
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    search: '',
    product_type: ''
  });

  useEffect(() => {
    fetchMyDownloads();
  }, [filters]);

  const fetchMyDownloads = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: filters.page,
        limit: filters.limit,
        ...(filters.search && { search: filters.search }),
        ...(filters.product_type && { product_type: filters.product_type })
      });

      const response = await fetch(
        `/api/marketplace/digital-downloads/my-downloads?${queryParams}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('student_token')}`
          }
        }
      );

      const data = await response.json();
      
      if (data.success) {
        setDownloads(data.data.digital_downloads);
      }
    } catch (error) {
      console.error('Error fetching downloads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStreamAccess = async (id, productType) => {
    try {
      const response = await fetch(
        `/api/marketplace/digital-downloads/${id}/stream-url`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('student_token')}`
          }
        }
      );

      const data = await response.json();
      
      if (data.success) {
        // Open streaming URL in new window or player
        window.open(data.data.stream_url, '_blank');
      }
    } catch (error) {
      console.error('Error getting stream URL:', error);
    }
  };

  const handleDownloadAccess = async (id) => {
    try {
      const response = await fetch(
        `/api/marketplace/digital-downloads/${id}/download-url`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('student_token')}`
          }
        }
      );

      const data = await response.json();
      
      if (data.success) {
        // Trigger download
        const link = document.createElement('a');
        link.href = data.data.download_url;
        link.download = '';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Error getting download URL:', error);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="my-downloads">
      <h2>My Digital Downloads</h2>

      {/* Filters */}
      <div className="filters">
        <input
          type="text"
          placeholder="Search..."
          value={filters.search}
          onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
        />
        <select
          value={filters.product_type}
          onChange={(e) => setFilters(prev => ({ ...prev, product_type: e.target.value, page: 1 }))}
        >
          <option value="">All Types</option>
          <option value="ebook">📚 Ebook</option>
          <option value="podcast">🎙️ Podcast</option>
          <option value="video">🎬 Video</option>
          <option value="music">🎵 Music</option>
          <option value="art">🎨 Art</option>
          <option value="article">📄 Article</option>
          <option value="code">💻 Code</option>
          <option value="2d_3d_files">🎯 2D/3D Files</option>
        </select>
      </div>

      {/* Downloads Grid */}
      <div className="downloads-grid">
        {downloads.map(download => (
          <div key={download.id} className="download-card">
            {download.cover_image && (
              <img src={download.cover_image} alt={download.title} />
            )}
            <h3>{download.title}</h3>
            <p>{download.author}</p>
            <div className="download-actions">
              {download.streaming_enabled && (
                <button onClick={() => handleStreamAccess(download.id, download.product_type)}>
                  Stream
                </button>
              )}
              {download.download_enabled && (
                <button onClick={() => handleDownloadAccess(download.id)}>
                  Download
                </button>
              )}
            </div>
            <small>Purchased: {new Date(download.purchased_at).toLocaleDateString()}</small>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MyPurchasedDownloads;
```

---

## File Upload Implementation

### Using Axios with Progress

```javascript
import axios from 'axios';

const uploadFile = async (file, productType, uploadType = 'file') => {
  const formData = new FormData();
  
  if (uploadType === 'file') {
    formData.append('file', file);
    formData.append('product_type', productType);
  } else if (uploadType === 'cover') {
    formData.append('cover_image', file);
  } else if (uploadType === 'preview') {
    formData.append('preview_file', file);
    formData.append('product_type', productType);
  }

  const token = localStorage.getItem('tutor_token');
  
  try {
    const response = await axios.post(
      uploadType === 'file'
        ? '/api/marketplace/tutor/digital-downloads/upload-file'
        : uploadType === 'cover'
        ? '/api/marketplace/tutor/digital-downloads/upload-cover'
        : '/api/marketplace/tutor/digital-downloads/upload-preview',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          // Update progress state
          console.log(`Upload progress: ${percentCompleted}%`);
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};
```

---

## Streaming vs Download

### Streaming Implementation

For videos, podcasts, and music:

```jsx
const StreamPlayer = ({ downloadId, productType }) => {
  const [streamUrl, setStreamUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchStreamUrl = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/marketplace/digital-downloads/${downloadId}/stream-url`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('student_token')}`
          }
        }
      );

      const data = await response.json();
      
      if (data.success) {
        setStreamUrl(data.data.stream_url);
      }
    } catch (error) {
      console.error('Error fetching stream URL:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStreamUrl();
  }, [downloadId]);

  if (loading) return <div>Loading player...</div>;
  if (!streamUrl) return <div>Stream URL not available</div>;

  return (
    <div className="stream-player">
      {productType === 'video' ? (
        <video controls src={streamUrl} style={{ width: '100%' }} />
      ) : (
        <audio controls src={streamUrl} style={{ width: '100%' }} />
      )}
      <p className="expiry-note">
        This stream URL expires in 1 hour. Refresh to get a new URL.
      </p>
    </div>
  );
};
```

### Download Implementation

For all product types:

```javascript
const handleDownload = async (downloadId) => {
  try {
    const response = await fetch(
      `/api/marketplace/digital-downloads/${downloadId}/download-url`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('student_token')}`
        }
      }
    );

    const data = await response.json();
    
    if (data.success) {
      // Create temporary link and trigger download
      const link = document.createElement('a');
      link.href = data.data.download_url;
      link.download = '';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      alert(`Download started! URL expires in ${data.data.expires_in / 3600} hours.`);
    }
  } catch (error) {
    console.error('Error downloading:', error);
    alert('Download failed. Please try again.');
  }
};
```

---

## UI/UX Recommendations

### 1. Product Type Icons
Use consistent icons and colors for each product type:
- 📚 Ebook - Blue
- 🎙️ Podcast - Red
- 🎬 Video - Pink
- 🎵 Music - Purple
- 🎨 Art - Orange
- 📄 Article - Light Blue
- 💻 Code - Green
- 🎯 2D/3D Files - Dark Orange

### 2. File Upload UI
- Show upload progress bar
- Display file size and type validation
- Show preview for images
- Allow drag-and-drop

### 3. Product Cards
- Display cover image prominently
- Show product type badge
- Display price clearly
- Show sales count for social proof
- Include preview button for streaming products

### 4. Streaming Player
- Use HTML5 video/audio players
- Show loading states
- Handle URL expiration gracefully
- Provide refresh mechanism

### 5. Download Experience
- Show download progress
- Handle large file downloads
- Provide download history
- Show expiration warnings

---

## Testing Guide

### 1. Tutor Testing

**Create Digital Download:**
1. Select product type
2. Fill in required fields
3. Upload file (test file size limits)
4. Upload cover image
5. Upload preview (for streaming products)
6. Submit form
7. Verify creation

**Update Digital Download:**
1. Edit existing download
2. Change status (draft ↔ published)
3. Update price
4. Verify changes

**Delete Digital Download:**
1. Delete download with no sales (should work)
2. Try to delete download with sales (should fail)

### 2. Student Testing

**Browse Downloads:**
1. Test search functionality
2. Test filters (product type, category, price)
3. Test sorting options
4. Test pagination

**Purchase Flow:**
1. View product details
2. Check preview (if available)
3. Purchase product
4. Verify wallet deduction
5. Verify purchase appears in "My Downloads"

**Access Purchased Products:**
1. Stream video/podcast/music
2. Download ebook/article/code
3. Test URL expiration (wait 1 hour for stream, 7 days for download)
4. Verify refresh mechanism

### 3. File Upload Testing

**File Size Limits:**
- Ebook: Try uploading > 100MB (should fail)
- Video: Try uploading > 5GB (should fail)
- Test each product type's limits

**File Type Validation:**
- Upload wrong file type (should fail)
- Upload correct file type (should succeed)

**Upload Progress:**
- Test with large files
- Verify progress bar updates
- Test cancellation

### 4. Error Handling

Test these scenarios:
- Network errors
- Invalid file types
- File size exceeded
- Insufficient wallet balance
- Product not found
- Already purchased
- URL expiration

---

## Environment Variables

Add to your `.env` file:

```env
# Digital Downloads Configuration
DIGITAL_DOWNLOADS_BUCKET=digital-downloads
# Or use existing bucket
# EBOOKS_BUCKET=ebooks
```

---

## Support

For issues or questions:
- Check API documentation
- Review error messages in console
- Verify file upload limits
- Check Supabase bucket configuration
- Verify authentication tokens

---

**Last Updated:** 2024-01-20  
**Version:** 1.0.0

