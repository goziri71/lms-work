# 🎥 VIDEO SYSTEM API ENDPOINTS

## Base URL: `http://localhost:3000/api/video`

**All endpoints require authentication:** `Authorization: Bearer YOUR_TOKEN`

---

## 📋 **ALL ENDPOINTS:**

### **1. CREATE VIDEO CALL (Staff Only)**

```
POST /api/video/calls
Authorization: Bearer STAFF_TOKEN

Request Body:
{
  "title": "Introduction to Programming",
  "courseId": 18,           // Optional
  "callType": "lecture",    // "lecture" or "meeting"
  "record": false,          // Optional, default: false
  "region": "auto",         // Optional
  "startsAt": "2025-10-25T10:00:00Z" // Optional (scheduled call)
}

Response:
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Introduction to Programming",
    "streamCallId": "video_lecture_uuid-1234",
    "callType": "lecture",
    "record": false,
    "region": "auto",
    "startsAt": "2025-10-25T10:00:00Z",
    "createdAt": "2025-10-24T15:30:00Z"
  }
}
```

---

### **2. LIST VIDEO CALLS**

```
GET /api/video/calls?courseId=18
Authorization: Bearer TOKEN

Query Parameters:
- courseId (optional) - Filter by course
- page (optional) - Page number
- limit (optional) - Items per page

Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Introduction to Programming",
      "streamCallId": "video_lecture_uuid-1234",
      "callType": "lecture",
      "courseId": 18,
      "record": false,
      "region": "auto",
      "status": "active",
      "startedAt": "2025-10-24T15:30:00Z",
      "createdAt": "2025-10-24T15:30:00Z",
      "createdBy": 8,
      "participantsCount": 5
    }
  ],
  "pagination": {
    "total": 10,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### **3. GET CALL DETAILS**

```
GET /api/video/calls/:id
Authorization: Bearer TOKEN

Response:
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Introduction to Programming",
    "streamCallId": "video_lecture_uuid-1234",
    "callType": "lecture",
    "courseId": 18,
    "record": false,
    "region": "auto",
    "status": "active",
    "startedAt": "2025-10-24T15:30:00Z",
    "createdAt": "2025-10-24T15:30:00Z",
    "createdBy": 8,
    "participants": [
      {
        "userId": 8,
        "userType": "staff",
        "role": "host",
        "joinedAt": "2025-10-24T15:30:00Z"
      },
      {
        "userId": 1,
        "userType": "student",
        "role": "participant",
        "joinedAt": "2025-10-24T15:35:00Z"
      }
    ]
  }
}
```

---

### **4. JOIN VIDEO CALL (Generate Token)**

```
POST /api/video/calls/:id/token
Authorization: Bearer TOKEN

Request Body:
{
  "userId": 1,              // Optional, uses auth token if not provided
  "userType": "student"     // "staff" or "student"
}

Response:
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "streamCallId": "video_lecture_uuid-1234",
    "userId": "1",
    "role": "participant"
  }
}
```

---

### **5. END VIDEO CALL (Host Only)**

```
POST /api/video/calls/:id/end
Authorization: Bearer STAFF_TOKEN

Response:
{
  "success": true,
  "message": "Call ended successfully",
  "data": {
    "id": 1,
    "status": "ended",
    "endedAt": "2025-10-24T16:30:00Z"
  }
}
```

---

## 🎯 **USAGE EXAMPLES:**

### **Staff Creates a Lecture:**

```javascript
// 1. Create call
const response = await fetch("http://localhost:3000/api/video/calls", {
  method: "POST",
  headers: {
    Authorization: "Bearer STAFF_TOKEN",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title: "Introduction to Programming",
    courseId: 18,
    callType: "lecture",
    record: true,
  }),
});

const { data } = await response.json();
const callId = data.id;
const streamCallId = data.streamCallId;
```

### **Student Joins Lecture:**

```javascript
// 1. Get token to join
const tokenResponse = await fetch(
  `http://localhost:3000/api/video/calls/${callId}/token`,
  {
    method: "POST",
    headers: {
      Authorization: "Bearer STUDENT_TOKEN",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: 1,
      userType: "student",
    }),
  }
);

const { data } = await tokenResponse.json();
const token = data.token;

// 2. Use token with Stream SDK on frontend
// (Stream SDK handles the actual video connection)
```

### **List All Active Calls:**

```javascript
const response = await fetch("http://localhost:3000/api/video/calls", {
  headers: {
    Authorization: "Bearer TOKEN",
  },
});

const { data } = await response.json();
// data = array of calls
```

---

## 🔐 **AUTHENTICATION:**

All endpoints require JWT token:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Token obtained from:**

```
POST /api/auth/login
```

---

## 📊 **RESPONSE FORMATS:**

**Success Response:**

```json
{
  "success": true,
  "data": { ... }
}
```

**Error Response:**

```json
{
  "success": false,
  "message": "Error description"
}
```

---

## 🎮 **FRONTEND INTEGRATION:**

### **Step 1: Create Call (Staff)**

```javascript
const call = await createVideoCall({ title, courseId });
```

### **Step 2: Get Token**

```javascript
const token = await getVideoToken(call.id);
```

### **Step 3: Join Call with Stream SDK**

```javascript
import { StreamCall, useStreamCallClient } from "@stream-io/react-sdk";

<StreamCall callId={streamCallId} token={token}>
  {/* Video UI here */}
</StreamCall>;
```

---

## ⚠️ **IMPORTANT NOTES:**

1. **Stream SDK Required:** Video UI handled by Stream.io SDK
2. **Token Expires:** Tokens expire after some time (check Stream docs)
3. **Recording:** Only works if `record: true` when creating call
4. **Host Control:** Only host (creator) can end the call
5. **Participants:** Automatically tracked when joining

---

## 📞 **QUICK POSTMAN TESTS:**

### **Create Call:**

- Method: `POST`
- URL: `http://localhost:3000/api/video/calls`
- Headers: `Authorization: Bearer STAFF_TOKEN`
- Body: `{ "title": "Test Lecture" }`

### **List Calls:**

- Method: `GET`
- URL: `http://localhost:3000/api/video/calls`
- Headers: `Authorization: Bearer TOKEN`

### **Generate Token:**

- Method: `POST`
- URL: `http://localhost:3000/api/video/calls/1/token`
- Headers: `Authorization: Bearer TOKEN`
- Body: `{ "userId": 1, "userType": "student" }`

### **End Call:**

- Method: `POST`
- URL: `http://localhost:3000/api/video/calls/1/end`
- Headers: `Authorization: Bearer STAFF_TOKEN`

---

**All endpoints are working and ready for frontend integration!** 🚀
