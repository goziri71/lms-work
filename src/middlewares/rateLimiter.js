import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { redisClient, isRedisAvailable } from "../config/redis.js";

// Create Redis store factory
const createRedisStore = (prefix) => {
  if (!isRedisAvailable || !redisClient) {
    return undefined; // Use memory store
  }

  try {
    return new RedisStore({
      // @ts-expect-error - ioredis is compatible
      sendCommand: (...args) => redisClient.call(...args),
      prefix,
    });
  } catch (error) {
    console.log(`⚠️ Redis store failed, using memory: ${error.message}`);
    return undefined;
  }
};

// General API rate limiter - 100 requests per 15 minutes
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    status: false,
    code: 429,
    message: "Too many requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("rl:general:"),
});

// Strict rate limiter for exam operations - 30 requests per 15 minutes
export const examLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    status: false,
    code: 429,
    message: "Too many exam requests, please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("rl:exam:"),
});

// Very strict limiter for starting exams - 5 attempts per hour
export const examStartLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 1 hour
  max: 5,
  message: {
    status: false,
    code: 429,
    message: "Too many exam start attempts. Please wait before trying again.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("rl:exam_start:"),
  keyGenerator: (req) => {
    // Rate limit by user ID + exam ID (no IP to avoid IPv6 issues)
    return `user_${req.user?.id || "guest"}_exam_${req.params.examId}`;
  },
});

// Answer submission limiter - 100 answers per 30 minutes (for long exams)
export const answerLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 100,
  message: {
    status: false,
    code: 429,
    message: "Too many answer submissions. Please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("rl:answer:"),
});

// Auth limiter - 10 login attempts per 15 minutes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    status: false,
    code: 429,
    message: "Too many login attempts. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("rl:auth:"),
  skipSuccessfulRequests: true, // Don't count successful logins
});

// Question creation limiter - 50 questions per hour (staff)
export const questionCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  message: {
    status: false,
    code: 429,
    message: "Too many questions created. Please wait before creating more.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("rl:question:"),
});

// Coaching booking actions (create/accept/counter/decline/pay) - 20 per
// 15 minutes per user. These are low-frequency, deliberate actions for a
// real human to take, so this is generous for legitimate use while still
// blocking scripted spam against tutors' booking requests or the payment
// endpoint.
export const coachingBookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    status: false,
    code: 429,
    message: "Too many booking actions. Please slow down and try again shortly.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("rl:coaching_booking:"),
  keyGenerator: (req) => `user_${req.user?.id || "guest"}`,
});

// Public (access-token based) coaching booking payment endpoints — these
// are reachable by guests with no req.user at all, so keying by user id
// would lump every guest into one shared "guest" bucket (one abusive guest
// could lock out everyone else). Keyed by the booking id itself instead:
// 20 attempts per booking per 15 minutes is generous for a real payer,
// generous enough to block brute-forcing a specific booking's access_token
// or spamming its payment-confirmation endpoint.
export const coachingPublicBookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    status: false,
    code: 429,
    message: "Too many attempts for this booking. Please slow down and try again shortly.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("rl:coaching_booking_public:"),
  keyGenerator: (req) => `booking_${req.params?.id || req.params?.accessToken || "unknown"}`,
});
