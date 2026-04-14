const mongoose = require("mongoose");
const User = require("../models/User");
const Food = require("../models/Food");

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function parseLocalDate(yyyyMmDd) {
  const raw = yyyyMmDd || todayStr();
  const [y, m, d] = String(raw).split("-").map(Number);
  if (!y || !m || !d) return dateOnly(new Date());
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function sameCalendarDay(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function dateOnly(d) {
  const dt = new Date(d);
  dt.setHours(0,0,0,0);
  return dt;
}

/** Estimated kcal from meal_log entries (foods must have calories_per_100g). */
function sumKcalFromEntries(entries) {
  let total = 0;
  for (const e of entries || []) {
    const cal = e.food && e.food.calories_per_100g;
    if (cal == null || cal === "") continue;
    total += (Number(e.portion_g) / 100) * Number(cal);
  }
  return Math.round(total);
}

/** kcal-weighted average GI (lower is better for glycemic load). */
function weightedAvgGiFromEntries(entries) {
  let kSum = 0;
  let giKSum = 0;
  for (const e of entries || []) {
    const gi = e.food && e.food.gi_value != null ? Number(e.food.gi_value) : NaN;
    if (!Number.isFinite(gi)) continue;
    const cal =
      e.food && e.food.calories_per_100g != null && e.food.calories_per_100g !== ""
        ? (Number(e.portion_g) / 100) * Number(e.food.calories_per_100g)
        : 0;
    if (cal <= 0) continue;
    giKSum += gi * cal;
    kSum += cal;
  }
  if (kSum <= 0) return null;
  return Math.round(giKSum / kSum);
}

/** 0–100 “quality” toward low-GI eating (100 = avg ≤ 55). */
function giLoadProgressPct(avgGi) {
  if (avgGi == null) return null;
  if (avgGi <= 55) return 100;
  if (avgGi >= 88) return 0;
  return Math.round((100 * (88 - avgGi)) / (88 - 55));
}

const WATER_GOAL_L = 2.5;

function kcalVsGoal(totalKcal, dailyGoal) {
  if (!dailyGoal || dailyGoal <= 0) {
    return { band: "no_goal", label: "Set a calorie target in your profile to compare." };
  }
  if (totalKcal <= 0) {
    return { band: "empty", label: "Log foods above to see how close you are to your goal." };
  }
  const ratio = totalKcal / dailyGoal;
  if (ratio < 0.9) return { band: "under", label: `About ${Math.round(ratio * 100)}% of goal — under target.` };
  if (ratio <= 1.1) return { band: "within", label: `About ${Math.round(ratio * 100)}% of goal — in range.` };
  return { band: "over", label: `About ${Math.round(ratio * 100)}% of goal — over target.` };
}

/** Calendar dot: full / partial / low / none */
function calendarDayStatus(log) {
  if (!log) return "none";
  if (log.met_targets === "yes") return "full";
  if (log.met_targets === "partial") return "partial";
  if (log.met_targets === "no") return "low";
  const c = Object.values(log.meals_followed || {}).filter(Boolean).length;
  if (c === 4) return "full";
  if (c >= 2) return "partial";
  if (c >= 1) return "partial";
  return "none";
}

/**
 * Derive stored met_targets from today's metrics (saved with check-in).
 * Uses calorie band vs goal, GI band, and hydration vs goal.
 */
function deriveMetTargetsFromMetrics({ kcalBand, giBand, waterL, waterGoalL, todayTotalKcal }) {
  const wRatio = waterGoalL > 0 ? waterL / waterGoalL : 1;
  const waterLow = wRatio < 0.45;
  const giHigh = giBand === "high";

  if (kcalBand === "empty") return "";
  if (kcalBand === "no_goal") return todayTotalKcal > 0 ? "partial" : "";
  if (kcalBand === "over" || giHigh || waterLow) return "no";
  if (kcalBand === "within" && wRatio >= 0.75 && !giHigh) return "yes";
  return "partial";
}

/** User-facing conclusion + tips (same inputs as deriveMetTargetsFromMetrics). */
function buildDayVerdict({
  dailyGoal,
  todayTotalKcal,
  todayKcalHint,
  todayAvgGi,
  giBand,
  todayWaterL,
  waterGoalL,
}) {
  const wRatio = waterGoalL > 0 ? todayWaterL / waterGoalL : 0;
  const derivedMet = deriveMetTargetsFromMetrics({
    kcalBand: todayKcalHint.band,
    giBand,
    waterL: todayWaterL,
    waterGoalL,
    todayTotalKcal,
  });

  const summaryLines = [];
  if (!dailyGoal || dailyGoal <= 0) {
    summaryLines.push("Calories: add a daily calorie goal in your profile so we can compare your intake.");
  } else if (todayTotalKcal <= 0) {
    summaryLines.push("Calories: nothing logged for today yet — use step 1 to add foods.");
  } else {
    summaryLines.push(`Calories: ${todayTotalKcal} kcal vs ${dailyGoal} kcal — ${todayKcalHint.label}`);
  }

  if (todayAvgGi == null) {
    summaryLines.push("GI: not enough data — choose foods with GI values in step 1 to score glycemic load.");
  } else {
    summaryLines.push(`GI: weighted average ${todayAvgGi} (aim ≤55 for gentler blood sugar).`);
  }

  summaryLines.push(`Hydration: ${todayWaterL} L vs ${waterGoalL} L goal (${Math.round(wRatio * 100)}%).`);

  const recommendations = [];
  let headline = "";
  let tone = "neutral";

  if (todayKcalHint.band === "empty") {
    headline = "Log food to get a full score";
    tone = "neutral";
    recommendations.push("Add meals or snacks in step 1 — we’ll estimate calories and GI from your choices.");
  } else if (todayKcalHint.band === "no_goal") {
    tone = "neutral";
    if (todayTotalKcal <= 0) {
      headline = "Set a calorie goal and log food";
      recommendations.push("Add a daily calorie target in your profile, then log what you ate in step 1.");
    } else {
      headline = "We need a calorie goal to judge the day";
      recommendations.push("Set a daily calorie target in your profile so we can score this day against your goals.");
    }
  } else if (derivedMet === "yes") {
    headline = "You’re on target today";
    tone = "positive";
    recommendations.push("Nice work — keep a similar balance tomorrow if it fits your routine.");
  } else if (derivedMet === "no") {
    headline = "A few targets were missed today";
    tone = "concern";
    if (todayKcalHint.band === "over") {
      recommendations.push("Tomorrow, try smaller portions or one lighter meal to stay closer to your calorie goal.");
    }
    if (giBand === "high") {
      recommendations.push("Favour lower-GI foods (vegetables, legumes, whole grains) to smooth blood sugar swings.");
    }
    if (wRatio < 0.45) {
      recommendations.push("Hydration is well below goal — sip water regularly until you’re closer to your target.");
    }
    if (!recommendations.length) {
      recommendations.push("Review the snapshot above and adjust one habit tomorrow.");
    }
  } else {
    headline = "Mixed — you’re close on some goals";
    tone = "neutral";
    if (todayKcalHint.band === "under") {
      recommendations.push("Calories are under your goal — add nutrient-dense snacks if you need more energy.");
    }
    if (giBand === "ok") {
      recommendations.push("GI is acceptable — swapping one meal toward lower-GI options can help.");
    }
    if (wRatio >= 0.45 && wRatio < 0.75) {
      recommendations.push("A bit more water would bring hydration in line with your goal.");
    }
    if (!recommendations.length) {
      recommendations.push("Pick one lever for tomorrow: calories, GI quality, or water.");
    }
  }

  return { headline, tone, summaryLines, recommendations, derivedMet };
}

// GET /tracking
exports.index = async (req, res) => {
  try {
    const user = await User.findById(res.locals.currentUser._id)
      .populate("meal_log.food", "name category gi_value gi_tier calories_per_100g")
      .lean();

    const focusDate = parseLocalDate(req.query.date || todayStr());
    const manualForDay = (user.meal_log || [])
      .filter((e) => sameCalendarDay(e.date, focusDate))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    let editEntry = null;
    const editId = req.query.edit;
    if (editId && mongoose.isValidObjectId(editId)) {
      const found = manualForDay.find((e) => String(e._id) === String(editId));
      if (found && found.food) editEntry = found;
    }

    const dailyGoal = user.profile && user.profile.daily_calories ? user.profile.daily_calories : null;
    const dayTotalKcal = sumKcalFromEntries(manualForDay);
    const kcalHint = kcalVsGoal(dayTotalKcal, dailyGoal);

    // Today's food log (for check-in step — always calendar "today", not the date picker)
    const todayForCal = parseLocalDate(todayStr());
    const todayMealEntries = (user.meal_log || []).filter((e) => sameCalendarDay(e.date, todayForCal));
    const todayTotalKcal = sumKcalFromEntries(todayMealEntries);
    const todayKcalHint = kcalVsGoal(todayTotalKcal, dailyGoal);
    let todayPctFill = 0;
    let kcalRemaining = null;
    let kcalOver = null;
    if (dailyGoal && dailyGoal > 0) {
      todayPctFill = Math.min(100, (todayTotalKcal / dailyGoal) * 100);
      if (todayTotalKcal <= dailyGoal) kcalRemaining = Math.round(dailyGoal - todayTotalKcal);
      else kcalOver = Math.round(todayTotalKcal - dailyGoal);
    }

    const todayAvgGi = weightedAvgGiFromEntries(todayMealEntries);
    const giLoadPct = giLoadProgressPct(todayAvgGi);
    let giBand = "empty";
    if (todayAvgGi != null) {
      if (todayAvgGi <= 55) giBand = "good";
      else if (todayAvgGi <= 70) giBand = "ok";
      else giBand = "high";
    }

    // Build 30-day window (past 30 days)
    const today    = new Date(); today.setHours(23,59,59,999);
    const start    = new Date(); start.setDate(start.getDate() - 29); start.setHours(0,0,0,0);

    const logs     = (user.tracking_log || []).filter(l => {
      const d = new Date(l.date);
      return d >= start && d <= today;
    });

    // Index logs by date string for quick lookup
    const logMap = {};
    logs.forEach(l => { logMap[new Date(l.date).toISOString().slice(0,10)] = l; });

    // Build calendar array (30 days)
    const calendar = [];
    for (let i = 29; i >= 0; i--) {
      const d   = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0,0,0,0);
      const key = d.toISOString().slice(0,10);
      const lg = logMap[key] || null;
      calendar.push({ date: d, key, log: lg, dayStatus: calendarDayStatus(lg) });
    }

    // Stats (30-day)
    const totalDays = calendar.length;
    const loggedDays = logs.length;
    const daysOnTarget = logs.filter((l) => l.met_targets === "yes").length;
    const targetPct = loggedDays ? Math.round((daysOnTarget / loggedDays) * 100) : 0;
    const avgWater = loggedDays
      ? (logs.reduce((s, l) => s + (l.water_intake_L || 0), 0) / loggedDays).toFixed(1)
      : 0;

    // Today's log + hydration snapshot (for dashboard)
    const todayKey = todayStr();
    const todayLog = logMap[todayKey] || null;
    const todayWaterL =
      todayLog && todayLog.water_intake_L != null ? Number(todayLog.water_intake_L) : 2;
    const waterPctFill = Math.min(100, (todayWaterL / WATER_GOAL_L) * 100);

    const dayVerdict = buildDayVerdict({
      dailyGoal,
      todayTotalKcal,
      todayKcalHint,
      todayAvgGi,
      giBand,
      todayWaterL,
      waterGoalL: WATER_GOAL_L,
    });

    res.render("pages/tracking/index", {
      title: "Tracking",
      user,
      manualForDay,
      manualDateStr: focusDate.toISOString().slice(0, 10),
      dayTotalKcal,
      dailyGoal,
      kcalHint,
      todayTotalKcal,
      todayKcalHint,
      todayPctFill,
      kcalRemaining,
      kcalOver,
      todayAvgGi,
      giLoadPct,
      giBand,
      waterGoalL: WATER_GOAL_L,
      todayWaterL,
      waterPctFill,
      calendar,
      todayKey,
      todayLog,
      dayVerdict,
      editEntry,
      stats: { loggedDays, totalDays, targetPct, avgWater, daysOnTarget },
    });
  } catch (err) {
    console.error("Tracking error:", err);
    res.status(500).render("pages/error", { title: "Error", message: err.message });
  }
};

// POST /tracking/log  — save water + notes; met_targets derived from log + goals
exports.log = async (req, res) => {
  try {
    const { water_intake_L, notes } = req.body;
    const user = await User.findById(res.locals.currentUser._id).populate(
      "meal_log.food",
      "name category gi_value gi_tier calories_per_100g"
    );

    const dailyGoal = user.profile && user.profile.daily_calories ? user.profile.daily_calories : null;
    const todayForCal = parseLocalDate(todayStr());
    const todayMealEntries = (user.meal_log || []).filter((e) => sameCalendarDay(e.date, todayForCal));
    const todayTotalKcal = sumKcalFromEntries(todayMealEntries);
    const todayKcalHint = kcalVsGoal(todayTotalKcal, dailyGoal);
    const todayAvgGi = weightedAvgGiFromEntries(todayMealEntries);
    let giBand = "empty";
    if (todayAvgGi != null) {
      if (todayAvgGi <= 55) giBand = "good";
      else if (todayAvgGi <= 70) giBand = "ok";
      else giBand = "high";
    }

    const waterL = Math.min(20, Math.max(0, parseFloat(water_intake_L) || 0));
    const mt = deriveMetTargetsFromMetrics({
      kcalBand: todayKcalHint.band,
      giBand,
      waterL,
      waterGoalL: WATER_GOAL_L,
      todayTotalKcal,
    });

    const today = dateOnly(new Date());
    const todayKey = today.toISOString().slice(0, 10);

    let entry = user.tracking_log.find((l) => new Date(l.date).toISOString().slice(0, 10) === todayKey);
    const meals_followed = { Breakfast: false, Lunch: false, Dinner: false, Snacks: false };

    if (entry) {
      entry.meals_followed = meals_followed;
      entry.met_targets = mt;
      entry.water_intake_L = waterL;
      entry.notes = (notes || "").slice(0, 300);
    } else {
      user.tracking_log.push({
        date: today,
        meals_followed,
        met_targets: mt,
        water_intake_L: waterL,
        notes: (notes || "").slice(0, 300),
      });
    }

    await user.save();
    req.flash("success", "Check-in saved — your score reflects today’s log and the water you entered.");
    res.redirect("/tracking");
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/tracking");
  }
};

// POST /tracking/meal — log a food from the database (independent of meal plan)
exports.addManualMeal = async (req, res) => {
  try {
    const { food_id, meal_type, portion_g, log_date } = req.body;
    if (!mongoose.isValidObjectId(food_id)) {
      req.flash("error", "Please choose a food.");
      return res.redirect("/tracking");
    }
    const food = await Food.findById(food_id).lean();
    if (!food) {
      req.flash("error", "Food not found.");
      return res.redirect("/tracking");
    }
    const mt = ["Breakfast", "Lunch", "Dinner", "Snack"].includes(meal_type) ? meal_type : "Lunch";
    const portion = Math.min(2000, Math.max(1, parseInt(portion_g, 10) || 100));
    const when = parseLocalDate(log_date);

    const user = await User.findById(res.locals.currentUser._id);
    user.meal_log.push({
      food: food_id,
      meal_type: mt,
      portion_g: portion,
      date: when,
    });
    await user.save();
    req.flash("success", "Meal logged.");
    const q = log_date ? `?date=${encodeURIComponent(String(log_date).slice(0, 10))}` : "";
    res.redirect("/tracking" + q);
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/tracking");
  }
};

// POST /tracking/meal/:entryId/update — edit a logged meal
exports.updateManualMeal = async (req, res) => {
  const { log_date } = req.body;
  const back = log_date ? `?date=${encodeURIComponent(String(log_date).slice(0, 10))}` : "";
  try {
    const { entryId } = req.params;
    const { food_id, meal_type, portion_g } = req.body;
    if (!mongoose.isValidObjectId(entryId)) {
      req.flash("error", "Invalid entry.");
      return res.redirect("/tracking" + back);
    }
    if (!mongoose.isValidObjectId(food_id)) {
      req.flash("error", "Please choose a food.");
      return res.redirect("/tracking" + back);
    }
    const food = await Food.findById(food_id).lean();
    if (!food) {
      req.flash("error", "Food not found.");
      return res.redirect("/tracking" + back);
    }
    const mt = ["Breakfast", "Lunch", "Dinner", "Snack"].includes(meal_type) ? meal_type : "Lunch";
    const portion = Math.min(2000, Math.max(1, parseInt(portion_g, 10) || 100));
    const when = parseLocalDate(log_date);

    const user = await User.findById(res.locals.currentUser._id);
    const sub = user.meal_log.id(entryId);
    if (!sub) {
      req.flash("error", "Entry not found.");
      return res.redirect("/tracking" + back);
    }
    sub.food = food_id;
    sub.meal_type = mt;
    sub.portion_g = portion;
    sub.date = when;
    await user.save();
    req.flash("success", "Meal entry updated.");
    res.redirect("/tracking" + back);
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/tracking" + back);
  }
};

// POST /tracking/meal/:entryId/remove
exports.removeManualMeal = async (req, res) => {
  try {
    const { entryId } = req.params;
    const back = req.body.back_date;
    if (!mongoose.isValidObjectId(entryId)) {
      req.flash("error", "Invalid entry.");
      return res.redirect("/tracking");
    }
    const result = await User.updateOne(
      { _id: res.locals.currentUser._id },
      { $pull: { meal_log: { _id: entryId } } }
    );
    if (!result.modifiedCount) {
      req.flash("error", "Entry not found.");
      return res.redirect("/tracking");
    }
    req.flash("success", "Meal entry removed.");
    const q = back ? `?date=${encodeURIComponent(String(back).slice(0, 10))}` : "";
    res.redirect("/tracking" + q);
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/tracking");
  }
};

// GET /tracking/history — AJAX endpoint returning last 30 days as JSON
exports.history = async (req, res) => {
  try {
    const user  = await User.findById(res.locals.currentUser._id).select("tracking_log").lean();
    const start = new Date(); start.setDate(start.getDate() - 29); start.setHours(0,0,0,0);
    const logs  = (user.tracking_log || []).filter(l => new Date(l.date) >= start);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
