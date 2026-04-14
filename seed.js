require("dotenv").config();
const mongoose = require("mongoose");
const Food = require("./models/Food");

const SAMPLE_FOODS = [
  { name: "Steel-Cut Oats", category: "Grains", gi_value: 55, calories_per_100g: 389, carbs_g: 67, fibre_g: 10, protein_g: 13, fat_g: 7, tags: ["breakfast","whole grain"], notes: "Much lower GI than instant oats. Rich in beta-glucan.", is_featured: true },
  { name: "Lentils", category: "Legumes", gi_value: 29, calories_per_100g: 116, carbs_g: 20, fibre_g: 8, protein_g: 9, fat_g: 0.4, tags: ["protein","iron"], notes: "One of the best GI foods.", is_featured: true },
  { name: "Blueberries", category: "Fruit", gi_value: 25, calories_per_100g: 57, carbs_g: 14, fibre_g: 2.4, protein_g: 0.7, fat_g: 0.3, tags: ["antioxidants","snack"], notes: "Extremely low GI, rich in antioxidants.", is_featured: true },
  { name: "Greek Yoghurt", category: "Dairy", gi_value: 12, calories_per_100g: 97, carbs_g: 3.6, fibre_g: 0, protein_g: 9, fat_g: 5, tags: ["protein","probiotic"], notes: "Full-fat plain is best.", is_featured: true },
  { name: "Avocado", category: "Vegetables", gi_value: 10, calories_per_100g: 160, carbs_g: 9, fibre_g: 7, protein_g: 2, fat_g: 15, tags: ["healthy fat","fibre"], notes: "Near-zero GI.", is_featured: true },
  { name: "Salmon", category: "Protein", gi_value: 0, calories_per_100g: 208, carbs_g: 0, fibre_g: 0, protein_g: 20, fat_g: 13, tags: ["omega-3","dinner"], notes: "Zero GI, rich omega-3.", is_featured: true },
  { name: "White Bread", category: "Grains", gi_value: 75, calories_per_100g: 265, carbs_g: 49, fibre_g: 2.7, protein_g: 9, fat_g: 3.2, tags: ["refined","limit"], notes: "High GI. Replace with sourdough." },
  { name: "Cornflakes", category: "Grains", gi_value: 81, calories_per_100g: 357, carbs_g: 84, fibre_g: 1.2, protein_g: 7, fat_g: 0.9, tags: ["processed","breakfast"], notes: "Very high GI breakfast cereal." },
  { name: "Chickpeas", category: "Legumes", gi_value: 28, calories_per_100g: 164, carbs_g: 27, fibre_g: 8, protein_g: 9, fat_g: 2.6, tags: ["protein","hummus"], notes: "Excellent for hummus and salads." },
  { name: "Brown Rice", category: "Grains", gi_value: 50, calories_per_100g: 216, carbs_g: 45, fibre_g: 1.8, protein_g: 5, fat_g: 1.8, tags: ["whole grain","fibre"], notes: "More fibre than white rice." },
  { name: "Apple", category: "Fruit", gi_value: 38, calories_per_100g: 52, carbs_g: 14, fibre_g: 2.4, protein_g: 0.3, fat_g: 0.2, tags: ["snack","pectin"], notes: "High in pectin." },
  { name: "Watermelon", category: "Fruit", gi_value: 76, calories_per_100g: 30, carbs_g: 7.6, fibre_g: 0.4, protein_g: 0.6, fat_g: 0.2, tags: ["summer","high GI"], notes: "High GI but low GL in small portions." },
  { name: "Quinoa", category: "Grains", gi_value: 53, calories_per_100g: 120, carbs_g: 22, fibre_g: 2.8, protein_g: 4.4, fat_g: 1.9, tags: ["complete protein","gluten-free"], notes: "Great rice substitute." },
  { name: "Soft Drink / Soda", category: "Drinks", gi_value: 65, calories_per_100g: 41, carbs_g: 11, fibre_g: 0, protein_g: 0, fat_g: 0, tags: ["avoid","liquid sugar"], notes: "Pure liquid sugar. Avoid." },
  { name: "Almonds", category: "Nuts & Seeds", gi_value: 15, calories_per_100g: 579, carbs_g: 22, fibre_g: 12.5, protein_g: 21, fat_g: 50, tags: ["snack","healthy fat"], notes: "Low GI, filling snack." },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB Atlas...");
  await Food.deleteMany({});
  console.log("Cleared existing food data.");
  const inserted = await Food.insertMany(SAMPLE_FOODS);
  console.log(`✅ Seeded ${inserted.length} foods.`);
  await mongoose.disconnect();
  console.log("Done.");
}

seed().catch(console.error);
