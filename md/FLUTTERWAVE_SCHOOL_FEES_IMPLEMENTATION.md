# Flutterwave School Fees Payment - Frontend Implementation Guide

This guide provides step-by-step instructions for implementing Flutterwave payment integration for school fees payment in your React frontend application.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Environment Setup](#environment-setup)
4. [Payment Flow Overview](#payment-flow-overview)
5. [Step-by-Step Implementation](#step-by-step-implementation)
6. [Error Handling](#error-handling)
7. [Testing](#testing)
8. [Complete Example Component](#complete-example-component)

---

## 🔧 Prerequisites

- React application (React 16.8+)
- Node.js installed
- Flutterwave account (get your public key from [Flutterwave Dashboard](https://dashboard.flutterwave.com))
- Backend API endpoints configured
- Student authentication token

---

## 📦 Installation

Install the Flutterwave React package:

```bash
npm install flutterwave-react-v3
# or
yarn add flutterwave-react-v3
```

---

## 🔐 Environment Setup

Add your Flutterwave public key to your environment variables:

```env
REACT_APP_FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_TEST-xxxxxxxxxxxxx-X
```

**Note:**

- Use `FLWPUBK_TEST-` prefix for test mode
- Use `FLWPUBK-` prefix for live/production mode
- Never expose your secret key in frontend code

---

## 🔄 Payment Flow Overview

1. **Student clicks "Pay School Fees"**
2. **Frontend gets amount** → `GET /api/courses/school-fees` (to get amount to pay)
3. **Frontend initializes Flutterwave** → Uses `flutterwave-react-v3` package directly
4. **Student completes payment** → Flutterwave processes payment
5. **Flutterwave callback** → Frontend receives transaction reference
6. **Frontend sends reference to backend** → `POST /api/courses/school-fees/verify`
7. **Backend verifies with Flutterwave** → Credits wallet if successful
8. **Frontend shows success** → Updates UI

---

## 📝 Step-by-Step Implementation

### Step 1: Import Required Dependencies

```javascript
import { useState, useEffect } from "react";
import { useFlutterwave, closePaymentModal } from "flutterwave-react-v3";
import axios from "axios"; // or your HTTP client
```

### Step 2: Create Payment Component State

```javascript
const [loading, setLoading] = useState(false);
const [schoolFeesData, setSchoolFeesData] = useState(null);
const [paymentStatus, setPaymentStatus] = useState(null);
const [error, setError] = useState(null);
```

### Step 3: Fetch School Fees Information

```javascript
const fetchSchoolFees = async () => {
  try {
    const response = await axios.get("/api/courses/school-fees", {
      headers: {
        Authorization: `Bearer ${yourAuthToken}`,
      },
    });

    if (response.data.success) {
      setSchoolFeesData(response.data.data);
    }
  } catch (error) {
    setError(error.response?.data?.message || "Failed to fetch school fees");
  }
};

useEffect(() => {
  fetchSchoolFees();
}, []);
```

### Step 4: Initialize Flutterwave Payment

```javascript
const FLUTTERWAVE_PUBLIC_KEY = process.env.REACT_APP_FLUTTERWAVE_PUBLIC_KEY;

const handlePayment = () => {
  if (!schoolFeesData || !schoolFeesData.school_fees) {
    setError("School fees information not available");
    return;
  }

  setLoading(true);
  setError(null);

  // Generate unique transaction reference
  const txRef = `SCHOOL-FEES-${Date.now()}`;

  // Flutterwave configuration
  const config = {
    public_key: FLUTTERWAVE_PUBLIC_KEY,
    tx_ref: txRef,
    amount: schoolFeesData.school_fees.amount,
    currency: schoolFeesData.school_fees.currency || "NGN",
    payment_options: "card,mobilemoney,ussd",
    customer: {
      email: studentEmail, // Get from your auth/user context
      phone_number: studentPhone || "",
      name: studentName, // Get from your auth/user context
    },
    customizations: {
      title: "School Fees Payment",
      description: `School fees for ${schoolFeesData.academic_year}`,
      logo: "https://your-logo-url.com/logo.png", // Optional
    },
  };

  // Initialize Flutterwave payment
  handleFlutterPayment({
    callback: async (response) => {
      // Payment completed - verify with backend
      console.log("Flutterwave response:", response);
      await verifyPayment(txRef, response);
    },
    onClose: () => {
      // User closed payment modal
      setLoading(false);
      console.log("Payment modal closed");
    },
  });
};

const handleFlutterPayment = useFlutterwave(config);
```

### Step 5: Verify Payment with Backend

```javascript
const verifyPayment = async (transactionReference, flutterwaveResponse) => {
  setLoading(true);

  try {
    const response = await axios.post(
      "/api/courses/school-fees/verify",
      {
        transaction_reference: transactionReference,
        flutterwave_transaction_id:
          flutterwaveResponse.transaction_id || flutterwaveResponse.id,
      },
      {
        headers: {
          Authorization: `Bearer ${yourAuthToken}`,
        },
      }
    );

    if (response.data.success) {
      setPaymentStatus("success");
      closePaymentModal();

      // Refresh school fees data
      await fetchSchoolFees();

      // Show success message
      alert("Payment successful! Your wallet has been credited.");
    } else {
      setPaymentStatus("failed");
      setError("Payment verification failed. Please contact support.");
    }
  } catch (error) {
    setPaymentStatus("failed");
    setError(
      error.response?.data?.message ||
        "Payment verification failed. Please contact support if payment was deducted."
    );
  } finally {
    setLoading(false);
  }
};
```

---

## ⚠️ Error Handling

### Handle Payment Errors

```javascript
const handlePaymentError = (error) => {
  if (error.response) {
    const status = error.response.status;
    const message = error.response.data?.message;

    switch (status) {
      case 400:
        setError(message || "Invalid payment request");
        break;
      case 401:
        setError("Please login again");
        // Redirect to login
        break;
      case 404:
        setError("School fees not configured for your level");
        break;
      case 500:
        setError("Server error. Please try again later or contact support");
        break;
      default:
        setError(message || "An error occurred");
    }
  } else if (error.request) {
    setError("Network error. Please check your internet connection");
  } else {
    setError("An unexpected error occurred");
  }
};
```

---

## 🧪 Testing

### Test Card Details (Flutterwave Test Mode)

```
Card Number: 4187427415564246
CVV: 828
Expiry: 09/32
```

---

## 📄 Complete Example Component

```javascript
import React, { useState, useEffect } from "react";
import { useFlutterwave, closePaymentModal } from "flutterwave-react-v3";
import axios from "axios";

const SchoolFeesPayment = () => {
  const [loading, setLoading] = useState(false);
  const [schoolFeesData, setSchoolFeesData] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [error, setError] = useState(null);

  const FLUTTERWAVE_PUBLIC_KEY = process.env.REACT_APP_FLUTTERWAVE_PUBLIC_KEY;
  const authToken = localStorage.getItem("authToken"); // Get from your auth system
  const studentEmail = "student@example.com"; // Get from your auth/user context
  const studentName = "John Doe"; // Get from your auth/user context
  const studentPhone = "08012345678"; // Get from your auth/user context

  // Fetch school fees information
  useEffect(() => {
    fetchSchoolFees();
  }, []);

  const fetchSchoolFees = async () => {
    try {
      const response = await axios.get("/api/courses/school-fees", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.data.success) {
        setSchoolFeesData(response.data.data);
      }
    } catch (error) {
      setError(error.response?.data?.message || "Failed to fetch school fees");
    }
  };

  // Verify payment with backend
  const verifyPayment = async (transactionReference, flutterwaveResponse) => {
    setLoading(true);

    try {
      const response = await axios.post(
        "/api/courses/school-fees/verify",
        {
          transaction_reference: transactionReference,
          flutterwave_transaction_id:
            flutterwaveResponse.transaction_id || flutterwaveResponse.id,
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (response.data.success) {
        setPaymentStatus("success");
        closePaymentModal();
        await fetchSchoolFees();
        alert("Payment successful! Your wallet has been credited.");
      } else {
        setPaymentStatus("failed");
        setError("Payment verification failed. Please contact support.");
      }
    } catch (error) {
      setPaymentStatus("failed");
      setError(
        error.response?.data?.message ||
          "Payment verification failed. Please contact support if payment was deducted."
      );
    } finally {
      setLoading(false);
    }
  };

  // Initialize Flutterwave payment
  const handlePayment = () => {
    if (!schoolFeesData || !schoolFeesData.school_fees) {
      setError("School fees information not available");
      return;
    }

    if (schoolFeesData.payment_status === "paid") {
      setError("School fees already paid");
      return;
    }

    setLoading(true);
    setError(null);
    setPaymentStatus(null);

    // Generate unique transaction reference
    const txRef = `SCHOOL-FEES-${Date.now()}`;

    // Flutterwave configuration
    const config = {
      public_key: FLUTTERWAVE_PUBLIC_KEY,
      tx_ref: txRef,
      amount: schoolFeesData.school_fees.amount,
      currency: schoolFeesData.school_fees.currency || "NGN",
      payment_options: "card,mobilemoney,ussd",
      customer: {
        email: studentEmail,
        phone_number: studentPhone || "",
        name: studentName,
      },
      customizations: {
        title: "School Fees Payment",
        description: `School fees for ${schoolFeesData.academic_year}`,
      },
    };

    const handleFlutterPayment = useFlutterwave(config);

    // Initialize payment
    handleFlutterPayment({
      callback: async (response) => {
        console.log("Flutterwave response:", response);
        await verifyPayment(txRef, response);
      },
      onClose: () => {
        setLoading(false);
        console.log("Payment modal closed");
      },
    });
  };

  if (!schoolFeesData) {
    return <div>Loading...</div>;
  }

  if (schoolFeesData.payment_status === "paid") {
    return (
      <div className="payment-status paid">
        <h3>School Fees Already Paid</h3>
        <p>
          Amount: {schoolFeesData.school_fees.amount}{" "}
          {schoolFeesData.school_fees.currency}
        </p>
        <p>Academic Year: {schoolFeesData.academic_year}</p>
        {schoolFeesData.payment && (
          <p>Payment Reference: {schoolFeesData.payment.teller_no}</p>
        )}
      </div>
    );
  }

  return (
    <div className="school-fees-payment">
      <h2>Pay School Fees</h2>

      {error && (
        <div className="error-message" style={{ color: "red" }}>
          {error}
        </div>
      )}

      {paymentStatus === "success" && (
        <div className="success-message" style={{ color: "green" }}>
          Payment successful!
        </div>
      )}

      <div className="payment-details">
        <p>
          <strong>Academic Year:</strong> {schoolFeesData.academic_year}
        </p>
        <p>
          <strong>Amount:</strong> {schoolFeesData.school_fees.amount}{" "}
          {schoolFeesData.school_fees.currency}
        </p>
        {schoolFeesData.school_fees.description && (
          <p>
            <strong>Description:</strong>{" "}
            {schoolFeesData.school_fees.description}
          </p>
        )}
      </div>

      <button
        onClick={handlePayment}
        disabled={loading || paymentStatus === "success"}
        className="pay-button"
      >
        {loading ? "Processing..." : "Pay School Fees"}
      </button>

      {paymentStatus === "failed" && (
        <button onClick={handlePayment} className="retry-button">
          Retry Payment
        </button>
      )}
    </div>
  );
};

export default SchoolFeesPayment;
```

---

## 🔑 API Endpoints Reference

### 1. Get School Fees Information

**GET** `/api/courses/school-fees`

**Headers:**

```
Authorization: Bearer {token}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "academic_year": "2025/2026",
    "school_fees": {
      "amount": 50000,
      "currency": "NGN",
      "level": "100",
      "description": "School fees for 100 level students"
    },
    "payment_status": "pending",
    "payment": null
  }
}
```

### 2. Verify Payment

**POST** `/api/courses/school-fees/verify`

**Headers:**

```
Authorization: Bearer {token}
```

**Request Body:**

```json
{
  "transaction_reference": "SCHOOL-FEES-1234567890",
  "flutterwave_transaction_id": "1234567"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Payment verified and processed successfully",
  "data": {
    "payment": {
      "id": 789,
      "amount": 50000,
      "currency": "NGN",
      "academic_year": "2025/2026",
      "payment_reference": "SCHOOL-FEES-1234567890",
      "date": "2025-01-15"
    },
    "wallet": {
      "previous_balance": 0,
      "new_balance": 50000,
      "credited": 50000
    }
  }
}
```

---

## 🎯 Important Notes

1. **Frontend initializes Flutterwave directly** - No backend initialize endpoint needed
2. **Always verify payment on backend** - Never trust frontend callback alone
3. **Webhook is backup** - Backend receives webhooks automatically for reliability
4. **Idempotency** - Same transaction reference won't be processed twice
5. **Error handling** - Always handle network errors and payment failures
6. **User feedback** - Show clear messages for success/failure states
7. **Security** - Never expose Flutterwave secret key in frontend

---

## 🐛 Troubleshooting

### Payment modal doesn't open

- Check Flutterwave public key is correct
- Verify config object has all required fields
- Check browser console for errors

### Payment succeeds but verification fails

- Check network connection
- Verify transaction reference matches
- Check backend logs for errors
- Use admin manual verification endpoint if needed

### Duplicate payments

- Backend handles idempotency automatically
- Same transaction reference won't be processed twice

---

## ✅ Checklist

- [ ] Flutterwave package installed
- [ ] Public key added to environment variables
- [ ] Backend verify endpoint configured
- [ ] Payment initialization implemented
- [ ] Payment verification implemented
- [ ] Error handling added
- [ ] Success/failure UI states implemented
- [ ] Tested with Flutterwave test cards
- [ ] Webhook URL configured in Flutterwave dashboard

---

**Last Updated:** January 2025
