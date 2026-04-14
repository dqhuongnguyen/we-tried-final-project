const express = require("express");
const rateLimit = require("express-rate-limit");
const router  = express.Router();
const ctrl    = require("../controllers/webAuthController");
const { guestOnly } = require("../middleware/webAuth");

const authFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  handler(req, res) {
    req.flash("error", "Too many attempts. Try again in 15 minutes.");
    res.redirect(req.path.includes("login") ? "/auth/login" : "/auth/register");
  },
});

router.get("/register", guestOnly, ctrl.registerForm);
router.post("/register", authFormLimiter, guestOnly, ctrl.register);
router.get("/login",    guestOnly, ctrl.loginForm);
router.post("/login",   authFormLimiter, guestOnly, ctrl.login);
router.post("/logout",  ctrl.logout);

module.exports = router;
