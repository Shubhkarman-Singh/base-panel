const fs = require('fs');
const path = require('path');

/**
 * Get the logo URL based on settings with fallback support
 * @param {Object} settings - Application settings
 * @returns {string} Logo URL or null if no logo
 */
function getLogoUrl(settings = {}) {
  if (!settings.logo) {
    return null; // No logo configured
  }
  
  if (settings.logoType === 'link' && settings.logoLink) {
    // Return the link directly - fallback will be handled on frontend
    return settings.logoLink;
  } else {
    // Check if uploaded logo exists
    const logoPath = path.join(__dirname, '..', 'public', 'assets', 'logo.png');
    if (fs.existsSync(logoPath)) {
      return '/assets/logo.png';
    }
  }
  
  // Fallback to default logo if exists
  const defaultLogoPath = path.join(__dirname, '..', 'public', 'assets', 'default-logo.svg');
  if (fs.existsSync(defaultLogoPath)) {
    return '/assets/default-logo.svg';
  }
  
  return null; // No logo available
}

/**
 * Check if a logo is configured
 * @param {Object} settings - Application settings
 * @returns {boolean} True if logo is configured
 */
function hasLogo(settings = {}) {
  return Boolean(settings.logo);
}

/**
 * Get logo display properties for frontend
 * @param {Object} settings - Application settings
 * @returns {Object} Logo properties
 */
function getLogoProperties(settings = {}) {
  return {
    hasLogo: hasLogo(settings),
    logoUrl: getLogoUrl(settings),
    logoType: settings.logoType || 'upload',
    logoLink: settings.logoLink || '',
    fallbackUrl: '/assets/default-logo.svg'
  };
}

module.exports = {
  getLogoUrl,
  hasLogo,
  getLogoProperties
};