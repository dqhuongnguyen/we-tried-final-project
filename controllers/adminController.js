const User = require("../models/User");
const Food = require("../models/Food");

// GET /admin
exports.dashboard = async (req, res) => {
  try {
    const [userCount, foodCount, adminCount, recentUsers] = await Promise.all([
      User.countDocuments(),
      Food.countDocuments(),
      User.countDocuments({ role: "admin" }),
      User.find().sort({ createdAt: -1 }).limit(10).select("name email role goal createdAt").lean(),
    ]);

    const [lowGI, medGI, highGI] = await Promise.all([
      Food.countDocuments({ gi_tier: "Low" }),
      Food.countDocuments({ gi_tier: "Medium" }),
      Food.countDocuments({ gi_tier: "High" }),
    ]);

    res.render("pages/admin/index", {
      title: "Admin Panel",
      stats: { userCount, foodCount, adminCount, lowGI, medGI, highGI },
      recentUsers,
    });
  } catch (err) {
    res.status(500).render("pages/error", { title: "Error", message: err.message });
  }
};

// GET /admin/users
exports.users = async (req, res) => {
  try {
    const { search, role, page = 1 } = req.query;
    const limit = 15;
    const skip  = (page - 1) * limit;
    let query   = {};

    if (search) query.$or = [
      { name:  { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
    if (role && role !== "all") query.role = role;

    const [users, total] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(query),
    ]);

    res.render("pages/admin/users", {
      title: "Manage Users",
      users,
      total,
      page: +page,
      pages: Math.ceil(total / limit),
      query: req.query,
    });
  } catch (err) {
    res.status(500).render("pages/error", { title: "Error", message: err.message });
  }
};

// POST /admin/users/:id/role  — toggle admin
exports.toggleRole = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    user.role = user.role === "admin" ? "user" : "admin";
    await user.save();
    res.json({ success: true, role: user.role });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /admin/users/:id
exports.deleteUser = async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) {
      req.flash("error", "User not found.");
      return res.redirect("/admin/users");
    }
    if (target._id.toString() === res.locals.currentUser._id.toString()) {
      req.flash("error", "You cannot delete yourself.");
      return res.redirect("/admin/users");
    }
    await User.findByIdAndDelete(req.params.id);
    req.flash("success", `User ${target.name} deleted.`);
    res.redirect("/admin/users");
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/admin/users");
  }
};

// GET /admin/foods — paginated
exports.foods = async (req, res) => {
  try {
    const { search, tier, category, page = 1 } = req.query;
    const limit = 15;
    const skip  = (page - 1) * limit;
    let query   = {};

    if (search) query.name = { $regex: search, $options: "i" };
    if (tier && tier !== "all") query.gi_tier = tier;
    if (category && category !== "all") query.category = category;

    const [foods, total, categories] = await Promise.all([
      Food.find(query).sort({ gi_value: 1 }).skip(skip).limit(limit).lean(),
      Food.countDocuments(query),
      Food.distinct("category"),
    ]);

    res.render("pages/admin/foods", {
      title: "Manage Foods",
      foods,
      total,
      page: +page,
      pages: Math.ceil(total / limit),
      categories,
      query: req.query,
    });
  } catch (err) {
    res.status(500).render("pages/error", { title: "Error", message: err.message });
  }
};
