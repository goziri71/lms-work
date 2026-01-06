# Tutor Wallet Management API Documentation

## Overview

This document describes the wallet management API endpoints available for tutors (sole tutors and organizations) to manage their wallet balance, fund their wallet, and view transaction history on the LenerMe marketplace platform.

**Base URL:** `/api/marketplace/tutor/wallet`

**Authentication:** All endpoints require tutor authentication using the `tutorAuthorize` middleware. Include the JWT token in the Authorization header:

```
Authorization: Bearer <access_token>
```

**User Types Supported:**
- `sole_tutor` - Individual tutors
- `organization` - Organization accounts

---

## Table of Contents

1. [Get Wallet Balance](#get-wallet-balance)
2. [Fund Wallet](#fund-wallet)
3. [Get Wallet Transactions](#get-wallet-transactions)

---

## Get Wallet Balance

Get the current wallet balance for the authenticated tutor.

**Endpoint:** `GET /api/marketplace/tutor/wallet/balance`

**Headers:**
```
Authorization: Bearer <tutor_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Wallet balance retrieved successfully",
  "data": {
    "wallet_balance": 5000.00,
    "currency": "NGN"
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - User is not a tutor

**Example Request:**
```javascript
const response = await fetch('/api/marketplace/tutor/wallet/balance', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${tutorToken}`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
console.log('Wallet Balance:', data.data.wallet_balance);
```

---

## Fund Wallet

Fund the tutor's wallet via Flutterwave payment. The frontend should initiate payment with Flutterwave, then send the transaction reference to this endpoint for verification and wallet crediting.

**Endpoint:** `POST /api/marketplace/tutor/wallet/fund`

**Headers:**
```
Authorization: Bearer <tutor_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "transaction_reference": "FLW-1234567890",
  "flutterwave_transaction_id": "1940774374",
  "amount": 10000.00
}
```

**Parameters:**
- `transaction_reference` (string, required if `flutterwave_transaction_id` not provided): Transaction reference from Flutterwave (tx_ref)
- `flutterwave_transaction_id` (string, required if `transaction_reference` not provided): Flutterwave transaction ID
- `amount` (number, optional): Expected amount for verification (will be validated against Flutterwave response)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Wallet funded successfully",
  "data": {
    "transaction": {
      "transaction_reference": "FLW-1234567890",
      "amount": 10000.00,
      "currency": "NGN"
    },
    "wallet": {
      "previous_balance": 5000.00,
      "new_balance": 15000.00,
      "credited": 10000.00,
      "currency": "NGN"
    }
  }
}
```

**Response (200 OK - Already Processed):**
If the transaction was already processed, the endpoint returns the existing transaction info:
```json
{
  "success": true,
  "message": "Wallet funding already processed",
  "data": {
    "transaction": {
      "transaction_reference": "FLW-1234567890",
      "status": "successful",
      "amount": 10000.00
    },
    "wallet": {
      "balance": 15000.00,
      "currency": "NGN"
    }
  }
}
```

**Error Responses:**
- `400 Bad Request` - Missing transaction reference, payment verification failed, payment not successful, or amount mismatch
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - User is not a tutor
- `500 Internal Server Error` - Flutterwave API error or database error

**Payment Flow:**
1. Frontend initiates Flutterwave payment
2. User completes payment on Flutterwave
3. Flutterwave redirects/callbacks with transaction reference
4. Frontend sends transaction reference to this endpoint
5. Backend verifies payment with Flutterwave API
6. Backend credits wallet if payment is successful
7. Backend creates wallet transaction record

**Example Request:**
```javascript
// After Flutterwave payment callback
const response = await fetch('/api/marketplace/tutor/wallet/fund', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${tutorToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    transaction_reference: flutterwaveTxRef,
    flutterwave_transaction_id: flutterwaveTxId,
    amount: 10000.00 // Optional: for verification
  })
});

const data = await response.json();
if (data.success) {
  console.log('Wallet funded! New balance:', data.data.wallet.new_balance);
}
```

**Important Notes:**
- The endpoint is **idempotent** - calling it multiple times with the same transaction reference will not create duplicate transactions
- Payment verification is done via Flutterwave API
- Wallet balance is updated atomically (database transaction)
- Transaction is logged in `tutor_wallet_transactions` table

---

## Get Wallet Transactions

Get paginated list of wallet transactions (funding, subscriptions, coaching hours, etc.) for the authenticated tutor.

**Endpoint:** `GET /api/marketplace/tutor/wallet/transactions`

**Headers:**
```
Authorization: Bearer <tutor_token>
```

**Query Parameters:**
- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Items per page (default: 20)
- `transaction_type` (string, optional): Filter by type - `credit` or `debit`
- `status` (string, optional): Filter by status - `pending`, `successful`, `failed`, `cancelled`
- `start_date` (string, optional): Filter transactions from this date (ISO 8601 format, e.g., "2024-01-01")
- `end_date` (string, optional): Filter transactions to this date (ISO 8601 format, e.g., "2024-12-31")

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Wallet transactions retrieved successfully",
  "data": {
    "transactions": [
      {
        "id": 1,
        "transaction_type": "credit",
        "amount": 10000.00,
        "currency": "NGN",
        "service_name": "Wallet Funding",
        "transaction_reference": "FLW-1234567890",
        "balance_before": 5000.00,
        "balance_after": 15000.00,
        "related_id": null,
        "related_type": null,
        "status": "successful",
        "notes": null,
        "created_at": "2024-01-15T10:00:00.000Z"
      },
      {
        "id": 2,
        "transaction_type": "debit",
        "amount": 249.00,
        "currency": "NGN",
        "service_name": "Subscription Payment - expert",
        "transaction_reference": null,
        "balance_before": 15000.00,
        "balance_after": 14751.00,
        "related_id": 5,
        "related_type": "subscription",
        "status": "successful",
        "notes": null,
        "created_at": "2024-01-16T08:30:00.000Z"
      },
      {
        "id": 3,
        "transaction_type": "debit",
        "amount": 50.00,
        "currency": "NGN",
        "service_name": "Coaching Hours Purchase",
        "transaction_reference": "COACHING-HOURS-123-1705392000000",
        "balance_before": 14751.00,
        "balance_after": 14701.00,
        "related_id": 10,
        "related_type": "coaching_hours",
        "status": "successful",
        "notes": null,
        "created_at": "2024-01-17T14:20:00.000Z"
      }
    ],
    "pagination": {
      "total": 15,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    },
    "summary": {
      "currency": "NGN",
      "total_credits": 50000.00,
      "total_debits": 35249.00,
      "current_balance": 14751.00
    }
  }
}
```

**Transaction Types:**
- `credit` - Money added to wallet (funding)
- `debit` - Money deducted from wallet (subscriptions, coaching hours, etc.)

**Service Names:**
- `Wallet Funding` - Direct wallet funding via Flutterwave
- `Subscription Payment - {tier}` - Subscription payment (e.g., "Subscription Payment - expert")
- `Coaching Hours Purchase` - Purchase of coaching hours

**Related Types:**
- `subscription` - Related to tutor subscription
- `coaching_hours` - Related to coaching hours purchase
- `null` - No related entity (direct funding)

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - User is not a tutor

**Example Requests:**
```javascript
// Get all transactions
const response = await fetch('/api/marketplace/tutor/wallet/transactions?page=1&limit=20', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${tutorToken}`,
    'Content-Type': 'application/json'
  }
});

// Get only credit transactions (funding)
const creditsResponse = await fetch('/api/marketplace/tutor/wallet/transactions?transaction_type=credit', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${tutorToken}`,
    'Content-Type': 'application/json'
  }
});

// Get transactions for a date range
const dateRangeResponse = await fetch(
  '/api/marketplace/tutor/wallet/transactions?start_date=2024-01-01&end_date=2024-01-31',
  {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${tutorToken}`,
      'Content-Type': 'application/json'
    }
  }
);

const data = await response.json();
console.log('Transactions:', data.data.transactions);
console.log('Summary:', data.data.summary);
```

---

## Transaction Tracking

The system automatically tracks wallet transactions for:

### 1. Wallet Funding
- **Type:** `credit`
- **Service Name:** `Wallet Funding`
- **Related Type:** `null`
- **Triggered:** When tutor funds wallet via Flutterwave

### 2. Subscription Payments
- **Type:** `debit`
- **Service Name:** `Subscription Payment - {tier}` (e.g., "Subscription Payment - expert")
- **Related Type:** `subscription`
- **Related ID:** Subscription record ID
- **Triggered:** When tutor subscribes to a paid tier

### 3. Coaching Hours Purchases
- **Type:** `debit`
- **Service Name:** `Coaching Hours Purchase`
- **Related Type:** `coaching_hours`
- **Related ID:** Coaching hours purchase record ID
- **Triggered:** When tutor purchases coaching hours

---

## Frontend Implementation Guide

### 1. Wallet Balance Display

```javascript
// Fetch wallet balance
async function getWalletBalance() {
  try {
    const response = await fetch('/api/marketplace/tutor/wallet/balance', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    if (data.success) {
      return data.data;
    }
  } catch (error) {
    console.error('Error fetching wallet balance:', error);
  }
}
```

### 2. Fund Wallet Flow

```javascript
// Step 1: Initiate Flutterwave payment
async function initiateWalletFunding(amount) {
  // Use Flutterwave SDK to initiate payment
  // Get transaction reference from Flutterwave
  const txRef = await flutterwavePayment(amount);
  return txRef;
}

// Step 2: After Flutterwave callback, verify and fund wallet
async function fundWallet(transactionRef, flutterwaveTxId, expectedAmount) {
  try {
    const response = await fetch('/api/marketplace/tutor/wallet/fund', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transaction_reference: transactionRef,
        flutterwave_transaction_id: flutterwaveTxId,
        amount: expectedAmount
      })
    });
    
    const data = await response.json();
    if (data.success) {
      console.log('Wallet funded! New balance:', data.data.wallet.new_balance);
      return data.data;
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Error funding wallet:', error);
    throw error;
  }
}
```

### 3. Transaction History

```javascript
// Fetch transaction history with filters
async function getWalletTransactions(filters = {}) {
  const params = new URLSearchParams({
    page: filters.page || 1,
    limit: filters.limit || 20,
    ...(filters.transaction_type && { transaction_type: filters.transaction_type }),
    ...(filters.status && { status: filters.status }),
    ...(filters.start_date && { start_date: filters.start_date }),
    ...(filters.end_date && { end_date: filters.end_date })
  });
  
  try {
    const response = await fetch(
      `/api/marketplace/tutor/wallet/transactions?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    const data = await response.json();
    if (data.success) {
      return data.data;
    }
  } catch (error) {
    console.error('Error fetching transactions:', error);
  }
}
```

### 4. React Component Example

```jsx
import { useState, useEffect } from 'react';

function TutorWallet() {
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWalletData();
  }, []);

  async function fetchWalletData() {
    try {
      // Fetch balance and transactions in parallel
      const [balanceRes, transactionsRes] = await Promise.all([
        fetch('/api/marketplace/tutor/wallet/balance', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/marketplace/tutor/wallet/transactions', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const balanceData = await balanceRes.json();
      const transactionsData = await transactionsRes.json();

      if (balanceData.success) {
        setBalance(balanceData.data);
      }

      if (transactionsData.success) {
        setTransactions(transactionsData.data.transactions);
      }
    } catch (error) {
      console.error('Error fetching wallet data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Wallet Balance</h2>
      <p>{balance?.currency} {balance?.wallet_balance.toFixed(2)}</p>
      
      <h3>Recent Transactions</h3>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Service</th>
            <th>Amount</th>
            <th>Balance After</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map(tx => (
            <tr key={tx.id}>
              <td>{new Date(tx.created_at).toLocaleDateString()}</td>
              <td>{tx.transaction_type}</td>
              <td>{tx.service_name}</td>
              <td>{tx.currency} {tx.amount.toFixed(2)}</td>
              <td>{tx.currency} {tx.balance_after.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## Error Handling

### Common Errors

1. **Insufficient Balance**
   - **Error:** `400 Bad Request`
   - **Message:** "Insufficient wallet balance. Required: X NGN, Available: Y NGN. Please fund your wallet first."
   - **Solution:** User needs to fund wallet before making purchase

2. **Payment Verification Failed**
   - **Error:** `400 Bad Request`
   - **Message:** "Payment verification failed: {error message}"
   - **Solution:** Check Flutterwave transaction status, retry if needed

3. **Payment Not Successful**
   - **Error:** `400 Bad Request`
   - **Message:** "Payment was not successful"
   - **Solution:** Payment was not completed on Flutterwave side

4. **Amount Mismatch**
   - **Error:** `400 Bad Request`
   - **Message:** "Payment amount mismatch. Expected: X, Received: Y"
   - **Solution:** Verify the amount sent matches Flutterwave response

---

## Database Schema

### tutor_wallet_transactions Table

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| tutor_id | INTEGER | Tutor ID (sole_tutor or organization) |
| tutor_type | ENUM | 'sole_tutor' or 'organization' |
| transaction_type | ENUM | 'credit' or 'debit' |
| amount | DECIMAL(10,2) | Transaction amount |
| currency | VARCHAR(10) | Currency code (e.g., 'NGN', 'USD') |
| service_name | VARCHAR(100) | Service name |
| transaction_reference | VARCHAR(255) | Payment reference |
| flutterwave_transaction_id | VARCHAR(100) | Flutterwave transaction ID |
| balance_before | DECIMAL(10,2) | Wallet balance before transaction |
| balance_after | DECIMAL(10,2) | Wallet balance after transaction |
| related_id | INTEGER | Related entity ID (subscription, coaching_hours, etc.) |
| related_type | VARCHAR(50) | Related entity type |
| status | ENUM | 'pending', 'successful', 'failed', 'cancelled' |
| notes | TEXT | Additional notes |
| metadata | JSONB | Additional metadata (Flutterwave response, etc.) |
| created_at | TIMESTAMP | Transaction timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

---

## Security Features

1. **Authentication Required:** All endpoints require valid tutor JWT token
2. **Idempotency:** Duplicate funding requests with same transaction reference are prevented
3. **Payment Verification:** All payments are verified with Flutterwave API before crediting wallet
4. **Atomic Transactions:** Wallet updates use database transactions to ensure consistency
5. **Balance Tracking:** Before/after balances are tracked for audit purposes

---

## Integration with Other Features

### Subscription Payments
When a tutor subscribes to a paid tier, the system:
1. Checks wallet balance
2. Deducts subscription amount from wallet
3. Creates wallet transaction record (debit)
4. Activates subscription

### Coaching Hours Purchases
When a tutor purchases coaching hours, the system:
1. Checks wallet balance
2. Deducts purchase amount from wallet
3. Creates wallet transaction record (debit)
4. Adds hours to coaching balance

---

## Testing Checklist

- [ ] Get wallet balance returns correct balance
- [ ] Fund wallet with valid Flutterwave transaction
- [ ] Fund wallet with invalid transaction (should fail)
- [ ] Fund wallet with duplicate transaction (should return existing)
- [ ] Get transactions with pagination
- [ ] Filter transactions by type (credit/debit)
- [ ] Filter transactions by status
- [ ] Filter transactions by date range
- [ ] Verify subscription payment creates debit transaction
- [ ] Verify coaching hours purchase creates debit transaction
- [ ] Verify balance updates correctly after funding
- [ ] Verify balance updates correctly after debits

---

## Notes

- Wallet balance is stored in `sole_tutors.wallet_balance` or `organizations.wallet_balance`
- All wallet movements are logged in `tutor_wallet_transactions` table
- Currency is stored per tutor (default: NGN)
- Multi-currency support is available (tutor's currency is used)
- Transaction history includes complete audit trail
- Summary statistics show total credits, debits, and current balance

---

## Support

For issues or questions:
- Check transaction status in Flutterwave dashboard
- Verify tutor has sufficient balance before purchases
- Review transaction history for audit trail
- Contact support if payment verification fails repeatedly

