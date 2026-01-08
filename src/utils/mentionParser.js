/**
 * Utility to parse @mentions from text content
 * Extracts user IDs from @username or @id patterns
 */

/**
 * Parse mentions from text content
 * Looks for @username or @id patterns
 * @param {string} content - Text content to parse
 * @returns {Array<number>} - Array of mentioned user IDs
 */
export function parseMentions(content) {
  if (!content || typeof content !== "string") {
    return [];
  }

  // Pattern to match @username or @id
  // Matches: @username, @user_name, @user123, @123
  const mentionPattern = /@(\w+)/g;
  const mentions = [];
  const seen = new Set();

  let match;
  while ((match = mentionPattern.exec(content)) !== null) {
    const mention = match[1];
    
    // Try to extract user ID if it's a number
    const userId = parseInt(mention);
    if (!isNaN(userId) && userId > 0) {
      if (!seen.has(userId)) {
        mentions.push(userId);
        seen.add(userId);
      }
    }
    // Note: For @username patterns, we'll need to look up the user ID
    // This will be handled in the controller by querying the database
  }

  return mentions;
}

/**
 * Replace mentions in content with formatted links
 * @param {string} content - Original content
 * @param {Array<Object>} users - Array of user objects with id, name
 * @returns {string} - Content with formatted mentions
 */
export function formatMentions(content, users = []) {
  if (!content || typeof content !== "string") {
    return content;
  }

  let formatted = content;
  const userMap = {};
  users.forEach((user) => {
    userMap[user.id] = user;
  });

  // Replace @id with @name
  const mentionPattern = /@(\w+)/g;
  formatted = formatted.replace(mentionPattern, (match, mention) => {
    const userId = parseInt(mention);
    if (!isNaN(userId) && userMap[userId]) {
      return `@${userMap[userId].name}`;
    }
    return match;
  });

  return formatted;
}

