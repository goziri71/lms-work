# Password Change Endpoints - Frontend Implementation Guide

## Overview

This document describes the new **Change Password** endpoints that allow authenticated users (students and admins) to change their passwords while logged in. These endpoints require the user to provide their current password for security verification.

**Note:** These endpoints are separate from the existing "Forgot Password" reset flow. Users must be authenticated to use these endpoints.

---

## Table of Contents

1. [Student Change Password](#student-change-password)
2. [Admin Change Password](#admin-change-password)
3. [Error Responses](#error-responses)
4. [Frontend Implementation Guide](#frontend-implementation-guide)
5. [Testing Checklist](#testing-checklist)

---

## Student Change Password

### Endpoint Details

- **URL:** `POST /api/auth/password/change`
- **Authentication:** Required (Student must be logged in)
- **Authorization Header:** `Bearer <access_token>`

### Request Body

```json
{
  "currentPassword": "old_password_123",
  "newPassword": "new_secure_password_456"
}
```

**Field Requirements:**
- `currentPassword` (string, required): User's current password
- `newPassword` (string, required): New password (minimum 6 characters)
- New password must be different from current password

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Password changed successfully. Notification email sent."
}
```

### Example Request (cURL)

```bash
curl -X POST https://api.pinnacleuniversity.co/api/auth/password/change \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <student_access_token>" \
  -d '{
    "currentPassword": "old_password_123",
    "newPassword": "new_secure_password_456"
  }'
```

### Example Request (JavaScript/Fetch)

```javascript
const changePassword = async (currentPassword, newPassword) => {
  try {
    const response = await fetch('/api/auth/password/change', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      },
      body: JSON.stringify({
        currentPassword,
        newPassword
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('Password changed successfully:', data.message);
      return { success: true, data };
    } else {
      console.error('Password change failed:', data.message);
      return { success: false, error: data.message };
    }
  } catch (error) {
    console.error('Network error:', error);
    return { success: false, error: 'Network error occurred' };
  }
};
```

---

## Admin Change Password

### Endpoint Details

- **URL:** `POST /api/admin/password/change`
- **Authentication:** Required (Admin must be logged in)
- **Authorization Header:** `Bearer <admin_access_token>`

### Request Body

```json
{
  "currentPassword": "old_admin_password_123",
  "newPassword": "new_admin_password_456"
}
```

**Field Requirements:**
- `currentPassword` (string, required): Admin's current password
- `newPassword` (string, required): New password (minimum 6 characters)
- New password must be different from current password

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Password changed successfully. Notification email sent."
}
```

### Example Request (cURL)

```bash
curl -X POST https://api.pinnacleuniversity.co/api/admin/password/change \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_access_token>" \
  -d '{
    "currentPassword": "old_admin_password_123",
    "newPassword": "new_admin_password_456"
  }'
```

### Example Request (JavaScript/Fetch)

```javascript
const changeAdminPassword = async (currentPassword, newPassword) => {
  try {
    const response = await fetch('/api/admin/password/change', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('adminAccessToken')}`
      },
      body: JSON.stringify({
        currentPassword,
        newPassword
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('Password changed successfully:', data.message);
      return { success: true, data };
    } else {
      console.error('Password change failed:', data.message);
      return { success: false, error: data.message };
    }
  } catch (error) {
    console.error('Network error:', error);
    return { success: false, error: 'Network error occurred' };
  }
};
```

---

## Error Responses

### Common Error Scenarios

#### 1. Missing Required Fields

**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Current password and new password are required"
}
```

#### 2. Current Password Incorrect

**Status Code:** `401 Unauthorized`

```json
{
  "success": false,
  "message": "Current password is incorrect"
}
```

#### 3. New Password Same as Current

**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "New password must be different from current password"
}
```

#### 4. Password Too Short

**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "New password must be at least 6 characters long"
}
```

#### 5. Unauthorized (Not Logged In)

**Status Code:** `401 Unauthorized`

```json
{
  "success": false,
  "message": "Unauthorized. Please login first."
}
```

#### 6. User Not Found

**Status Code:** `404 Not Found`

```json
{
  "success": false,
  "message": "Student not found"
}
```

or

```json
{
  "success": false,
  "message": "Admin not found"
}
```

---

## Frontend Implementation Guide

### 1. UI/UX Recommendations

#### Password Change Form Fields

- **Current Password Field:**
  - Type: `password`
  - Required: Yes
  - Show/Hide toggle: Recommended
  - Validation: Must match user's current password

- **New Password Field:**
  - Type: `password`
  - Required: Yes
  - Show/Hide toggle: Recommended
  - Validation: 
    - Minimum 6 characters
    - Must be different from current password
    - Consider adding strength indicator

- **Confirm New Password Field (Optional but Recommended):**
  - Type: `password`
  - Required: Yes
  - Validation: Must match new password field

#### User Feedback

- **Success Message:**
  - Display: "Password changed successfully. A confirmation email has been sent to your email address."
  - Action: Redirect to profile/settings page or show success modal

- **Error Messages:**
  - Display specific error message from API response
  - Highlight the field that caused the error
  - Clear error messages after user starts typing

### 2. React Component Example

```jsx
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const ChangePasswordForm = () => {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { user, userType } = useAuth();

  const validateForm = () => {
    const newErrors = {};

    if (!formData.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }

    if (!formData.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (formData.newPassword.length < 6) {
      newErrors.newPassword = 'Password must be at least 6 characters';
    } else if (formData.currentPassword === formData.newPassword) {
      newErrors.newPassword = 'New password must be different from current password';
    }

    if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setSuccess(false);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const endpoint = userType === 'admin' 
        ? '/api/admin/password/change'
        : '/api/auth/password/change';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setFormData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        // Optionally redirect or show success message
        setTimeout(() => setSuccess(false), 5000);
      } else {
        setErrors({ submit: data.message || 'Failed to change password' });
      }
    } catch (error) {
      setErrors({ submit: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="change-password-form">
      <h2>Change Password</h2>

      {success && (
        <div className="alert alert-success">
          Password changed successfully! A confirmation email has been sent.
        </div>
      )}

      {errors.submit && (
        <div className="alert alert-error">
          {errors.submit}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="currentPassword">Current Password</label>
        <input
          type="password"
          id="currentPassword"
          value={formData.currentPassword}
          onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
          className={errors.currentPassword ? 'error' : ''}
        />
        {errors.currentPassword && (
          <span className="error-message">{errors.currentPassword}</span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="newPassword">New Password</label>
        <input
          type="password"
          id="newPassword"
          value={formData.newPassword}
          onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
          className={errors.newPassword ? 'error' : ''}
        />
        {errors.newPassword && (
          <span className="error-message">{errors.newPassword}</span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="confirmPassword">Confirm New Password</label>
        <input
          type="password"
          id="confirmPassword"
          value={formData.confirmPassword}
          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
          className={errors.confirmPassword ? 'error' : ''}
        />
        {errors.confirmPassword && (
          <span className="error-message">{errors.confirmPassword}</span>
        )}
      </div>

      <button type="submit" disabled={loading}>
        {loading ? 'Changing Password...' : 'Change Password'}
      </button>
    </form>
  );
};

export default ChangePasswordForm;
```

### 3. Vue.js Component Example

```vue
<template>
  <form @submit.prevent="handleSubmit" class="change-password-form">
    <h2>Change Password</h2>

    <div v-if="success" class="alert alert-success">
      Password changed successfully! A confirmation email has been sent.
    </div>

    <div v-if="errors.submit" class="alert alert-error">
      {{ errors.submit }}
    </div>

    <div class="form-group">
      <label for="currentPassword">Current Password</label>
      <input
        type="password"
        id="currentPassword"
        v-model="formData.currentPassword"
        :class="{ error: errors.currentPassword }"
      />
      <span v-if="errors.currentPassword" class="error-message">
        {{ errors.currentPassword }}
      </span>
    </div>

    <div class="form-group">
      <label for="newPassword">New Password</label>
      <input
        type="password"
        id="newPassword"
        v-model="formData.newPassword"
        :class="{ error: errors.newPassword }"
      />
      <span v-if="errors.newPassword" class="error-message">
        {{ errors.newPassword }}
      </span>
    </div>

    <div class="form-group">
      <label for="confirmPassword">Confirm New Password</label>
      <input
        type="password"
        id="confirmPassword"
        v-model="formData.confirmPassword"
        :class="{ error: errors.confirmPassword }"
      />
      <span v-if="errors.confirmPassword" class="error-message">
        {{ errors.confirmPassword }}
      </span>
    </div>

    <button type="submit" :disabled="loading">
      {{ loading ? 'Changing Password...' : 'Change Password' }}
    </button>
  </form>
</template>

<script>
import { ref, reactive } from 'vue';
import { useAuthStore } from '@/stores/auth';

export default {
  name: 'ChangePasswordForm',
  setup() {
    const authStore = useAuthStore();
    const formData = reactive({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    const errors = reactive({});
    const loading = ref(false);
    const success = ref(false);

    const validateForm = () => {
      Object.keys(errors).forEach(key => delete errors[key]);

      if (!formData.currentPassword) {
        errors.currentPassword = 'Current password is required';
      }

      if (!formData.newPassword) {
        errors.newPassword = 'New password is required';
      } else if (formData.newPassword.length < 6) {
        errors.newPassword = 'Password must be at least 6 characters';
      } else if (formData.currentPassword === formData.newPassword) {
        errors.newPassword = 'New password must be different from current password';
      }

      if (formData.newPassword !== formData.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }

      return Object.keys(errors).length === 0;
    };

    const handleSubmit = async () => {
      if (!validateForm()) {
        return;
      }

      loading.value = true;
      success.value = false;
      Object.keys(errors).forEach(key => delete errors[key]);

      try {
        const endpoint = authStore.userType === 'admin'
          ? '/api/admin/password/change'
          : '/api/auth/password/change';

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authStore.accessToken}`
          },
          body: JSON.stringify({
            currentPassword: formData.currentPassword,
            newPassword: formData.newPassword
          })
        });

        const data = await response.json();

        if (response.ok) {
          success.value = true;
          formData.currentPassword = '';
          formData.newPassword = '';
          formData.confirmPassword = '';
          setTimeout(() => {
            success.value = false;
          }, 5000);
        } else {
          errors.submit = data.message || 'Failed to change password';
        }
      } catch (error) {
        errors.submit = 'Network error. Please try again.';
      } finally {
        loading.value = false;
      }
    };

    return {
      formData,
      errors,
      loading,
      success,
      handleSubmit
    };
  }
};
</script>
```

### 4. Integration Points

#### Where to Add Change Password Feature

1. **Student Dashboard:**
   - Settings/Profile page
   - Account Security section
   - Link: "Change Password"

2. **Admin Dashboard:**
   - Admin Settings/Profile page
   - Security Settings section
   - Link: "Change Password"

#### Navigation Flow

```
User Profile/Settings Page
  └── Security Section
      └── Change Password Button/Link
          └── Change Password Modal/Page
              └── Form Submission
                  └── Success Message
                      └── Redirect to Profile
```

---

## Testing Checklist

### Student Change Password Endpoint

- [ ] **Valid Request**
  - [ ] Provide correct current password
  - [ ] Provide new password (≥6 characters)
  - [ ] Verify 200 OK response
  - [ ] Verify success message
  - [ ] Verify email notification sent

- [ ] **Invalid Current Password**
  - [ ] Provide incorrect current password
  - [ ] Verify 401 Unauthorized response
  - [ ] Verify error message: "Current password is incorrect"

- [ ] **Missing Fields**
  - [ ] Omit currentPassword
  - [ ] Verify 400 Bad Request response
  - [ ] Omit newPassword
  - [ ] Verify 400 Bad Request response

- [ ] **Password Validation**
  - [ ] New password < 6 characters
  - [ ] Verify 400 Bad Request response
  - [ ] New password same as current password
  - [ ] Verify 400 Bad Request response

- [ ] **Authentication**
  - [ ] Request without token
  - [ ] Verify 401 Unauthorized response
  - [ ] Request with invalid/expired token
  - [ ] Verify 401 Unauthorized response

### Admin Change Password Endpoint

- [ ] **Valid Request**
  - [ ] Provide correct current password
  - [ ] Provide new password (≥6 characters)
  - [ ] Verify 200 OK response
  - [ ] Verify success message
  - [ ] Verify email notification sent
  - [ ] Verify admin activity log entry

- [ ] **Invalid Current Password**
  - [ ] Provide incorrect current password
  - [ ] Verify 401 Unauthorized response
  - [ ] Verify error message: "Current password is incorrect"

- [ ] **Missing Fields**
  - [ ] Omit currentPassword
  - [ ] Verify 400 Bad Request response
  - [ ] Omit newPassword
  - [ ] Verify 400 Bad Request response

- [ ] **Password Validation**
  - [ ] New password < 6 characters
  - [ ] Verify 400 Bad Request response
  - [ ] New password same as current password
  - [ ] Verify 400 Bad Request response

- [ ] **Authentication**
  - [ ] Request without token
  - [ ] Verify 401 Unauthorized response
  - [ ] Request with invalid/expired token
  - [ ] Verify 401 Unauthorized response
  - [ ] Request with student token (should fail)
  - [ ] Verify 401 Unauthorized response

### Frontend Integration Tests

- [ ] **Form Validation**
  - [ ] Empty form submission shows validation errors
  - [ ] Password mismatch shows error
  - [ ] Short password shows error
  - [ ] Same password shows error

- [ ] **User Experience**
  - [ ] Loading state during API call
  - [ ] Success message displays correctly
  - [ ] Error messages display correctly
  - [ ] Form clears after successful submission
  - [ ] Password fields can be toggled (show/hide)

- [ ] **Email Notifications**
  - [ ] User receives password changed email
  - [ ] Email contains correct information
  - [ ] Email sent to correct address

### Postman/API Testing

#### Student Change Password Collection

```json
{
  "name": "Student Change Password",
  "request": {
    "method": "POST",
    "header": [
      {
        "key": "Content-Type",
        "value": "application/json"
      },
      {
        "key": "Authorization",
        "value": "Bearer {{student_access_token}}"
      }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"currentPassword\": \"old_password\",\n  \"newPassword\": \"new_password_123\"\n}"
    },
    "url": {
      "raw": "{{base_url}}/api/auth/password/change",
      "host": ["{{base_url}}"],
      "path": ["api", "auth", "password", "change"]
    }
  }
}
```

#### Admin Change Password Collection

```json
{
  "name": "Admin Change Password",
  "request": {
    "method": "POST",
    "header": [
      {
        "key": "Content-Type",
        "value": "application/json"
      },
      {
        "key": "Authorization",
        "value": "Bearer {{admin_access_token}}"
      }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"currentPassword\": \"old_admin_password\",\n  \"newPassword\": \"new_admin_password_123\"\n}"
    },
    "url": {
      "raw": "{{base_url}}/api/admin/password/change",
      "host": ["{{base_url}}"],
      "path": ["api", "admin", "password", "change"]
    }
  }
}
```

---

## Important Notes

### Security Considerations

1. **Never store passwords in plain text** - Always use password input types
2. **Clear form after submission** - Don't leave passwords in form fields
3. **Use HTTPS** - Always make requests over secure connections
4. **Token expiration** - Handle token expiration gracefully
5. **Rate limiting** - Be aware of potential rate limiting on password change attempts

### Email Notifications

- Users will receive an email notification when their password is successfully changed
- The email includes:
  - Confirmation of password change
  - Timestamp of change
  - IP address and device information
  - Security recommendations

### Difference from Password Reset

| Feature | Change Password | Password Reset |
|---------|----------------|----------------|
| Authentication | Required (logged in) | Not required |
| Current Password | Required | Not required |
| Token | Access token | Reset token (from email) |
| Use Case | User wants to change password | User forgot password |
| Endpoint | `/password/change` | `/password/reset` |

---

## Support

If you encounter any issues during implementation or testing, please contact the backend team or refer to the main API documentation.

**Last Updated:** {{current_date}}
**API Version:** 1.0

