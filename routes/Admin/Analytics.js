const express = require("express");
const router = express.Router();
const { db } = require("../../handlers/db");
const { isAdmin } = require("../../utils/isAdmin");

router.get("/admin/analytics", isAdmin, async (req, res) => {
  res.redirect("/admin/misc/analytics");
});



module.exports = router;
