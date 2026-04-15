const User = require("../models/User");
const { ensureWeeklyMealPlan, dashboardMealsForDate } = require("../services/mealPlanService");


const KCAL_PER_KG_FAT = 7700;
const MAX_DAILY_DEFICIT = 1000;
const MIN_LOSS_WEEKS = 2;
const MAX_LOSS_WEEKS = 104;

function minCalorieFloor(gender) {
  if (gender === "female") return 1200;
  if (gender === "male") return 1500;
  return 1400;
}

/** BMI + daily calories. Weight Loss uses goal weight & weeks: deficit = (kg to lose × 7700) / days, capped for safety. */
function calcBMI(weight_kg, height_cm, age, gender, activity, goal, weightLoss) {
  const h = height_cm / 100;
  const bmi = parseFloat((weight_kg / (h * h)).toFixed(1));
  let bmi_category;
  if (bmi < 18.5) bmi_category = "Underweight";
  else if (bmi < 25) bmi_category = "Normal";
  else if (bmi < 30) bmi_category = "Overweight";
  else bmi_category = "Obese";

  let daily_calories;
  let weight_loss_deficit_capped = false;

  if (age && gender) {
    const bmr =
      gender === "female"
        ? 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
        : 10 * weight_kg + 6.25 * height_cm - 5 * age + 5;
    const actMap = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
    const tdee = Math.round(bmr * (actMap[activity] || 1.55));
    const minCal = minCalorieFloor(gender);

    if (goal === "Weight Loss" && weightLoss && weightLoss.target_weight_kg != null && weightLoss.weight_loss_weeks) {
      const kgToLose = weight_kg - weightLoss.target_weight_kg;
      const days = weightLoss.weight_loss_weeks * 7;
      const rawDeficit = days > 0 ? (kgToLose * KCAL_PER_KG_FAT) / days : 0;
      const maxDeficitFromFloor = Math.max(0, tdee - minCal);
      const maxDeficit = Math.min(MAX_DAILY_DEFICIT, maxDeficitFromFloor);
      const appliedDeficit = Math.min(Math.max(0, rawDeficit), maxDeficit);
      weight_loss_deficit_capped = rawDeficit > appliedDeficit + 1;
      daily_calories = Math.round(tdee - appliedDeficit);
      if (daily_calories < minCal) daily_calories = minCal;
    } else if (goal === "Sports Performance") {
      daily_calories = tdee + 300;
    } else {
      daily_calories = tdee;
    }
  }

  return { bmi, bmi_category, daily_calories, weight_loss_deficit_capped };
}

// GET /dashboard
exports.dashboard = async (req, res) => {
  try {
    const user = await User.findById(res.locals.currentUser._id).lean();

    if (!user) {
      req.session.token = null;
      req.flash("error", "Account not found. Please sign in again.");
      return res.redirect("/auth/login");
    }

    const hasProfile = !!(user.profile?.bmi);
    let mealPlan = null;

    if (hasProfile) {
      try {
        const weeklyPlan = await ensureWeeklyMealPlan(req, user);
        mealPlan = dashboardMealsForDate(weeklyPlan, new Date());
      } catch (planErr) {
        console.error("Dashboard: meal plan generation failed:", planErr);
        const msg =
          "Your meal plan could not be generated. Check that GROQ_API_KEY is set in .env and that Groq is reachable. You can still use Foods and Tracking.";
        const prev = res.locals.error;
        res.locals.error = Array.isArray(prev) && prev.length ? [...prev, msg] : [msg];
      }
    }

    res.render('pages/dashboard/index', {
      title: 'My Dashboard', user, hasProfile, mealPlan,
    });

  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).render('pages/error', { title: 'Error', message: err.message });
  }
};

// GET /user/profile
exports.profileForm = async (req, res) => {
  const user = await User.findById(res.locals.currentUser._id).lean();
  res.render("pages/user/profile", { title: "Health Profile", user });
};

// POST /user/profile
exports.updateProfile = async (req, res) => {
  try {
    const { age, gender, weight_kg, height_cm, activity, goal, name, target_weight_kg, weight_loss_weeks } = req.body;
    const user = await User.findById(res.locals.currentUser._id);
    if (name) user.name = name;

    if (weight_kg && height_cm) {
      const w = +weight_kg;
      const hCm = +height_cm;
      let weightLoss = null;

      if (goal === "Weight Loss") {
        const tw = parseFloat(target_weight_kg);
        const wk = parseInt(weight_loss_weeks, 10);
        if (!Number.isFinite(tw) || !Number.isFinite(wk)) {
          req.flash(
            "error",
            "For weight loss, enter both goal weight (kg) and weeks (2–104) in the fields below."
          );
          return res.redirect("/user/profile");
        }
        if (tw >= w) {
          req.flash("error", "Goal weight must be lower than your current weight.");
          return res.redirect("/user/profile");
        }
        const h = hCm / 100;
        const targetBmi = tw / (h * h);
        if (targetBmi < 18.5) {
          req.flash("error", "Goal weight would put BMI under 18.5 — choose a healthier target or speak to a clinician.");
          return res.redirect("/user/profile");
        }
        if (wk < MIN_LOSS_WEEKS || wk > MAX_LOSS_WEEKS) {
          req.flash("error", `Use a timeline between ${MIN_LOSS_WEEKS} and ${MAX_LOSS_WEEKS} weeks.`);
          return res.redirect("/user/profile");
        }
        weightLoss = { target_weight_kg: tw, weight_loss_weeks: wk };
      }

      const result = calcBMI(w, hCm, +age, gender, activity, goal, weightLoss);
      const profile = {
        age: +age,
        gender,
        weight_kg: w,
        height_cm: hCm,
        activity,
        goal,
        bmi: result.bmi,
        bmi_category: result.bmi_category,
        daily_calories: result.daily_calories,
      };
      if (goal === "Weight Loss" && weightLoss) {
        profile.target_weight_kg = weightLoss.target_weight_kg;
        profile.weight_loss_weeks = weightLoss.weight_loss_weeks;
      } else if (goal !== "Weight Loss") {
        // Keep saved targets when switching to another goal so "Weight Loss" can be selected again
        // without re-entering (assigning profile without these keys used to wipe them in MongoDB).
        const twBody = parseFloat(target_weight_kg);
        const wkBody = parseInt(weight_loss_weeks, 10);
        if (Number.isFinite(twBody) && Number.isFinite(wkBody)) {
          profile.target_weight_kg = twBody;
          profile.weight_loss_weeks = wkBody;
        } else if (user.profile?.target_weight_kg != null && user.profile?.weight_loss_weeks != null) {
          profile.target_weight_kg = user.profile.target_weight_kg;
          profile.weight_loss_weeks = user.profile.weight_loss_weeks;
        }
      }
      user.profile = profile;
      user.goal = profile.goal;

      let msg = "Profile updated! Your meal plan will regenerate to match your new targets.";
      if (goal === "Weight Loss" && result.weight_loss_deficit_capped) {
        msg +=
          " Your target pace was faster than we recommend — daily calories were capped so intake stays in a safe range.";
      }
      await user.save();
      await User.updateOne({ _id: user._id }, { $unset: { weekly_meal_plan: 1 } });
      delete req.session.weeklyMealPlan;
      delete req.session.mealPlan;
      delete req.session.detailedMealPlan;
      req.flash("success", msg);
      res.redirect("/dashboard");
      return;
    }
    if (goal) {
      user.goal = goal;
      if (user.profile) user.profile.goal = goal;
    }
    await user.save();
    await User.updateOne({ _id: user._id }, { $unset: { weekly_meal_plan: 1 } });
    delete req.session.weeklyMealPlan;
    delete req.session.mealPlan;
    delete req.session.detailedMealPlan;
    req.flash("success", "Profile updated.");
    res.redirect("/dashboard");
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/user/profile");
  }
};
