# Membership System - Frontend Implementation Guide

## Overview

This document provides complete frontend implementation guide for the Membership System. Memberships allow tutors to bundle multiple products (courses, ebooks, digital downloads, coaching sessions, communities) together and offer them as subscriptions (free, monthly, yearly, or lifetime) to learners.

## Key Concepts

### Membership Structure
- **Tutor creates membership** with name, description, pricing (free/monthly/yearly/lifetime)
- **Tutor adds products** to membership (courses, ebooks, digital downloads, coaching sessions, communities)
- **Learners subscribe** to membership to access all included products
- **Access depends on tutor's subscription** - if tutor subscription expires, all memberships become inactive

### Pricing Models
- **Free**: No payment required
- **Monthly**: Recurring monthly payment
- **Yearly**: One payment per year (covers 12 months)
- **Lifetime**: One-time payment (but access still depends on tutor's subscription)

### Access Logic
- If learner **owns** a product → Show "Owned" badge
- If product is in **active membership** → Show "Member Access" badge
- If **both** → Show "Owned + Member Access" badge
- If membership becomes **inactive** → Learner loses access (unless they own it separately)

---

## API Endpoints

### Tutor Endpoints (Require `tutorAuthorize`)

#### 1. Create Membership
**POST** `/api/marketplace/tutor/memberships`

**Request Body:**
```json
{
  "name": "Premium Learning Package",
  "description": "Complete access to all my courses and resources",
  "category": "Technology & Data",
  "pricing_type": "monthly",
  "price": 29.99,
  "currency": "NGN",
  "products": [
    {
      "product_type": "course",
      "product_id": 5
    },
    {
      "product_type": "ebook",
      "product_id": 3
    }
  ]
}
```

**Response:**
```json
{
  "status": true,
  "code": 201,
  "message": "Membership created successfully",
  "data": {
    "id": 1,
    "tutor_id": 123,
    "tutor_type": "sole_tutor",
    "name": "Premium Learning Package",
    "description": "Complete access to all my courses and resources",
    "category": "Technology & Data",
    "image_url": null,
    "pricing_type": "monthly",
    "price": "29.99",
    "currency": "NGN",
    "status": "active",
    "commission_rate": "0.00",
    "created_at": "2024-01-20T10:00:00Z",
    "updated_at": "2024-01-20T10:00:00Z",
    "products": [
      {
        "id": 1,
        "membership_id": 1,
        "product_type": "course",
        "product_id": 5
      },
      {
        "id": 2,
        "membership_id": 1,
        "product_type": "ebook",
        "product_id": 3
      }
    ]
  }
}
```

**Image Upload:**
- Include `image` field in form-data (multipart/form-data)
- Max file size: 5MB
- Allowed types: JPEG, PNG, WebP

#### 2. Get My Memberships
**GET** `/api/marketplace/tutor/memberships`

**Response:**
```json
{
  "status": true,
  "code": 200,
  "message": "Memberships retrieved successfully",
  "data": [
    {
      "id": 1,
      "name": "Premium Learning Package",
      "pricing_type": "monthly",
      "price": "29.99",
      "status": "active",
      "products": [...]
    }
  ]
}
```

#### 3. Get Single Membership
**GET** `/api/marketplace/tutor/memberships/:id`

#### 4. Update Membership
**PUT** `/api/marketplace/tutor/memberships/:id`

**Request Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "pricing_type": "yearly",
  "price": 299.99
}
```

#### 5. Add Product to Membership
**POST** `/api/marketplace/tutor/memberships/:id/products`

**Request Body:**
```json
{
  "product_type": "course",
  "product_id": 7
}
```

#### 6. Remove Product from Membership
**DELETE** `/api/marketplace/tutor/memberships/:id/products/:productId?product_type=course`

**Note:** `product_type` is required as query parameter.

#### 7. Delete Membership (Deactivate)
**DELETE** `/api/marketplace/tutor/memberships/:id`

**Note:** This sets status to "inactive", doesn't delete the record.

---

### Learner Endpoints (Require `authorize`)

#### 1. Browse Memberships
**GET** `/api/marketplace/memberships`

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20)
- `tutor_id` (optional - filter by tutor)
- `category` (optional - filter by category)
- `pricing_type` (optional - filter by pricing: free, monthly, yearly, lifetime)
- `search` (optional - search by name/description)

**Response:**
```json
{
  "status": true,
  "code": 200,
  "message": "Memberships retrieved successfully",
  "data": {
    "memberships": [
      {
        "id": 1,
        "tutor_id": 123,
        "tutor_type": "sole_tutor",
        "name": "Premium Learning Package",
        "description": "Complete access to all courses",
        "category": "Technology & Data",
        "image_url": "https://...",
        "pricing_type": "monthly",
        "price": "29.99",
        "currency": "NGN",
        "status": "active",
        "tutor_name": "John Doe",
        "product_count": 5,
        "is_subscribed": false
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "totalPages": 3
    }
  }
}
```

#### 2. Get Membership Details
**GET** `/api/marketplace/memberships/:id`

**Response:**
```json
{
  "status": true,
  "code": 200,
  "message": "Membership retrieved successfully",
  "data": {
    "membership": {
      "id": 1,
      "name": "Premium Learning Package",
      "description": "Complete access to all courses",
      "pricing_type": "monthly",
      "price": "29.99",
      "currency": "NGN",
      "status": "active",
      "tutor_name": "John Doe",
      "products": [
        {
          "id": 1,
          "product_type": "course",
          "product_id": 5,
          "product_details": {
            "id": 5,
            "title": "Introduction to Programming",
            "image_url": "https://...",
            "price": "49.99"
          },
          "is_owned": false
        }
      ],
      "is_subscribed": false,
      "subscription": null
    }
  }
}
```

#### 3. Subscribe to Membership
**POST** `/api/marketplace/memberships/:id/subscribe`

**Request Body:**
```json
{
  "payment_method": "wallet" // or "flutterwave"
}
```

**Response:**
```json
{
  "status": true,
  "code": 200,
  "message": "Successfully subscribed to membership",
  "data": {
    "subscription": {
      "id": 1,
      "student_id": 456,
      "membership_id": 1,
      "status": "active",
      "start_date": "2024-01-20T10:00:00Z",
      "end_date": "2024-02-20T10:00:00Z", // null for lifetime
      "next_payment_date": "2024-02-20T10:00:00Z", // null for lifetime
      "auto_renew": true
    },
    "payment": {
      "id": 1,
      "amount": "29.99",
      "currency": "NGN",
      "status": "completed"
    }
  }
}
```

#### 4. Cancel Subscription
**POST** `/api/marketplace/memberships/:id/cancel`

**Response:**
```json
{
  "status": true,
  "code": 200,
  "message": "Subscription cancelled successfully",
  "data": {
    "subscription": {
      "id": 1,
      "status": "cancelled",
      "cancelled_at": "2024-01-25T10:00:00Z"
    }
  }
}
```

#### 5. Get My Subscriptions
**GET** `/api/marketplace/memberships/my-subscriptions`

**Query Parameters:**
- `status` (optional - filter by: active, expired, cancelled)
- `page` (default: 1)
- `limit` (default: 20)

**Response:**
```json
{
  "status": true,
  "code": 200,
  "message": "Subscriptions retrieved successfully",
  "data": {
    "subscriptions": [
      {
        "id": 1,
        "membership_id": 1,
        "membership_name": "Premium Learning Package",
        "membership_image": "https://...",
        "pricing_type": "monthly",
        "price": "29.99",
        "status": "active",
        "start_date": "2024-01-20T10:00:00Z",
        "end_date": "2024-02-20T10:00:00Z",
        "next_payment_date": "2024-02-20T10:00:00Z",
        "auto_renew": true
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

#### 6. Check Product Access
**GET** `/api/marketplace/products/:productType/:productId/access`

**Response:**
```json
{
  "status": true,
  "code": 200,
  "message": "Access information retrieved",
  "data": {
    "has_access": true,
    "access_type": "membership", // "owned", "membership", "both", "none"
    "membership_id": 1,
    "membership_name": "Premium Learning Package",
    "is_owned": false
  }
}
```

---

## Frontend Implementation

### 1. Tutor Dashboard - Membership Management

#### Create Membership Form

```jsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';

function CreateMembershipForm() {
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('description', data.description);
    formData.append('category', data.category);
    formData.append('pricing_type', data.pricing_type);
    formData.append('price', data.price);
    formData.append('currency', data.currency || 'NGN');
    
    // Add products
    formData.append('products', JSON.stringify(selectedProducts));
    
    // Add image if selected
    if (imageFile) {
      formData.append('image', imageFile);
    }

    try {
      const response = await fetch('/api/marketplace/tutor/memberships', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const result = await response.json();
      if (result.status) {
        // Success - redirect or show success message
        console.log('Membership created:', result.data);
      }
    } catch (error) {
      console.error('Error creating membership:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input
        {...register('name', { required: 'Name is required' })}
        placeholder="Membership Name"
      />
      {errors.name && <span>{errors.name.message}</span>}

      <textarea
        {...register('description')}
        placeholder="Description"
      />

      <select {...register('category')}>
        <option value="">Select Category</option>
        <option value="Technology & Data">Technology & Data</option>
        <option value="Business & Management">Business & Management</option>
        {/* ... other categories */}
      </select>

      <select {...register('pricing_type', { required: true })}>
        <option value="">Select Pricing</option>
        <option value="free">Free</option>
        <option value="monthly">Monthly</option>
        <option value="yearly">Yearly</option>
        <option value="lifetime">Lifetime</option>
      </select>

      <input
        type="number"
        step="0.01"
        {...register('price', { 
          required: 'Price is required',
          min: { value: 0, message: 'Price must be 0 or greater' }
        })}
        placeholder="Price"
      />

      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => setImageFile(e.target.files[0])}
      />

      {/* Product Selection Component */}
      <ProductSelector
        selectedProducts={selectedProducts}
        onSelectionChange={setSelectedProducts}
      />

      <button type="submit">Create Membership</button>
    </form>
  );
}
```

#### Product Selector Component

```jsx
function ProductSelector({ selectedProducts, onSelectionChange }) {
  const [products, setProducts] = useState([]);
  const [productType, setProductType] = useState('course');

  useEffect(() => {
    // Fetch tutor's products based on productType
    fetchTutorProducts(productType).then(setProducts);
  }, [productType]);

  const toggleProduct = (product) => {
    const exists = selectedProducts.find(
      p => p.product_type === product.product_type && p.product_id === product.id
    );

    if (exists) {
      onSelectionChange(selectedProducts.filter(
        p => !(p.product_type === product.product_type && p.product_id === product.id)
      ));
    } else {
      onSelectionChange([
        ...selectedProducts,
        { product_type: product.product_type, product_id: product.id }
      ]);
    }
  };

  return (
    <div>
      <select value={productType} onChange={(e) => setProductType(e.target.value)}>
        <option value="course">Courses</option>
        <option value="ebook">Ebooks</option>
        <option value="digital_download">Digital Downloads</option>
        <option value="coaching_session">Coaching Sessions</option>
        <option value="community">Communities</option>
      </select>

      <div>
        {products.map(product => (
          <div key={product.id}>
            <input
              type="checkbox"
              checked={selectedProducts.some(
                p => p.product_type === productType && p.product_id === product.id
              )}
              onChange={() => toggleProduct({ product_type: productType, id: product.id })}
            />
            <label>{product.title || product.name}</label>
          </div>
        ))}
      </div>

      <div>
        <h4>Selected Products ({selectedProducts.length})</h4>
        {selectedProducts.map((p, idx) => (
          <span key={idx}>
            {p.product_type}: {p.product_id}
          </span>
        ))}
      </div>
    </div>
  );
}
```

#### Membership List (Tutor View)

```jsx
function TutorMembershipsList() {
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/marketplace/tutor/memberships', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.status) {
          setMemberships(data.data);
        }
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>My Memberships</h2>
      {memberships.map(membership => (
        <MembershipCard
          key={membership.id}
          membership={membership}
          isTutorView={true}
        />
      ))}
    </div>
  );
}
```

---

### 2. Learner Dashboard - Membership Browsing & Subscription

#### Browse Memberships

```jsx
function BrowseMemberships() {
  const [memberships, setMemberships] = useState([]);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    category: '',
    pricing_type: '',
    search: ''
  });

  useEffect(() => {
    const params = new URLSearchParams(filters);
    fetch(`/api/marketplace/memberships?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.status) {
          setMemberships(data.data.memberships);
        }
      });
  }, [filters]);

  return (
    <div>
      <h2>Browse Memberships</h2>
      
      {/* Filters */}
      <div>
        <input
          placeholder="Search..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
        />
        <select
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value, page: 1 })}
        >
          <option value="">All Categories</option>
          {/* ... categories */}
        </select>
        <select
          value={filters.pricing_type}
          onChange={(e) => setFilters({ ...filters, pricing_type: e.target.value, page: 1 })}
        >
          <option value="">All Pricing</option>
          <option value="free">Free</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
          <option value="lifetime">Lifetime</option>
        </select>
      </div>

      {/* Membership Cards */}
      <div>
        {memberships.map(membership => (
          <MembershipCard
            key={membership.id}
            membership={membership}
            isTutorView={false}
          />
        ))}
      </div>
    </div>
  );
}
```

#### Membership Card Component

```jsx
function MembershipCard({ membership, isTutorView }) {
  const formatPrice = (pricingType, price, currency) => {
    if (pricingType === 'free') return 'Free';
    if (pricingType === 'monthly') return `${currency} ${price}/month`;
    if (pricingType === 'yearly') return `${currency} ${price}/year`;
    if (pricingType === 'lifetime') return `${currency} ${price} (Lifetime)`;
    return `${currency} ${price}`;
  };

  return (
    <div className="membership-card">
      {membership.image_url && (
        <img src={membership.image_url} alt={membership.name} />
      )}
      <h3>{membership.name}</h3>
      <p>{membership.description}</p>
      <div>
        <span className="price">
          {formatPrice(membership.pricing_type, membership.price, membership.currency)}
        </span>
        <span className="product-count">
          {membership.product_count || 0} Products
        </span>
      </div>
      {membership.status === 'inactive' && (
        <span className="badge inactive">Inactive</span>
      )}
      {!isTutorView && (
        <div>
          {membership.is_subscribed ? (
            <button>Manage Subscription</button>
          ) : (
            <button onClick={() => handleSubscribe(membership.id)}>
              Subscribe
            </button>
          )}
        </div>
      )}
      {isTutorView && (
        <div>
          <button onClick={() => handleEdit(membership.id)}>Edit</button>
          <button onClick={() => handleViewDetails(membership.id)}>View Details</button>
        </div>
      )}
    </div>
  );
}
```

#### Subscribe to Membership

```jsx
function SubscribeToMembership({ membershipId }) {
  const [paymentMethod, setPaymentMethod] = useState('wallet');
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/marketplace/memberships/${membershipId}/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ payment_method: paymentMethod })
      });

      const result = await response.json();
      if (result.status) {
        // Success - show success message and redirect
        alert('Successfully subscribed!');
        // Redirect to membership details or my subscriptions
      } else {
        alert(result.message || 'Subscription failed');
      }
    } catch (error) {
      console.error('Error subscribing:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3>Subscribe to Membership</h3>
      <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
        <option value="wallet">Wallet</option>
        <option value="flutterwave">Card/Bank Transfer</option>
      </select>
      <button onClick={handleSubscribe} disabled={loading}>
        {loading ? 'Processing...' : 'Subscribe Now'}
      </button>
    </div>
  );
}
```

#### My Subscriptions

```jsx
function MySubscriptions() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [statusFilter, setStatusFilter] = useState('active');

  useEffect(() => {
    fetch(`/api/marketplace/memberships/my-subscriptions?status=${statusFilter}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.status) {
          setSubscriptions(data.data.subscriptions);
        }
      });
  }, [statusFilter]);

  return (
    <div>
      <h2>My Memberships</h2>
      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
        <option value="active">Active</option>
        <option value="expired">Expired</option>
        <option value="cancelled">Cancelled</option>
        <option value="">All</option>
      </select>

      {subscriptions.map(sub => (
        <SubscriptionCard
          key={sub.id}
          subscription={sub}
          onCancel={() => handleCancelSubscription(sub.membership_id)}
        />
      ))}
    </div>
  );
}
```

---

### 3. Product Access Display

#### Check and Display Access Status

```jsx
function ProductAccessBadge({ productType, productId }) {
  const [accessInfo, setAccessInfo] = useState(null);

  useEffect(() => {
    fetch(`/api/marketplace/products/${productType}/${productId}/access`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.status) {
          setAccessInfo(data.data);
        }
      });
  }, [productType, productId]);

  if (!accessInfo) return null;

  const getBadgeText = () => {
    if (accessInfo.access_type === 'both') return 'Owned + Member Access';
    if (accessInfo.access_type === 'owned') return 'Owned';
    if (accessInfo.access_type === 'membership') return 'Member Access';
    return null;
  };

  const getBadgeColor = () => {
    if (accessInfo.access_type === 'both') return 'green';
    if (accessInfo.access_type === 'owned') return 'blue';
    if (accessInfo.access_type === 'membership') return 'purple';
    return 'gray';
  };

  if (!accessInfo.has_access) {
    return <span className="badge no-access">No Access</span>;
  }

  return (
    <span className={`badge ${getBadgeColor()}`}>
      {getBadgeText()}
    </span>
  );
}
```

---

## Error Handling

### Common Error Responses

**403 Forbidden:**
```json
{
  "status": false,
  "code": 403,
  "message": "Your subscription has expired. Please renew to continue."
}
```

**403 Limit Reached:**
```json
{
  "status": false,
  "code": 403,
  "message": "You have reached your membership limit (1). Please upgrade your subscription."
}
```

**404 Not Found:**
```json
{
  "status": false,
  "code": 404,
  "message": "Membership not found"
}
```

**400 Validation Error:**
```json
{
  "status": false,
  "code": 400,
  "message": "Name is required"
}
```

---

## UI/UX Recommendations

### 1. Membership Card Design
- Show membership image (or placeholder)
- Display pricing prominently
- Show product count
- Indicate subscription status (if learner view)
- Show "Inactive" badge if membership is inactive

### 2. Product Selection (Tutor)
- Allow filtering by product type
- Show product thumbnails
- Display selected products count
- Allow removing products before submission

### 3. Subscription Management
- Show next payment date for monthly/yearly
- Display subscription status clearly
- Allow easy cancellation
- Show payment history

### 4. Access Badges
- Use color coding:
  - Green: Owned + Member Access
  - Blue: Owned
  - Purple: Member Access
  - Gray: No Access
- Show tooltip on hover with membership name

### 5. Empty States
- "No memberships found" when browsing
- "You haven't created any memberships" for tutors
- "You're not subscribed to any memberships" for learners

---

## Testing Checklist

- [ ] Create membership with all pricing types
- [ ] Add/remove products from membership
- [ ] Update membership details
- [ ] Browse memberships with filters
- [ ] Subscribe to membership (wallet & Flutterwave)
- [ ] Cancel subscription
- [ ] Check product access status
- [ ] Verify access badges display correctly
- [ ] Test inactive membership (tutor subscription expired)
- [ ] Verify tier limits (Basic: 1, Professional: 3, Expert: 5)
- [ ] Test image upload
- [ ] Verify pagination works
- [ ] Test error handling

---

## Notes

1. **Tutor Subscription Dependency**: All memberships become inactive if tutor's subscription expires. Always check membership status before allowing access.

2. **Product Ownership**: If a learner owns a product AND it's in their membership, they should see both badges. Access should work via either method.

3. **Lifetime Memberships**: Even though learner pays once, access still depends on tutor's subscription. If tutor subscription expires, lifetime members lose access too.

4. **Yearly Payments**: Learner pays once per year (not 12 monthly payments). Next payment date is calculated as start_date + 12 months.

5. **No Commission**: Memberships have 0% commission rate (unlike other marketplace products).

---

**Last Updated**: January 2025
**Version**: 1.0.0
