const express = require("express");
const router = express.Router();
const { db } = require("../../handlers/db");
const { isAdmin } = require("../../utils/isAdmin");
const log = new (require("cat-loggr"))();

// Analytics tab
router.get("/admin/misc/analytics", isAdmin, async (req, res) => {
  const analytics = (await db.get("analytics")) || [];

  const pageViews = analytics.reduce((acc, item) => {
    acc[item.path] = (acc[item.path] || 0) + 1;
    return acc;
  }, {});

  const methodCounts = analytics.reduce((acc, item) => {
    acc[item.method] = (acc[item.method] || 0) + 1;
    return acc;
  }, {});

  const timeSeriesData = analytics.map((item) => ({
    timestamp: item.timestamp,
    path: item.path,
  }));

  res.render("admin/misc/analytics", {
    req,
    user: req.user,
    pageViews,
    methodCounts,
    timeSeriesData,
  });
});

// Audit logs tab
router.get("/admin/misc/auditlogs", isAdmin, async (req, res) => {
  try {
    let audits = await db.get("audits");
    audits = audits ? JSON.parse(audits) : [];
    
    // Sort audits by timestamp (newest first)
    audits.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.render("admin/misc/auditlogs", {
      req,
      user: req.user,
      audits,
    });
  } catch (err) {
    log.error("Error fetching audits:", err);
    res.status(500).send("Internal Server Error");
  }
});

// Main misc page - redirects to analytics
router.get("/admin/misc", isAdmin, async (req, res) => {
  res.redirect("/admin/misc/analytics");
});

// Keep the API endpoint for analytics
router.get("/api/analytics", isAdmin, async (req, res) => {
  // Check if user is authenticated and has admin rights
  if (!req.user || !req.user.admin) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const analytics = (await db.get("analytics")) || [];

  // Process analytics data
  const totalRequests = analytics.length;
  const uniqueVisitors = new Set(analytics.map((item) => item.ip)).size;
  const avgRequestsPerHour = totalRequests / 24; // Assuming 24 hours of data

  // Get top page
  const pageCounts = analytics.reduce((acc, item) => {
    acc[item.path] = (acc[item.path] || 0) + 1;
    return acc;
  }, {});
  const topPageEntry = Object.entries(pageCounts).sort((a, b) => b[1] - a[1])[0];
  const topPage = topPageEntry ? topPageEntry[0] : 'No data';

  // Traffic over time (hourly)
  const trafficOverTime = Array(24).fill(0);
  analytics.forEach((item) => {
    const hour = new Date(item.timestamp).getHours();
    trafficOverTime[hour]++;
  });

  // Top 5 pages
  const topPages = Object.entries(pageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  res.json({
    totalRequests,
    uniqueVisitors,
    avgRequestsPerHour,
    topPage,
    trafficOverTime: {
      labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      data: trafficOverTime,
    },
    topPages: {
      labels: topPages.map(([page]) => page),
      data: topPages.map(([, count]) => count),
    },
  });
});

module.exports = router;