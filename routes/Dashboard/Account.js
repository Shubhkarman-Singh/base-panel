/**
 * @fileoverview This module sets up administrative routes for managing and monitoring server nodes
 * within the network. It provides functionality to create, delete, and debug nodes, as well as check
 * their current status. User authentication and admin role verification are enforced for access to
 * these routes.
 */

const express = require("express");
const router = express.Router();
const { db } = require("../../handlers/db.js");
const bcrypt = require("bcrypt");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const configManager = require("../../utils/configManager");
const saltRounds = configManager.get("saltRounds") || 10;
const log = require("../../utils/secureLogger");
const { isAuthenticated } = require("../../handlers/auth.js");
const { InputValidator } = require("../../utils/inputValidation");
const DataSanitizer = require("../../utils/dataSanitizer");

async function doesUserExist(username) {
  const users = await db.get("users");
  if (users) {
    return users.some((user) => user.username === username);
  } else {
    return false; // If no users found, return false
  }
}

router.get("/account", async (req, res) => {
  try {
    const { getUserAvatarUrl } = require("../../handlers/avatarHelper.js");
    const settings = (await db.get("settings")) || {};
    const users = (await db.get("users")) || [];
    
    // Sanitize user data for template rendering
    const sanitizedUsers = DataSanitizer.sanitizeUsers(users, {
      includeEmail: false,
      includeAdminStatus: false,
      includePersonalData: false
    });
    
    // Create safe profile for current user (includes their own email)
    const userProfile = DataSanitizer.createUserProfile(req.user);
    
    res.render("account", {
      req,
      user: userProfile,
      users: sanitizedUsers,
      settings: DataSanitizer.removeSensitiveFields(settings),
      getUserAvatarUrl
    });
  } catch (error) {
    log.error("Error loading account page:", DataSanitizer.sanitizeError(error));
    res.status(500).send("Internal Server Error");
  }
});

router.get("/accounts", async (req, res) => {
  try {
    let users = (await db.get("users")) || [];

    // Use data sanitizer for consistent and secure data filtering
    const sanitizedUsers = DataSanitizer.sanitizeUsers(users, {
      includeEmail: false,        // Never include email in public listings
      includeAdminStatus: true,   // Include admin status for UI purposes
      includePersonalData: true   // Include non-sensitive personal data
    });

    log.info(`User accounts data requested by user: ${req.user?.username || 'unknown'}`);
    res.json(sanitizedUsers);
  } catch (error) {
    log.error("Error fetching user accounts:", DataSanitizer.sanitizeError(error));
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/check-username", async (req, res) => {
  const username = req.query.username;

  if (!username) {
    return res.status(400).send("Username parameter is required.");
  }

  const userExists = await doesUserExist(username);

  res.json({ exists: userExists });
});

router.post("/update-username", isAuthenticated, async (req, res) => {
  const { currentUsername, newUsername } = req.body;

  if (!currentUsername || !newUsername) {
    return res
      .status(400)
      .send("Current and new username parameters are required.");
  }

  // Validate new username
  const usernameValidation = InputValidator.validateUsername(newUsername);
  if (!usernameValidation.isValid) {
    return res.status(400).send(`Username validation failed: ${usernameValidation.errors.join(', ')}`);
  }

  try {
    // Logout the user
    req.logout(async (err) => {
      if (err) {
        //log.error('Error logging out user:', err);
        //return res.status(500).send('Error logging out user.');
        next(err);
      }

      // Now that the user is logged out, proceed with the username update

      // Check if the current username exists
      const userExists = await doesUserExist(currentUsername);
      if (!userExists) {
        return res.status(404).send("Current username does not exist.");
      }

      // Check if the new username already exists
      const newUsernameExists = await doesUserExist(newUsername);
      if (newUsernameExists) {
        return res.status(409).send("New username is already taken.");
      }

      // Update the username in the database
      const users = await db.get("users");
      const updatedUsers = users.map((user) => {
        if (user.username === currentUsername) {
          return { ...user, username: newUsername };
        } else {
          return user;
        }
      });
      await db.set("users", updatedUsers);

      // Send updated user data back to the client
      res.status(200).json({ success: true, username: newUsername });
    });
  } catch (error) {
    log.error("Error updating username:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/enable-2fa", isAuthenticated, async (req, res) => {
  try {
    const users = await db.get("users");
    const currentUser = users.find(
      (user) => user.username === req.user.username
    );
    
    // Generate secure secret with backup codes
    const secret = speakeasy.generateSecret({
      length: 32, // Increased length for better security
      name: `Impulse (${currentUser.username})`,
      issuer: "Impulse",
    });
    
    // Generate backup codes
    const backupCodes = [];
    for (let i = 0; i < 10; i++) {
      backupCodes.push(require('crypto').randomBytes(4).toString('hex').toUpperCase());
    }

    const updatedUsers = users.map((user) => {
      if (user.username === req.user.username) {
        return { 
          ...user, 
          twoFASecret: secret.base32, 
          twoFAEnabled: false,
          twoFABackupCodes: backupCodes,
          twoFAAttempts: 0,
          twoFALastAttempt: null
        };
      } else {
        return user;
      }
    });
    await db.set("users", updatedUsers);

    qrcode.toDataURL(secret.otpauth_url, async (err, data_url) => {
      if (err) return res.status(500).send("Error generating QR Code");
      res.render("enable-2fa", {
        req,
        user: req.user,
        users,
        name: (await db.get("name")) || "Impulse",
        qrCode: data_url,
        backupCodes: backupCodes
      });
    });
  } catch (error) {
    log.error("Error enabling 2FA:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.post("/verify-2fa", isAuthenticated, async (req, res) => {
  try {
    const { token } = req.body;
    const users = await db.get("users");
    const currentUser = users.find(
      (user) => user.username === req.user.username
    );

    // Rate limiting for 2FA attempts
    const now = Date.now();
    const attempts = currentUser.twoFAAttempts || 0;
    const lastAttempt = currentUser.twoFALastAttempt || 0;
    
    // Reset attempts if more than 15 minutes have passed
    if (now - lastAttempt > 15 * 60 * 1000) {
      currentUser.twoFAAttempts = 0;
    }
    
    if (attempts >= 5) {
      return res.status(429).send("Too many 2FA attempts. Please try again in 15 minutes.");
    }

    const verified = speakeasy.totp.verify({
      secret: currentUser.twoFASecret,
      encoding: "base32",
      token,
      window: 1 // Allow 1 step tolerance for clock drift
    });

    if (verified) {
      const updatedUsers = users.map((user) => {
        if (user.username === req.user.username) {
          return { 
            ...user, 
            twoFAEnabled: true,
            twoFAAttempts: 0,
            twoFALastAttempt: null
          };
        } else {
          return user;
        }
      });
      await db.set("users", updatedUsers);

      res.redirect("/account?msg=2FAEnabled");
    } else {
      // Increment failed attempts
      const updatedUsers = users.map((user) => {
        if (user.username === req.user.username) {
          return { 
            ...user, 
            twoFAAttempts: attempts + 1,
            twoFALastAttempt: now
          };
        } else {
          return user;
        }
      });
      await db.set("users", updatedUsers);
      
      res.status(400).send("Invalid token");
    }
  } catch (error) {
    log.error("Error verifying 2FA:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.post("/disable-2fa", isAuthenticated, async (req, res) => {
  try {
    const users = await db.get("users");

    const updatedUsers = users.map((user) => {
      if (user.username === req.user.username) {
        return { 
          ...user, 
          twoFAEnabled: false, 
          twoFASecret: null,
          twoFABackupCodes: null,
          twoFAAttempts: 0,
          twoFALastAttempt: null
        };
      } else {
        return user;
      }
    });
    await db.set("users", updatedUsers);

    res.redirect("/account");
  } catch (error) {
    log.error("Error disabling 2FA:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.post("/change-password", isAuthenticated, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .send("Current and new password parameters are required.");
  }

  // Validate new password
  const passwordValidation = InputValidator.validatePassword(newPassword);
  if (!passwordValidation.isValid) {
    return res.status(400).send(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
  }

  try {
    // Get the user's information from the database
    const users = await db.get("users");
    const currentUser = users.find(
      (user) => user.username === req.user.username
    );

    // Check if the current password matches the user's password in the database
    const passwordMatch = await bcrypt.compare(
      currentPassword,
      currentUser.password
    );
    if (!passwordMatch) {
      return res.status(401).send("Current password is incorrect.");
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update the user's password in the database
    const updatedUsers = users.map((user) => {
      if (user.username === req.user.username) {
        return { ...user, password: hashedNewPassword };
      } else {
        return user;
      }
    });
    await db.set("users", updatedUsers);

    // Log the user out
    req.logout(async (err) => {
      if (err) {
        //log.error('Error logging out user:', err);
        //return res.status(500).send('Error logging out user.');
        next(err);
      }
    });

    // Redirect the user to the login page with a success message
    res.status(200).redirect("/login?err=UpdatedCredentials");
  } catch (error) {
    log.error("Error changing password:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.post("/validate-password", isAuthenticated, async (req, res) => {
  try {
    // Retrieve the password from the request body
    const { currentPassword } = req.body;

    // Get the user's information from the database
    const users = await db.get("users");
    const currentUser = users.find(
      (user) => user.username === req.user.username
    );

    // Check if currentUser exists and contains the hashed password
    if (currentUser && currentUser.password) {
      // Hash the current password using the same salt as the stored password
      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        currentUser.password
      );

      if (isPasswordValid) {
        res.status(200).json({ valid: true });
      } else {
        res.status(200).json({ valid: false });
      }
    } else {
      res
        .status(404)
        .json({ message: "User not found or password not available." });
    }
  } catch (error) {
    log.error("Error validating password:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Change avatar URL route
router.post("/change-avatar", isAuthenticated, async (req, res) => {
  try {
    const { avatarUrl, action } = req.body;
    const users = await db.get("users");
    
    const userIndex = users.findIndex(u => u.userId === req.user.userId);
    if (userIndex === -1) {
      return res.status(404).send("User not found");
    }
    
    if (action === 'remove') {
      // Remove custom avatar URL
      users[userIndex].customAvatarUrl = null;
    } else if (avatarUrl) {
      // Validate URL format
      try {
        new URL(avatarUrl);
        users[userIndex].customAvatarUrl = avatarUrl;
      } catch (error) {
        return res.status(400).send("Invalid URL format");
      }
    }
    
    await db.set("users", users);
    res.redirect("/account?msg=AvatarUpdated");
  } catch (error) {
    log.error("Error changing avatar:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Change boring avatar style route
router.post("/change-boring-avatar-style", isAuthenticated, async (req, res) => {
  try {
    const { style, colors } = req.body;
    const users = await db.get("users");
    
    const userIndex = users.findIndex(u => u.userId === req.user.userId);
    if (userIndex === -1) {
      return res.status(404).send("User not found");
    }
    
    // Validate style
    const validStyles = ['beam', 'marble', 'pixel', 'sunset', 'bauhaus', 'ring'];
    if (!validStyles.includes(style)) {
      return res.status(400).send("Invalid style");
    }
    
    // Parse and validate colors
    let colorArray = [];
    if (colors) {
      colorArray = colors.split(',').map(c => c.trim()).filter(c => /^[0-9a-fA-F]{6}$/.test(c));
      if (colorArray.length === 0) {
        colorArray = ['264653', '2a9d8f', 'e9c46a', 'f4a261', 'e76f51']; // Default colors
      }
    }
    
    users[userIndex].boringAvatarStyle = style;
    users[userIndex].boringAvatarColors = colorArray;
    
    await db.set("users", users);
    res.redirect("/account?msg=AvatarStyleUpdated");
  } catch (error) {
    log.error("Error changing boring avatar style:", error);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;