const { validationResult } = require("express-validator");
const Food = require("../models/Food");

// ─── helpers ────────────────────────────────────────────────────────────────

const buildQuery = (reqQuery) => {
  const query = {};

  // Text search on name / tags / notes
  if (reqQuery.q) {
    query.$or = [
      { name: { $regex: reqQuery.q, $options: "i" } },
      { tags: { $regex: reqQuery.q, $options: "i" } },
      { notes: { $regex: reqQuery.q, $options: "i" } },
    ];
  }

  // Filter by category
  if (reqQuery.category) query.category = reqQuery.category;

  // Filter by gi_tier
  if (reqQuery.gi_tier) query.gi_tier = reqQuery.gi_tier;

  // Filter by is_featured
  if (reqQuery.is_featured !== undefined) query.is_featured = reqQuery.is_featured === "true";

  // GI value range  ?gi_value[gte]=55&gi_value[lte]=69
  if (reqQuery.gi_value) {
    query.gi_value = {};
    if (reqQuery.gi_value.gte !== undefined) query.gi_value.$gte = Number(reqQuery.gi_value.gte);
    if (reqQuery.gi_value.lte !== undefined) query.gi_value.$lte = Number(reqQuery.gi_value.lte);
    if (reqQuery.gi_value.gt !== undefined) query.gi_value.$gt = Number(reqQuery.gi_value.gt);
    if (reqQuery.gi_value.lt !== undefined) query.gi_value.$lt = Number(reqQuery.gi_value.lt);
  }

  // Calories range  ?calories_per_100g[lte]=200
  if (reqQuery.calories_per_100g) {
    query.calories_per_100g = {};
    if (reqQuery.calories_per_100g.gte !== undefined) query.calories_per_100g.$gte = Number(reqQuery.calories_per_100g.gte);
    if (reqQuery.calories_per_100g.lte !== undefined) query.calories_per_100g.$lte = Number(reqQuery.calories_per_100g.lte);
  }

  return query;
};

const buildSort = (sortParam) => {
  if (!sortParam) return { gi_value: 1 };
  const sortObj = {};
  sortParam.split(",").forEach((field) => {
    if (field.startsWith("-")) sortObj[field.slice(1)] = -1;
    else sortObj[field] = 1;
  });
  return sortObj;
};

// ─── controllers ────────────────────────────────────────────────────────────

// GET /api/foods
// Supports: ?q= ?category= ?gi_tier= ?gi_value[lte]= ?sort= ?page= ?limit= ?fields=
exports.getAllFoods = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const query = buildQuery(req.query);
    const sort = buildSort(req.query.sort);

    // Field selection
    let fields;
    if (req.query.fields) {
      fields = req.query.fields.split(",").join(" ");
    }

    const [foods, total] = await Promise.all([
      Food.find(query).sort(sort).skip(skip).limit(limit).select(fields),
      Food.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
      count: foods.length,
      data: foods,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/foods/search?q=<keyword>
exports.searchFoods = async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    if (!q) return res.status(400).json({ success: false, message: "Search query 'q' is required" });

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const filter = {
      $or: [
        { name: { $regex: q, $options: "i" } },
        { tags: { $regex: q, $options: "i" } },
        { notes: { $regex: q, $options: "i" } },
        { category: { $regex: q, $options: "i" } },
      ],
    };

    const [foods, total] = await Promise.all([
      Food.find(filter).skip(skip).limit(parseInt(limit)),
      Food.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      query: q,
      total,
      page: parseInt(page),
      count: foods.length,
      data: foods,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/foods/:id
exports.getFoodById = async (req, res) => {
  try {
    const food = await Food.findById(req.params.id);
    if (!food) return res.status(404).json({ success: false, message: "Food not found" });
    res.status(200).json({ success: true, data: food });
  } catch (err) {
    if (err.name === "CastError") return res.status(400).json({ success: false, message: "Invalid food ID" });
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/foods  (admin only)
exports.createFood = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const food = await Food.create(req.body);
    res.status(201).json({ success: true, data: food });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: "Duplicate field value" });
    res.status(400).json({ success: false, message: err.message });
  }
};

// PUT /api/foods/:id  (admin only)
exports.updateFood = async (req, res) => {
  try {
    const food = await Food.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!food) return res.status(404).json({ success: false, message: "Food not found" });
    res.status(200).json({ success: true, data: food });
  } catch (err) {
    if (err.name === "CastError") return res.status(400).json({ success: false, message: "Invalid food ID" });
    res.status(400).json({ success: false, message: err.message });
  }
};

// DELETE /api/foods/:id  (admin only)
exports.deleteFood = async (req, res) => {
  try {
    const food = await Food.findByIdAndDelete(req.params.id);
    if (!food) return res.status(404).json({ success: false, message: "Food not found" });
    res.status(200).json({ success: true, message: `'${food.name}' deleted successfully` });
  } catch (err) {
    if (err.name === "CastError") return res.status(400).json({ success: false, message: "Invalid food ID" });
    res.status(500).json({ success: false, message: err.message });
  }
};
