# AI Content Generation - Frontend Implementation Guide

## Overview

The backend now supports AI-powered content generation using OpenAI. Tutors and admins can generate, improve, and summarize content directly from the platform. This feature helps tutors quickly create course descriptions, outlines, quiz questions, community posts, sales page copy, and more.

---

## Base URLs

- **Tutor endpoints:** `/api/marketplace/tutor/ai/...`
- **Admin endpoints:** `/api/admin/ai/...`

Both sets of endpoints behave identically. The only difference is the authentication middleware (tutor token vs admin token).

---

## Authentication

All endpoints require authentication via Bearer token in the `Authorization` header:

```
Authorization: Bearer <token>
```

- Tutor endpoints require a **tutor JWT token**
- Admin endpoints require an **admin JWT token**

---

## Endpoints

### 1. Get Supported Content Types

Returns all available content types, tones, and summary styles. Use this to populate dropdowns/selectors in the UI.

**Request:**

```
GET /api/marketplace/tutor/ai/content-types
```

**Response:**

```json
{
  "success": true,
  "data": {
    "content_types": [
      { "value": "course_description", "label": "Course Description" },
      { "value": "course_outline", "label": "Course Outline" },
      { "value": "module_content", "label": "Module Content" },
      { "value": "quiz_questions", "label": "Quiz Questions" },
      { "value": "community_post", "label": "Community Post" },
      { "value": "coaching_description", "label": "Coaching Description" },
      { "value": "sales_page", "label": "Sales Page" },
      { "value": "assignment", "label": "Assignment" },
      { "value": "email_template", "label": "Email Template" },
      { "value": "general", "label": "General" }
    ],
    "tones": [
      "professional",
      "casual",
      "academic",
      "friendly",
      "persuasive",
      "conversational"
    ],
    "summary_styles": [
      "brief",
      "detailed",
      "bullet_points"
    ]
  }
}
```

---

### 2. Generate Content

Generate new content from a topic and content type.

**Request:**

```
POST /api/marketplace/tutor/ai/generate
Content-Type: application/json
```

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content_type` | string | Yes | One of the supported content types (see above) |
| `topic` | string | Yes | The subject/topic to generate content about |
| `additional_context` | string | No | Extra instructions or context to guide the AI |
| `tone` | string | No | One of: `professional`, `casual`, `academic`, `friendly`, `persuasive`, `conversational`. Default: `professional` |
| `language` | string | No | Language for the content. Default: `English` |
| `max_tokens` | number | No | Max response length in tokens. Default: `2000` |

**Example Request Body:**

```json
{
  "content_type": "course_description",
  "topic": "Introduction to Digital Marketing for Small Business Owners",
  "additional_context": "Focus on social media marketing and SEO basics. Target audience is people with no prior marketing experience.",
  "tone": "friendly",
  "language": "English"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Content generated successfully",
  "data": {
    "content": "## Introduction to Digital Marketing for Small Business Owners\n\nAre you a small business owner looking to grow your online presence but don't know where to start? ...",
    "content_type": "course_description",
    "model": "gpt-4o-mini",
    "usage": {
      "prompt_tokens": 125,
      "completion_tokens": 487,
      "total_tokens": 612
    }
  }
}
```

---

### 3. Improve Content

Send existing content to the AI to improve its quality, clarity, grammar, or tone.

**Request:**

```
POST /api/marketplace/tutor/ai/improve
Content-Type: application/json
```

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `original_content` | string | Yes | The content to improve (min 10 characters) |
| `instruction` | string | No | Specific improvement instructions. Default: general improvement |
| `content_type` | string | No | Content type for context |
| `max_tokens` | number | No | Max response length. Default: `2000` |

**Example Request Body:**

```json
{
  "original_content": "This course teaches you marketing stuff. You will learn things about social media and how to do SEO. Its good for beginners who want to learn marketing.",
  "instruction": "Make it more professional and compelling. Add bullet points for key benefits.",
  "content_type": "course_description"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Content improved successfully",
  "data": {
    "content": "This comprehensive course equips you with essential digital marketing skills...\n\n**Key Benefits:**\n- Master social media strategies...\n- Learn SEO fundamentals...",
    "content_type": "course_description",
    "model": "gpt-4o-mini",
    "usage": {
      "prompt_tokens": 98,
      "completion_tokens": 312,
      "total_tokens": 410
    }
  }
}
```

---

### 4. Summarize Content

Condense long content into a concise summary.

**Request:**

```
POST /api/marketplace/tutor/ai/summarize
Content-Type: application/json
```

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | Yes | The content to summarize (min 20 characters) |
| `style` | string | No | One of: `brief`, `detailed`, `bullet_points`. Default: `brief` |
| `max_tokens` | number | No | Max response length. Default: `500` |

**Example Request Body:**

```json
{
  "content": "In this 12-week comprehensive digital marketing course, students will embark on a transformative journey through the world of online marketing. Starting with the fundamentals of digital marketing strategy, participants will learn how to identify target audiences, create buyer personas, and develop comprehensive marketing plans. The course covers social media marketing across all major platforms including Facebook, Instagram, LinkedIn, Twitter, and TikTok...",
  "style": "bullet_points"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Content summarized successfully",
  "data": {
    "content": "- 12-week comprehensive digital marketing course\n- Covers strategy fundamentals, audience targeting, and buyer personas\n- Social media marketing across major platforms\n- ...",
    "style": "bullet_points",
    "model": "gpt-4o-mini",
    "usage": {
      "prompt_tokens": 200,
      "completion_tokens": 85,
      "total_tokens": 285
    }
  }
}
```

---

## Error Responses

All errors follow the standard format:

```json
{
  "status": false,
  "code": 400,
  "message": "Error description"
}
```

| Status Code | Scenario |
|-------------|----------|
| `400` | Missing required fields, invalid content type, invalid tone, content too short |
| `401` | Missing or invalid authentication token |
| `403` | User type not authorized (e.g. student trying tutor endpoint) |
| `500` | OpenAI API error, API key not configured, server error |

**Common error messages:**

- `"Topic is required"` - Missing `topic` field
- `"Content type is required"` - Missing `content_type` field
- `"Invalid content type. Supported types: ..."` - Unsupported content type value
- `"Invalid tone. Supported tones: ..."` - Unsupported tone value
- `"Original content is required"` - Missing content for improve endpoint
- `"Content must be at least 10 characters long"` - Content too short for improve
- `"Content to summarize is required"` - Missing content for summarize endpoint
- `"OpenAI API key is not configured..."` - Backend missing API key (contact admin)

---

## Frontend Implementation Suggestions

### Where to Integrate

1. **Course Creation/Edit Form** - Add an "AI Generate" button next to the description field. When clicked, open a modal/drawer where the tutor enters a topic, selects `course_description` as content type, and generates content. Paste the result into the description field.

2. **Course Outline Builder** - Add "Generate Outline with AI" button. Use content type `course_outline` to auto-generate a course structure.

3. **Module Content Editor** - Add an "AI Assist" button in the rich text editor toolbar. Allows generating module content, or selecting existing text and improving it.

4. **Quiz Creator** - Add "Generate Quiz Questions" button. Use `quiz_questions` content type with the module topic as input.

5. **Community Post Composer** - Add "Help me write" button for tutors creating community posts.

6. **Coaching Session Form** - Generate coaching session descriptions from a topic.

7. **Sales Page Builder** - Generate compelling sales page copy including headlines, benefits, and CTAs.

8. **Text Selection Improve** - Allow tutors to select any text and click "Improve with AI" to rewrite it.

### Recommended UI Flow

#### Generate Flow:
```
1. User clicks "Generate with AI" button
2. Modal/drawer opens with:
   - Content type dropdown (pre-selected based on context, e.g. "Course Description" on course form)
   - Topic text input (required)
   - Additional context textarea (optional)
   - Tone selector (default: professional)
   - Language selector (default: English)
3. User fills in topic and clicks "Generate"
4. Show loading spinner
5. Display generated content in a preview area
6. User can:
   a. "Use This" → paste into the target field
   b. "Regenerate" → call API again
   c. "Edit" → modify the generated text before using
   d. "Cancel" → close modal
```

#### Improve Flow:
```
1. User selects existing text or clicks "Improve" on a filled field
2. Modal opens showing the original content
3. User can optionally add improvement instructions (e.g. "Make it shorter", "More formal tone")
4. Click "Improve"
5. Show side-by-side comparison: original vs improved
6. User can "Accept" or "Keep Original"
```

#### Summarize Flow:
```
1. User has long content and clicks "Summarize"
2. Modal shows style options (Brief / Detailed / Bullet Points)
3. Click "Summarize"
4. Display summary
5. User can copy or use the summary
```

### Example React Integration (Pseudocode)

```jsx
// hooks/useAIContent.js
import { useState } from 'react';
import api from '../services/api'; // your axios instance

export const useAIContent = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const generate = async ({ content_type, topic, additional_context, tone, language }) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/marketplace/tutor/ai/generate', {
        content_type,
        topic,
        additional_context,
        tone,
        language,
      });
      setResult(data.data);
      return data.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate content');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const improve = async ({ original_content, instruction, content_type }) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/marketplace/tutor/ai/improve', {
        original_content,
        instruction,
        content_type,
      });
      setResult(data.data);
      return data.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to improve content');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const summarize = async ({ content, style }) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/marketplace/tutor/ai/summarize', {
        content,
        style,
      });
      setResult(data.data);
      return data.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to summarize content');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { generate, improve, summarize, loading, error, result };
};
```

```jsx
// Example usage in a component
const CourseForm = () => {
  const { generate, loading } = useAIContent();
  const [description, setDescription] = useState('');
  const [showAIModal, setShowAIModal] = useState(false);

  const handleGenerate = async (topic, additionalContext) => {
    const result = await generate({
      content_type: 'course_description',
      topic,
      additional_context: additionalContext,
      tone: 'professional',
    });
    if (result) {
      setDescription(result.content);
      setShowAIModal(false);
    }
  };

  return (
    <div>
      <label>Course Description</label>
      <textarea value={description} onChange={e => setDescription(e.target.value)} />
      <button onClick={() => setShowAIModal(true)}>
        ✨ Generate with AI
      </button>
      {/* AI Modal component here */}
    </div>
  );
};
```

---

## Content Type Descriptions

Use these descriptions in the UI to help tutors understand what each type generates:

| Content Type | Label | Description |
|-------------|-------|-------------|
| `course_description` | Course Description | Compelling course description with learning outcomes, target audience, and CTA |
| `course_outline` | Course Outline | Structured syllabus with modules, lessons, and time estimates |
| `module_content` | Module Content | Detailed lesson content with objectives, explanations, and key takeaways |
| `quiz_questions` | Quiz Questions | Multiple-choice questions with answers and explanations |
| `community_post` | Community Post | Engaging discussion post for community spaces |
| `coaching_description` | Coaching Description | Professional coaching session description |
| `sales_page` | Sales Page | Conversion-focused sales copy with headlines, benefits, and CTAs |
| `assignment` | Assignment | Project brief with instructions, deliverables, and grading criteria |
| `email_template` | Email Template | Professional email with subject line, body, and CTA |
| `general` | General | Free-form content generation for any purpose |

---

## Notes

- The AI response time is typically **3-10 seconds** depending on content length. Always show a loading indicator.
- The `usage` object in responses shows token consumption. You may optionally display this or track it.
- Content is returned as plain text with markdown formatting. Render it with a markdown renderer for best results.
- The `max_tokens` parameter controls response length. Higher values = longer content but slower response. Default is 2000 tokens (~1500 words).
- If the API key is not configured on the backend, all endpoints will return a 500 error. Contact the system administrator.
