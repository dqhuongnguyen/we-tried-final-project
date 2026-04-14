const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { jwt: jwtSecret } = require("../config/secrets");

/**
 * Login state: JWT stored in express-session (httpOnly cookie). No secrets in localStorage.
 * setLocals runs on every request: verifies JWT, loads User → res.locals.currentUser.
 */
exports.setLocals = async (req, res, next) => {
  res.locals.currentUser = null;
  res.locals.success = req.flash ? req.flash("success") : [];
  res.locals.error   = req.flash ? req.flash("error")   : [];

  const token = req.session?.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, jwtSecret);
      res.locals.currentUser = await User.findById(decoded.id).select("-password").lean();
    } catch {
      req.session.token = null; // expired — clear it
    }
  }
  next();
};

// Block logged-in users from /auth pages
exports.guestOnly = (req, res, next) => {
  if (req.session?.token) return res.redirect("/dashboard");
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
  if (res.locals.currentUser?.role !== "admin") {
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
