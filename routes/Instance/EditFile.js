const express = require("express");
const router = express.Router();
const { db } = require("../../handlers/db.js");
const {
  isUserAuthorizedForContainer,
  isInstanceSuspended,
} = require("../../utils/authHelper");
const { editFile } = require("../../utils/fileHelper");
const { requireAuth, requireInstanceAccess } = require("../../utils/authMiddleware.js");

/**
 * Validate filename for security
 */
function validateFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return { isValid: false, error: 'Invalid filename' };
  }
  
  // Check for dangerous characters
  const dangerousChars = /[<>:"|?*\x00-\x1f]/;
  if (dangerousChars.test(filename)) {
    return { isValid: false, error: 'Filename contains invalid characters' };
  }
  
  // Check for path traversal attempts
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return { isValid: false, error: 'Filename contains path traversal characters' };
  }
  
  // Check length
  if (filename.length > 255) {
    return { isValid: false, error: 'Filename too long' };
  }
  
  return { isValid: true };
}

router.post("/instance/:id/files/edit/:filename", requireAuth, requireInstanceAccess, async (req, res) => {
  if (!req.user) return res.status(401).send("Authentication required");

  const { id, filename } = req.params;
  const { content } = req.body;

  // Validate filename
  const filenameValidation = validateFilename(filename);
  if (!filenameValidation.isValid) {
    return res.status(400).json({ error: filenameValidation.error });
  }

  const instance = await db.get(id + "_instance");
  if (!instance) return res.status(404).send("Instance not found");

  const isAuthorized = await isUserAuthorizedForContainer(
    req.user.userId,
    instance.Id
  );
  if (!isAuthorized) {
    return res.status(403).send("Unauthorized access to this instance.");
  }

  const suspended = await isInstanceSuspended(req.user.userId, instance, id);
  if (suspended === true) {
    return res.render("instance/suspended", { req, user: req.user });
  }

  if (!instance.Node || !instance.Node.address || !instance.Node.port) {
    return res.status(500).send("Invalid instance node configuration");
  }

  try {
    const result = await editFile(instance, filename, content, req.query.path);
    res.json(result);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).send(error.response.data);
    } else {
      res.status(500).send({ message: "Failed to communicate with node." });
    }
  }
});

module.exports = router;
