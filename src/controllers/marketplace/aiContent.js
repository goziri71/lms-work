import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import {
  generateContent,
  improveContent,
  summarizeContent,
  SUPPORTED_CONTENT_TYPES,
} from "../../services/aiService.js";

// ─── Generate AI Content ────────────────────────────────────────────────
/**
 * POST /api/marketplace/tutor/ai/generate
 * Generate content using AI
 * 
 * Body:
 *   content_type  - (required) one of: course_description, course_outline, module_content,
 *                   quiz_questions, community_post, coaching_description, sales_page,
 *                   assignment, email_template, general
 *   topic         - (required) the subject/topic to generate content about
 *   additional_context - (optional) extra instructions or context
 *   tone          - (optional) professional | casual | academic | friendly (default: professional)
 *   language      - (optional) language for the content (default: English)
 *   max_tokens    - (optional) max response length in tokens
 */
export const generateAIContent = TryCatchFunction(async (req, res) => {
  const { content_type, topic, additional_context, tone, language, max_tokens } = req.body;

  // Validate required fields
  if (!topic || !topic.trim()) {
    throw new ErrorClass("Topic is required", 400);
  }

  if (!content_type || !content_type.trim()) {
    throw new ErrorClass("Content type is required", 400);
  }

  // Validate content_type
  if (!SUPPORTED_CONTENT_TYPES.includes(content_type)) {
    throw new ErrorClass(
      `Invalid content type. Supported types: ${SUPPORTED_CONTENT_TYPES.join(", ")}`,
      400
    );
  }

  // Validate tone if provided
  const validTones = ["professional", "casual", "academic", "friendly", "persuasive", "conversational"];
  if (tone && !validTones.includes(tone)) {
    throw new ErrorClass(
      `Invalid tone. Supported tones: ${validTones.join(", ")}`,
      400
    );
  }

  const result = await generateContent({
    content_type: content_type.trim(),
    topic: topic.trim(),
    additional_context: additional_context?.trim() || "",
    tone: tone?.trim() || "professional",
    language: language?.trim() || "English",
    max_tokens: max_tokens ? parseInt(max_tokens) : undefined,
  });

  res.status(200).json({
    success: true,
    message: "Content generated successfully",
    data: result,
  });
});

// ─── Improve Existing Content ───────────────────────────────────────────
/**
 * POST /api/marketplace/tutor/ai/improve
 * Improve or rewrite existing content
 * 
 * Body:
 *   original_content - (required) the content to improve
 *   instruction      - (optional) what to improve (default: general improvement)
 *   content_type     - (optional) for context
 *   max_tokens       - (optional) max response length
 */
export const improveAIContent = TryCatchFunction(async (req, res) => {
  const { original_content, instruction, content_type, max_tokens } = req.body;

  if (!original_content || !original_content.trim()) {
    throw new ErrorClass("Original content is required", 400);
  }

  if (original_content.trim().length < 10) {
    throw new ErrorClass("Content must be at least 10 characters long", 400);
  }

  const result = await improveContent({
    original_content: original_content.trim(),
    instruction: instruction?.trim() || undefined,
    content_type: content_type?.trim() || "general",
    max_tokens: max_tokens ? parseInt(max_tokens) : undefined,
  });

  res.status(200).json({
    success: true,
    message: "Content improved successfully",
    data: result,
  });
});

// ─── Summarize Content ──────────────────────────────────────────────────
/**
 * POST /api/marketplace/tutor/ai/summarize
 * Summarize given content
 * 
 * Body:
 *   content    - (required) the content to summarize
 *   style      - (optional) brief | detailed | bullet_points (default: brief)
 *   max_tokens - (optional) max response length
 */
export const summarizeAIContent = TryCatchFunction(async (req, res) => {
  const { content, style, max_tokens } = req.body;

  if (!content || !content.trim()) {
    throw new ErrorClass("Content to summarize is required", 400);
  }

  if (content.trim().length < 20) {
    throw new ErrorClass("Content must be at least 20 characters long to summarize", 400);
  }

  const validStyles = ["brief", "detailed", "bullet_points"];
  if (style && !validStyles.includes(style)) {
    throw new ErrorClass(
      `Invalid style. Supported styles: ${validStyles.join(", ")}`,
      400
    );
  }

  const result = await summarizeContent({
    content: content.trim(),
    style: style?.trim() || "brief",
    max_tokens: max_tokens ? parseInt(max_tokens) : undefined,
  });

  res.status(200).json({
    success: true,
    message: "Content summarized successfully",
    data: result,
  });
});

// ─── Get Supported Content Types ────────────────────────────────────────
/**
 * GET /api/marketplace/tutor/ai/content-types
 * Return the list of supported AI content types
 */
export const getContentTypes = TryCatchFunction(async (req, res) => {
  const types = SUPPORTED_CONTENT_TYPES.map((type) => ({
    value: type,
    label: type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" "),
  }));

  res.status(200).json({
    success: true,
    data: {
      content_types: types,
      tones: ["professional", "casual", "academic", "friendly", "persuasive", "conversational"],
      summary_styles: ["brief", "detailed", "bullet_points"],
    },
  });
});
