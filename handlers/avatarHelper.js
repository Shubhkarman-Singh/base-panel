const crypto = require('crypto');

/**
 * Generate avatar URL based on the configured avatar provider
 * @param {string} identifier - User identifier (username, email, etc.)
 * @param {Object} settings - Application settings
 * @param {Object} user - User object (optional, for custom avatars)
 * @returns {string} Avatar URL
 */
function generateAvatarUrl(identifier, settings = {}, user = null) {
  const avatarProvider = settings.avatarProvider || 'gravatar';
  
  switch (avatarProvider) {
    case 'gravatar':
      // Generate Gravatar URL using MD5 hash of email or username
      const email = user?.email || `${identifier}@example.com`;
      const hash = crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex');
      return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=200`;
      
    case 'dicebear':
      // Use DiceBear API with username as seed
      return `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(identifier)}`;
      
    case 'custom':
      // Check if user has custom avatar, fallback to DiceBear
      if (user?.customAvatar && settings.customAvatars) {
        return `/uploads/avatars/${user.customAvatar}`;
      }
      // Fallback to DiceBear if no custom avatar
      return `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(identifier)}`;
      
    default:
      // Default fallback to DiceBear
      return `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(identifier)}`;
  }
}

/**
 * Get avatar URL for a user
 * @param {Object} user - User object
 * @param {Object} settings - Application settings
 * @returns {string} Avatar URL
 */
function getUserAvatarUrl(user, settings = {}) {
  return generateAvatarUrl(user.username, settings, user);
}

module.exports = {
  generateAvatarUrl,
  getUserAvatarUrl
};