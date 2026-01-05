# Subscription Enforcement Implementation

## Overview

Complete implementation of subscription enforcement system to prevent tutors from bypassing tier limits and ensure proper payment and expiration handling.

---

## ✅ Implemented Features

### 1. Payment Enforcement

**Location:** `src/controllers/marketplace/tutorSubscription.js` - `subscribe()` function

**What it does:**
- ✅ Requires wallet payment before subscription activation
- ✅ Checks wallet balance before creating/updating subscription
- ✅ Deducts payment amount from tutor wallet
- ✅ Uses database transaction to ensure atomicity
- ✅ Free tier doesn't require payment (but has 30-day limit)

**Payment Flow:**
1. Tutor requests subscription
2. System checks wallet balance
3. If insufficient → Error: "Insufficient wallet balance"
4. If sufficient → Deducts from wallet and activates subscription
5. Returns subscription details with payment info

**Error Messages:**
- `Insufficient wallet balance. Required: X NGN, Available: Y NGN. Please fund your wallet first.`

---

### 2. Expiration Checking

**Location:** `src/controllers/marketplace/tutorSubscription.js` - `checkSubscriptionExpiration()` function

**What it does:**
- ✅ Checks if subscription `end_date` has passed
- ✅ Auto-expires subscriptions that have expired
- ✅ Returns expiration status

**When it runs:**
- On tutor login (all login endpoints)
- Before resource creation (courses, digital downloads)
- When getting subscription details

**Free Tier Expiration:**
- Free tier subscriptions expire after 30 days
- After expiration, tutors must upgrade to paid tier to continue creating resources

---

### 3. Subscription Status Validation

**Location:** `src/controllers/marketplace/tutorSubscription.js` - `validateSubscriptionStatus()` function

**What it does:**
- ✅ Validates subscription is active and not expired
- ✅ Blocks resource creation if subscription expired
- ✅ Handles free tier 30-day limit

**Error Messages:**
- `Your subscription has expired. Please renew to continue.`
- `Your free tier subscription has expired (30-day limit). Please upgrade to a paid subscription to continue creating resources.`

---

### 4. Tier Limit Enforcement

**Location:** 
- `src/controllers/marketplace/tutorSubscription.js` - `checkSubscriptionLimit()` function
- `src/controllers/marketplace/tutorCourseManagement.js` - `createCourse()` function
- `src/controllers/marketplace/tutorDigitalDownloadManagement.js` - `createDigitalDownload()` function

**What it does:**
- ✅ Checks subscription limits before creating courses
- ✅ Checks subscription limits before creating digital downloads
- ✅ Blocks creation if limit reached
- ✅ Checks expiration before checking limits

**Enforced Limits:**

| Tier | Courses | Digital Downloads | Communities | Memberships | Coaching |
|------|---------|-------------------|-------------|-------------|----------|
| Free | 2 | 0 | 0 | 0 | Pay-as-you-go |
| Basic | 5 | 0 | 1 | 0 | Pay-as-you-go |
| Professional | 25 | 10 | 1 | 0 | Pay-as-you-go |
| Expert | 100 | 20 | 3 | 5 | Unlimited |
| Grand Master | Unlimited | Unlimited | Unlimited | Unlimited | Unlimited |

**Error Messages:**
- `You have reached your course limit (X). Please upgrade your subscription.`
- `You have reached your digital_download limit (X). Please upgrade your subscription.`

---

### 5. Auto-Expiration on Login

**Location:** `src/controllers/marketplace/tutorAuth.js` - All login functions

**What it does:**
- ✅ Checks subscription expiration on login
- ✅ Auto-expires subscriptions that have passed `end_date`
- ✅ Updates subscription status to "expired"

**Login Endpoints Updated:**
- `soleTutorLogin()`
- `organizationLogin()`
- `unifiedTutorLogin()`
- `organizationUserLogin()`

---

### 6. Free Tier 30-Day Limit

**Location:** `src/controllers/marketplace/tutorSubscription.js`

**What it does:**
- ✅ Free tier subscriptions get `end_date` set to 30 days from creation
- ✅ After 30 days, free tier expires
- ✅ Tutors must upgrade to paid tier to continue creating resources
- ✅ Free tier can be renewed (new 30-day period)

**Implementation:**
- When subscribing to free tier, `end_date` is set to 30 days from now
- `auto_renew` is set to `false` for free tier
- Expiration is checked before resource creation

---

### 7. Auto-Renewal System

**Location:** 
- `src/services/subscriptionRenewalService.js` - New service
- `app.js` - Background job setup

**What it does:**
- ✅ Processes auto-renewals for subscriptions expiring in next 3 days
- ✅ Checks wallet balance for renewal payment
- ✅ Extends subscription by 30 days if payment successful
- ✅ Marks subscription as expired if payment fails
- ✅ Sends email notifications for successful/failed renewals
- ✅ Auto-expires subscriptions that have passed `end_date`

**Background Jobs:**
- **Auto-renewal check:** Runs daily (checks hourly, executes at 2-3 AM)
- **Expiration check:** Runs daily (executes after renewals)

**Email Notifications:**
- ✅ Renewal success email (with payment details)
- ✅ Renewal failure email (insufficient balance warning)

---

## 🔒 Enforcement Points

### Resource Creation
1. **Course Creation** (`POST /api/marketplace/tutor/courses`)
   - ✅ Checks subscription expiration
   - ✅ Checks course limit
   - ✅ Blocks if expired or limit reached

2. **Digital Download Creation** (`POST /api/marketplace/tutor/digital-downloads`)
   - ✅ Checks subscription expiration
   - ✅ Checks digital download limit
   - ✅ Blocks if expired or limit reached

### Subscription Management
1. **Subscription Creation** (`POST /api/marketplace/tutor/subscription`)
   - ✅ Requires payment (wallet check)
   - ✅ Deducts from wallet
   - ✅ Sets 30-day expiration for all tiers (including free)

2. **Get Subscription** (`GET /api/marketplace/tutor/subscription`)
   - ✅ Checks expiration
   - ✅ Auto-expires if needed

### Login
1. **All Tutor Login Endpoints**
   - ✅ Checks subscription expiration
   - ✅ Auto-expires if needed

---

## 📋 Subscription Lifecycle

### Paid Subscription
1. **Subscribe** → Payment required → Subscription active (30 days)
2. **During subscription** → Can create resources up to tier limits
3. **3 days before expiry** → Auto-renewal attempted
4. **If renewal succeeds** → Extended by 30 days
5. **If renewal fails** → Status set to "expired"
6. **After expiry** → Resource creation blocked

### Free Tier
1. **Subscribe to free** → No payment → Subscription active (30 days)
2. **During subscription** → Can create 2 courses, 0 digital downloads
3. **After 30 days** → Subscription expires
4. **After expiry** → Must upgrade to paid tier to continue

---

## 🛡️ Security Features

1. **Payment Verification**
   - Wallet balance checked before subscription activation
   - Transaction rollback if payment fails
   - No subscription without payment (except free tier)

2. **Expiration Enforcement**
   - Multiple checkpoints (login, resource creation, get subscription)
   - Auto-expiration prevents bypassing
   - Status validation before all operations

3. **Limit Enforcement**
   - Real-time limit checking
   - Counts existing resources
   - Blocks creation at limit

---

## 📧 Email Notifications

### Renewal Success
- Sent when subscription auto-renews successfully
- Includes: tier name, amount paid, new end date, wallet balance

### Renewal Failure
- Sent when auto-renewal fails (insufficient balance)
- Includes: required amount, available balance, shortfall
- Includes link to renew subscription

---

## 🔄 Background Jobs

### Auto-Renewal Job
- **Frequency:** Daily (checks hourly, executes at 2-3 AM)
- **Function:** `processAutoRenewals()`
- **What it does:**
  - Finds subscriptions expiring in next 3 days
  - Processes renewal payment
  - Extends subscription or marks as expired
  - Sends email notifications

### Expiration Job
- **Frequency:** Daily (runs after renewals)
- **Function:** `expireSubscriptions()`
- **What it does:**
  - Finds subscriptions past `end_date`
  - Updates status to "expired"

---

## 🧪 Testing Checklist

- [ ] Subscribe to free tier (should work, no payment)
- [ ] Subscribe to paid tier with sufficient balance (should work)
- [ ] Subscribe to paid tier with insufficient balance (should fail)
- [ ] Create course within limit (should work)
- [ ] Create course at limit (should fail)
- [ ] Create course after limit (should fail)
- [ ] Create digital download within limit (should work)
- [ ] Create digital download at limit (should fail)
- [ ] Create resource with expired subscription (should fail)
- [ ] Login with expired subscription (should auto-expire)
- [ ] Auto-renewal with sufficient balance (should extend)
- [ ] Auto-renewal with insufficient balance (should expire)
- [ ] Free tier expires after 30 days (should block creation)

---

## 📝 Notes

1. **Free Tier Renewal:**
   - Free tier can be renewed (new 30-day period)
   - No payment required
   - `auto_renew` is `false` for free tier

2. **Upgrade/Downgrade:**
   - Tutors can upgrade/downgrade anytime
   - Payment required for upgrade
   - Downgrade doesn't refund (but limits apply immediately)

3. **Grace Period:**
   - No grace period implemented
   - Expired subscriptions immediately block resource creation
   - Can be added later if needed

4. **Existing Subscriptions:**
   - Existing subscriptions without `end_date` will need migration
   - Free tier subscriptions will get 30-day limit on next access

---

## 🚀 Next Steps (Optional Enhancements)

1. **Grace Period:**
   - Add 7-day grace period after expiration
   - Allow viewing but not creating resources

2. **Payment Gateway Integration:**
   - Add Flutterwave/payment gateway support
   - Allow credit card payments for subscriptions

3. **Subscription History:**
   - Track subscription changes
   - Show payment history

4. **Usage Analytics:**
   - Track resource creation over time
   - Show usage trends

---

**Last Updated:** January 2024  
**Version:** 1.0.0

