# Community Features - Frontend Implementation Guide

## Overview
This document lists all community features available in the API for frontend implementation.

---

## STAGE 1: Core Features (Already Implemented)

### Community Management (Tutor)
- ✅ Create community
- ✅ Update community
- ✅ Delete community
- ✅ List my communities
- ✅ Get single community

### Posts & Comments
- ✅ Create post
- ✅ Get posts (with pagination, search, category filter)
- ✅ Get single post
- ✅ Update post
- ✅ Delete post
- ✅ Create comment
- ✅ Get comments (with thread replies support)
- ✅ Thread replies (nested comments)

### File Sharing
- ✅ Upload files
- ✅ Get files
- ✅ Delete files

### Member Management (Tutor)
- ✅ List members
- ✅ Get single member
- ✅ Update member role
- ✅ Block/unblock member
- ✅ Remove member

### Subscription
- ✅ Purchase subscription
- ✅ Auto-renewal
- ✅ Expiration handling

---

## STAGE 2: New Features (To Implement)

### 1. Reactions System
**Status:** ✅ Backend Ready

**Endpoints:**
- `POST /api/marketplace/communities/:id/reactions`
  - Body: `{ post_id?, comment_id?, emoji }`
  - Toggle reaction (add if not exists, remove if exists)
  
- `GET /api/marketplace/communities/:id/reactions?post_id=X` or `?comment_id=X`
  - Returns grouped reactions by emoji with counts and user list

**Features:**
- Emoji reactions on posts and comments
- Toggle reactions (click to add, click again to remove)
- Group reactions by emoji
- Show who reacted
- Show if current user reacted

**Frontend Tasks:**
1. Add emoji picker/reaction buttons
2. Display reaction counts grouped by emoji
3. Show user list on hover/click
4. Handle toggle functionality
5. Update UI in real-time

---

### 2. @Mentions System
**Status:** ✅ Backend Ready

**Features:**
- Parse @mentions from post/comment content
- Store mentioned user IDs in `mentions` field
- Format mentions in display

**How it works:**
- Users type `@123` or `@username` in content
- Backend extracts user IDs and stores in `mentions` array
- Frontend should:
  - Show mention suggestions as user types
  - Highlight mentions in content
  - Link mentions to user profiles
  - Send notifications to mentioned users

**Frontend Tasks:**
1. Implement mention autocomplete/typeahead
2. Parse and highlight @mentions in content
3. Link mentions to user profiles
4. Show mention notifications (if notification system exists)

---

### 3. Thread Replies
**Status:** ✅ Backend Ready

**Features:**
- Nested/threaded comment replies
- Comments can reply to other comments
- Tree structure in API response

**API Response Structure:**
```json
{
  "comments": [
    {
      "id": 1,
      "content": "Main comment",
      "replies": [
        {
          "id": 2,
          "content": "Reply to main comment",
          "replies": [
            {
              "id": 3,
              "content": "Reply to reply",
              "replies": []
            }
          ]
        }
      ]
    }
  ]
}
```

**Frontend Tasks:**
1. Display nested comment threads
2. Add "Reply" button to each comment
3. Show reply form inline or in modal
4. Indent replies visually
5. Handle deep nesting (limit depth if needed)

---

### 4. Blog Features
**Status:** ✅ Backend Ready

#### 4.1 Post Status
- **draft** - Not published, only visible to author
- **published** - Live and visible to all members
- **scheduled** - Will auto-publish at `scheduled_at` time
- **pinned** - Stays at top of feed
- **archived** - Hidden from main feed
- **deleted** - Soft deleted

#### 4.2 Draft Posts
- Create posts as drafts
- Save drafts for later editing
- Only author can see drafts
- Publish drafts when ready

**API:**
- `POST /api/marketplace/communities/:id/posts` with `status: "draft"`

**Frontend Tasks:**
1. Add "Save as Draft" button
2. Show draft posts in separate section
3. Allow editing and publishing drafts

#### 4.3 Scheduled Posts
- Schedule posts for future publication
- Auto-publish at scheduled time
- Only tutors can schedule

**API:**
- `POST /api/marketplace/communities/:id/posts` with `status: "scheduled"` and `scheduled_at: "2024-01-15T10:00:00Z"`

**Frontend Tasks:**
1. Add date/time picker for scheduling
2. Show scheduled posts in separate section
3. Display countdown to publication
4. Allow editing scheduled posts

#### 4.4 Featured Posts
- Mark posts as featured
- Featured posts appear first in feed
- Only tutors can feature posts

**API:**
- `POST /api/marketplace/communities/:id/posts` with `is_featured: true`
- `GET /api/marketplace/communities/:id/posts?featured=true`

**Frontend Tasks:**
1. Add "Feature" button for tutors
2. Show featured badge on posts
3. Display featured posts at top of feed
4. Filter by featured status

#### 4.5 Post Categories & Tags
- Categorize posts
- Add tags for better organization
- Filter by category

**API:**
- `POST /api/marketplace/communities/:id/posts` with `category: "Tech"` and `tags: ["javascript", "react"]`
- `GET /api/marketplace/communities/:id/posts?category=Tech`

**Frontend Tasks:**
1. Add category dropdown/selector
2. Add tag input field
3. Display categories and tags on posts
4. Filter posts by category
5. Show tag cloud

#### 4.6 Post Analytics
- View count tracking
- Likes count
- Comments count

**API:**
- Already included in post response: `views`, `likes_count`, `comments_count`

**Frontend Tasks:**
1. Display view count
2. Show engagement metrics
3. Add analytics dashboard for tutors

---

## STAGE 3: Removed Features

### ❌ Commission Rate
- **Removed:** Commission rate is no longer used for communities
- Communities have 0% commission
- No commission_rate field in API requests/responses

### ❌ Private Messaging
- **Removed:** Members cannot private message each other
- All communication is through posts and comments

### ❌ Channels
- **Removed:** No separate channels within communities
- All posts are in the main community feed

---

## API Endpoints Summary

### Community Management
- `POST /api/marketplace/tutor/communities` - Create
- `GET /api/marketplace/tutor/communities` - List
- `GET /api/marketplace/tutor/communities/:id` - Get
- `PUT /api/marketplace/tutor/communities/:id` - Update
- `DELETE /api/marketplace/tutor/communities/:id` - Delete

### Posts
- `POST /api/marketplace/communities/:id/posts` - Create (supports draft, scheduled, featured)
- `GET /api/marketplace/communities/:id/posts` - List (filters: status, category, featured, search)
- `GET /api/marketplace/communities/:id/posts/:postId` - Get single
- `PUT /api/marketplace/communities/:id/posts/:postId` - Update
- `DELETE /api/marketplace/communities/:id/posts/:postId` - Delete

### Comments
- `POST /api/marketplace/communities/:id/posts/:postId/comments` - Create (supports parent_comment_id for threads)
- `GET /api/marketplace/communities/:id/posts/:postId/comments` - List (returns threaded structure)

### Reactions
- `POST /api/marketplace/communities/:id/reactions` - Add/remove reaction
- `GET /api/marketplace/communities/:id/reactions?post_id=X` or `?comment_id=X` - Get reactions

### Files
- `POST /api/marketplace/communities/:id/files` - Upload
- `GET /api/marketplace/communities/:id/files` - List
- `DELETE /api/marketplace/communities/:id/files/:fileId` - Delete

### Members (Tutor Only)
- `GET /api/marketplace/tutor/communities/:id/members` - List
- `GET /api/marketplace/tutor/communities/:id/members/:memberId` - Get
- `PUT /api/marketplace/tutor/communities/:id/members/:memberId/role` - Update role
- `PUT /api/marketplace/tutor/communities/:id/members/:memberId/block` - Block
- `PUT /api/marketplace/tutor/communities/:id/members/:memberId/unblock` - Unblock
- `DELETE /api/marketplace/tutor/communities/:id/members/:memberId` - Remove

### Subscription
- `POST /api/marketplace/communities/:id/subscribe` - Purchase subscription

---

## Implementation Priority

### Phase 1: Essential (Week 1)
1. Thread replies display
2. Reactions system
3. @Mentions parsing and display

### Phase 2: Blog Features (Week 2)
1. Draft posts
2. Scheduled posts
3. Featured posts
4. Categories and tags

### Phase 3: Enhancements (Week 3)
1. Post analytics
2. Advanced filtering
3. Rich text editor improvements

---

## Data Models

### Post Fields
```typescript
{
  id: number;
  community_id: number;
  author_id: number;
  title?: string;
  content: string;
  content_type: "text" | "rich_text" | "link";
  category?: string;
  tags?: string[];
  image_url?: string;
  status: "draft" | "published" | "scheduled" | "pinned" | "archived" | "deleted";
  scheduled_at?: string; // ISO date
  is_featured: boolean;
  featured_at?: string; // ISO date
  mentions?: number[]; // User IDs
  views: number;
  likes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
}
```

### Comment Fields
```typescript
{
  id: number;
  post_id: number;
  author_id: number;
  parent_comment_id?: number; // For thread replies
  content: string;
  mentions?: number[]; // User IDs
  status: "published" | "deleted";
  likes_count: number;
  replies?: Comment[]; // Nested replies
  created_at: string;
  updated_at: string;
}
```

### Reaction Response
```typescript
{
  reactions: [
    {
      emoji: "👍",
      count: 5,
      users: [
        { id: 1, name: "John Doe", email: "john@example.com" }
      ],
      user_reacted: true // If current user reacted
    }
  ],
  total: 5
}
```

---

## Notes for Frontend Team

1. **Thread Replies:** Comments are returned in a nested tree structure. Display them recursively.

2. **Reactions:** Reactions are toggleable - clicking the same emoji again removes it.

3. **Mentions:** Parse `@123` patterns in content. The `mentions` array contains user IDs that were mentioned.

4. **Post Status:** Only tutors can create drafts and scheduled posts. Students can only create published posts.

5. **Featured Posts:** Only tutors can feature posts. Featured posts automatically appear first in the feed.

6. **Scheduled Posts:** Backend automatically publishes scheduled posts when `scheduled_at` time is reached. Frontend should show countdown.

7. **No Commission:** Commission rate field is removed. Communities have 0% commission.

8. **No Private Messaging:** All communication is public through posts and comments.

9. **No Channels:** All posts are in the main community feed. No separate channels.

---

## Migration Required

Before using new features, run:
```bash
node scripts/migrate-add-community-features.js
```

This creates:
- `community_reactions` table
- Adds `scheduled_at`, `is_featured`, `featured_at`, `mentions` to posts
- Adds `mentions` to comments
- Updates post status enum

---

## Questions?

Contact backend team for any clarifications on API endpoints or data structures.

