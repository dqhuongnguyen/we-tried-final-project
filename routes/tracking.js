const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/trackingController");
const { requireLogin } = require("../middleware/webAuth");

router.use(requireLogin);

router.get("/", ctrl.index);
router.post("/log", ctrl.log);
router.post("/meal", ctrl.addManualMeal);
router.post("/meal/:entryId/update", ctrl.updateManualMeal);
router.post("/meal/:entryId/remove", ctrl.removeManualMeal);
router.get("/history", ctrl.history);

module.exports = router;
