const express = require("express");
const router = express.Router();
const { db } = require("../../handlers/db.js");
const { isAdmin } = require("../../utils/isAdmin.js");

/**
 * Admin endpoint to view current rate limit status
 */
router.get("/admin/rate-limits", isAdmin, async (req, res) => {
  try {
    const rateLimitData = await db.get("rate_limit_attempts") || {};
    const settings = (await db.get("settings")) || {};
    
    // Process and format the data for display
    const formattedData = Object.entries(rateLimitData).map(([key, data]) => {
      const [type, ip] = key.split('_');
      return {
        type: type,
        ip: ip,
        attempts: data.count,
        lastAttempt: new Date(data.lastAttempt).toLocaleString(),
        blockedUntil: data.blockedUntil > Date.now() ? 
          new Date(data.blockedUntil).toLocaleString() : 'Not blocked',
        isCurrentlyBlocked: data.blockedUntil > Date.now()
      };
    });

    res.render("admin/rate-limits", {
      req,
      user: req.user,
      settings,
      rateLimitData: formattedData,
      totalEntries: formattedData.length,
      blockedIPs: formattedData.filter(d => d.isCurrentlyBlocked).length
    });
  } catch (error) {
    console.error("Error fetching rate limit data:", error);
    res.status(500).send("Error fetching rate limit data");
  }
});

/**
 * Admin endpoint to clear rate limit data for a specific IP
 */
router.post("/admin/rate-limits/clear/:ip", isAdmin, async (req, res) => {
  try {
    const { ip } = req.params;
    const rateLimitData = await db.get("rate_limit_attempts") || {};
    
    // Remove all entries for this IP
    const keysToRemove = Object.keys(rateLimitData).filter(key => key.includes(ip));
    keysToRemove.forEach(key => delete rateLimitData[key]);
    
    await db.set("rate_limit_attempts", rateLimitData);
    
    res.redirect("/admin/rate-limits?msg=IPCleared");
  } catch (error) {
    console.error("Error clearing rate limit data:", error);
    res.status(500).send("Error clearing rate limit data");
  }
});

/**
 * Admin endpoint to clear all rate limit data
 */
router.post("/admin/rate-limits/clear-all", isAdmin, async (req, res) => {
  try {
    await db.set("rate_limit_attempts", {});
    res.redirect("/admin/rate-limits?msg=AllCleared");
  } catch (error) {
    console.error("Error clearing all rate limit data:", error);
    res.status(500).send("Error clearing all rate limit data");
  }
});

module.exports = router;