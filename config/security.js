/**
 * Central security configuration: Helmet, CORS, HTTPS redirect.
 * Session + JWT live in app.js + middleware/webAuth.js (JWT in server-side session cookie).
 */
const helmet = require("helmet");

/** CORS: in production set CORS_ORIGINS or CLIENT_URL (comma-separated). Dev allows all. */
function corsOptions() {
  const raw = process.env.CORS_ORIGINS || process.env.CLIENT_URL || "";
  const allowed = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const strictProd = process.env.NODE_ENV === "production" && allowed.length > 0;

  return {
    origin(origin, callback) {
      if (!strictProd) return callback(null, true);
      if (!origin) return callback(null, true);
      if (allowed.includes(origin)) return callback(null, true);
      return callback(new Error("CORS: origin not allowed"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
    maxAge: 86400,
  };
}

/** Helmet: strict CSP in production (EJS uses inline scripts/styles — allowed narrowly). */
function helmetMiddleware() {
  const prod = process.env.NODE_ENV === "production";
  if (!prod) {
    return helmet({ contentSecurityPolicy: false });
  }
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        ...(process.env.ENFORCE_HTTPS === "true" ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    crossOriginEmbedderPolicy: false,
  });
}

/** Set ENFORCE_HTTPS=true behind TLS (use TRUST_PROXY=1 with reverse proxies). */
function enforceHttps(req, res, next) {
  if (process.env.ENFORCE_HTTPS !== "true") return next();
  const secure = req.secure || req.get("x-forwarded-proto") === "https";
  if (secure) return next();
  return res.redirect(301, `https://${req.get("host")}${req.originalUrl}`);
}

module.exports = { corsOptions, helmetMiddleware, enforceHttps };
