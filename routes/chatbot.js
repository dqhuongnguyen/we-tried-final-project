const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/chatbotController");
const { requireLogin } = require("../middleware/webAuth");

router.post("/message", requireLogin, ctrl.message);

module.exports = router;
