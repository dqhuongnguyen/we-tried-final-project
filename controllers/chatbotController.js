const OpenAI = require("openai");
const Food   = require("../models/Food");

const client = new OpenAI({
  apiKey:  process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// POST /api/chatbot/message
exports.message = async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ success: false, error: "Message is required." });
    }
    if (message.trim().length > 800) {
      return res.status(400).json({ success: false, error: "Message too long (max 800 chars)." });
    }

    const user = res.locals.currentUser;

    // Fetch low-GI food sample for context (lean, select only needed fields)
    const lowGIFoods = await Food.find({ gi_tier: "Low" })
      .select("name gi_value category")
      .limit(15)
      .lean();
    const foodSample = lowGIFoods.map(f => `${f.name} (GI ${f.gi_value})`).join(", ");

    const systemPrompt = `You are GI Smart Assistant, a concise nutrition coach specialising in the Glycemic Index diet.

USER: ${user ? `${user.name}, Goal: ${user.goal || "General Health"}${user.profile?.bmi ? `, BMI: ${user.profile.bmi} (${user.profile.bmi_category})` : ""}` : "Guest"}

SAMPLE LOW-GI FOODS: ${foodSample}

RESPONSE RULES (CRITICAL):
- Always respond in SHORT BULLET POINTS (3-5 bullets max)
- Each bullet = one concise actionable tip or fact
- No long paragraphs — bullets only
- Use • as bullet character
- Keep total response under 120 words
- If asked about medical issues, add: "• Consult your doctor for personalised advice"
- Only discuss nutrition, GI diet, food, health — nothing else

FORMAT EXAMPLE:
• First point here
• Second point here
• Third point here`;

    const safeHistory = Array.isArray(history) ? history.slice(-8) : [];
    const messages    = [
      { role: "system", content: systemPrompt },
      ...safeHistory,
      { role: "user",   content: message.trim() },
    ];

    const result = await client.chat.completions.create({
      model:       "llama-3.3-70b-versatile",
      messages,
      max_tokens:  200,
      temperature: 0.6,
    });

    const reply = result.choices[0].message.content.trim();
    res.json({ success: true, reply });
  } catch (err) {
    console.error("Chatbot error:", err.message);
    res.status(500).json({ success: false, error: "Could not get a response. Please try again." });
  }
};
