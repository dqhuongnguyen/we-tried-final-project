const Food = require("../models/Food");

exports.home = async (req, res) => {
  try {
    const featured = await Food.find({ is_featured: true }).limit(6);
    const best = await Food.find({ gi_tier: "Low" }).sort({ gi_value: 1 }).limit(3);
    const stats = {
      total: await Food.countDocuments(),
      low: await Food.countDocuments({ gi_tier: "Low" }),
      medium: await Food.countDocuments({ gi_tier: "Medium" }),
      high: await Food.countDocuments({ gi_tier: "High" }),
    };
    res.render("pages/home", { title: "GI Tracker — Eat Smart", featured, best, stats });
  } catch (err) {
    res.status(500).render("pages/error", { message: err.message });
  }
};
