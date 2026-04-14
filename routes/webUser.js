const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/webUserController");
const { requireLogin } = require("../middleware/webAuth");

router.get("/dashboard",                requireLogin, ctrl.dashboard);
router.get("/user/profile",             requireLogin, ctrl.profileForm);
router.post("/user/profile",            requireLogin, ctrl.updateProfile);

module.exports = router;
