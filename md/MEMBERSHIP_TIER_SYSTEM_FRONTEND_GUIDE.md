# Membership Tier System - Frontend Implementation Guide

## Overview

The membership system has been enhanced with a **tier system** that allows tutors to create multiple pricing tiers within a single membership. Each tier can have different products with different access levels based on the subscription period (monthly/yearly/lifetime).

## Key Changes from Previous System

### Before (Legacy System)
- Single pricing per membership (free/monthly/yearly/lifetime)
- Products directly assigned to membership
- All subscribers get same access

### After (Tier System)
- **Multiple tiers per membership** (e.g., Basic, Pro, Enterprise)
- **Custom tier names** set by tutor
- **Separate pricing** for each tier (monthly/yearly/lifetime prices)
- **Products assigned to tiers** with access levels
- **Tutor-defined access levels** per product and subscription period
- **Upgrade/downgrade** between tiers

## Important Notes

1. **Backward Compatibility**: The system supports both tier-based and legacy memberships
2. **Tier Selection Required**: When subscribing to a tier-based membership, `tier_id` and `pricing_type` are required
3. **Access Levels**: Determined by tutor-defined access levels based on subscription period
4. **Immediate Effect**: Tier changes (upgrade/downgrade) take effect immediately

---

## API Endpoints

### Tutor Endpoints (Require `tutorAuthorize`)

#### 1. Create Membership with Tiers
**POST** `/api/marketplace/tutor/memberships`

**Request Body (Tier System):**
```json
{
  "name": "Premium Learning Package",
  "description": "Complete access to all courses",
  "category": "Technology & Data",
  "currency": "NGN",
  "tiers": [
    {
      "tier_name": "Basic",
      "description": "Access to core courses",
      "monthly_price": 1000,
      "yearly_price": 10000,
      "lifetime_price": 50000,
      "display_order": 0,
      "products": [
        {
          "product_type": "course",
          "product_id": 5,
          "monthly_access_level": "View lessons only",
          "yearly_access_level": "View lessons + assignments",
          "lifetime_access_level": "Full access + certificates"
        }
      ]
    },
    {
      "tier_name": "Pro",
      "description": "Access to all courses + bonus content",
      "monthly_price": 3000,
      "yearly_price": 30000,
      "lifetime_price": 150000,
      "display_order": 1,
      "products": [
        {
          "product_type": "course",
          "product_id": 5,
          "monthly_access_level": "View lessons + assignments",
          "yearly_access_level": "Full access + certificates",
          "lifetime_access_level": "Full access + certificates + bonus materials"
        },
        {
          "product_type": "ebook",
          "product_id": 3,
          "monthly_access_level": "Read online",
          "yearly_access_level": "Read online + download",
          "lifetime_access_level": "Full access"
        }
      ]
    }
  ]
}
```

**Request Body (Legacy - Still Supported):**
```json
{
  "name": "Simple Membership",
  "description": "Basic membership",
  "pricing_type": "monthly",
  "price": 29.99,
  "currency": "NGN",
  "products": [
    {
      "product_type": "course",
      "product_id": 5
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
    "name": "Premium Learning Package",
    "tiers": [
      {
        "id": 1,
        "tier_name": "Basic",
        "monthly_price": "1000.00",
        "yearly_price": "10000.00",
        "lifetime_price": "50000.00",
        "products": [...]
      }
    ]
  }
}
```

#### 2. Create Tier for Existing Membership
**POST** `/api/marketplace/tutor/memberships/:id/tiers`

**Request Body:**
```json
{
  "tier_name": "Enterprise",
  "description": "Full access with premium support",
  "monthly_price": 5000,
  "yearly_price": 50000,
  "lifetime_price": 250000,
  "currency": "NGN",
  "display_order": 2
}
```

#### 3. Get All Tiers for Membership
**GET** `/api/marketplace/tutor/memberships/:id/tiers`

**Response:**
```json
{
  "status": true,
  "code": 200,
  "message": "Tiers retrieved successfully",
  "data": [
    {
      "id": 1,
      "tier_name": "Basic",
      "description": "Access to core courses",
      "monthly_price": "1000.00",
      "yearly_price": "10000.00",
      "lifetime_price": "50000.00",
      "currency": "NGN",
      "display_order": 0,
      "status": "active",
      "products": [
        {
          "id": 1,
          "product_type": "course",
          "product_id": 5,
          "monthly_access_level": "View lessons only",
          "yearly_access_level": "View lessons + assignments",
          "lifetime_access_level": "Full access + certificates"
        }
      ]
    }
  ]
}
```

#### 4. Get Single Tier
**GET** `/api/marketplace/tutor/memberships/:id/tiers/:tierId`

#### 5. Update Tier
**PUT** `/api/marketplace/tutor/memberships/:id/tiers/:tierId`

**Request Body:**
```json
{
  "tier_name": "Updated Basic",
  "monthly_price": 1200,
  "display_order": 1
}
```

#### 6. Delete Tier
**DELETE** `/api/marketplace/tutor/memberships/:id/tiers/:tierId`

**Note:** If tier has active subscriptions, it will be deactivated instead of deleted.

#### 7. Bulk Assign Products to Tiers
**POST** `/api/marketplace/tutor/memberships/:id/tiers/products`

**Request Body:**
```json
{
  "assignments": [
    {
      "tier_id": 1,
      "products": [
        {
          "product_type": "course",
          "product_id": 5,
          "monthly_access_level": "View lessons only",
          "yearly_access_level": "View lessons + assignments",
          "lifetime_access_level": "Full access"
        },
        {
          "product_type": "ebook",
          "product_id": 3,
          "monthly_access_level": "Read online",
          "yearly_access_level": "Read online + download",
          "lifetime_access_level": "Full access"
        }
      ]
    },
    {
      "tier_id": 2,
      "products": [
        {
          "product_type": "course",
          "product_id": 5,
          "monthly_access_level": "View lessons + assignments",
          "yearly_access_level": "Full access + certificates",
          "lifetime_access_level": "Full access + certificates + bonus"
        }
      ]
    }
  ]
}
```

**Response:**
```json
{
  "status": true,
  "code": 201,
  "message": "Products assigned to tiers",
  "data": {
    "results": [
      {
        "tier_id": 1,
        "tier_name": "Basic",
        "products_assigned": 2,
        "products": [
          { "product_type": "course", "product_id": 5, "action": "created" },
          { "product_type": "ebook", "product_id": 3, "action": "created" }
        ]
      }
    ],
    "errors": []
  }
}
```

#### 8. Add Single Product to Tier
**POST** `/api/marketplace/tutor/memberships/:id/tiers/:tierId/products`

**Request Body:**
```json
{
  "product_type": "course",
  "product_id": 7,
  "monthly_access_level": "View lessons only",
  "yearly_access_level": "Full access",
  "lifetime_access_level": "Full access + certificates"
}
```

#### 9. Remove Product from Tier
**DELETE** `/api/marketplace/tutor/memberships/:id/tiers/:tierId/products/:productId?product_type=course`

---

### Learner Endpoints (Require `authorize`)

#### 1. Browse Memberships (Updated)
**GET** `/api/marketplace/memberships`

**Response (Now includes tiers):**
```json
{
  "status": true,
  "code": 200,
  "data": {
    "memberships": [
      {
        "id": 1,
        "name": "Premium Learning Package",
        "tiers": [
          {
            "id": 1,
            "tier_name": "Basic",
            "monthly_price": "1000.00",
            "yearly_price": "10000.00",
            "lifetime_price": "50000.00"
          }
        ],
        "is_subscribed": false
      }
    ]
  }
}
```

#### 2. Get Membership Details (Updated)
**GET** `/api/marketplace/memberships/:id`

**Response (Now includes tiers):**
```json
{
  "status": true,
  "code": 200,
  "data": {
    "membership": {
      "id": 1,
      "name": "Premium Learning Package",
      "tiers": [
        {
          "id": 1,
          "tier_name": "Basic",
          "description": "Access to core courses",
          "monthly_price": "1000.00",
          "yearly_price": "10000.00",
          "lifetime_price": "50000.00",
          "products": [
            {
              "product_type": "course",
              "product_id": 5,
              "monthly_access_level": "View lessons only",
              "yearly_access_level": "View lessons + assignments",
              "lifetime_access_level": "Full access + certificates"
            }
          ]
        }
      ],
      "is_subscribed": false,
      "subscription": null
    }
  }
}
```

#### 3. Subscribe to Membership (Updated)
**POST** `/api/marketplace/memberships/:id/subscribe`

**Request Body (Tier System - REQUIRED):**
```json
{
  "tier_id": 1,
  "pricing_type": "monthly",
  "payment_method": "wallet"
}
```

**Request Body (Legacy - if membership has no tiers):**
```json
{
  "payment_method": "wallet"
}
```

**Response:**
```json
{
  "status": true,
  "code": 201,
  "message": "Successfully subscribed to membership",
  "data": {
    "subscription": {
      "id": 1,
      "membership_id": 1,
      "tier_id": 1,
      "tier_name": "Basic",
      "status": "active",
      "start_date": "2024-01-20T10:00:00Z",
      "end_date": "2024-02-20T10:00:00Z",
      "next_payment_date": "2024-02-20T10:00:00Z"
    },
    "payment": {
      "id": 1,
      "amount": "1000.00",
      "status": "completed"
    },
    "tier": {
      "id": 1,
      "name": "Basic",
      "pricing_type": "monthly"
    }
  }
}
```

#### 4. Change Tier (Upgrade/Downgrade) - NEW
**POST** `/api/marketplace/memberships/:id/change-tier`

**Request Body:**
```json
{
  "new_tier_id": 2,
  "pricing_type": "yearly",
  "payment_method": "wallet"
}
```

**Response (Upgrade):**
```json
{
  "status": true,
  "code": 200,
  "message": "Tier upgrade successful",
  "data": {
    "subscription": {
      "id": 1,
      "tier_id": 2,
      "tier_name": "Pro",
      "status": "active"
    },
    "tier_change": {
      "id": 1,
      "change_type": "upgrade",
      "old_tier_name": "Basic",
      "new_tier_name": "Pro",
      "payment_amount": "29000.00"
    },
    "payment": {
      "id": 2,
      "amount": "29000.00",
      "status": "completed"
    },
    "new_tier": {
      "id": 2,
      "name": "Pro",
      "pricing_type": "yearly"
    }
  }
}
```

**Response (Downgrade):**
```json
{
  "status": true,
  "code": 200,
  "message": "Tier downgrade successful",
  "data": {
    "subscription": {
      "id": 1,
      "tier_id": 1,
      "tier_name": "Basic"
    },
    "tier_change": {
      "id": 2,
      "change_type": "downgrade",
      "old_tier_name": "Pro",
      "new_tier_name": "Basic",
      "refund_amount": "1500.00"
    },
    "refund_amount": "1500.00",
    "new_tier": {
      "id": 1,
      "name": "Basic",
      "pricing_type": "monthly"
    }
  }
}
```

#### 5. Get My Subscriptions (Updated)
**GET** `/api/marketplace/memberships/my-subscriptions`

**Response (Now includes tier info):**
```json
{
  "status": true,
  "code": 200,
  "data": {
    "subscriptions": [
      {
        "id": 1,
        "membership_id": 1,
        "membership_name": "Premium Learning Package",
        "tier_id": 1,
        "tier_name": "Basic",
        "pricing_type": "monthly",
        "price": "1000.00",
        "status": "active",
        "start_date": "2024-01-20T10:00:00Z",
        "end_date": "2024-02-20T10:00:00Z",
        "next_payment_date": "2024-02-20T10:00:00Z"
      }
    ]
  }
}
```

#### 6. Check Product Access (Updated)
**GET** `/api/marketplace/products/:productType/:productId/access`

**Response (Now includes tier and access level):**
```json
{
  "status": true,
  "code": 200,
  "data": {
    "has_access": true,
    "access_type": "membership",
    "is_owned": false,
    "has_membership_access": true,
    "membership_id": 1,
    "membership_name": "Premium Learning Package",
    "tier_id": 1,
    "tier_name": "Basic",
    "access_level": "View lessons + assignments",
    "pricing_period": "yearly"
  }
}
```

---

## Frontend Implementation Guide

### 1. Detecting Tier System

Check if a membership uses the tier system:

```javascript
const hasTiers = membership.tiers && membership.tiers.length > 0;
```

### 2. Membership Creation Form

**For Tier System:**
```jsx
function CreateMembershipForm() {
  const [tiers, setTiers] = useState([
    {
      tier_name: "",
      description: "",
      monthly_price: "",
      yearly_price: "",
      lifetime_price: "",
      products: []
    }
  ]);

  const addTier = () => {
    setTiers([...tiers, {
      tier_name: "",
      description: "",
      monthly_price: "",
      yearly_price: "",
      lifetime_price: "",
      products: []
    }]);
  };

  const handleSubmit = async (data) => {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('description', data.description);
    formData.append('category', data.category);
    formData.append('currency', data.currency || 'NGN');
    formData.append('tiers', JSON.stringify(tiers));

    if (imageFile) {
      formData.append('image', imageFile);
    }

    const response = await fetch('/api/marketplace/tutor/memberships', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Basic membership fields */}
      <input name="name" placeholder="Membership Name" />
      <textarea name="description" placeholder="Description" />
      
      {/* Tiers */}
      {tiers.map((tier, index) => (
        <div key={index}>
          <input
            value={tier.tier_name}
            onChange={(e) => {
              const newTiers = [...tiers];
              newTiers[index].tier_name = e.target.value;
              setTiers(newTiers);
            }}
            placeholder="Tier Name (e.g., Basic, Pro)"
          />
          <input
            type="number"
            value={tier.monthly_price}
            onChange={(e) => {
              const newTiers = [...tiers];
              newTiers[index].monthly_price = e.target.value;
              setTiers(newTiers);
            }}
            placeholder="Monthly Price"
          />
          <input
            type="number"
            value={tier.yearly_price}
            onChange={(e) => {
              const newTiers = [...tiers];
              newTiers[index].yearly_price = e.target.value;
              setTiers(newTiers);
            }}
            placeholder="Yearly Price"
          />
          <input
            type="number"
            value={tier.lifetime_price}
            onChange={(e) => {
              const newTiers = [...tiers];
              newTiers[index].lifetime_price = e.target.value;
              setTiers(newTiers);
            }}
            placeholder="Lifetime Price"
          />
        </div>
      ))}
      
      <button type="button" onClick={addTier}>Add Tier</button>
      <button type="submit">Create Membership</button>
    </form>
  );
}
```

### 3. Membership Details Display

```jsx
function MembershipDetails({ membershipId }) {
  const [membership, setMembership] = useState(null);
  const [selectedTier, setSelectedTier] = useState(null);
  const [selectedPricing, setSelectedPricing] = useState('monthly');

  useEffect(() => {
    fetch(`/api/marketplace/memberships/${membershipId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.status) {
          setMembership(data.data.membership);
          // Auto-select first tier if available
          if (data.data.membership.tiers?.length > 0) {
            setSelectedTier(data.data.membership.tiers[0]);
          }
        }
      });
  }, [membershipId]);

  const hasTiers = membership?.tiers && membership.tiers.length > 0;

  if (!membership) return <div>Loading...</div>;

  return (
    <div>
      <h1>{membership.name}</h1>
      <p>{membership.description}</p>

      {hasTiers ? (
        // Tier System UI
        <div>
          <h2>Choose Your Tier</h2>
          
          {/* Pricing Period Selector */}
          <select value={selectedPricing} onChange={(e) => setSelectedPricing(e.target.value)}>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
            <option value="lifetime">Lifetime</option>
          </select>

          {/* Tier Cards */}
          <div className="tiers-grid">
            {membership.tiers.map(tier => (
              <div
                key={tier.id}
                className={`tier-card ${selectedTier?.id === tier.id ? 'selected' : ''}`}
                onClick={() => setSelectedTier(tier)}
              >
                <h3>{tier.tier_name}</h3>
                <p>{tier.description}</p>
                <div className="price">
                  {selectedPricing === 'monthly' && tier.monthly_price && (
                    <span>{tier.currency} {tier.monthly_price}/month</span>
                  )}
                  {selectedPricing === 'yearly' && tier.yearly_price && (
                    <span>{tier.currency} {tier.yearly_price}/year</span>
                  )}
                  {selectedPricing === 'lifetime' && tier.lifetime_price && (
                    <span>{tier.currency} {tier.lifetime_price} (Lifetime)</span>
                  )}
                </div>
                <ul>
                  {tier.products.map(product => (
                    <li key={product.id}>
                      {product.product_type}: {product.product_id}
                      <small>
                        {selectedPricing === 'monthly' && product.monthly_access_level && (
                          <div>Monthly: {product.monthly_access_level}</div>
                        )}
                        {selectedPricing === 'yearly' && product.yearly_access_level && (
                          <div>Yearly: {product.yearly_access_level}</div>
                        )}
                        {selectedPricing === 'lifetime' && product.lifetime_access_level && (
                          <div>Lifetime: {product.lifetime_access_level}</div>
                        )}
                      </small>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <button
            onClick={() => handleSubscribe(membership.id, selectedTier.id, selectedPricing)}
            disabled={!selectedTier}
          >
            Subscribe to {selectedTier?.tier_name}
          </button>
        </div>
      ) : (
        // Legacy System UI
        <div>
          <div className="price">
            {membership.pricing_type === 'free' && <span>Free</span>}
            {membership.pricing_type === 'monthly' && (
              <span>{membership.currency} {membership.price}/month</span>
            )}
            {membership.pricing_type === 'yearly' && (
              <span>{membership.currency} {membership.price}/year</span>
            )}
            {membership.pricing_type === 'lifetime' && (
              <span>{membership.currency} {membership.price} (Lifetime)</span>
            )}
          </div>
          <button onClick={() => handleSubscribe(membership.id)}>
            Subscribe
          </button>
        </div>
      )}
    </div>
  );
}
```

### 4. Subscribe Function

```javascript
const handleSubscribe = async (membershipId, tierId = null, pricingType = null) => {
  const body = {
    payment_method: 'wallet'
  };

  // Add tier info if tier system
  if (tierId && pricingType) {
    body.tier_id = tierId;
    body.pricing_type = pricingType;
  }

  const response = await fetch(`/api/marketplace/memberships/${membershipId}/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  const result = await response.json();
  if (result.status) {
    // Success - redirect or show success message
    console.log('Subscribed:', result.data);
  }
};
```

### 5. Upgrade/Downgrade Tier

```jsx
function TierChangeModal({ subscription, membership }) {
  const [newTierId, setNewTierId] = useState(null);
  const [pricingType, setPricingType] = useState('monthly');

  const handleChangeTier = async () => {
    const response = await fetch(`/api/marketplace/memberships/${membership.id}/change-tier`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        new_tier_id: newTierId,
        pricing_type: pricingType,
        payment_method: 'wallet'
      })
    });

    const result = await response.json();
    if (result.status) {
      if (result.data.refund_amount) {
        alert(`Downgraded! Refunded: ${result.data.refund_amount}`);
      } else {
        alert(`Upgraded! Payment: ${result.data.payment.amount}`);
      }
      // Refresh subscription data
    }
  };

  return (
    <div className="modal">
      <h3>Change Tier</h3>
      <select value={pricingType} onChange={(e) => setPricingType(e.target.value)}>
        <option value="monthly">Monthly</option>
        <option value="yearly">Yearly</option>
        <option value="lifetime">Lifetime</option>
      </select>
      
      {membership.tiers
        .filter(tier => tier.id !== subscription.tier_id)
        .map(tier => (
          <div key={tier.id}>
            <input
              type="radio"
              name="tier"
              value={tier.id}
              checked={newTierId === tier.id}
              onChange={(e) => setNewTierId(parseInt(e.target.value))}
            />
            <label>
              {tier.tier_name} - {
                pricingType === 'monthly' ? tier.monthly_price :
                pricingType === 'yearly' ? tier.yearly_price :
                tier.lifetime_price
              }
            </label>
          </div>
        ))}
      
      <button onClick={handleChangeTier} disabled={!newTierId}>
        Change Tier
      </button>
    </div>
  );
}
```

### 6. Display Access Level

```jsx
function ProductCard({ product, accessInfo }) {
  return (
    <div className="product-card">
      <h3>{product.title}</h3>
      
      {accessInfo?.has_access && (
        <div className="access-badge">
          {accessInfo.access_type === 'both' && (
            <span className="badge both">Owned + Member Access</span>
          )}
          {accessInfo.access_type === 'owned' && (
            <span className="badge owned">Owned</span>
          )}
          {accessInfo.access_type === 'membership' && (
            <span className="badge membership">
              Member Access ({accessInfo.tier_name})
            </span>
          )}
        </div>
      )}

      {accessInfo?.access_level && (
        <div className="access-level">
          <strong>Your Access:</strong> {accessInfo.access_level}
        </div>
      )}
    </div>
  );
}
```

---

## Migration Checklist

### Frontend Updates Required

- [ ] Update membership creation form to support tiers
- [ ] Update membership details page to show tiers
- [ ] Update subscription flow to require tier selection
- [ ] Add tier comparison UI
- [ ] Add upgrade/downgrade functionality
- [ ] Update subscription list to show tier information
- [ ] Update product access display to show access levels
- [ ] Handle both tier-based and legacy memberships
- [ ] Update error handling for tier-related errors

### UI/UX Recommendations

1. **Tier Selection**: Use card-based UI with clear pricing comparison
2. **Access Levels**: Display access levels prominently for each product
3. **Upgrade/Downgrade**: Make it easy to find and use tier change feature
4. **Pricing Period**: Allow switching between monthly/yearly/lifetime views
5. **Visual Indicators**: Show which tier user is currently on
6. **Comparison Table**: Help users compare tiers side-by-side

---

## Error Handling

### Common Errors

**Tier Required:**
```json
{
  "status": false,
  "code": 400,
  "message": "tier_id is required for this membership"
}
```

**Tier Not Found:**
```json
{
  "status": false,
  "code": 404,
  "message": "Tier not found or inactive"
}
```

**Pricing Not Available:**
```json
{
  "status": false,
  "code": 400,
  "message": "This tier does not support monthly pricing"
}
```

**Already on Tier:**
```json
{
  "status": false,
  "code": 400,
  "message": "You are already subscribed to this tier"
}
```

---

## Testing Checklist

- [ ] Create membership with tiers
- [ ] Create membership without tiers (legacy)
- [ ] Subscribe to tier-based membership
- [ ] Subscribe to legacy membership
- [ ] Upgrade tier
- [ ] Downgrade tier (verify refund)
- [ ] Check product access with tier
- [ ] Check product access with legacy membership
- [ ] Display access levels correctly
- [ ] Handle tier deactivation
- [ ] Bulk assign products to tiers
- [ ] Add/remove individual products from tiers

---

## Notes

1. **Backward Compatibility**: Legacy memberships (without tiers) continue to work
2. **Access Levels**: Defined by tutors, displayed to learners based on their subscription period
3. **Immediate Effect**: Tier changes take effect immediately (no waiting period)
4. **Prorated Refunds**: Downgrades calculate prorated refunds automatically
5. **Full Price Upgrades**: Upgrades charge full new tier price (not prorated)
6. **Tier Limits**: No limit on number of tiers per membership
7. **Tier Names**: Must be unique within a membership

---

**Last Updated**: January 2025  
**Version**: 2.0.0 (Tier System)
