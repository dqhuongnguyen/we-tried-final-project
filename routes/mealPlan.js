const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/mealPlanController");
const { requireLogin } = require("../middleware/webAuth");

router.get("/", requireLogin, ctrl.index);

module.exports = router;
