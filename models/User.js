const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const MealLogSchema = new mongoose.Schema(
  {
    food:      { type: mongoose.Schema.Types.ObjectId, ref: "Food", required: true },
    meal_type: { type: String, enum: ["Breakfast","Lunch","Dinner","Snack"], required: true },
    portion_g: { type: Number, default: 100, min: 1 },
    date:      { type: Date, default: Date.now },
  },
  { _id: true }
);

// ── Phase 4: Daily Tracking Log ───────────────────────────────────────────────
const TrackingLogSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    meals_followed: {
      Breakfast: { type: Boolean, default: false },
      Lunch:     { type: Boolean, default: false },
      Dinner:    { type: Boolean, default: false },
      Snacks:    { type: Boolean, default: false },
    },
    water_intake_L: { type: Number, default: 0, min: 0, max: 20 },
    notes:          { type: String, maxlength: 300, default: "" },
    /** App-derived vs calorie goal, GI, and water (set when check-in is saved) */
    met_targets:    { type: String, enum: ["", "yes", "partial", "no"], default: "" },
  },
  { _id: true }
);

const ProfileSchema = new mongoose.Schema({
  age:            { type: Number },
  gender:         { type: String, enum: ["male","female","other"] },
  weight_kg:      { type: Number },
  height_cm:      { type: Number },
  activity:       { type: String, enum: ["sedentary","light","moderate","active","very_active"] },
  goal:           { type: String },
  bmi:            { type: Number },
  bmi_category:   { type: String },
  daily_calories: { type: Number },
  /** Weight Loss only: goal weight (kg) and timeline (weeks) — used to derive calorie deficit */
  target_weight_kg:  { type: Number },
  weight_loss_weeks: { type: Number },
}, { _id: false });

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true,"Name is required"], trim: true },
    email: {
      type: String, required: [true,"Email is required"], unique: true,
      lowercase: true, match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },
    password: {
      type: String, required: [true,"Password is required"],
      minlength: [6,"Password must be at least 6 characters"], select: false,
    },
    role:      { type: String, enum: ["user","admin"], default: "user" },
    goal:      { type: String, enum: ["Weight Loss","Blood Sugar Control","General Health","Sports Performance"], default: "General Health" },
    profile:   ProfileSchema,
    meal_log:  [MealLogSchema],
    tracking_log: [TrackingLogSchema],   // Phase 4: daily adherence tracking
    /** Persisted 7-day AI plan (food ids + tips). Cleared when profile changes. */
    weekly_meal_plan: { type: mongoose.Schema.Types.Mixed, default: undefined },
  },
  { timestamps: true }
);

// Indexes for performance (Phase 4)
UserSchema.index({ email: 1 });
UserSchema.index({ "tracking_log.date": -1 });

UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model("User", UserSchema);
