const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/adminController");
const { requireLogin, requireAdmin } = require("../middleware/webAuth");

router.use(requireLogin, requireAdmin);

router.get("/",                  ctrl.dashboard);
router.get("/users",             ctrl.users);
router.post("/users/:id/role",   ctrl.toggleRole);
router.delete("/users/:id",      ctrl.deleteUser);
router.get("/foods",             ctrl.foods);

module.exports = router;
