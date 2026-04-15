const User = require("../models/User");
const jwt  = require("jsonwebtoken");
const { jwt: jwtSecret } = require("../config/secrets");

const signToken = (id) =>
  jwt.sign({ id: String(id) }, jwtSecret, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

// GET /auth/register
exports.registerForm = (req, res) =>
  res.render("pages/auth/register", { title: "Create Account" });

// POST /auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, password, confirm, goal } = req.body;

    if (!name || !email || !password) {
      req.flash("error", "All fields are required.");
      return res.redirect("/auth/register");
    }
    if (password !== confirm) {
      req.flash("error", "Passwords do not match.");
      return res.redirect("/auth/register");
    }
    if (password.length < 6) {
      req.flash("error", "Password must be at least 6 characters.");
      return res.redirect("/auth/register");
    }

    const existing = await User.findOne({ email });
    if (existing) {
      req.flash("error", "An account with that email already exists.");
      return res.redirect("/auth/register");
    }

    const user = await User.create({ name, email, password, goal: goal || "General Health" });
    req.session.token = signToken(user._id);
    req.session.save((err) => {
      if (err) {
        req.flash("error", "Could not start your session. Try again.");
        return res.redirect("/auth/register");
      }
      req.flash("success", `Welcome, ${user.name}! You're now logged in.`);
      res.redirect("/dashboard");
    });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/auth/register");
  }
};

// GET /auth/login
exports.loginForm = (req, res) =>
  res.render("pages/auth/login", { title: "Sign In" });

// POST /auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      req.flash("error", "Email and password are required.");
      return res.redirect("/auth/login");
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.matchPassword(password))) {
      req.flash("error", "Invalid email or password.");
      return res.redirect("/auth/login");
    }

    req.session.token = signToken(user._id);
    req.session.save((err) => {
      if (err) {
        req.flash("error", "Could not save your session. Try again.");
        return res.redirect("/auth/login");
      }
      req.flash("success", `Welcome back, ${user.name}!`);
      res.redirect(user.role === "admin" ? "/admin" : "/dashboard");
    });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/auth/login");
  }
};

// POST /auth/logout
exports.logout = (req, res) => {
  req.session.destroy(() => res.redirect("/"));
};
