const { validationResult } = require("express-validator");
const User = require("../models/User");
const Food = require("../models/Food");

// GET /api/users/profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate(
      "meal_log.food",
      "name category gi_value gi_tier calories_per_100g"
    );

    res.status(200).json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/users/profile
exports.updateProfile = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    // Prevent role escalation from this endpoint
    const { name, goal } = req.body;
    const allowed = {};
    if (name) allowed.name = name;
    if (goal) allowed.goal = goal;

    const user = await User.findByIdAndUpdate(req.user.id, allowed, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({ success: true, data: user });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ─── Meal Log ────────────────────────────────────────────────────────────────

// GET /api/users/meal-log
exports.getMealLog = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate(
      "meal_log.food",
      "name category gi_value gi_tier calories_per_100g carbs_g"
    );

    // Optional date filter ?date=2025-06-01
    let log = user.meal_log;
    if (req.query.date) {
      const target = new Date(req.query.date);
      const next = new Date(target);
      next.setDate(next.getDate() + 1);
      log = log.filter((e) => e.date >= target && e.date < next);
    }

    // Optional meal_type filter
    if (req.query.meal_type) {
      log = log.filter((e) => e.meal_type === req.query.meal_type);
    }

    // Sort newest first
    log = [...log].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const paginated = log.slice(skip, skip + limit);

    res.status(200).json({
      success: true,
      total: log.length,
      page,
      count: paginated.length,
      data: paginated,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/users/meal-log
exports.addMealEntry = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { food_id, meal_type, portion_g, date } = req.body;

  try {
    const food = await Food.findById(food_id);
    if (!food) return res.status(404).json({ success: false, message: "Food not found" });

    const user = await User.findById(req.user.id);
    user.meal_log.push({ food: food_id, meal_type, portion_g, date });
    await user.save();

    // Return the newly added entry
    const newEntry = user.meal_log[user.meal_log.length - 1];
    res.status(201).json({ success: true, data: newEntry });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// DELETE /api/users/meal-log/:entryId
exports.deleteMealEntry = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const entry = user.meal_log.id(req.params.entryId);
    if (!entry) return res.status(404).json({ success: false, message: "Meal log entry not found" });

    entry.deleteOne();
    await user.save();
    res.status(200).json({ success: true, message: "Meal log entry removed" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Admin: List all users ────────────────────────────────────────────────────

// GET /api/users  (admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find().select("-password").skip(skip).limit(limit),
      User.countDocuments(),
    ]);

    res.status(200).json({ success: true, total, page, count: users.length, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
