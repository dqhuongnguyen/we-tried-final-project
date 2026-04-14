const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/webFoodController");
const { requireLogin, requireAdmin } = require("../middleware/webAuth");

router.get("/",          ctrl.index);
router.get("/:id",       ctrl.show);

// Admin-only mutations
router.get("/new",         requireLogin, requireAdmin, ctrl.newForm);
router.post("/",           requireLogin, requireAdmin, ctrl.create);
router.get("/:id/edit",    requireLogin, requireAdmin, ctrl.editForm);
router.put("/:id",         requireLogin, requireAdmin, ctrl.update);
router.delete("/:id",      requireLogin, requireAdmin, ctrl.destroy);

module.exports = router;
