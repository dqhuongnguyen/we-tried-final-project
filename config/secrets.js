/**
 * JWT signing/verification must use the same secret as express-session cookie signing is separate.
 * Set JWT_SECRET and SESSION_SECRET in production (can be the same strong value).
 */
module.exports = {
  jwt:
    process.env.JWT_SECRET ||
    process.env.SESSION_SECRET ||
    "gi-smart-dev-only-set-jwt-secret",
  session:
    process.env.SESSION_SECRET ||
    process.env.JWT_SECRET ||
    "gi-smart-dev-only-set-session-secret",
};
