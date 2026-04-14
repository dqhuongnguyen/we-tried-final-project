const Food = require("../models/Food");

// GET /foods — list all with search/filter + pagination
exports.index = async (req, res) => {
  try {
    const { search, tier, category, sort, page = 1 } = req.query;
    const limit = 18;
    const skip  = (Math.max(1, +page) - 1) * limit;
    let query = {};

    if (search) query.name = { $regex: search, $options: "i" };
    if (tier && tier !== "all") query.gi_tier = tier;
    if (category && category !== "all") query.category = category;

    const sortMap = {
      gi_asc: { gi_value: 1 },
      gi_desc: { gi_value: -1 },
      name_asc: { name: 1 },
    };
    const sortOpt = sortMap[sort] || { gi_value: 1 };

    const [foods, total, categories] = await Promise.all([
      Food.find(query).sort(sortOpt).skip(skip).limit(limit),
      Food.countDocuments(query),
      Food.distinct("category"),
    ]);

    const counts = {
      all:    await Food.countDocuments(),
      Low:    await Food.countDocuments({ gi_tier: "Low" }),
      Medium: await Food.countDocuments({ gi_tier: "Medium" }),
      High:   await Food.countDocuments({ gi_tier: "High" }),
    };

    res.render("pages/foods", {
      title: "Food Database",
      foods,
      categories,
      counts,
      query: req.query,
      flash: req.flash ? req.flash() : {},
      currentPage: +page,
      totalPages:  Math.ceil(total / limit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).render("pages/error", { message: err.message });
  }
};

// GET /foods/:id
exports.show = async (req, res) => {
  try {
    const food = await Food.findById(req.params.id);
    if (!food) return res.status(404).render("pages/error", { message: "Food not found" });
    res.render("pages/food-detail", { title: food.name, food });
  } catch (err) {
    res.status(500).render("pages/error", { message: err.message });
  }
};

// GET /foods/new
exports.newForm = (req, res) => {
  res.render("pages/food-form", { title: "Add Food", food: null });
};

// POST /foods
exports.create = async (req, res) => {
  try {
    const food = await Food.create(req.body);
    req.flash && req.flash("success", `${food.name} added successfully!`);
    res.redirect("/foods");
  } catch (err) {
    res.status(400).render("pages/food-form", { title: "Add Food", food: null, error: err.message });
  }
};

// GET /foods/:id/edit
exports.editForm = async (req, res) => {
  try {
    const food = await Food.findById(req.params.id);
    res.render("pages/food-form", { title: "Edit Food", food });
  } catch (err) {
    res.status(500).render("pages/error", { message: err.message });
  }
};

// PUT /foods/:id
exports.update = async (req, res) => {
  try {
    const food = await Food.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    req.flash && req.flash("success", `${food.name} updated!`);
    res.redirect(`/foods/${food._id}`);
  } catch (err) {
    res.status(400).render("pages/error", { message: err.message });
  }
};

// DELETE /foods/:id
exports.destroy = async (req, res) => {
  try {
    await Food.findByIdAndDelete(req.params.id);
    req.flash && req.flash("success", "Food deleted.");
    res.redirect("/foods");
  } catch (err) {
    res.status(500).render("pages/error", { message: err.message });
  }
};
