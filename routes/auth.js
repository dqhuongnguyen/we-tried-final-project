const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const { body } = require("express-validator");
const { register, login, getMe } = require("../controllers/authController");
const { protect } = require("../middleware/auth");

const apiAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: { success: false, message: "Too many attempts. Try again later." },
});

const registerRules = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
  body("goal")
    .optional()
    .isIn(["Weight Loss", "Blood Sugar Control", "General Health", "Sports Performance"])
    .withMessage("Invalid goal value"),
];

const loginRules = [
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

// POST /api/auth/register
router.post("/register", apiAuthLimiter, registerRules, register);

// POST /api/auth/login
router.post("/login", apiAuthLimiter, loginRules, login);

// GET /api/auth/me  (protected)
router.get("/me", protect, getMe);

module.exports = router;
