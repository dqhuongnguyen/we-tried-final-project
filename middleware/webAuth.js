const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { jwt: jwtSecret } = require("../config/secrets");

/**
 * True if this user has admin privileges (navbar + redirects + requireAdmin).
 * 1) `role: "admin"` on the user document (preferred), or
 * 2) `ADMIN_EMAILS` env (comma-separated, case-insensitive) — useful when DB role is hard to update in production.
 */
function userIsAdmin(user) {
  if (!user) return false;
  if (String(user.role || "").toLowerCase() === "admin") return true;
  const raw = process.env.ADMIN_EMAILS || "";
  const email = (user.email || "").trim().toLowerCase();
  if (!email) return false;
  const allowed = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allowed.length > 0 && allowed.includes(email);
}

/**
 * Login state: JWT stored in express-session (httpOnly cookie). No secrets in localStorage.
 * setLocals runs on every request: verifies JWT, loads User → res.locals.currentUser.
 */
exports.setLocals = async (req, res, next) => {
  res.locals.currentUser = null;
  res.locals.isAdmin = false;
  res.locals.success = req.flash ? req.flash("success") : [];
  res.locals.error   = req.flash ? req.flash("error")   : [];

  const token = req.session?.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, jwtSecret);
      res.locals.currentUser = await User.findById(decoded.id).select("-password").lean();
      res.locals.isAdmin = userIsAdmin(res.locals.currentUser);
    } catch {
      req.session.token = null; // expired — clear it
    }
  }
  next();
};

exports.userIsAdmin = userIsAdmin;

// Block logged-in users from /auth pages
exports.guestOnly = (req, res, next) => {
  if (req.session?.token) {
    if (res.locals.isAdmin) return res.redirect("/admin");
    return res.redirect("/dashboard");
  }
  next();
};

const isApi = (req) => req.originalUrl.startsWith("/api");

function requireLogin(req, res, next) {
  if (!req.session?.token) {
    if (isApi(req)) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }
    req.flash && req.flash("error", "Please log in to access that page.");
    return res.redirect("/auth/login");
  }
  if (!res.locals.currentUser) {
    req.session.token = null;
    if (isApi(req)) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }
    req.flash && req.flash("error", "Please sign in again.");
    return res.redirect("/auth/login");
  }
  next();
}
exports.requireLogin = requireLogin;

function requireAdmin(req, res, next) {
  if (!req.session?.token) {
    if (isApi(req)) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }
    req.flash && req.flash("error", "Please log in.");
    return res.redirect("/auth/login");
  }
  if (!userIsAdmin(res.locals.currentUser)) {
    if (isApi(req)) {
      return res.status(403).json({ success: false, message: "Forbidden." });
    }
    return res.status(403).render("pages/error", {
      title: "Access Denied",
      message: "You do not have permission to access this page.",
    });
  }
  next();
}
exports.requireAdmin = requireAdmin;

/**
 * Logged-in admins only use the admin panel + food CRUD web routes + API.
 * Everything else (home, dashboard, meal plan, consumer foods list, etc.) → /admin
 */
function redirectAdminFromConsumer(req, res, next) {
  if (!req.session?.token || !res.locals.currentUser) return next();
  if (!res.locals.isAdmin) return next();

  // Pathname from full URL — more reliable than req.path behind some proxies (e.g. Render)
  const path = (req.originalUrl || "").split("?")[0] || req.path || "";
  const method = req.method || "GET";

  if (path.startsWith("/admin")) return next();
  if (path === "/auth/logout" && method === "POST") return next();
  if (path.startsWith("/api/")) return next();
  if (path === "/foods/new") return next();
  if (path === "/foods" && method === "POST") return next();
  if (/^\/foods\/[^/]+\/edit$/.test(path)) return next();
  if (/^\/foods\/[^/]+$/.test(path)) return next();

  if (method === "GET" || method === "HEAD") return res.redirect(302, "/admin");
  return res.redirect(303, "/admin");
}
exports.redirectAdminFromConsumer = redirectAdminFromConsumer;
