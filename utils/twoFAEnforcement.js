const { db } = require("../handlers/db");

/**
 * Middleware to enforce 2FA based on settings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function enforce2FA(req, res, next) {
  try {
    // Skip if user is not authenticated
    if (!req.user) {
      return next();
    }
    
    // Skip for 2FA-related routes to avoid infinite redirects
    const skip2FARoutes = ['/2fa', '/enable-2fa', '/verify-2fa', '/disable-2fa', '/logout'];
    if (skip2FARoutes.some(route => req.path.includes(route))) {
      return next();
    }
    
    const settings = (await db.get("settings")) || {};
    const twoFARequirement = settings.twoFARequirement || 'none';
    
    // No 2FA requirement
    if (twoFARequirement === 'none') {
      return next();
    }
    
    const users = (await db.get("users")) || [];
    const currentUser = users.find(u => u.userId === req.user.userId);
    
    if (!currentUser) {
      return next();
    }
    
    let requires2FA = false;
    
    // Check if 2FA is required based on settings
    if (twoFARequirement === 'all') {
      requires2FA = true;
    } else if (twoFARequirement === 'admins' && currentUser.admin) {
      requires2FA = true;
    }
    
    // If 2FA is required but user doesn't have it enabled, redirect to enable 2FA
    if (requires2FA && !currentUser.twoFAEnabled) {
      // Set a flash message or session variable to inform user
      req.session.enforce2FAMessage = `2FA is required for ${twoFARequirement === 'all' ? 'all users' : 'administrators'}. Please enable 2FA to continue.`;
      return res.redirect('/enable-2fa');
    }
    
    next();
  } catch (error) {
    console.error('Error in 2FA enforcement middleware:', error);
    next();
  }
}

module.exports = {
  enforce2FA
};