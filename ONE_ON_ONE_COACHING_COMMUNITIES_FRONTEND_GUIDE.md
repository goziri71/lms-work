# One-on-One Coaching & Communities - Frontend Implementation Guide

## Table of Contents
1. [Overview](#overview)
2. [One-on-One Coaching](#one-on-one-coaching)
3. [Communities](#communities)
4. [WebSocket Integration](#websocket-integration)
5. [API Endpoints](#api-endpoints)
6. [Data Models](#data-models)
7. [Implementation Examples](#implementation-examples)
8. [Error Handling](#error-handling)
9. [Testing](#testing)

---

## Overview

This guide covers two major new features:
1. **One-on-One Coaching**: Flexible scheduling system with real-time messaging
2. **Communities**: Subscription-based communities with posts, comments, files, and audio sessions

Both features integrate with the existing marketplace system and subscription tiers.

---

## One-on-One Coaching

### Feature Overview

One-on-one coaching allows tutors to create flexible coaching sessions where learners purchase access first, then both parties negotiate the meeting time through in-app messaging. Once a time is agreed upon, the system creates a Stream.io call and sends email notifications.

### Key Features
- **Flexible Scheduling**: Time negotiation via real-time messaging
- **Purchase First**: Learners must purchase before scheduling
- **Time Proposals**: Both parties can propose meeting times
- **Email Notifications**: Automatic emails for scheduling events
- **Stream.io Integration**: Video calls created automatically upon agreement

### Workflow

1. **Tutor creates one-on-one session** (paid)
2. **Learner purchases access** (wallet payment)
3. **Messaging phase**: Both parties negotiate time via WebSocket
4. **Time proposal**: Either party proposes a time
5. **Acceptance**: Other party accepts → Session scheduled
6. **Email notifications**: Both parties receive meeting details
7. **Session starts**: At agreed time, both join via Stream.io

---

## Communities

### Feature Overview

Communities are subscription-based groups where tutors can:
- Create paid monthly subscriptions
- Manage members
- Host discussions (posts & comments)
- Share files
- Conduct audio-only sessions
- Set member limits based on subscription tier

### Key Features
- **Monthly Subscriptions**: Learners pay monthly to access
- **Auto-Renewal**: Automatic renewal from wallet balance
- **Expiration Emails**: Reminders at 7, 3, 1 days before expiration
- **Access Control**: Auto-blocking on expiration
- **Discussion Forum**: Posts and nested comments
- **File Sharing**: Upload and download files
- **Audio Sessions**: Subscription-gated audio calls
- **Member Management**: Roles, blocking, moderation

### Subscription Tiers & Member Limits

| Tier | Communities | Max Members/Community |
|------|-------------|----------------------|
| Free | 0 | 0 |
| Basic | 1 | 10 |
| Professional | 1 | 30 |
| Expert | 3 | 50 |
| Grand Master | Unlimited | 100 |

---

## WebSocket Integration

### Setup

```javascript
import { io } from 'socket.io-client';

const socket = io('YOUR_API_URL', {
  auth: {
    token: userToken, // JWT token from login
  },
  transports: ['websocket'],
});
```

### One-on-One Coaching Events

#### Join Session Room

```javascript
socket.emit('join_session', {
  sessionId: 123
});

socket.on('joined_session', (data) => {
  console.log('Joined room:', data.room);
  // data: { sessionId, room }
});
```

#### Send Message

```javascript
// Text message
socket.emit('send_message', {
  sessionId: 123,
  message: 'Hello, when are you available?'
});

// Time proposal
socket.emit('send_message', {
  sessionId: 123,
  proposedStartTime: '2024-01-15T10:00:00Z',
  proposedEndTime: '2024-01-15T11:00:00Z'
});
```

#### Receive Messages

```javascript
socket.on('new_message', (message) => {
  // message structure:
  // {
  //   id, session_id, sender_id, sender_type, sender_info,
  //   message, message_type, proposed_start_time, proposed_end_time,
  //   status, created_at
  // }
  addMessageToUI(message);
});
```

#### Accept Time Proposal

```javascript
socket.emit('accept_time_proposal', {
  sessionId: 123,
  messageId: 456
});

socket.on('time_proposal_accepted', (data) => {
  // data: { messageId, sessionId, agreed_start_time, agreed_end_time }
  // Show success message and update UI
});
```

#### Reject Time Proposal

```javascript
socket.emit('reject_time_proposal', {
  sessionId: 123,
  messageId: 456,
  reason: 'Not available at that time'
});

socket.on('time_proposal_rejected', (data) => {
  // data: { messageId, sessionId, reason }
});
```

#### Mark Messages as Read

```javascript
socket.emit('mark_message_read', {
  messageId: 456
});
```

#### Leave Session

```javascript
socket.emit('leave_session');
```

#### Error Handling

```javascript
socket.on('error', (error) => {
  console.error('Socket error:', error.message);
  // Show error to user
});
```

---

## API Endpoints

### One-on-One Coaching

#### Get Session Messages (with pagination)

```http
GET /api/marketplace/coaching/sessions/:sessionId/messages?page=1&limit=50&before=2024-01-01T00:00:00Z
Authorization: Bearer {token}
```

**Response:**
```json
{
  "status": true,
  "code": 200,
  "message": "Messages retrieved successfully",
  "data": {
    "messages": [
      {
        "id": 1,
        "session_id": 123,
        "sender_id": 456,
        "sender_type": "tutor",
        "sender_info": {
          "id": 456,
          "name": "John Doe",
          "email": "john@example.com"
        },
        "message": "Hello, when are you available?",
        "message_type": "text",
        "proposed_start_time": null,
        "proposed_end_time": null,
        "status": "pending",
        "read_at": null,
        "created_at": "2024-01-10T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 25,
      "totalPages": 1,
      "hasMore": false
    }
  }
}
```

#### Mark Messages as Read

```http
PUT /api/marketplace/coaching/sessions/:sessionId/messages/read
Authorization: Bearer {token}
```

---

### Communities

#### Create Community (Tutor)

```http
POST /api/marketplace/tutor/communities
Authorization: Bearer {tutorToken}
Content-Type: multipart/form-data

name: "Tech Community"
description: "A community for tech enthusiasts"
category: "Tech"
price: 29.99
currency: "NGN"
trial_days: 0
member_limit: 50
auto_approve: true
who_can_post: "members"
moderation_enabled: false
file_sharing_enabled: true
live_sessions_enabled: true
visibility: "public"
commission_rate: 15.0
image: [file]
```

**Response:**
```json
{
  "status": true,
  "code": 201,
  "message": "Community created successfully",
  "data": {
    "id": 1,
    "tutor_id": 123,
    "tutor_type": "sole_tutor",
    "name": "Tech Community",
    "description": "A community for tech enthusiasts",
    "category": "Tech",
    "price": 29.99,
    "currency": "NGN",
    "status": "draft",
    "member_count": 0,
    "post_count": 0,
    "created_at": "2024-01-10T10:00:00Z"
  }
}
```

#### Get My Communities (Tutor)

```http
GET /api/marketplace/tutor/communities?page=1&limit=20&status=published&search=tech
Authorization: Bearer {tutorToken}
```

#### Update Community

```http
PUT /api/marketplace/tutor/communities/:id
Authorization: Bearer {tutorToken}
Content-Type: multipart/form-data

name: "Updated Community Name"
price: 39.99
image: [file] // optional
```

#### Delete Community

```http
DELETE /api/marketplace/tutor/communities/:id
Authorization: Bearer {tutorToken}
```

#### Purchase Community Subscription (Student)

```http
POST /api/marketplace/communities/:id/subscribe
Authorization: Bearer {studentToken}
```

**Response:**
```json
{
  "status": true,
  "code": 201,
  "message": "Community subscription purchased successfully",
  "data": {
    "subscription": {
      "id": 1,
      "community_id": 1,
      "student_id": 456,
      "price": 29.99,
      "currency": "NGN",
      "status": "active",
      "start_date": "2024-01-10T10:00:00Z",
      "next_billing_date": "2024-02-10T10:00:00Z",
      "auto_renew": true
    },
    "member": {
      "id": 1,
      "community_id": 1,
      "student_id": 456,
      "role": "member",
      "status": "active",
      "subscription_status": "active"
    },
    "next_billing_date": "2024-02-10T10:00:00Z"
  }
}
```

---

### Community Posts

#### Create Post

```http
POST /api/marketplace/communities/:id/posts
Authorization: Bearer {studentToken}
Content-Type: application/json

{
  "title": "Welcome to the Community!",
  "content": "This is my first post...",
  "content_type": "text",
  "category": "General",
  "tags": ["welcome", "introduction"]
}
```

#### Get Posts

```http
GET /api/marketplace/communities/:id/posts?page=1&limit=20&category=General&search=welcome
Authorization: Bearer {studentToken} // Optional
```

**Response:**
```json
{
  "status": true,
  "code": 200,
  "data": {
    "posts": [
      {
        "id": 1,
        "community_id": 1,
        "author_id": 456,
        "author": {
          "id": 456,
          "name": "Jane Doe",
          "email": "jane@example.com"
        },
        "title": "Welcome to the Community!",
        "content": "This is my first post...",
        "content_type": "text",
        "category": "General",
        "tags": ["welcome", "introduction"],
        "status": "published",
        "views": 10,
        "likes_count": 5,
        "comments_count": 3,
        "created_at": "2024-01-10T10:00:00Z"
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

#### Update Post

```http
PUT /api/marketplace/communities/:id/posts/:postId
Authorization: Bearer {studentToken}
Content-Type: application/json

{
  "title": "Updated Title",
  "content": "Updated content..."
}
```

#### Delete Post

```http
DELETE /api/marketplace/communities/:id/posts/:postId
Authorization: Bearer {studentToken}
```

---

### Community Comments

#### Create Comment

```http
POST /api/marketplace/communities/:id/posts/:postId/comments
Authorization: Bearer {studentToken}
Content-Type: application/json

{
  "content": "Great post!",
  "parent_comment_id": null // For replies, use parent comment ID
}
```

#### Get Comments

```http
GET /api/marketplace/communities/:id/posts/:postId/comments?page=1&limit=50
Authorization: Bearer {studentToken} // Optional
```

**Response:**
```json
{
  "status": true,
  "code": 200,
  "data": {
    "comments": [
      {
        "id": 1,
        "post_id": 1,
        "author_id": 456,
        "author": {
          "id": 456,
          "name": "Jane Doe",
          "email": "jane@example.com"
        },
        "content": "Great post!",
        "parent_comment_id": null,
        "parent_comment": null,
        "status": "published",
        "likes_count": 2,
        "created_at": "2024-01-10T11:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 10,
      "totalPages": 1
    }
  }
}
```

---

### Community Files

#### Upload File

```http
POST /api/marketplace/communities/:id/files
Authorization: Bearer {studentToken}
Content-Type: multipart/form-data

file: [binary]
description: "Important document"
category: "Resources"
```

**Response:**
```json
{
  "status": true,
  "code": 201,
  "message": "File uploaded successfully",
  "data": {
    "id": 1,
    "community_id": 1,
    "uploaded_by": 456,
    "file_name": "document.pdf",
    "file_url": "https://...",
    "file_type": "application/pdf",
    "file_size": 1024000,
    "description": "Important document",
    "category": "Resources",
    "download_count": 0,
    "created_at": "2024-01-10T10:00:00Z"
  }
}
```

#### Get Files

```http
GET /api/marketplace/communities/:id/files?page=1&limit=20&category=Resources&search=document
Authorization: Bearer {studentToken}
```

#### Delete File

```http
DELETE /api/marketplace/communities/:id/files/:fileId
Authorization: Bearer {studentToken}
```

---

### Community Audio Sessions

#### Create Audio Session (Tutor)

```http
POST /api/marketplace/tutor/communities/:id/audio-sessions
Authorization: Bearer {tutorToken}
Content-Type: application/json

{
  "title": "Weekly Discussion",
  "description": "Let's discuss this week's topics",
  "scheduled_start_time": "2024-01-15T10:00:00Z",
  "scheduled_end_time": "2024-01-15T11:00:00Z"
}
```

**Response:**
```json
{
  "status": true,
  "code": 201,
  "message": "Audio session created successfully",
  "data": {
    "id": 1,
    "community_id": 1,
    "created_by": 123,
    "title": "Weekly Discussion",
    "description": "Let's discuss this week's topics",
    "stream_call_id": "community-audio-1-1234567890",
    "view_link": "https://frontend.com/communities/1/audio/community-audio-1-1234567890",
    "scheduled_start_time": "2024-01-15T10:00:00Z",
    "scheduled_end_time": "2024-01-15T11:00:00Z",
    "status": "scheduled",
    "participant_count": 0,
    "created_at": "2024-01-10T10:00:00Z"
  }
}
```

#### Get Audio Sessions

```http
GET /api/marketplace/communities/:id/audio-sessions?page=1&limit=20&status=scheduled
Authorization: Bearer {studentToken} // Optional
```

#### Start Audio Session (Tutor)

```http
POST /api/marketplace/tutor/communities/:id/audio-sessions/:sessionId/start
Authorization: Bearer {tutorToken}
```

#### End Audio Session (Tutor)

```http
POST /api/marketplace/tutor/communities/:id/audio-sessions/:sessionId/end
Authorization: Bearer {tutorToken}
```

#### Get Join Token (Student)

```http
POST /api/marketplace/communities/:id/audio-sessions/:sessionId/join-token
Authorization: Bearer {studentToken}
```

**Response:**
```json
{
  "status": true,
  "code": 200,
  "message": "Join token generated successfully",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "call_id": "community-audio-1-1234567890",
    "view_link": "https://frontend.com/communities/1/audio/community-audio-1-1234567890"
  }
}
```

#### Cancel Audio Session (Tutor)

```http
DELETE /api/marketplace/tutor/communities/:id/audio-sessions/:sessionId
Authorization: Bearer {tutorToken}
```

---

### Community Member Management (Tutor)

#### Get Members

```http
GET /api/marketplace/tutor/communities/:id/members?page=1&limit=20&status=active&role=member&search=john
Authorization: Bearer {tutorToken}
```

**Response:**
```json
{
  "status": true,
  "code": 200,
  "data": {
    "members": [
      {
        "id": 1,
        "community_id": 1,
        "student_id": 456,
        "student": {
          "id": 456,
          "name": "Jane Doe",
          "email": "jane@example.com",
          "matric_number": "STU001"
        },
        "role": "member",
        "status": "active",
        "subscription_status": "active",
        "subscription_start_date": "2024-01-10T10:00:00Z",
        "subscription_end_date": "2024-02-10T10:00:00Z",
        "next_billing_date": "2024-02-10T10:00:00Z",
        "joined_at": "2024-01-10T10:00:00Z"
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

#### Update Member Role

```http
PUT /api/marketplace/tutor/communities/:id/members/:memberId/role
Authorization: Bearer {tutorToken}
Content-Type: application/json

{
  "role": "moderator" // member, moderator, admin
}
```

#### Block Member

```http
PUT /api/marketplace/tutor/communities/:id/members/:memberId/block
Authorization: Bearer {tutorToken}
```

#### Unblock Member

```http
PUT /api/marketplace/tutor/communities/:id/members/:memberId/unblock
Authorization: Bearer {tutorToken}
```

#### Remove Member

```http
DELETE /api/marketplace/tutor/communities/:id/members/:memberId
Authorization: Bearer {tutorToken}
```

---

## Data Models

### Coaching Session (One-on-One)

```typescript
interface CoachingSession {
  id: number;
  tutor_id: number;
  tutor_type: 'sole_tutor' | 'organization';
  title: string;
  description?: string;
  start_time: string; // ISO date
  end_time: string; // ISO date
  session_type: 'group' | 'one_on_one';
  scheduling_status?: 'awaiting_purchase' | 'awaiting_scheduling' | 'scheduled' | 'completed' | 'cancelled';
  agreed_start_time?: string; // ISO date
  agreed_end_time?: string; // ISO date
  scheduling_deadline?: string; // ISO date
  pricing_type: 'free' | 'paid';
  price?: number;
  currency: string;
  status: 'scheduled' | 'active' | 'ended' | 'cancelled';
  stream_call_id?: string;
  view_link?: string;
}
```

### Coaching Scheduling Message

```typescript
interface CoachingSchedulingMessage {
  id: number;
  session_id: number;
  sender_id: number;
  sender_type: 'tutor' | 'learner';
  sender_info: {
    id: number;
    name: string;
    email: string;
  };
  message?: string;
  message_type: 'text' | 'time_proposal';
  proposed_start_time?: string; // ISO date
  proposed_end_time?: string; // ISO date
  status: 'pending' | 'accepted' | 'rejected';
  read_at?: string; // ISO date
  created_at: string; // ISO date
}
```

### Community

```typescript
interface Community {
  id: number;
  tutor_id: number;
  tutor_type: 'sole_tutor' | 'organization';
  name: string;
  description?: string;
  category?: 'Business' | 'Tech' | 'Art' | 'Logistics' | 'Ebooks' | 'Podcast' | 'Videos' | 'Music' | 'Articles' | 'Code' | '2D/3D Files';
  image_url?: string;
  icon_url?: string;
  price: number;
  currency: string;
  pricing_type: 'subscription';
  trial_days: number;
  member_limit?: number;
  auto_approve: boolean;
  who_can_post: 'members' | 'tutor_only' | 'moderators';
  moderation_enabled: boolean;
  file_sharing_enabled: boolean;
  live_sessions_enabled: boolean;
  visibility: 'public' | 'private';
  status: 'draft' | 'published' | 'archived';
  member_count: number;
  post_count: number;
  commission_rate: number;
  created_at: string;
  updated_at: string;
}
```

### Community Subscription

```typescript
interface CommunitySubscription {
  id: number;
  community_id: number;
  student_id: number;
  price: number;
  currency: string;
  status: 'active' | 'expired' | 'cancelled';
  start_date: string;
  end_date?: string;
  next_billing_date: string;
  auto_renew: boolean;
  cancelled_at?: string;
  cancellation_reason?: string;
  payment_reference?: string;
}
```

### Community Member

```typescript
interface CommunityMember {
  id: number;
  community_id: number;
  student_id: number;
  student: {
    id: number;
    name: string;
    email: string;
    matric_number?: string;
  };
  role: 'member' | 'moderator' | 'admin';
  status: 'active' | 'blocked' | 'left';
  subscription_status: 'active' | 'expired' | 'cancelled';
  subscription_start_date?: string;
  subscription_end_date?: string;
  next_billing_date?: string;
  joined_at: string;
  last_active_at?: string;
  access_blocked_at?: string;
}
```

### Community Post

```typescript
interface CommunityPost {
  id: number;
  community_id: number;
  author_id: number;
  author: {
    id: number;
    name: string;
    email: string;
  };
  title?: string;
  content: string;
  content_type: 'text' | 'rich_text' | 'link';
  category?: string;
  tags?: string[];
  status: 'published' | 'pinned' | 'archived' | 'deleted';
  views: number;
  likes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
}
```

### Community Comment

```typescript
interface CommunityComment {
  id: number;
  post_id: number;
  author_id: number;
  author: {
    id: number;
    name: string;
    email: string;
  };
  parent_comment_id?: number;
  parent_comment?: CommunityComment;
  content: string;
  status: 'published' | 'deleted';
  likes_count: number;
  created_at: string;
  updated_at: string;
}
```

### Community File

```typescript
interface CommunityFile {
  id: number;
  community_id: number;
  uploaded_by: number;
  uploader: {
    id: number;
    name: string;
    email: string;
  };
  file_name: string;
  file_url: string;
  file_type?: string;
  file_size?: number;
  description?: string;
  category?: string;
  download_count: number;
  created_at: string;
  updated_at: string;
}
```

### Community Audio Session

```typescript
interface CommunityAudioSession {
  id: number;
  community_id: number;
  created_by: number;
  title: string;
  description?: string;
  stream_call_id?: string;
  view_link?: string;
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  status: 'scheduled' | 'active' | 'ended' | 'cancelled';
  actual_start_time?: string;
  actual_end_time?: string;
  participant_count: number;
  created_at: string;
  updated_at: string;
}
```

---

## Implementation Examples

### React Example: One-on-One Coaching Messaging

```jsx
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

function CoachingMessaging({ sessionId, userToken }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Connect to WebSocket
    const newSocket = io('YOUR_API_URL', {
      auth: { token: userToken },
      transports: ['websocket'],
    });

    newSocket.emit('join_session', { sessionId });

    newSocket.on('joined_session', (data) => {
      console.log('Joined:', data.room);
    });

    newSocket.on('new_message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    newSocket.on('time_proposal_accepted', (data) => {
      // Show success notification
      alert('Time proposal accepted! Session scheduled.');
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    setSocket(newSocket);

    // Load message history
    loadMessages();

    return () => {
      newSocket.emit('leave_session');
      newSocket.disconnect();
    };
  }, [sessionId]);

  const loadMessages = async () => {
    const response = await fetch(
      `/api/marketplace/coaching/sessions/${sessionId}/messages?page=1&limit=50`,
      {
        headers: {
          'Authorization': `Bearer ${userToken}`,
        },
      }
    );
    const data = await response.json();
    setMessages(data.data.messages);
  };

  const sendMessage = () => {
    if (!newMessage.trim()) return;

    socket.emit('send_message', {
      sessionId,
      message: newMessage,
    });

    setNewMessage('');
  };

  const proposeTime = (startTime, endTime) => {
    socket.emit('send_message', {
      sessionId,
      proposedStartTime: startTime,
      proposedEndTime: endTime,
    });
  };

  const acceptProposal = (messageId) => {
    socket.emit('accept_time_proposal', {
      sessionId,
      messageId,
    });
  };

  return (
    <div className="messaging-container">
      <div className="messages-list">
        {messages.map(msg => (
          <div key={msg.id} className="message">
            <div className="sender">{msg.sender_info.name}</div>
            {msg.message && <div className="content">{msg.message}</div>}
            {msg.message_type === 'time_proposal' && (
              <div className="time-proposal">
                <p>Proposed: {new Date(msg.proposed_start_time).toLocaleString()}</p>
                {msg.status === 'pending' && (
                  <button onClick={() => acceptProposal(msg.id)}>
                    Accept
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="message-input">
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}
```

### React Example: Community Subscription Purchase

```jsx
import { useState } from 'react';

function CommunitySubscription({ communityId, userToken }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const purchaseSubscription = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/marketplace/communities/${communityId}/subscribe`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (!data.status) {
        throw new Error(data.message);
      }

      // Show success message
      alert('Subscription purchased successfully!');
      
      // Redirect to community page
      window.location.href = `/communities/${communityId}`;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {error && <div className="error">{error}</div>}
      <button
        onClick={purchaseSubscription}
        disabled={loading}
      >
        {loading ? 'Processing...' : 'Subscribe Now'}
      </button>
    </div>
  );
}
```

### React Example: Community Posts List

```jsx
import { useEffect, useState } from 'react';

function CommunityPosts({ communityId, userToken }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadPosts();
  }, [page]);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/marketplace/communities/${communityId}/posts?page=${page}&limit=20`,
        {
          headers: {
            'Authorization': `Bearer ${userToken}`,
          },
        }
      );
      const data = await response.json();
      setPosts(data.data.posts);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="posts-list">
      {posts.map(post => (
        <div key={post.id} className="post">
          <h3>{post.title}</h3>
          <div className="author">By {post.author.name}</div>
          <div className="content">{post.content}</div>
          <div className="meta">
            <span>{post.views} views</span>
            <span>{post.likes_count} likes</span>
            <span>{post.comments_count} comments</span>
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## Error Handling

### Common Error Responses

All endpoints return errors in this format:

```json
{
  "status": false,
  "code": 400,
  "message": "Error message here"
}
```

### Common Error Codes

- `400` - Bad Request (validation errors, insufficient balance, etc.)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (no access, subscription expired, etc.)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

### Error Handling Example

```javascript
try {
  const response = await fetch('/api/marketplace/communities/1/subscribe', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!data.status) {
    // Handle specific error codes
    if (data.code === 400) {
      // Validation error or insufficient balance
      showError(data.message);
    } else if (data.code === 403) {
      // Access denied
      showError('You do not have access to this community');
    } else if (data.code === 404) {
      // Not found
      showError('Community not found');
    } else {
      // Generic error
      showError('An error occurred. Please try again.');
    }
    return;
  }

  // Success
  handleSuccess(data.data);
} catch (error) {
  // Network error
  showError('Network error. Please check your connection.');
}
```

---

## Testing

### Testing Checklist

#### One-on-One Coaching
- [ ] Create one-on-one coaching session
- [ ] Purchase session access
- [ ] Send text messages via WebSocket
- [ ] Propose meeting time
- [ ] Accept/reject time proposal
- [ ] Receive email notifications
- [ ] Join Stream.io call at agreed time

#### Communities
- [ ] Create community (tutor)
- [ ] Purchase subscription (student)
- [ ] Create posts
- [ ] Add comments (nested replies)
- [ ] Upload files
- [ ] Download files
- [ ] Create audio session (tutor)
- [ ] Join audio session (student)
- [ ] Manage members (tutor)
- [ ] Test subscription expiration emails
- [ ] Test auto-renewal

### Test Scenarios

1. **Subscription Expiration Flow**
   - Subscribe to community
   - Wait for expiration (or manually expire)
   - Verify access is blocked
   - Verify email notifications sent

2. **Member Limit Enforcement**
   - Create community with member limit
   - Add members up to limit
   - Verify limit is enforced

3. **Access Control**
   - Try to access community without subscription
   - Verify 403 error
   - Subscribe and verify access granted

---

## Important Notes

1. **Subscription Tiers**: Tutors must have an active subscription to create communities. Check subscription limits before allowing creation.

2. **Audio Sessions**: Tutors need active subscription to create audio sessions. Students need active community subscription to join.

3. **File Uploads**: Maximum file size is 50MB. Supported formats depend on community settings.

4. **WebSocket Reconnection**: Implement automatic reconnection logic for WebSocket connections.

5. **Pagination**: All list endpoints support pagination. Always check `hasMore` in pagination response.

6. **Currency Conversion**: Prices are stored in the community's currency. Frontend should handle currency conversion for display.

7. **Auto-Renewal**: Subscriptions auto-renew from wallet balance. Notify users if renewal fails due to insufficient funds.

8. **Email Notifications**: System sends expiration emails at 7, 3, and 1 days before expiration. Users should be notified in-app as well.

---

## Support

For questions or issues, contact the backend team or refer to the API documentation.

**Last Updated**: January 2024

