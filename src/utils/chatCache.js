import { cacheHelper } from "../config/redis.js";

/**
 * Chat caching utilities for WhatsApp-like performance
 */

const CACHE_TTL = 5 * 60; // 5 minutes

/**
 * Cache last messages for a chat thread
 */
export const cacheMessages = async (chatKey, messages) => {
  try {
    const key = `chat:messages:${chatKey}`;
    // Cache last 100 messages
    const messagesToCache = messages.slice(0, 100);
    await cacheHelper.set(key, messagesToCache, CACHE_TTL);
  } catch (error) {
    console.error("Chat cache error:", error.message);
  }
};

/**
 * Get cached messages for a chat thread
 */
export const getCachedMessages = async (chatKey) => {
  try {
    const key = `chat:messages:${chatKey}`;
    const cached = await cacheHelper.get(key);

    if (cached) {
      return cached;
    }
    return null;
  } catch (error) {
    console.error("Get cached messages error:", error.message);
    return null;
  }
};

/**
 * Cache unread count for a chat
 */
export const cacheUnreadCount = async (userId, peerId, peerType, count) => {
  try {
    const key = `chat:unread:${userId}:${peerType}:${peerId}`;
    await cacheHelper.set(key, count, CACHE_TTL);
  } catch (error) {
    console.error("Cache unread count error:", error.message);
  }
};

/**
 * Get cached unread count
 */
export const getCachedUnreadCount = async (userId, peerId, peerType) => {
  try {
    const key = `chat:unread:${userId}:${peerType}:${peerId}`;
    return await cacheHelper.get(key);
  } catch (error) {
    return null;
  }
};

/**
 * Cache active chat list
 */
export const cacheChatList = async (userId, chatList) => {
  try {
    const key = `chat:list:${userId}`;
    await cacheHelper.set(key, chatList, 10 * 60);
  } catch (error) {
    console.error("Cache chat list error:", error.message);
  }
};

/**
 * Get cached chat list
 */
export const getCachedChatList = async (userId) => {
  try {
    const key = `chat:list:${userId}`;
    const cached = await cacheHelper.get(key);

    if (cached) {
      return cached;
    }
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Invalidate chat cache
 */
export const invalidateChatCache = async (chatKey) => {
  try {
    const key = `chat:messages:${chatKey}`;
    await cacheHelper.del(key);
  } catch (error) {
    console.error("Invalidate chat cache error:", error.message);
  }
};

/**
 * Invalidate user's chat list cache
 */
export const invalidateChatList = async (userId) => {
  try {
    const key = `chat:list:${userId}`;
    await cacheHelper.del(key);
  } catch (error) {
    console.error("Invalidate chat list error:", error.message);
  }
};

/**
 * Generate cache key for a chat between two users
 */
export const getChatKey = (userId1, userId2, type1, type2) => {
  // Sort IDs for consistent cache key
  if (userId1 < userId2) {
    return `${type1}-${userId1}:${type2}-${userId2}`;
  } else {
    return `${type2}-${userId2}:${type1}-${userId1}`;
  }
};
