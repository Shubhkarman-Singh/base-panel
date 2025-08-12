/**
 * Middleware to verify if the user is an administrator.
 * Implements comprehensive admin privilege verification with multiple security checks.
 *
 * @param {Object} req - The request object, containing user data.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware or route handler to be executed.
 * @returns {void} Either redirects or proceeds by calling next().
 */
async function isAdmin(req, res, next) {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Validate user object structure
    if (typeof req.user !== 'object' || !req.user.userId) {
      return res.status(401).json({ error: "Invalid user session" });
    }

    // Check admin privilege with strict type checking
    if (req.user.admin !== true || typeof req.user.admin !== 'boolean') {
      return res.status(403).json({ error: "Administrator privileges required" });
    }

    // Additional security: verify user still exists in database and has admin privileges
    const { db } = require("../handlers/db.js");
    const users = await db.get("users");
    const currentUser = users?.find(u => u.userId === req.user.userId);
    
    if (!currentUser) {
      // User no longer exists in database
      if (req.session) {
        req.session.destroy();
      }
      return res.status(401).json({ error: "User account not found" });
    }
    
    if (currentUser.admin !== true) {
      // Admin privileges have been revoked
      return res.status(403).json({ error: "Administrator privileges revoked" });
    }
    
    // Update req.user with fresh data from database
    req.user = currentUser;
    next();
    
  } catch (error) {
    console.error("Admin verification error:", error);
    return res.status(500).json({ error: "Authorization verification failed" });
  }
}

module.exports = { isAdmin };
