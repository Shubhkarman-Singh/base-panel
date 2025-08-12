const crypto = require('crypto');
const { db } = require("../handlers/db.js");
const log = new (require("cat-loggr"))();

/**
 * Secure Password Reset Management
 */
class PasswordResetSecurity {
  
  /**
   * Generate secure password reset token with expiration
   */
  static generateResetToken() {
    return {
      token: crypto.randomBytes(32).toString('hex'),
      expires: Date.now() + (60 * 60 * 1000), // 1 hour expiration
      created: Date.now(),
      used: false
    };
  }

  /**
   * Store password reset token for user
   */
  static async storeResetToken(email, tokenData) {
    try {
      let users = (await db.get("users")) || [];
      const userIndex = users.findIndex(u => u.email === email);
      
      if (userIndex === -1) {
        throw new Error('User not found');
      }

      // Clear any existing reset tokens for this user
      delete users[userIndex].resetToken;
      delete users[userIndex].resetTokenExpires;
      delete users[userIndex].resetTokenCreated;
      delete users[userIndex].resetTokenUsed;

      // Store new token data
      users[userIndex].resetToken = tokenData.token;
      users[userIndex].resetTokenExpires = tokenData.expires;
      users[userIndex].resetTokenCreated = tokenData.created;
      users[userIndex].resetTokenUsed = tokenData.used;

      await db.set("users", users);
      
      log.info(`Password reset token generated for user: ${email}`);
      return tokenData.token;
    } catch (error) {
      log.error('Error storing reset token:', error);
      throw error;
    }
  }

  /**
   * Validate password reset token
   */
  static async validateResetToken(token) {
    try {
      const users = (await db.get("users")) || [];
      const user = users.find(u => u.resetToken === token);

      if (!user) {
        return { valid: false, error: 'Invalid token' };
      }

      // Check if token is expired
      if (!user.resetTokenExpires || Date.now() > user.resetTokenExpires) {
        return { valid: false, error: 'Token expired' };
      }

      // Check if token was already used
      if (user.resetTokenUsed) {
        return { valid: false, error: 'Token already used' };
      }

      return { 
        valid: true, 
        user: {
          email: user.email,
          username: user.username,
          userId: user.userId
        }
      };
    } catch (error) {
      log.error('Error validating reset token:', error);
      return { valid: false, error: 'Validation error' };
    }
  }

  /**
   * Mark reset token as used
   */
  static async markTokenAsUsed(token) {
    try {
      let users = (await db.get("users")) || [];
      const userIndex = users.findIndex(u => u.resetToken === token);

      if (userIndex !== -1) {
        users[userIndex].resetTokenUsed = true;
        await db.set("users", users);
        log.info(`Password reset token marked as used for user: ${users[userIndex].email}`);
      }
    } catch (error) {
      log.error('Error marking token as used:', error);
    }
  }

  /**
   * Clear reset token after successful password change
   */
  static async clearResetToken(token) {
    try {
      let users = (await db.get("users")) || [];
      const userIndex = users.findIndex(u => u.resetToken === token);

      if (userIndex !== -1) {
        delete users[userIndex].resetToken;
        delete users[userIndex].resetTokenExpires;
        delete users[userIndex].resetTokenCreated;
        delete users[userIndex].resetTokenUsed;
        
        await db.set("users", users);
        log.info(`Password reset token cleared for user: ${users[userIndex].email}`);
      }
    } catch (error) {
      log.error('Error clearing reset token:', error);
    }
  }

  /**
   * Clean up expired tokens (run periodically)
   */
  static async cleanupExpiredTokens() {
    try {
      let users = (await db.get("users")) || [];
      let cleaned = 0;
      const now = Date.now();

      users.forEach(user => {
        if (user.resetToken && user.resetTokenExpires && now > user.resetTokenExpires) {
          delete user.resetToken;
          delete user.resetTokenExpires;
          delete user.resetTokenCreated;
          delete user.resetTokenUsed;
          cleaned++;
        }
      });

      if (cleaned > 0) {
        await db.set("users", users);
        log.info(`Cleaned up ${cleaned} expired password reset tokens`);
      }

      return cleaned;
    } catch (error) {
      log.error('Error cleaning up expired tokens:', error);
      return 0;
    }
  }

  /**
   * Get reset attempt statistics for monitoring
   */
  static async getResetStats() {
    try {
      const users = (await db.get("users")) || [];
      const stats = {
        activeTokens: 0,
        expiredTokens: 0,
        usedTokens: 0
      };

      const now = Date.now();
      users.forEach(user => {
        if (user.resetToken) {
          if (user.resetTokenUsed) {
            stats.usedTokens++;
          } else if (user.resetTokenExpires && now > user.resetTokenExpires) {
            stats.expiredTokens++;
          } else {
            stats.activeTokens++;
          }
        }
      });

      return stats;
    } catch (error) {
      log.error('Error getting reset stats:', error);
      return { activeTokens: 0, expiredTokens: 0, usedTokens: 0 };
    }
  }
}

// Clean up expired tokens every 6 hours
setInterval(() => {
  PasswordResetSecurity.cleanupExpiredTokens();
}, 6 * 60 * 60 * 1000);

module.exports = {
  PasswordResetSecurity
};