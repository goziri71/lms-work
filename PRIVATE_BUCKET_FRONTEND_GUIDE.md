# Private Bucket Support - Frontend Guide

## ✅ Backend Support

**The backend already handles private buckets automatically!**

When you upload files, the backend:

1. Uploads the file to Supabase storage
2. **Automatically generates a signed URL** (valid for 1 year) if the bucket is private
3. Falls back to public URL if the bucket is public
4. Returns the URL in the response

**You don't need to change your upload code** - it works the same for both public and private buckets!

---

## 🔐 How Private Buckets Work

### Signed URLs

When a bucket is **private**, Supabase requires **signed URLs** to access files. These URLs:

- Include an authentication token in the URL
- Have an expiration time (1 year for uploads, 1 hour for refreshes)
- Allow access without making the bucket public

### URL Format

**Public Bucket URL:**

```
https://{supabase-url}/storage/v1/object/public/student-documents/students/123/profile/image.jpg
```

**Private Bucket Signed URL:**

```
https://{supabase-url}/storage/v1/object/sign/student-documents/students/123/profile/image.jpg?token=abc123...&expires=1234567890
```

---

## 📱 Frontend Implementation

### 1. Using URLs from API Responses

The URLs returned from the API work directly in your frontend:

```javascript
// Upload document
const response = await fetch('/api/student/kyc/documents', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});

const data = await response.json();

// This URL works for both public and private buckets!
const fileUrl = data.data.file_url;

// Use in <img> tag
<img src={fileUrl} alt="Profile" />

// Use in <a> tag for download
<a href={fileUrl} download>Download Document</a>
```

**✅ No changes needed** - the URL works the same way!

---

### 2. Handling Expired URLs (Optional)

Signed URLs expire after **1 year** (for uploads). If a URL expires, you'll get a 403 or 404 error when trying to access it.

**Solution:** Use the refresh endpoint to get a new signed URL.

#### Refresh Signed URL Endpoint

**Endpoint:** `POST /api/student/kyc/documents/signed-url`

**Request Body:**

```json
{
  "document_type": "birth_certificate",
  "file_url": "https://supabase-url.com/.../old-url"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Signed URL generated successfully",
  "data": {
    "document_type": "birth_certificate",
    "signed_url": "https://supabase-url.com/.../new-signed-url?token=...",
    "expires_in": 3600
  }
}
```

#### Frontend Implementation

```javascript
// Function to refresh expired URL
async function refreshDocumentUrl(documentType, oldUrl, token) {
  try {
    const response = await fetch("/api/student/kyc/documents/signed-url", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        document_type: documentType,
        file_url: oldUrl,
      }),
    });

    const data = await response.json();

    if (data.success) {
      return data.data.signed_url;
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error("Failed to refresh URL:", error);
    return null;
  }
}

// Function to load image with automatic refresh on error
async function loadImageWithRefresh(imgElement, documentType, url, token) {
  imgElement.src = url;

  imgElement.onerror = async () => {
    // URL might be expired, try to refresh
    console.log("Image failed to load, refreshing URL...");
    const newUrl = await refreshDocumentUrl(documentType, url, token);

    if (newUrl) {
      imgElement.src = newUrl;
    } else {
      imgElement.alt = "Failed to load image";
    }
  };
}

// Usage
const profileImg = document.getElementById("profile-image");
loadImageWithRefresh(profileImg, "profile_image", profileUrl, token);
```

---

### 3. React Component Example

```jsx
import React, { useState, useEffect } from "react";

function DocumentViewer({ documentType, fileUrl, token }) {
  const [currentUrl, setCurrentUrl] = useState(fileUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refreshUrl = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/student/kyc/documents/signed-url", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          document_type: documentType,
          file_url: fileUrl,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCurrentUrl(data.data.signed_url);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Failed to refresh URL");
    } finally {
      setLoading(false);
    }
  };

  const handleImageError = () => {
    // Try to refresh URL if image fails to load
    refreshUrl();
  };

  // Determine if it's an image or PDF
  const isImage = currentUrl?.match(/\.(jpg|jpeg|png)$/i);

  return (
    <div>
      {isImage ? (
        <img
          src={currentUrl}
          alt={documentType}
          onError={handleImageError}
          style={{ maxWidth: "100%" }}
        />
      ) : (
        <iframe
          src={currentUrl}
          title={documentType}
          style={{ width: "100%", height: "600px" }}
          onError={handleImageError}
        />
      )}

      {error && (
        <div>
          <p>Error: {error}</p>
          <button onClick={refreshUrl} disabled={loading}>
            {loading ? "Refreshing..." : "Retry"}
          </button>
        </div>
      )}
    </div>
  );
}

// Usage
<DocumentViewer
  documentType="birth_certificate"
  fileUrl={studentData.documents.birth_certificate}
  token={userToken}
/>;
```

---

### 4. Error Handling

#### Check if URL is Expired

```javascript
async function checkAndRefreshUrl(url, documentType, token) {
  try {
    // Try to fetch the URL
    const response = await fetch(url, { method: "HEAD" });

    if (response.status === 403 || response.status === 404) {
      // URL expired, refresh it
      console.log("URL expired, refreshing...");
      return await refreshDocumentUrl(documentType, url, token);
    }

    // URL is still valid
    return url;
  } catch (error) {
    // Network error or URL expired
    console.log("URL check failed, refreshing...");
    return await refreshDocumentUrl(documentType, url, token);
  }
}
```

---

## 📋 Summary

### ✅ What You DON'T Need to Do

- ❌ Change upload code (works the same for public/private)
- ❌ Handle authentication for private buckets (backend does it)
- ❌ Generate signed URLs manually (backend does it)

### ✅ What You MAY Need to Do

- ✅ Handle expired URLs (optional - only if URLs expire after 1 year)
- ✅ Add error handling for failed image/document loads
- ✅ Refresh URLs if you get 403/404 errors

### 🔄 Recommended Approach

**Option 1: Simple (Recommended)**

- Use URLs directly from API responses
- Handle errors with user-friendly messages
- URLs are valid for 1 year, so expiration is rare

**Option 2: Robust**

- Implement automatic URL refresh on error
- Check URL validity before displaying
- Cache refreshed URLs

---

## 🧪 Testing

### Test Private Bucket URLs

1. Upload a document
2. Copy the URL from the response
3. Try accessing it directly in browser
4. If it works → bucket is public or URL is valid
5. If 403/404 → URL expired, use refresh endpoint

### Test URL Refresh

```javascript
// Test refresh endpoint
const testRefresh = async () => {
  const response = await fetch("/api/student/kyc/documents/signed-url", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      document_type: "birth_certificate",
      file_url: "https://your-supabase-url.com/.../old-url",
    }),
  });

  const data = await response.json();
  console.log("New URL:", data.data.signed_url);
  console.log("Expires in:", data.data.expires_in, "seconds");
};
```

---

## 📝 Notes

1. **Signed URLs are long** - They include authentication tokens, so they're longer than public URLs. This is normal.

2. **URLs expire** - Signed URLs from uploads expire in 1 year. If you need longer access, use the refresh endpoint.

3. **No CORS issues** - Signed URLs work the same as public URLs for CORS.

4. **Cache considerations** - Browsers may cache signed URLs. If a URL expires, clear cache or use the refresh endpoint.

5. **Security** - Private buckets are more secure. Only people with valid signed URLs can access files.

---

## 🆘 Troubleshooting

### Issue: Images/Documents not loading

**Solution:**

1. Check if URL is expired (403/404 error)
2. Use refresh endpoint to get new URL
3. Update your component with new URL

### Issue: "Failed to generate signed URL" error

**Possible causes:**

- Bucket doesn't exist
- Service role key doesn't have permissions
- File path is incorrect

**Solution:** Contact backend team to check Supabase configuration.

### Issue: URLs work in browser but not in app

**Possible causes:**

- CORS configuration
- URL encoding issues
- Network restrictions

**Solution:** Check browser console for specific errors.

---

## 📞 Support

If you encounter issues with private bucket URLs, contact the backend team with:

- The document type
- The URL (first 50 characters)
- The error message
- Browser console errors (if any)

---

**Last Updated:** January 2024
