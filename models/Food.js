const mongoose = require("mongoose");

const FoodSchema = new mongoose.Schema(
  {
    name:             { type: String, required: [true,"Food name is required"], trim: true },
    category:         { type: String, required: [true,"Category is required"],
                        enum: ["Grains","Legumes","Fruit","Dairy","Protein","Vegetables","Nuts & Seeds","Drinks","Other"] },
    gi_value:         { type: Number, required: [true,"GI value is required"], min: 0, max: 110 },
    gi_tier:          { type: String, enum: ["Low","Medium","High"] },
    serving_size_g:   { type: Number, default: 100 },
    glycemic_load:    { type: Number },
    calories_per_100g:{ type: Number },
    carbs_g:          { type: Number },
    fibre_g:          { type: Number },
    protein_g:        { type: Number },
    fat_g:            { type: Number },
    tags:             [{ type: String, lowercase: true, trim: true }],
    notes:            { type: String },
    image_url:        { type: String },
    is_featured:      { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

FoodSchema.pre("save", function (next) {
  if      (this.gi_value <= 55) this.gi_tier = "Low";
  else if (this.gi_value <= 69) this.gi_tier = "Medium";
  else                          this.gi_tier = "High";
  next();
});

FoodSchema.pre("findOneAndUpdate", function (next) {
  const u = this.getUpdate();
  if (u.gi_value !== undefined) {
    if      (u.gi_value <= 55) u.gi_tier = "Low";
    else if (u.gi_value <= 69) u.gi_tier = "Medium";
    else                       u.gi_tier = "High";
  }
  next();
});

FoodSchema.virtual("computed_gl").get(function () {
  if (this.carbs_g != null) return Math.round((this.gi_value * this.carbs_g) / 100);
  return null;
});

// Phase 4: compound indexes for common queries
FoodSchema.index({ gi_tier: 1, gi_value: 1 });
FoodSchema.index({ category: 1, gi_tier: 1 });
FoodSchema.index({ name: "text", tags: "text", notes: "text" });
FoodSchema.index({ is_featured: 1 });

module.exports = mongoose.model("Food", FoodSchema);
