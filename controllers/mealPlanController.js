const User = require("../models/User");
const { RULES, DAYS, ensureWeeklyMealPlan } = require("../services/mealPlanService");

// GET /meal-plan
exports.index = async (req, res) => {
  try {
    const user       = await User.findById(res.locals.currentUser._id).lean();
    const hasProfile = !!(user.profile?.bmi);
    let weeklyPlan   = null;
    let rule         = null;

    if (hasProfile) {
      rule = RULES[user.profile.bmi_category] || RULES.Normal;
      try {
        weeklyPlan = await ensureWeeklyMealPlan(req, user);
      } catch (planErr) {
        console.error("Meal plan page: generation failed:", planErr);
        const msg =
          "We could not generate your meal plan (AI error or missing GROQ_API_KEY). Check .env and try again later.";
        const prev = res.locals.error;
        res.locals.error = Array.isArray(prev) && prev.length ? [...prev, msg] : [msg];
      }
    }

    // Next 7 days: quick jump to each weekday in the current 7-day template
    const today    = new Date();
    const calendar = [];
    for (let i = 0; i < 7; i++) {
      const d   = new Date(today);
      d.setDate(today.getDate() + i);
      const dayName = DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1]; // Mon=0..Sun=6
      calendar.push({ date: d, dayName, label: d.toLocaleDateString("en-CA") });
    }

    res.render("pages/meal-plan", {
      title: "Weekly Meal Plan",
      user, hasProfile, weeklyPlan, rule, RULES, DAYS, calendar,
    });
  } catch (err) {
    console.error("Meal plan error:", err);
    res.status(500).render("pages/error", { title: "Error", message: err.message });
  }
};
