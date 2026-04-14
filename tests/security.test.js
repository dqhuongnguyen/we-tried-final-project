/**
 * Security smoke tests: protected routes, API auth, input handling.
 * Run: npm test  (requires MongoDB reachable if routes touch DB; redirects do not.)
 */
"use strict";

process.env.NODE_ENV = "test";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../app");

describe("Session + JWT (web)", () => {
  test("GET /dashboard without session redirects to login", async () => {
    const res = await request(app).get("/dashboard").expect(302);
    assert.match(res.headers.location, /\/auth\/login/);
  });

  test("GET /tracking without session redirects to login", async () => {
    const res = await request(app).get("/tracking").expect(302);
    assert.match(res.headers.location, /\/auth\/login/);
  });

  test("GET /meal-plan without session redirects to login", async () => {
    const res = await request(app).get("/meal-plan").expect(302);
    assert.match(res.headers.location, /\/auth\/login/);
  });

  test("GET /admin without session redirects to login", async () => {
    const res = await request(app).get("/admin").expect(302);
    assert.match(res.headers.location, /\/auth\/login/);
  });
});

describe("API JWT / Bearer", () => {
  test("GET /api/auth/me without token returns 401", async () => {
    const res = await request(app).get("/api/auth/me").expect(401);
    assert.equal(res.body.success, false);
  });

  test("POST /api/foods without token returns 401", async () => {
    const res = await request(app)
      .post("/api/foods")
      .send({ name: "Test", category: "Grains", gi_value: 50 })
      .expect(401);
    assert.equal(res.body.success, false);
  });
});

describe("Input validation", () => {
  test("POST /api/auth/register with invalid email returns 400", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "A", email: "not-an-email", password: "123456" })
      .expect(400);
    assert.equal(res.body.success, false);
  });
});
