const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const { protect, authorize } = require("../middleware/auth");
const {
  getAllFoods,
  searchFoods,
  getFoodById,
  createFood,
  updateFood,
  deleteFood,
} = require("../controllers/foodController");

const foodValidation = [
  body("name").trim().notEmpty().withMessage("Food name is required"),
  body("category")
    .isIn(["Grains", "Legumes", "Fruit", "Dairy", "Protein", "Vegetables", "Nuts & Seeds", "Drinks", "Other"])
    .withMessage("Invalid category"),
  body("gi_value").isFloat({ min: 0, max: 110 }).withMessage("GI value must be between 0 and 110"),
];

// GET /api/foods/search?q=<keyword>   ← must be before /:id
router.get("/search", searchFoods);

// GET  /api/foods
// POST /api/foods  (admin only)
router
  .route("/")
  .get(getAllFoods)
  .post(protect, authorize("admin"), foodValidation, createFood);

// GET    /api/foods/:id
// PUT    /api/foods/:id  (admin only)
// DELETE /api/foods/:id  (admin only)
router
  .route("/:id")
  .get(getFoodById)
  .put(protect, authorize("admin"), updateFood)
  .delete(protect, authorize("admin"), deleteFood);

module.exports = router;
