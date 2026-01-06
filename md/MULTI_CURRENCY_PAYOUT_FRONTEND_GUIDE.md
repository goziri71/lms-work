# Multi-Currency Payment & Payout System - Frontend Implementation Guide

This guide provides comprehensive instructions for implementing the multi-currency payment and payout system in your frontend application.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Currency Detection](#currency-detection)
3. [FX Conversion](#fx-conversion)
4. [Bank Account Management](#bank-account-management)
5. [Payout System](#payout-system)
6. [API Endpoints Reference](#api-endpoints-reference)
7. [Frontend Implementation Examples](#frontend-implementation-examples)
8. [Testing Guide](#testing-guide)
9. [Error Handling](#error-handling)
10. [Best Practices](#best-practices)

---

## 🌍 Overview

The system supports:
- **Multi-currency payments**: Accept payments from students in their local currency
- **Automatic currency detection**: Based on user's country
- **Real-time FX conversion**: Using Flutterwave rates API
- **Tutor payouts**: Automatic transfers to tutor's local bank account
- **Bank account management**: Add, verify, and manage bank accounts

### Supported Countries & Currencies

- **Nigeria** → NGN (₦)
- **Ghana** → GHS (₵)
- **Kenya** → KES (KSh)
- **South Africa** → ZAR (R)
- **Uganda** → UGX (USh)
- **Tanzania** → TZS (TSh)
- **Rwanda** → RWF (RF)
- **Zambia** → ZMW (ZK)
- **Cameroon** → XAF (FCFA)
- **Ivory Coast** → XOF (CFA)
- **Senegal** → XOF (CFA)
- **Malawi** → MWK (MK)
- **Mauritius** → MUR (₨)
- **Egypt** → EGP (E£)
- **United Kingdom** → GBP (£)
- **United States** → USD ($)
- **Canada** → CAD (C$)
- **Rest of Europe** → EUR (€)
- **Unsupported countries** → USD (default)

---

## 🔍 Currency Detection

### Automatic Detection at Login

Currency is automatically detected and set when users log in based on their country.

**Login Response Includes Currency:**

```json
{
  "success": true,
  "data": {
    "tutor": {
      "id": 1,
      "fname": "John",
      "lname": "Doe",
      "email": "john@example.com",
      "country": "Nigeria",
      "currency": "NGN",
      "wallet_balance": 50000.00
    },
    "accessToken": "...",
    "userType": "sole_tutor"
  }
}
```

### Manual Currency Detection

If you need to detect currency from country name:

```javascript
// The backend automatically handles this, but you can use it for display
const countryToCurrency = {
  "Nigeria": "NGN",
  "Ghana": "GHS",
  "Kenya": "KES",
  "South Africa": "ZAR",
  // ... etc
};
```

---

## 💱 FX Conversion

### Displaying Prices in User's Currency

When showing prices to users, convert from base currency to their currency:

```javascript
// Example: Convert course price to user's currency
async function getPriceInUserCurrency(basePrice, baseCurrency, userCurrency) {
  if (baseCurrency === userCurrency) {
    return basePrice;
  }

  try {
    const response = await fetch('/api/marketplace/fx/convert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        amount: basePrice,
        from_currency: baseCurrency,
        to_currency: userCurrency
      })
    });

    const data = await response.json();
    return data.data.converted_amount;
  } catch (error) {
    console.error('FX conversion error:', error);
    return basePrice; // Fallback to original price
  }
}
```

### Formatting Currency

```javascript
function formatCurrency(amount, currency) {
  const symbols = {
    NGN: "₦",
    USD: "$",
    GBP: "£",
    EUR: "€",
    GHS: "₵",
    KES: "KSh",
    ZAR: "R",
    // ... etc
  };

  const symbol = symbols[currency] || currency;
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);

  // Prefix for some currencies, suffix for others
  if (['NGN', 'USD', 'GBP', 'EUR', 'GHS', 'CAD'].includes(currency)) {
    return `${symbol}${formatted}`;
  }
  return `${formatted} ${symbol}`;
}

// Usage
formatCurrency(1000, 'NGN'); // "₦1,000.00"
formatCurrency(100, 'USD');  // "$100.00"
formatCurrency(500, 'KES');  // "500.00 KSh"
```

---

## 🏦 Bank Account Management

### 1. Get List of Banks for a Country

```javascript
async function getBanks(countryCode = 'NG') {
  try {
    const response = await fetch(
      `/api/marketplace/tutor/bank-accounts/banks?country=${countryCode}`,
      {
        headers: {
          'Authorization': `Bearer ${tutorToken}`
        }
      }
    );

    const data = await response.json();
    return data.data.banks;
  } catch (error) {
    console.error('Error fetching banks:', error);
    throw error;
  }
}

// Usage
const banks = await getBanks('NG');
// Returns: [{ id: "bnk_xxx", code: "044", name: "Access Bank" }, ...]
```

### 2. Add Bank Account

```javascript
async function addBankAccount(accountData) {
  try {
    const response = await fetch('/api/marketplace/tutor/bank-accounts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tutorToken}`
      },
      body: JSON.stringify({
        account_name: accountData.accountName,
        account_number: accountData.accountNumber,
        bank_code: accountData.bankCode,
        bank_name: accountData.bankName,
        country: accountData.country, // e.g., 'NG', 'GH', 'KE'
        verify: true // Automatically verify account
      })
    });

    const data = await response.json();
    
    if (data.success) {
      return data.data;
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Error adding bank account:', error);
    throw error;
  }
}

// Usage
const newAccount = await addBankAccount({
  accountName: "John Doe",
  accountNumber: "0123456789",
  bankCode: "044",
  bankName: "Access Bank",
  country: "NG"
});
```

### 3. List Bank Accounts

```javascript
async function getBankAccounts() {
  try {
    const response = await fetch('/api/marketplace/tutor/bank-accounts', {
      headers: {
        'Authorization': `Bearer ${tutorToken}`
      }
    });

    const data = await response.json();
    return data.data.accounts;
  } catch (error) {
    console.error('Error fetching bank accounts:', error);
    throw error;
  }
}

// Usage
const accounts = await getBankAccounts();
// Returns: [{ id, account_name, bank_name, is_verified, is_primary, ... }, ...]
```

### 4. Verify Bank Account

```javascript
async function verifyBankAccount(accountId) {
  try {
    const response = await fetch(
      `/api/marketplace/tutor/bank-accounts/${accountId}/verify`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tutorToken}`
        }
      }
    );

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error verifying bank account:', error);
    throw error;
  }
}
```

### 5. Set Primary Account

```javascript
async function setPrimaryAccount(accountId) {
  try {
    const response = await fetch(
      `/api/marketplace/tutor/bank-accounts/${accountId}/set-primary`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${tutorToken}`
        }
      }
    );

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error setting primary account:', error);
    throw error;
  }
}
```

### 6. Delete Bank Account

```javascript
async function deleteBankAccount(accountId) {
  try {
    const response = await fetch(
      `/api/marketplace/tutor/bank-accounts/${accountId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${tutorToken}`
        }
      }
    );

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting bank account:', error);
    throw error;
  }
}
```

---

## 💰 Payout System

### 1. Request Payout

```javascript
async function requestPayout(amount, bankAccountId = null) {
  try {
    const response = await fetch('/api/marketplace/tutor/payouts/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tutorToken}`
      },
      body: JSON.stringify({
        amount: amount, // Amount in base currency (e.g., NGN)
        bank_account_id: bankAccountId, // Optional: uses primary if not provided
        // currency: "NGN" // Optional: defaults to bank account currency
      })
    });

    const data = await response.json();
    
    if (data.success) {
      return data.data;
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Error requesting payout:', error);
    throw error;
  }
}

// Usage
const payout = await requestPayout(50000); // Request 50,000 NGN payout
// Returns: { id, amount, currency, converted_amount, fx_rate, status, reference, ... }
```

### 2. List Payouts

```javascript
async function getPayouts(page = 1, limit = 20, status = null) {
  try {
    let url = `/api/marketplace/tutor/payouts?page=${page}&limit=${limit}`;
    if (status) {
      url += `&status=${status}`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${tutorToken}`
      }
    });

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching payouts:', error);
    throw error;
  }
}

// Usage
const { payouts, pagination } = await getPayouts(1, 20, 'successful');
```

### 3. Get Payout Details

```javascript
async function getPayoutDetails(payoutId) {
  try {
    const response = await fetch(
      `/api/marketplace/tutor/payouts/${payoutId}`,
      {
        headers: {
          'Authorization': `Bearer ${tutorToken}`
        }
      }
    );

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching payout details:', error);
    throw error;
  }
}
```

---

## 📡 API Endpoints Reference

### Bank Account Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/marketplace/tutor/bank-accounts/banks?country=NG` | Get banks for a country |
| POST | `/api/marketplace/tutor/bank-accounts` | Add bank account |
| GET | `/api/marketplace/tutor/bank-accounts` | List bank accounts |
| POST | `/api/marketplace/tutor/bank-accounts/:id/verify` | Verify account |
| PUT | `/api/marketplace/tutor/bank-accounts/:id/set-primary` | Set primary account |
| DELETE | `/api/marketplace/tutor/bank-accounts/:id` | Delete account |

### Payout Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/marketplace/tutor/payouts/request` | Request payout |
| GET | `/api/marketplace/tutor/payouts` | List payouts |
| GET | `/api/marketplace/tutor/payouts/:id` | Get payout details |

---

## 💻 Frontend Implementation Examples

### React Component: Bank Account Management

```jsx
import React, { useState, useEffect } from 'react';

function BankAccountManagement() {
  const [banks, setBanks] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    accountName: '',
    accountNumber: '',
    bankCode: '',
    bankName: '',
    country: 'NG'
  });

  // Fetch banks when country changes
  useEffect(() => {
    fetchBanks(formData.country);
  }, [formData.country]);

  // Fetch user's bank accounts
  useEffect(() => {
    fetchBankAccounts();
  }, []);

  const fetchBanks = async (country) => {
    try {
      const response = await fetch(
        `/api/marketplace/tutor/bank-accounts/banks?country=${country}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('tutorToken')}`
          }
        }
      );
      const data = await response.json();
      setBanks(data.data.banks || []);
    } catch (error) {
      console.error('Error fetching banks:', error);
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const response = await fetch('/api/marketplace/tutor/bank-accounts', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('tutorToken')}`
        }
      });
      const data = await response.json();
      setAccounts(data.data.accounts || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const handleAddAccount = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/marketplace/tutor/bank-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('tutorToken')}`
        },
        body: JSON.stringify({
          account_name: formData.accountName,
          account_number: formData.accountNumber,
          bank_code: formData.bankCode,
          bank_name: formData.bankName,
          country: formData.country,
          verify: true
        })
      });

      const data = await response.json();

      if (data.success) {
        alert('Bank account added successfully!');
        setFormData({
          accountName: '',
          accountNumber: '',
          bankCode: '',
          bankName: '',
          country: 'NG'
        });
        fetchBankAccounts();
      } else {
        alert(data.message || 'Failed to add bank account');
      }
    } catch (error) {
      alert('Error adding bank account');
    } finally {
      setLoading(false);
    }
  };

  const handleBankSelect = (bankCode) => {
    const selectedBank = banks.find(b => b.code === bankCode);
    setFormData({
      ...formData,
      bankCode: bankCode,
      bankName: selectedBank?.name || ''
    });
  };

  return (
    <div className="bank-account-management">
      <h2>Bank Account Management</h2>

      {/* Add Bank Account Form */}
      <form onSubmit={handleAddAccount}>
        <div>
          <label>Country</label>
          <select
            value={formData.country}
            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
          >
            <option value="NG">Nigeria</option>
            <option value="GH">Ghana</option>
            <option value="KE">Kenya</option>
            <option value="ZA">South Africa</option>
            {/* Add more countries */}
          </select>
        </div>

        <div>
          <label>Bank</label>
          <select
            value={formData.bankCode}
            onChange={(e) => handleBankSelect(e.target.value)}
            required
          >
            <option value="">Select Bank</option>
            {banks.map(bank => (
              <option key={bank.code} value={bank.code}>
                {bank.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Account Name</label>
          <input
            type="text"
            value={formData.accountName}
            onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
            required
          />
        </div>

        <div>
          <label>Account Number</label>
          <input
            type="text"
            value={formData.accountNumber}
            onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
            required
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Adding...' : 'Add Bank Account'}
        </button>
      </form>

      {/* List of Bank Accounts */}
      <div className="accounts-list">
        <h3>Your Bank Accounts</h3>
        {accounts.map(account => (
          <div key={account.id} className="account-card">
            <h4>{account.bank_name}</h4>
            <p>Account: {account.account_number}</p>
            <p>Currency: {account.currency}</p>
            <p>Status: {account.is_verified ? '✓ Verified' : '✗ Not Verified'}</p>
            {account.is_primary && <span className="badge">Primary</span>}
            {!account.is_verified && (
              <button onClick={() => verifyAccount(account.id)}>
                Verify Account
              </button>
            )}
            {!account.is_primary && (
              <button onClick={() => setPrimary(account.id)}>
                Set as Primary
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default BankAccountManagement;
```

### React Component: Payout Request

```jsx
import React, { useState, useEffect } from 'react';

function PayoutRequest() {
  const [walletBalance, setWalletBalance] = useState(0);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchWalletBalance();
    fetchBankAccounts();
  }, []);

  const fetchWalletBalance = async () => {
    // Fetch from earnings endpoint
    const response = await fetch('/api/marketplace/tutor/earnings/summary', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('tutorToken')}`
      }
    });
    const data = await response.json();
    setWalletBalance(data.data.wallet.balance);
  };

  const fetchBankAccounts = async () => {
    const response = await fetch('/api/marketplace/tutor/bank-accounts', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('tutorToken')}`
      }
    });
    const data = await response.json();
    setAccounts(data.data.accounts || []);
    
    // Set primary account as default
    const primary = data.data.accounts.find(a => a.is_primary);
    if (primary) {
      setSelectedAccount(primary.id);
    }
  };

  const handleRequestPayout = async (e) => {
    e.preventDefault();
    
    if (parseFloat(amount) > walletBalance) {
      alert('Insufficient balance');
      return;
    }

    if (!selectedAccount) {
      alert('Please select a bank account');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/marketplace/tutor/payouts/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('tutorToken')}`
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          bank_account_id: selectedAccount
        })
      });

      const data = await response.json();

      if (data.success) {
        alert(`Payout request submitted! Reference: ${data.data.reference}`);
        setAmount('');
        fetchWalletBalance();
      } else {
        alert(data.message || 'Failed to request payout');
      }
    } catch (error) {
      alert('Error requesting payout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="payout-request">
      <h2>Request Payout</h2>

      <div className="wallet-info">
        <p>Available Balance: {formatCurrency(walletBalance, 'NGN')}</p>
      </div>

      <form onSubmit={handleRequestPayout}>
        <div>
          <label>Bank Account</label>
          <select
            value={selectedAccount || ''}
            onChange={(e) => setSelectedAccount(e.target.value)}
            required
          >
            <option value="">Select Bank Account</option>
            {accounts
              .filter(a => a.is_verified)
              .map(account => (
                <option key={account.id} value={account.id}>
                  {account.bank_name} - {account.account_number} ({account.currency})
                </option>
              ))}
          </select>
        </div>

        <div>
          <label>Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="1"
            max={walletBalance}
            step="0.01"
            required
          />
          <small>Maximum: {formatCurrency(walletBalance, 'NGN')}</small>
        </div>

        <button type="submit" disabled={loading || !selectedAccount}>
          {loading ? 'Processing...' : 'Request Payout'}
        </button>
      </form>
    </div>
  );
}

export default PayoutRequest;
```

### React Component: Payout History

```jsx
import React, { useState, useEffect } from 'react';

function PayoutHistory() {
  const [payouts, setPayouts] = useState([]);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchPayouts(page, statusFilter);
  }, [page, statusFilter]);

  const fetchPayouts = async (pageNum, status) => {
    try {
      let url = `/api/marketplace/tutor/payouts?page=${pageNum}&limit=20`;
      if (status) {
        url += `&status=${status}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('tutorToken')}`
        }
      });

      const data = await response.json();
      setPayouts(data.data.payouts || []);
      setPagination(data.data.pagination || {});
    } catch (error) {
      console.error('Error fetching payouts:', error);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { class: 'badge-warning', text: 'Pending' },
      processing: { class: 'badge-info', text: 'Processing' },
      successful: { class: 'badge-success', text: 'Successful' },
      failed: { class: 'badge-danger', text: 'Failed' },
      cancelled: { class: 'badge-secondary', text: 'Cancelled' }
    };
    return badges[status] || badges.pending;
  };

  return (
    <div className="payout-history">
      <h2>Payout History</h2>

      <div className="filters">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="successful">Successful</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <table>
        <thead>
          <tr>
            <th>Reference</th>
            <th>Amount</th>
            <th>Currency</th>
            <th>Status</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {payouts.map(payout => {
            const badge = getStatusBadge(payout.status);
            return (
              <tr key={payout.id}>
                <td>{payout.reference}</td>
                <td>{formatCurrency(payout.amount, payout.currency)}</td>
                <td>{payout.currency}</td>
                <td>
                  <span className={`badge ${badge.class}`}>
                    {badge.text}
                  </span>
                </td>
                <td>{new Date(payout.created_at).toLocaleDateString()}</td>
                <td>
                  <button onClick={() => viewDetails(payout.id)}>
                    View Details
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="pagination">
        <button
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>
        <span>Page {page} of {pagination.pages || 1}</span>
        <button
          disabled={page >= (pagination.pages || 1)}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default PayoutHistory;
```

---

## 🧪 Testing Guide

### 1. Test Currency Detection

```javascript
// Test 1: Login and check currency
const loginResponse = await fetch('/api/marketplace/tutor/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'tutor@example.com',
    password: 'password'
  })
});

const loginData = await loginResponse.json();
console.log('Detected Currency:', loginData.data.tutor.currency);
// Expected: Currency based on tutor's country
```

### 2. Test Bank Account Management

```javascript
// Test 2: Add bank account
const addAccountResponse = await fetch('/api/marketplace/tutor/bank-accounts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    account_name: 'John Doe',
    account_number: '0123456789',
    bank_code: '044',
    bank_name: 'Access Bank',
    country: 'NG',
    verify: true
  })
});

const accountData = await addAccountResponse.json();
console.log('Account Added:', accountData);
// Expected: { success: true, data: { id, is_verified: true/false, ... } }
```

### 3. Test Payout Request

```javascript
// Test 3: Request payout
const payoutResponse = await fetch('/api/marketplace/tutor/payouts/request', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    amount: 1000,
    bank_account_id: 1
  })
});

const payoutData = await payoutResponse.json();
console.log('Payout Requested:', payoutData);
// Expected: { success: true, data: { id, status: 'pending', reference, ... } }
```

### 4. Test Payout Status Check

```javascript
// Test 4: Check payout status
const statusResponse = await fetch('/api/marketplace/tutor/payouts/1', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const statusData = await statusResponse.json();
console.log('Payout Status:', statusData.data.status);
// Expected: 'pending', 'processing', 'successful', or 'failed'
```

---

## ⚠️ Error Handling

### Common Errors and Solutions

#### 1. Insufficient Balance

```javascript
// Error Response
{
  "success": false,
  "message": "Insufficient balance. Available: 5000"
}

// Handle in frontend
if (error.message.includes('Insufficient balance')) {
  alert('You do not have enough balance for this payout');
}
```

#### 2. Bank Account Not Verified

```javascript
// Error Response
{
  "success": false,
  "message": "Bank account is not verified. Please verify your account first."
}

// Handle in frontend
if (error.message.includes('not verified')) {
  // Redirect to verification page or show verify button
  showVerificationModal(accountId);
}
```

#### 3. Invalid Bank Account

```javascript
// Error Response
{
  "success": false,
  "message": "Invalid account details"
}

// Handle in frontend
if (error.message.includes('Invalid account')) {
  alert('The bank account details are invalid. Please check and try again.');
}
```

#### 4. Payout Processing Error

```javascript
// Error Response
{
  "success": false,
  "message": "Transfer processing error"
}

// Handle in frontend
// The system automatically refunds the wallet balance on failure
// Show user-friendly message
alert('Payout processing failed. Your balance has been refunded. Please try again.');
```

---

## ✅ Best Practices

### 1. Currency Display

- Always show prices in user's currency
- Display both original and converted prices for transparency
- Update prices when currency changes
- Cache FX rates for better performance

### 2. Bank Account Security

- Never display full account numbers (mask them: `0123****`)
- Require verification before allowing payouts
- Show verification status clearly
- Allow users to set primary account

### 3. Payout UX

- Show wallet balance prominently
- Validate amount before submission
- Show processing status in real-time
- Provide clear error messages
- Display payout history with filters

### 4. Error Handling

- Handle network errors gracefully
- Show user-friendly error messages
- Provide retry mechanisms
- Log errors for debugging

### 5. Performance

- Cache bank lists (they don't change often)
- Cache FX rates (5-minute cache is recommended)
- Paginate payout history
- Lazy load bank accounts

---

## 📝 Notes

1. **Currency Detection**: Happens automatically at login. No frontend action needed.

2. **FX Conversion**: Rates are cached for 5 minutes. Real-time rates are fetched when needed.

3. **Payout Processing**: 
   - Payouts are processed asynchronously
   - Status updates automatically
   - Failed payouts are automatically refunded

4. **Bank Account Verification**: 
   - Happens automatically when adding account
   - Can be manually triggered if needed
   - Only verified accounts can receive payouts

5. **Multi-Currency Support**: 
   - System handles all Flutterwave-supported currencies
   - Automatic conversion during payout
   - Transfer fees are deducted from payout amount

---

## 🔗 Related Documentation

- [Flutterwave API Documentation](https://developer.flutterwave.com/docs)
- [Tutor Dashboard API](./TUTOR_DASHBOARD_API.md)
- [Coaching System Guide](./COACHING_SUBSCRIPTION_API.md)

---

## 🆘 Support

For issues or questions:
1. Check error messages in API responses
2. Verify Flutterwave credentials are set
3. Ensure migration scripts have been run
4. Check network connectivity
5. Review server logs for detailed errors

---

**Last Updated**: 2024
**Version**: 1.0.0

