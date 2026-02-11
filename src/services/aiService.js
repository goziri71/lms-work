import OpenAI from "openai";
import { Config } from "../config/config.js";

// ─── Initialize OpenAI client ───────────────────────────────────────────
let openaiClient = null;

const getClient = () => {
  if (!openaiClient) {
    if (!Config.openai.apiKey) {
      throw new Error("OpenAI API key is not configured. Set OPENAI_API_KEY in your .env file.");
    }
    openaiClient = new OpenAI({ apiKey: Config.openai.apiKey });
  }
  return openaiClient;
};

// ─── Content-type specific system prompts ───────────────────────────────

const SYSTEM_PROMPTS = {
  course_description: `You are an expert educational content writer for an online learning platform. 
Generate a compelling, professional course description that:
- Opens with a strong hook to capture interest
- Clearly explains what students will learn
- Lists key learning outcomes (3-5 bullet points)
- Describes who the course is for (target audience)
- Ends with a motivating call-to-action
Keep the tone professional yet engaging. Use clear, accessible language.`,

  course_outline: `You are an expert curriculum designer for an online learning platform.
Generate a well-structured course outline/syllabus that:
- Includes logical module/section titles (5-10 modules)
- Lists 2-4 lesson topics under each module
- Progresses from foundational to advanced concepts
- Includes estimated time per module
- Suggests practical exercises or assessments where appropriate
Format with clear headings and bullet points.`,

  module_content: `You are an expert educational content writer.
Generate comprehensive module/lesson content that:
- Starts with clear learning objectives
- Explains concepts in a clear, structured way
- Uses examples and analogies for complex topics
- Includes key takeaways at the end
- Is written at an appropriate academic level
Use headings, subheadings, and bullet points for readability.`,

  quiz_questions: `You are an expert assessment designer for an online learning platform.
Generate quiz questions that:
- Are clear and unambiguous
- Test understanding, not just memorization
- Include 4 answer options (A, B, C, D) for multiple choice
- Mark the correct answer clearly
- Include a brief explanation for each correct answer
- Mix difficulty levels (easy, medium, hard)
Format each question clearly with options and the correct answer marked.`,

  community_post: `You are a community engagement specialist for an online learning platform.
Generate a community post that:
- Is engaging and encourages discussion
- Is relevant to the given topic
- Asks thought-provoking questions
- Is conversational yet professional
- Encourages learners to share their experiences
Keep the post concise and discussion-friendly.`,

  coaching_description: `You are an expert in professional coaching and mentorship.
Generate a coaching session description that:
- Clearly explains the coaching session's focus and goals
- Describes what participants will gain
- Lists specific topics or skills that will be covered
- Explains the format and approach
- Appeals to the target audience
Keep it professional, warm, and inviting.`,

  sales_page: `You are a conversion-focused copywriter for an online education platform.
Generate sales page content that:
- Has a powerful, benefit-driven headline
- Opens with a compelling hook addressing the target audience's pain points
- Lists clear benefits and outcomes (not just features)
- Includes social proof suggestions (testimonial prompts)
- Has a strong call-to-action section
- Uses persuasive but honest language
Structure with clear sections: headline, sub-headline, benefits, features, FAQ suggestions, CTA.`,

  assignment: `You are an expert instructional designer.
Generate an assignment or project brief that:
- Has a clear title and objective
- Provides detailed instructions
- Lists specific deliverables/requirements
- Includes grading criteria or rubric points
- Sets a realistic scope
- Encourages critical thinking and practical application
Format with clear sections and bullet points.`,

  email_template: `You are a professional email copywriter for an educational platform.
Generate an email template that:
- Has an attention-grabbing subject line
- Opens with a personalized greeting
- Communicates the message clearly and concisely
- Has a clear call-to-action
- Ends professionally
Keep it warm, professional, and concise.`,

  general: `You are a helpful AI writing assistant for an online learning platform called Knomada.
Generate high-quality content based on the user's request. Be clear, professional, and helpful.
Adapt your tone and style to match the requested content type.`,
};

// ─── Supported content types ────────────────────────────────────────────

export const SUPPORTED_CONTENT_TYPES = Object.keys(SYSTEM_PROMPTS);

// ─── Main generation function ───────────────────────────────────────────

/**
 * Generate AI content using OpenAI
 * @param {Object} options
 * @param {string} options.content_type - Type of content to generate
 * @param {string} options.topic - The main topic/subject
 * @param {string} [options.additional_context] - Extra context or instructions
 * @param {string} [options.tone] - Desired tone (professional, casual, academic, etc.)
 * @param {string} [options.language] - Language for the content (default: English)
 * @param {number} [options.max_tokens] - Maximum tokens for the response
 * @returns {Promise<{content: string, content_type: string, model: string, usage: object}>}
 */
export const generateContent = async ({
  content_type = "general",
  topic,
  additional_context = "",
  tone = "professional",
  language = "English",
  max_tokens,
}) => {
  const client = getClient();
  const model = Config.openai.model;
  const maxTokens = max_tokens || Config.openai.maxTokens;

  // Get the system prompt for the content type
  const systemPrompt = SYSTEM_PROMPTS[content_type] || SYSTEM_PROMPTS.general;

  // Build the user message
  let userMessage = `Topic: ${topic}`;

  if (additional_context) {
    userMessage += `\n\nAdditional context/instructions: ${additional_context}`;
  }

  if (tone && tone !== "professional") {
    userMessage += `\n\nTone: ${tone}`;
  }

  if (language && language.toLowerCase() !== "english") {
    userMessage += `\n\nPlease write the content in ${language}.`;
  }

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_tokens: maxTokens,
    temperature: 0.7,
  });

  const generatedContent = response.choices[0]?.message?.content || "";

  return {
    content: generatedContent.trim(),
    content_type,
    model,
    usage: {
      prompt_tokens: response.usage?.prompt_tokens || 0,
      completion_tokens: response.usage?.completion_tokens || 0,
      total_tokens: response.usage?.total_tokens || 0,
    },
  };
};

/**
 * Improve/rewrite existing content using AI
 * @param {Object} options
 * @param {string} options.original_content - The original content to improve
 * @param {string} options.instruction - What to improve (clarity, grammar, tone, etc.)
 * @param {string} [options.content_type] - Content type for context
 * @param {number} [options.max_tokens] - Maximum tokens for the response
 * @returns {Promise<{content: string, model: string, usage: object}>}
 */
export const improveContent = async ({
  original_content,
  instruction = "Improve the clarity, grammar, and engagement of this content while keeping the same meaning.",
  content_type = "general",
  max_tokens,
}) => {
  const client = getClient();
  const model = Config.openai.model;
  const maxTokens = max_tokens || Config.openai.maxTokens;

  const systemPrompt = `You are a professional editor and content improver for an online learning platform. 
Improve the provided content based on the user's instructions. 
Maintain the original meaning and key information while enhancing quality.
Return only the improved content without any preamble or explanation.`;

  const userMessage = `Instruction: ${instruction}

Original content:
---
${original_content}
---

Please provide the improved version.`;

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_tokens: maxTokens,
    temperature: 0.5,
  });

  const improvedContent = response.choices[0]?.message?.content || "";

  return {
    content: improvedContent.trim(),
    content_type,
    model,
    usage: {
      prompt_tokens: response.usage?.prompt_tokens || 0,
      completion_tokens: response.usage?.completion_tokens || 0,
      total_tokens: response.usage?.total_tokens || 0,
    },
  };
};

/**
 * Generate a summary of given content
 * @param {Object} options
 * @param {string} options.content - Content to summarize
 * @param {string} [options.style] - Summary style: "brief", "detailed", "bullet_points"
 * @param {number} [options.max_tokens] - Maximum tokens for the response
 * @returns {Promise<{content: string, model: string, usage: object}>}
 */
export const summarizeContent = async ({
  content,
  style = "brief",
  max_tokens,
}) => {
  const client = getClient();
  const model = Config.openai.model;
  const maxTokens = max_tokens || 500;

  const styleInstructions = {
    brief: "Provide a concise summary in 2-3 sentences.",
    detailed: "Provide a comprehensive summary covering all key points.",
    bullet_points: "Summarize the key points as a bulleted list.",
  };

  const systemPrompt = `You are a professional content summarizer. ${styleInstructions[style] || styleInstructions.brief}`;

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Please summarize the following:\n\n${content}` },
    ],
    max_tokens: maxTokens,
    temperature: 0.3,
  });

  const summary = response.choices[0]?.message?.content || "";

  return {
    content: summary.trim(),
    style,
    model,
    usage: {
      prompt_tokens: response.usage?.prompt_tokens || 0,
      completion_tokens: response.usage?.completion_tokens || 0,
      total_tokens: response.usage?.total_tokens || 0,
    },
  };
};
