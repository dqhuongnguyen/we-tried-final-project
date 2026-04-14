const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const { protect, authorize } = require("../middleware/auth");
const {
  getProfile,
  updateProfile,
  getMealLog,
  addMealEntry,
  deleteMealEntry,
  getAllUsers,
} = require("../controllers/userController");

// ─── Profile ─────────────────────────────────────────────────────────────────
router
  .route("/profile")
  .get(protect, getProfile)
  .put(protect, [
    body("name").optional().trim().notEmpty().withMessage("Name cannot be empty"),
    body("goal")
      .optional()
      .isIn(["Weight Loss", "Blood Sugar Control", "General Health", "Sports Performance"])
      .withMessage("Invalid goal"),
  ], updateProfile);

// ─── Meal Log ─────────────────────────────────────────────────────────────────
router
  .route("/meal-log")
  .get(protect, getMealLog)
  .post(protect, [
    body("food_id").notEmpty().withMessage("food_id is required"),
    body("meal_type")
      .isIn(["Breakfast", "Lunch", "Dinner", "Snack"])
      .withMessage("meal_type must be Breakfast, Lunch, Dinner, or Snack"),
    body("portion_g").optional().isFloat({ min: 1 }).withMessage("portion_g must be a positive number"),
  ], addMealEntry);

router.delete("/meal-log/:entryId", protect, deleteMealEntry);

// ─── Admin: all users ─────────────────────────────────────────────────────────
router.get("/", protect, authorize("admin"), getAllUsers);

module.exports = router;
