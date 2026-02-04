# Student Community API – Frontend Reference

Base URL for all endpoints: **`/api/marketplace`** (e.g. `https://your-api.com/api/marketplace`).

**Auth:**

- **Student token required** for endpoints marked _Student auth_.
- Send header: `Authorization: Bearer <student_jwt>`
- _No auth_ = no token. _Optional auth_ = token optional (public data returned either way).

---

## 1. Discover & view communities

### Browse communities (public)

**GET** `/store/products?product_type=community`

Query params (all optional): `product_type=community`, `category`, `search`, `min_price`, `max_price`, `page`, `limit`, `sort`

**Auth:** None

**Response:** List of published, public communities with basic info (id, name, slug, description, price, image_url, category, member_count, tutor, etc.).

---

### Get one community (details for subscription page)

**GET** `/store/products/community/:id`

**Auth:** None

**Response:**

```json
{
  "success": true,
  "data": {
    "product": {
      "id": 1,
      "type": "community",
      "title": "Community Name",
      "description": "...",
      "price": 100,
      "currency": "NGN",
      "image_url": "...",
      "category": "...",
      "slug": "community-slug",
      "member_count": 50,
      "trial_days": 0,
      "tutor": { "id", "name", "image", "bio" },
      "reviews": { ... }
    },
    "add_to_cart_url": "...",
    "checkout_url": "..."
  }
}
```

Use this to show community details and a “Subscribe” / “Join” action.

---

## 2. Subscribe to a community

**POST** `/communities/:id/subscribe`

**Auth:** Student auth required

**Body (optional):** Can send `payment_method` or other fields if your backend supports them. Wallet is often used by default.

**Response (success):**

```json
{
  "success": true,
  "message": "Community subscription purchased successfully",
  "data": { "subscription": { ... } }
}
```

**Errors:**

- 400 – Already subscribed, or community not available.
- 403 – Not a student.
- 404 – Community not found.

---

## 3. My subscription status for one community (NEW)

Use this to know if the current student is in a community (e.g. show “Join” vs “Enter” or member-only UI).

**GET** `/communities/:id/subscription`

**Auth:** Student auth required

**Response – not subscribed:**

```json
{
  "success": true,
  "data": {
    "subscribed": false,
    "community": {
      "id": 1,
      "name": "Community Name",
      "slug": "community-slug",
      "image_url": "..."
    }
  }
}
```

**Response – subscribed:**

```json
{
  "success": true,
  "data": {
    "subscribed": true,
    "community": {
      "id": 1,
      "name": "Community Name",
      "slug": "community-slug",
      "image_url": "..."
    },
    "member": {
      "id": 10,
      "role": "member",
      "status": "active",
      "subscription_status": "active",
      "joined_at": "2024-01-20T...",
      "subscription_end_date": "2024-02-20T...",
      "next_billing_date": "2024-02-20T..."
    },
    "subscription": {
      "id": 5,
      "status": "active",
      "start_date": "2024-01-20T...",
      "end_date": null,
      "next_billing_date": "2024-02-20T...",
      "auto_renew": true
    }
  }
}
```

**Errors:** 403 if not a student; 404 if community not found.

---

## 4. My communities (list of communities I’ve joined) (NEW)

Use for “My communities” or “Communities I’ve joined” page.

**GET** `/my-communities`

**Auth:** Student auth required

**Response:**

```json
{
  "success": true,
  "data": {
    "communities": [
      {
        "id": 1,
        "name": "Community Name",
        "slug": "community-slug",
        "description": "...",
        "image_url": "...",
        "category": "...",
        "price": 100,
        "currency": "NGN",
        "member_count": 50,
        "tutor": { "name": "...", "image": "..." },
        "my_membership": {
          "role": "member",
          "joined_at": "2024-01-20T...",
          "subscription_end_date": "2024-02-20T..."
        }
      }
    ],
    "total": 1
  }
}
```

**Errors:** 403 if not a student.

---

## 5. Posts

### List posts

**GET** `/communities/:id/posts?page=1&limit=20`

Query (optional): `page`, `limit`, `category`, `search`, `status`, `featured`, `scheduled`

**Auth:** Optional (public posts visible without auth; member-only content may require auth)

**Response:** Paginated list of posts (ids, title, content, author, status, created_at, etc.).

---

### Get one post

**GET** `/communities/:id/posts/:postId`

**Auth:** Optional

**Response:** Single post with full details.

---

### Create post

**POST** `/communities/:id/posts`

**Auth:** Student auth required (and must be a member)

**Body:** `multipart/form-data` or JSON with e.g. `title`, `content`, `status`; image as file if supported.

**Response:** Created post.

---

### Update post

**PUT** `/communities/:id/posts/:postId`

**Auth:** Student auth required (author or allowed role)

**Body:** Fields to update (e.g. `title`, `content`, `status`).

---

### Delete post

**DELETE** `/communities/:id/posts/:postId`

**Auth:** Student auth required (author or allowed role)

---

## 6. Comments

### List comments for a post

**GET** `/communities/:id/posts/:postId/comments?page=1&limit=20`

**Auth:** Optional

**Response:** Paginated list of comments.

---

### Create comment

**POST** `/communities/:id/posts/:postId/comments`

**Auth:** Student auth required (member)

**Body:** `{ "content": "Comment text" }`

**Response:** Created comment.

---

## 7. Files

### List files

**GET** `/communities/:id/files`

**Auth:** Student auth required (member)

**Response:** List of files (ids, names, URLs, etc.) for that community.

---

### Upload file

**POST** `/communities/:id/files`

**Auth:** Student auth required (member)

**Body:** `multipart/form-data` with file(s).

**Response:** Created file(s).

---

### Delete file

**DELETE** `/communities/:id/files/:fileId`

**Auth:** Student auth required (uploader or allowed role)

---

## 8. Reactions

### Add reaction

**POST** `/communities/:id/reactions`

**Auth:** Student auth required (member)

**Body:** e.g. `{ "post_id": 5, "reaction_type": "like" }` or as per your backend (e.g. `comment_id`).

**Response:** Reaction created/updated.

---

### List reactions

**GET** `/communities/:id/reactions?post_id=5` or `?comment_id=10`

**Auth:** Optional

**Response:** List of reactions for that post or comment.

---

## 9. Audio sessions (live audio)

### List sessions

**GET** `/communities/:id/audio-sessions`

**Auth:** Optional

**Response:** List of audio sessions (scheduled, live, past as applicable).

---

### Get one session

**GET** `/communities/:id/audio-sessions/:sessionId`

**Auth:** Optional

**Response:** Single session details.

---

### Get join token (to join live audio)

**POST** `/communities/:id/audio-sessions/:sessionId/join-token`

**Auth:** Student auth required (member)

**Body:** Optional, as required by backend.

**Response:** Token or URL to join the session (use in your audio/video SDK).

---

## Quick reference

| Action                            | Method | Endpoint                                                | Auth     |
| --------------------------------- | ------ | ------------------------------------------------------- | -------- |
| Browse communities                | GET    | `/store/products?product_type=community`                | No       |
| Get community details             | GET    | `/store/products/community/:id`                         | No       |
| Subscribe                         | POST   | `/communities/:id/subscribe`                            | Student  |
| My subscription for one community | GET    | `/communities/:id/subscription`                         | Student  |
| My communities list               | GET    | `/my-communities`                                       | Student  |
| List posts                        | GET    | `/communities/:id/posts`                                | Optional |
| Get post                          | GET    | `/communities/:id/posts/:postId`                        | Optional |
| Create post                       | POST   | `/communities/:id/posts`                                | Student  |
| Update post                       | PUT    | `/communities/:id/posts/:postId`                        | Student  |
| Delete post                       | DELETE | `/communities/:id/posts/:postId`                        | Student  |
| List comments                     | GET    | `/communities/:id/posts/:postId/comments`               | Optional |
| Create comment                    | POST   | `/communities/:id/posts/:postId/comments`               | Student  |
| List files                        | GET    | `/communities/:id/files`                                | Student  |
| Upload file                       | POST   | `/communities/:id/files`                                | Student  |
| Delete file                       | DELETE | `/communities/:id/files/:fileId`                        | Student  |
| Add reaction                      | POST   | `/communities/:id/reactions`                            | Student  |
| List reactions                    | GET    | `/communities/:id/reactions`                            | Optional |
| List audio sessions               | GET    | `/communities/:id/audio-sessions`                       | Optional |
| Get audio session                 | GET    | `/communities/:id/audio-sessions/:sessionId`            | Optional |
| Get audio join token              | POST   | `/communities/:id/audio-sessions/:sessionId/join-token` | Student  |

---

**Last updated:** January 2025
