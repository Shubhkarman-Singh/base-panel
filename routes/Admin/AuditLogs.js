const express = require("express");
const router = express.Router();
const { db } = require("../../handlers/db.js");
const { isAdmin } = require("../../utils/isAdmin.js");
const log = new (require("cat-loggr"))();

router.get("/admin/auditlogs", isAdmin, async (req, res) => {
  res.redirect("/admin/misc/auditlogs");
});

module.exports = router;
