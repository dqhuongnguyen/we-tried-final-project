const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

// ── Generate a 7-day weekly rotating meal plan ──────────────────────────────
async function generateWeeklyMealPlan(user, foodPool) {
  // Limit food pool to 60 foods to keep prompt size manageable
  const foods = foodPool.slice(0, 60).map(f => ({
    id:       f._id.toString(),
    name:     f.name,
    category: f.category,
    gi_value: f.gi_value,
    gi_tier:  f.gi_tier,
    calories: f.calories_per_100g,
    protein:  f.protein_g,
    carbs:    f.carbs_g,
    fibre:    f.fibre_g,
    fat:      f.fat_g,
  }));

  const profile = user.profile;
  const days    = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

  const prompt = `You are a clinical nutritionist. Create a 7-day rotating meal plan for this patient.

PATIENT PROFILE:
- BMI: ${profile.bmi} (${profile.bmi_category})
- Age: ${profile.age}, Gender: ${profile.gender}
- Weight: ${profile.weight_kg}kg, Height: ${profile.height_cm}cm  
- Activity: ${profile.activity}, Goal: ${profile.goal}
- Daily calorie target: ${profile.daily_calories} kcal

CALORIE SPLIT PER DAY:
- Breakfast: 25% = ${Math.round(profile.daily_calories * 0.25)} kcal
- Lunch: 35% = ${Math.round(profile.daily_calories * 0.35)} kcal
- Dinner: 30% = ${Math.round(profile.daily_calories * 0.30)} kcal
- Snacks: 10% = ${Math.round(profile.daily_calories * 0.10)} kcal

RULES:
- Only pick foods from the provided list using exact id field
- Prioritise LOW GI foods
- Vary foods across the 7 days (no same food two days in a row for same meal)
- **Every Breakfast, Lunch, Dinner, and Snacks must include exactly 3 foods** listed in the "foods" array (three separate objects). Snacks are three small items that go together.
- **Meals must read like a real plate**, not random sides: for Breakfast/Lunch/Dinner combine **(1) a lean protein or legume dish, (2) a whole grain or starchy vegetable/bread serving where appropriate, (3) vegetables or salad** — or an equivalent balanced trio. **Do not** pair only “leafy greens + dip/spread” (e.g. spinach + hummus alone) without a third anchoring food such as grain, bread, potato, eggs, fish, poultry, tofu, or another substantial item from the list.
- Give each food its own "reason" (one short phrase explaining its role in that meal).
- ${profile.bmi_category === 'Obese' ? 'Strictly avoid medium/high GI. Max fibre and protein.' : 
   profile.bmi_category === 'Overweight' ? 'Avoid high GI. Prioritise fibre and lean protein.' :
   profile.bmi_category === 'Underweight' ? 'Include some medium GI for calorie density.' :
   'Balanced low-GI approach.'}

AVAILABLE FOODS (use exact id):
${JSON.stringify(foods)}

CRITICAL: Respond ONLY with raw JSON, no markdown, no backticks. Use this exact structure (note: **foods** is always an array with **exactly 3** objects per meal):
{
  "Monday":    { "Breakfast": { "foods": [{"id":"...","name":"...","reason":"..."},{"id":"...","name":"...","reason":"..."},{"id":"...","name":"...","reason":"..."}], "tip": "..." }, "Lunch": {...}, "Dinner": {...}, "Snacks": {...} },
  "Tuesday":   { "Breakfast": {...}, "Lunch": {...}, "Dinner": {...}, "Snacks": {...} },
  "Wednesday": { "Breakfast": {...}, "Lunch": {...}, "Dinner": {...}, "Snacks": {...} },
  "Thursday":  { "Breakfast": {...}, "Lunch": {...}, "Dinner": {...}, "Snacks": {...} },
  "Friday":    { "Breakfast": {...}, "Lunch": {...}, "Dinner": {...}, "Snacks": {...} },
  "Saturday":  { "Breakfast": {...}, "Lunch": {...}, "Dinner": {...}, "Snacks": {...} },
  "Sunday":    { "Breakfast": {...}, "Lunch": {...}, "Dinner": {...}, "Snacks": {...} },
  "summary": "2-3 sentences explaining why this weekly plan suits this patient"
}`;

  const result = await client.chat.completions.create({
    model:      'llama-3.3-70b-versatile',
    messages:   [{ role: 'user', content: prompt }],
    max_tokens: 6000,
    temperature: 0.7,
  });

  const raw   = result.choices[0].message.content.trim();
  const clean = raw.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(clean);
}

module.exports = { generateWeeklyMealPlan };
