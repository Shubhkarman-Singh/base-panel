const express = require("express");
const router = express.Router();
const { db } = require("../../handlers/db.js");
const configManager = require("../../utils/configManager");
const { isAdmin } = require("../../utils/isAdmin.js");
const fs = require('fs');
const path = require('path');

router.get("/admin/overview", isAdmin, async (req, res) => {
  try {
    const users = (await db.get("users")) || [];
    const nodes = (await db.get("nodes")) || [];
    const images = (await db.get("images")) || [];
    const instances = (await db.get("instances")) || [];

    // Calculate the total number of each type of object
    const usersTotal = users.length;
    const nodesTotal = nodes.length;
    const imagesTotal = images.length;
    const instancesTotal = instances.length;

    const settings = (await db.get("settings")) || {};
    
    // Load version codenames
    let versionCodenames = [];
    try {
      const codenamesPath = path.join(__dirname, '../../version_codenames.json');
      const codenamesData = fs.readFileSync(codenamesPath, 'utf8');
      versionCodenames = JSON.parse(codenamesData);
    } catch (error) {
      console.error('Error loading version codenames:', error);
    }

    const currentVersion = configManager.get("version");
    const currentVersionInfo = versionCodenames.find(v => v.version === currentVersion) || { codename: 'Unknown', status: 'unknown' };
    const currentCodename = currentVersionInfo.codename;

    res.render("admin/overview", {
      req,
      user: req.user,
      usersTotal,
      nodesTotal,
      imagesTotal,
      instancesTotal,
      version: currentVersion,
      versionCodename: currentCodename,
      versionCodenames: JSON.stringify(versionCodenames),
      settings,
    });
  } catch (error) {
    res
      .status(500)
      .send({ error: "Failed to retrieve data from the database." });
  }
});

module.exports = router;
