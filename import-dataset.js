require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse");
const mongoose = require("mongoose");
const Food = require("./models/Food");

// ─────────────────────────────────────────────────────────────
// Dataset: nutrition.csv
// Source:  Kaggle — "Nutritional Values for Common Foods"
//          kaggle.com/datasets/trolukovich/nutritional-values-for-common-foods-and-products
// GI Values sourced from:
//          University of Sydney GI Database (glycemicindex.com)
// ─────────────────────────────────────────────────────────────

// Auto-set gi_tier from gi_value
function getGITier(gi) {
  if (gi <= 55) return "Low";
  if (gi <= 69) return "Medium";
  return "High";
}

// Parse number safely from CSV value
function num(val) {
  if (val === undefined || val === null || val === "" || val === "N/A") return undefined;
  const n = parseFloat(String(val).replace(/[^0-9.]/g, ""));
  return isNaN(n) ? undefined : n;
}

// Auto-generate tags from food name and category
function makeTags(name, category) {
  const tags = [];
  const n = name.toLowerCase();
  if (category === "Grains") {
    if (/oat|oatmeal/.test(n)) tags.push("breakfast", "high-fibre");
    if (/bread/.test(n)) tags.push("bread");
    if (/rice/.test(n)) tags.push("staple");
    if (/pasta|spaghetti/.test(n)) tags.push("dinner");
    if (/whole|brown|rye/.test(n)) tags.push("whole grain");
  }
  if (category === "Fruit") {
    tags.push("snack");
    if (/berry|berries|cherry|cherries|blueberry/.test(n)) tags.push("antioxidants");
    if (/dried|raisin|date/.test(n)) tags.push("dried fruit");
  }
  if (category === "Legumes") tags.push("protein", "fibre");
  if (category === "Protein") {
    if (/salmon|tuna|sardine|fish|shrimp/.test(n)) tags.push("omega-3", "seafood");
    if (/chicken|turkey/.test(n)) tags.push("lean protein");
    if (/egg/.test(n)) tags.push("breakfast");
  }
  if (category === "Dairy") {
    if (/yoghurt|yogurt/.test(n)) tags.push("probiotic");
  }
  if (category === "Nuts & Seeds") tags.push("snack", "healthy fat");
  if (category === "Vegetables") {
    if (/avocado/.test(n)) tags.push("healthy fat");
    if (/broccoli|spinach|kale|cauliflower/.test(n)) tags.push("cruciferous");
    if (/potato|sweet potato/.test(n)) tags.push("starchy");
  }
  return [...new Set(tags)]; // remove duplicates
}

// Auto-generate a helpful note
function makeNote(name, gi, category) {
  if (gi === 0) return `${name} contains no carbohydrates — zero GI impact on blood sugar.`;
  if (gi <= 20) return `Exceptionally low GI. ${name} is an excellent choice for blood sugar control.`;
  if (gi <= 40) return `Low GI food. ${name} digests slowly, providing steady energy.`;
  if (gi <= 55) return `Low-medium GI. ${name} is a good option in a balanced diet.`;
  if (gi <= 69) return `Medium GI. Enjoy ${name} in moderate portions alongside protein or fibre.`;
  if (gi <= 80) return `High GI. Limit ${name} or pair with protein and fat to blunt the blood sugar spike.`;
  return `Very high GI. ${name} causes rapid blood sugar spikes — limit or avoid for better metabolic health.`;
}

async function importDataset() {
  const csvPath = path.join(__dirname, "nutrition.csv");

  if (!fs.existsSync(csvPath)) {
    console.error("❌ nutrition.csv not found!");
    console.error("   Make sure nutrition.csv is in the root of your project folder.");
    process.exit(1);
  }

  // Connect to MongoDB Atlas
  console.log("🔌 Connecting to MongoDB Atlas...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected!\n");

  // Clear existing data
  const existing = await Food.countDocuments();
  await Food.deleteMany({});
  console.log(`🗑️  Cleared ${existing} existing food records.`);

  const foods = [];
  let skipped = 0;

  // Parse CSV
  const parser = fs
    .createReadStream(csvPath)
    .pipe(
      parse({
        columns: true,          // use first row as headers
        skip_empty_lines: true,
        trim: true,
      })
    );

  for await (const row of parser) {
    const name = row.name;
    const category = row.category;
    const gi = num(row.gi_value);

    // Skip rows missing essential fields
    if (!name || !category || gi === undefined) {
      skipped++;
      continue;
    }

    const isFeatured = [
      "Lentils Green", "Steel-Cut Oats", "Blueberries",
      "Salmon Atlantic", "Greek Yoghurt Plain Full Fat",
      "Avocado", "Chickpeas", "Quinoa", "Almonds", "Eggs Whole"
    ].includes(name);

    foods.push({
      name,
      category,
      gi_value: gi,
      gi_tier: getGITier(gi),
      calories_per_100g: num(row.calories),
      carbs_g:           num(row.total_carbohydrate_g),
      fibre_g:           num(row.dietary_fiber_g),
      protein_g:         num(row.protein_g),
      fat_g:             num(row.total_fat_g),
      serving_size_g:    100,
      tags:              makeTags(name, category),
      notes:             makeNote(name, gi, category),
      is_featured:       isFeatured,
    });
  }

  if (foods.length === 0) {
    console.error("❌ No valid rows found in CSV. Check the file format.");
    await mongoose.disconnect();
    process.exit(1);
  }

  // Insert in batches of 50
  let inserted = 0;
  const BATCH = 50;
  for (let i = 0; i < foods.length; i += BATCH) {
    const batch = foods.slice(i, i + BATCH);
    await Food.insertMany(batch, { ordered: false });
    inserted += batch.length;
  }

  // Summary
  console.log(`\n✅ Import complete!`);
  console.log(`   ✔  Inserted : ${inserted} foods`);
  console.log(`   ✘  Skipped  : ${skipped} rows (missing fields)`);
  console.log(`\n📊 Breakdown by GI tier:`);
  console.log(`   🟢 Low GI  (0–55)  : ${foods.filter(f => f.gi_tier === "Low").length} foods`);
  console.log(`   🟡 Medium  (56–69) : ${foods.filter(f => f.gi_tier === "Medium").length} foods`);
  console.log(`   🔴 High GI (70+)   : ${foods.filter(f => f.gi_tier === "High").length} foods`);
  console.log(`\n🚀 Run 'npm start' → open http://localhost:3000`);

  await mongoose.disconnect();
}

importDataset().catch((err) => {
  console.error("❌ Import failed:", err.message);
  process.exit(1);
});
