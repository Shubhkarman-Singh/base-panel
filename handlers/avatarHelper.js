const crypto = require('crypto');

/**
 * Generate avatar URL based on the configured avatar provider
 * @param {string} identifier - User identifier (username, email, etc.)
 * @param {Object} settings - Application settings
 * @param {Object} user - User object (optional, for custom avatars)
 * @returns {string} Avatar URL
 */
function generateAvatarUrl(identifier, settings = {}, user = null) {
  // Safety check for identifier
  if (!identifier || typeof identifier !== 'string') {
    identifier = 'User';
  }
  
  const avatarProvider = settings.avatarProvider || 'default';

  try {
    switch (avatarProvider) {
      case 'gravatar':
        // Generate Gravatar URL using MD5 hash of email or username
        const email = user?.email || `${identifier}@example.com`;
        const hash = crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex');
        return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=200&r=pg`;

      case 'dicebear':
        // Use DiceBear API with username as seed
        return `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(identifier)}&backgroundColor=transparent`;

      case 'ui-avatars':
        // Use UI-Avatars service
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(identifier)}&size=200&background=random&color=fff&bold=true&format=svg`;

      case 'boring-avatars':
        // Use Boring Avatars with user's preferred style and colors
        const style = user?.boringAvatarStyle || settings.boringAvatarStyle || 'beam';
        const colors = user?.boringAvatarColors || settings.boringAvatarColors || ['264653', '2a9d8f', 'e9c46a', 'f4a261', 'e76f51'];
        const colorString = colors.join(',');
        return `https://source.boringavatars.com/${style}/200/${encodeURIComponent(identifier)}?colors=${colorString}`;

      case 'default':
      default:
        // WhatsApp-style avatar with first letter
        return generateDefaultAvatar(identifier);
    }
  } catch (error) {
    console.error('Error in generateAvatarUrl:', error);
    return generateDefaultAvatar(identifier);
  }
}

/**
 * Generate WhatsApp-style default avatar with first letter
 * @param {string} identifier - User identifier (username, email, etc.)
 * @returns {string} Data URL for SVG avatar
 */
function generateDefaultAvatar(identifier) {
  // Safety check and fallback
  if (!identifier || typeof identifier !== 'string' || identifier.length === 0) {
    identifier = 'User';
  }
  
  const firstLetter = identifier.charAt(0).toUpperCase();

  // Generate a consistent color based on the identifier
  const colors = [
    // Teals
    '#128C7E', '#0D6E63', '#075E54', '#1A5F5F', '#0F4C5C',
    // Blues
    '#1E3A8A', '#1E40AF', '#1D4ED8', '#2563EB', '#3B82F6',
    // Purples
    '#4C1D95', '#5B21B6', '#6D28D9', '#7C3AED', '#8B5CF6',
    // Pinks/Purples
    '#831843', '#9D174D', '#BE185D', '#DB2777', '#EC4899',
    // Reds
    '#991B1B', '#B91C1C', '#DC2626', '#EF4444', '#F87171',
    // Oranges
    '#9A3412', '#C2410C', '#EA580C', '#F97316', '#FB923C',
    // Yellows
    '#854D0E', '#A16207', '#CA8A04', '#EAB308', '#FACC15',
    // Greens
    '#166534', '#15803D', '#16A34A', '#22C55E', '#4ADE80',
    // Deep colors
    '#1E293B', '#334155', '#475569', '#64748B', '#94A3B8'
  ];

  // Generate hash from identifier
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % colors.length;
  const backgroundColor = colors[colorIndex];

  // Calculate text color (white or very light gray for better contrast)
  const textColor = '#FFFFFF';

  try {
    // Create SVG avatar with perfect centering
    const svg = `<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" rx="100" fill="${backgroundColor}"/><text x="50%" y="50%" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="80" font-weight="600" fill="${textColor}" text-anchor="middle" dominant-baseline="middle" style="user-select: none;">${firstLetter}</text></svg>`;

    // Return as data URL
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  } catch (error) {
    console.error('Error generating default avatar:', error);
    // Return a simple fallback
    return `data:image/svg+xml;base64,${Buffer.from('<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" rx="100" fill="#6B7280"/><text x="50%" y="50%" font-family="Arial" font-size="80" font-weight="600" fill="#FFFFFF" text-anchor="middle" dominant-baseline="middle">?</text></svg>').toString('base64')}`;
  }
}

/**
 * Get avatar URL for a user
 * @param {Object} user - User object
 * @param {Object} settings - Application settings
 * @returns {string} Avatar URL with cache-busting for browser refresh
 */
function getUserAvatarUrl(user, settings = {}) {
  // Safety check for user object
  if (!user) {
    console.error('getUserAvatarUrl: user object is null or undefined');
    return generateDefaultAvatar('?');
  }
  
  // Check if user has a custom avatar URL and custom avatars are enabled
  if (user.customAvatarUrl && settings.customAvatars) {
    // Validate the custom avatar URL
    try {
      new URL(user.customAvatarUrl);
      // Add cache-busting to custom avatar URLs
      const separator = user.customAvatarUrl.includes('?') ? '&' : '?';
      return `${user.customAvatarUrl}${separator}v=${Date.now()}`;
    } catch (error) {
      console.warn('Invalid custom avatar URL for user:', user.username, user.customAvatarUrl);
      // Fall through to generate default avatar
    }
  }
  
  // Get username with fallback
  const username = user.username || user.name || user.userId || 'User';
  
  // Generate the avatar URL
  let avatarUrl;
  try {
    avatarUrl = generateAvatarUrl(username, settings, user);
  } catch (error) {
    console.error('Error generating avatar URL:', error);
    return generateDefaultAvatar(username);
  }
  
  // Add cache-busting for external URLs (not data URLs)
  if (!avatarUrl.startsWith('data:')) {
    const separator = avatarUrl.includes('?') ? '&' : '?';
    return `${avatarUrl}${separator}v=${Date.now()}`;
  }
  
  return avatarUrl;
}

module.exports = {
  generateAvatarUrl,
  getUserAvatarUrl
};