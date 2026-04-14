require("dotenv").config();
const express        = require("express");
const session        = require("express-session");
const flash          = require("connect-flash");
const morgan         = require("morgan");
const methodOverride = require("method-override");
const path           = require("path");
const cors           = require("cors");
const mongoSanitize  = require("express-mongo-sanitize");
const rateLimit      = require("express-rate-limit");
const compression    = require("compression");           // Phase 4

const connectDB     = require("./config/db");
const { setLocals } = require("./middleware/webAuth");
const secrets       = require("./config/secrets");
const { MongoStore } = require("connect-mongo");
const { corsOptions, helmetMiddleware, enforceHttps } = require("./config/security");

connectDB();

const app = express();
const skipRateLimitInTest = () => process.env.NODE_ENV === "test";

if (process.env.TRUST_PROXY === "1") {
  app.set("trust proxy", 1);
}

app.use(enforceHttps);

// ── Phase 4: Compression (gzip all responses) ─────────────────────────────────
app.use(compression());

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmetMiddleware());
app.use(mongoSanitize());
app.use(cors(corsOptions()));

// Rate-limit API routes
app.use("/api", rateLimit({
  windowMs: 15 * 60 * 1000, max: 100,
  message: { success: false, message: "Too many requests. Try again after 15 minutes." },
  standardHeaders: true, legacyHeaders: false,
  skip: skipRateLimitInTest,
}));

// Stricter rate limit for chatbot
app.use("/api/chatbot", rateLimit({
  windowMs: 60 * 1000, max: 15,
  message: { success: false, error: "Too many chatbot requests. Please wait a moment." },
  skip: skipRateLimitInTest,
}));

// ── View Engine ───────────────────────────────────────────────────────────────
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ── Core Middleware ───────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "10kb" }));
app.use(methodOverride("_method"));

// Phase 4: Cache static assets for 7 days in production
app.use(express.static(path.join(__dirname, "public"), {
  maxAge: process.env.NODE_ENV === "production" ? "7d" : 0,
}));

// ── Session + Flash ───────────────────────────────────────────────────────────
// Secure cookies only over HTTPS — set SESSION_COOKIE_SECURE=true in production behind TLS.
// Do NOT tie to NODE_ENV alone: NODE_ENV=production on http://localhost drops the cookie every request.
const sessionStore =
  process.env.MONGODB_URI
    ? MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        touchAfter: 24 * 3600,
      })
    : undefined;

app.use(session({
  name: "connect.sid",
  secret: secrets.session,
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7,
    httpOnly: true,
    secure: process.env.SESSION_COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/",
  },
}));
app.use(flash());
app.use(setLocals);

// ── Web (EJS) Routes ──────────────────────────────────────────────────────────
app.use("/",          require("./routes/index"));
app.use("/auth",      require("./routes/webAuth"));
app.use("/",          require("./routes/webUser"));
app.use("/foods",     require("./routes/web-foods"));
app.use("/meal-plan", require("./routes/mealPlan"));
app.use("/tracking",  require("./routes/tracking"));   // Phase 4
app.use("/admin",     require("./routes/admin"));

// ── REST API Routes ───────────────────────────────────────────────────────────
app.use("/api/auth",    require("./routes/auth"));
app.use("/api/foods",   require("./routes/foods"));
app.use("/api/users",   require("./routes/users"));
app.use("/api/chatbot", require("./routes/chatbot"));

app.get("/api/health", (req, res) =>
  res.json({
    success: true,
    message: "GI Smart API running",
    version: "4.0.0",
    ...(process.env.NODE_ENV !== "production" ? { env: process.env.NODE_ENV } : {}),
  })
);

// ── Error Handlers ────────────────────────────────────────────────────────────
app.use((req, res) => {
  if (req.originalUrl.startsWith("/api"))
    return res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
  res.status(404).render("pages/error", { title: "404", message: "Page not found." });
});

app.use((err, req, res, next) => {
  if (err.message && String(err.message).includes("CORS")) {
    if (req.originalUrl.startsWith("/api")) {
      return res.status(403).json({ success: false, message: "Origin not allowed." });
    }
    return res.status(403).send("Forbidden");
  }
  console.error(err.stack);
  if (req.originalUrl.startsWith("/api")) {
    const status = err.statusCode || 500;
    const publicMsg =
      process.env.NODE_ENV === "production" && status >= 500
        ? "Internal server error"
        : err.message;
    return res.status(status).json({ success: false, message: publicMsg });
  }
  res.status(500).render("pages/error", {
    title: "Error",
    message:
      process.env.NODE_ENV === "production"
        ? "Something went wrong."
        : err.message,
  });
});

const PORT = process.env.PORT || 3000;
module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => console.log(`🚀 GI Smart v4 running at http://localhost:${PORT}`));
}
