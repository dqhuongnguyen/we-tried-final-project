const Food = require("../models/Food");
const User = require("../models/User");
const { generateWeeklyMealPlan } = require("../utils/aiMealPlanner");

const RULES = {
  Underweight: { tiers: ["Low", "Medium"], maxGI: 69, focus: "Higher calorie, nutrient-dense foods with medium-GI for energy", goal: "Gain weight", icon: "📈", colour: "underweight" },
  Normal:      { tiers: ["Low"],          maxGI: 55, focus: "Balanced low-GI diet for long-term maintenance",                goal: "Maintain weight",       icon: "✅", colour: "normal"      },
  Overweight:  { tiers: ["Low"],          maxGI: 50, focus: "Strict low-GI, high-fibre calorie-deficit eating",              goal: "Lose weight",           icon: "⚖️", colour: "overweight"  },
  Obese:       { tiers: ["Low"],          maxGI: 45, focus: "Very low GI only, no high-GI foods — blood sugar priority",    goal: "Blood sugar control",   icon: "🩸", colour: "obese"       },
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const MEAL_SLOTS = ["Breakfast", "Lunch", "Dinner", "Snacks"];

/** Every meal slot must list at least this many foods (AI + padding). */
const MIN_FOODS_PER_MEAL = 3;

/** Order for padding: main meals prefer grain/protein so meals are not “two sides only” (e.g. veg + dip). */
function categoryPadOrderForSlot(slot) {
  if (slot === "Snacks") {
    return ["Fruit", "Dairy", "Nuts & Seeds", "Grains", "Protein", "Vegetables", "Legumes", "Drinks", "Other"];
  }
  return ["Grains", "Protein", "Vegetables", "Legumes", "Fruit", "Dairy", "Nuts & Seeds", "Drinks", "Other"];
}

function reasonForPadCategory(category) {
  const m = {
    Vegetables: "Adds fibre and volume to balance the plate.",
    Legumes: "Adds plant protein and fibre.",
    Grains: "Adds slow-release energy.",
    Protein: "Adds lean protein to round out the meal.",
    Fruit: "Adds vitamins and natural sweetness.",
    Dairy: "Adds calcium and protein.",
    "Nuts & Seeds": "Adds healthy fats and crunch.",
    Drinks: "Hydration support.",
    Other: "Complements the other foods in this meal.",
  };
  return m[category] || m.Other;
}

/**
 * Mutates aiPlan: each Breakfast/Lunch/Dinner/Snacks must list at least MIN_FOODS_PER_MEAL foods.
 * Pads from the same filtered pool when the model returns fewer items.
 */
function ensureMealsHaveMinFoods(aiPlan, foodPool) {
  if (!aiPlan || !foodPool?.length) return;

  const poolById = new Map(foodPool.map((f) => [f._id.toString(), f]));

  for (const day of DAYS) {
    const dayBlock = aiPlan[day];
    if (!dayBlock || typeof dayBlock !== "object") continue;

    for (const slot of MEAL_SLOTS) {
      const meal = dayBlock[slot];
      if (!meal || !Array.isArray(meal.foods)) continue;

      const foods = meal.foods;
      const seen = new Set();
      for (const f of foods) {
        if (f && f.id) seen.add(String(f.id));
      }

      const categoriesPresent = new Set();
      for (const f of foods) {
        const full = f?.id ? poolById.get(String(f.id)) : null;
        if (full?.category) categoriesPresent.add(full.category);
      }

      while (foods.length < MIN_FOODS_PER_MEAL) {
        const extra = pickPadFood(foodPool, seen, categoriesPresent, slot);
        if (!extra) break;
        foods.push({
          id: extra._id.toString(),
          name: extra.name,
          reason: reasonForPadCategory(extra.category),
        });
        seen.add(extra._id.toString());
        if (extra.category) categoriesPresent.add(extra.category);
      }
    }
  }
}

function pickPadFood(pool, seenIds, categoriesPresent, slot) {
  for (const cat of categoryPadOrderForSlot(slot)) {
    if (categoriesPresent.has(cat)) continue;
    const found = pool.find((p) => !seenIds.has(p._id.toString()) && p.category === cat);
    if (found) return found;
  }
  return pool.find((p) => !seenIds.has(p._id.toString())) || null;
}

function needsMinFoodPadding(weeklyPlan) {
  if (!weeklyPlan?.days) return false;
  for (const day of DAYS) {
    const dayBlock = weeklyPlan.days[day];
    if (!dayBlock) continue;
    for (const slot of MEAL_SLOTS) {
      const foods = dayBlock[slot]?.foods;
      if (!Array.isArray(foods) || foods.length < MIN_FOODS_PER_MEAL) return true;
    }
  }
  return false;
}

/** Same rules as ensureMealsHaveMinFoods, for hydrated plans (full Food docs + reason). */
function ensureHydratedWeeklyMealPlanMinFoods(weeklyPlan, foodPool) {
  if (!weeklyPlan?.days || !foodPool?.length) return;

  for (const day of DAYS) {
    const dayBlock = weeklyPlan.days[day];
    if (!dayBlock) continue;

    for (const slot of MEAL_SLOTS) {
      const meal = dayBlock[slot];
      if (!meal || !Array.isArray(meal.foods)) continue;

      const foods = meal.foods;
      const seen = new Set();
      for (const f of foods) {
        if (f && f._id) seen.add(String(f._id));
      }

      const categoriesPresent = new Set();
      for (const f of foods) {
        if (f?.category) categoriesPresent.add(f.category);
      }

      while (foods.length < MIN_FOODS_PER_MEAL) {
        const extra = pickPadFood(foodPool, seen, categoriesPresent, slot);
        if (!extra) break;
        foods.push({
          ...extra,
          reason: reasonForPadCategory(extra.category),
        });
        seen.add(extra._id.toString());
        if (extra.category) categoriesPresent.add(extra.category);
      }
    }
  }
}

/** After this many ms, the next page load triggers a new AI meal plan (simple weekly refresh). */
const PLAN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function isPlanFresh(generatedAtIso) {
  if (!generatedAtIso) return false;
  const t = new Date(generatedAtIso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < PLAN_MAX_AGE_MS;
}

/** Monday–Sunday name for a given date (matches meal-plan calendar). */
function getWeekdayName(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];
}

/** Storable copy: food ids + reasons only (full Food docs loaded on read). */
function buildStoredFromAi(aiPlan) {
  const out = {
    summary: aiPlan.summary,
    generatedAt: new Date().toISOString(),
    days: {},
  };
  for (const day of DAYS) {
    if (!aiPlan[day]) continue;
    out.days[day] = {};
    for (const [meal, data] of Object.entries(aiPlan[day])) {
      out.days[day][meal] = {
        foods: (data.foods || []).map((f) => ({ id: f.id, reason: f.reason })),
        tip: data.tip,
      };
    }
  }
  return out;
}

/** Merge stored plan with live Food documents from the database. */
async function hydrateWeeklyMealPlan(stored) {
  const ids = new Set();
  for (const day of DAYS) {
    const dayPlan = stored.days?.[day];
    if (!dayPlan) continue;
    for (const meal of Object.values(dayPlan)) {
      for (const f of meal.foods || []) {
        if (f.id) ids.add(String(f.id));
      }
    }
  }
  const foods = await Food.find({ _id: { $in: [...ids] } }).lean();
  const foodMap = Object.fromEntries(foods.map((f) => [f._id.toString(), f]));

  const weeklyPlan = {
    summary: stored.summary,
    generatedAt: stored.generatedAt,
    days: {},
  };

  for (const day of DAYS) {
    if (!stored.days?.[day]) continue;
    weeklyPlan.days[day] = {};
    for (const [mealName, meal] of Object.entries(stored.days[day])) {
      weeklyPlan.days[day][mealName] = {
        foods: (meal.foods || [])
          .map((f) => {
            const full = foodMap[String(f.id)];
            if (!full) return null;
            return { ...full, reason: f.reason };
          })
          .filter(Boolean),
        tip: meal.tip,
      };
    }
  }
  return weeklyPlan;
}

/**
 * Weekly plan: session cache (if fresh) → database (if fresh) → AI, then save to DB.
 * Refreshes automatically when the stored plan is older than 7 days.
 * Survives sign-out; cleared when health profile is updated.
 */
async function ensureWeeklyMealPlan(req, user) {
  const userId = user._id;
  const rule = RULES[user.profile.bmi_category] || RULES.Normal;
  const loadFoodPool = () =>
    Food.find({ gi_tier: { $in: rule.tiers } })
      .sort({ gi_value: 1 })
      .lean();

  if (req.session.weeklyMealPlan && isPlanFresh(req.session.weeklyMealPlan.generatedAt)) {
    if (needsMinFoodPadding(req.session.weeklyMealPlan)) {
      ensureHydratedWeeklyMealPlanMinFoods(req.session.weeklyMealPlan, await loadFoodPool());
    }
    return req.session.weeklyMealPlan;
  }
  delete req.session.weeklyMealPlan;

  const doc = await User.findById(userId).select("weekly_meal_plan").lean();
  const stored = doc?.weekly_meal_plan;
  if (
    stored?.days &&
    Object.keys(stored.days).length &&
    isPlanFresh(stored.generatedAt)
  ) {
    const weeklyPlan = await hydrateWeeklyMealPlan(stored);
    if (needsMinFoodPadding(weeklyPlan)) {
      ensureHydratedWeeklyMealPlanMinFoods(weeklyPlan, await loadFoodPool());
    }
    req.session.weeklyMealPlan = weeklyPlan;
    delete req.session.detailedMealPlan;
    delete req.session.mealPlan;
    return weeklyPlan;
  }

  const foodPool = await loadFoodPool();

  const aiPlan = await generateWeeklyMealPlan(user, foodPool);
  ensureMealsHaveMinFoods(aiPlan, foodPool);
  const freshStored = buildStoredFromAi(aiPlan);

  await User.updateOne({ _id: userId }, { $set: { weekly_meal_plan: freshStored } });

  const weeklyPlan = await hydrateWeeklyMealPlan(freshStored);
  req.session.weeklyMealPlan = weeklyPlan;
  delete req.session.detailedMealPlan;
  delete req.session.mealPlan;

  return weeklyPlan;
}

/** Shape expected by dashboard: { summary, meals } for one day. */
function dashboardMealsForDate(weeklyPlan, date = new Date()) {
  const dayName = getWeekdayName(date);
  const dayMeals = weeklyPlan.days[dayName];
  if (!dayMeals) return null;
  return { summary: weeklyPlan.summary, meals: dayMeals };
}

module.exports = {
  RULES,
  DAYS,
  getWeekdayName,
  ensureWeeklyMealPlan,
  dashboardMealsForDate,
};
