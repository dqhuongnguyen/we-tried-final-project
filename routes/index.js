const express = require("express");
const router = express.Router();
const homeController = require("../controllers/homeController");

router.get("/", homeController.home);
router.get("/about", (req, res) => res.redirect(301, "/#about-gi"));

module.exports = router;
