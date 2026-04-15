# GI Smart — Phase 4 Documentation

**Version:** 4.0.0  
**Stack:** Node.js · Express · EJS · MongoDB Atlas · Mongoose · JWT (session) · Groq AI  

Phase 4 focuses on **meal planning**, **daily tracking**, **performance**, **security hardening**, and **deployment** readiness.

---

## Table of contents

1. [Feature summary (current behaviour)](#1-feature-summary-current-behaviour)
2. [Functional & security testing](#2-functional--security-testing)
3. [Backend optimizations](#3-backend-optimizations)
4. [Frontend & delivery](#4-frontend--delivery)
5. [Security](#5-security)
6. [Deployment (Render + Atlas)](#6-deployment-render--atlas)
7. [Post-deploy checks](#7-post-deploy-checks)
8. [Known limitations](#8-known-limitations)

---

## 1. Feature summary (current behaviour)

### Weekly AI meal plan

- Groq (`utils/aiMealPlanner.js`) returns a **7-day** JSON plan (Mon–Sun), with per-meal foods (from DB ids), tips, and a summary.
- Plan is stored on the user as `weekly_meal_plan` (includes `generatedAt`).
- **Session:** `req.session.weeklyMealPlan` caches the hydrated plan for the current visit.
- **Auto-refresh:** plans older than **7 days** (by `generatedAt`) are replaced on the next `ensureWeeklyMealPlan` call (e.g. opening **Dashboard** or **Meal plan**).
- **Profile save** clears `weekly_meal_plan` so the next load generates a new plan aligned with updated BMI/calories.

### Daily tracking (`/tracking`)

- Log foods with search, portion, meal type; **edit** and **remove** entries.
- **Today’s check-in:** water + notes; calories/GI from the log; **conclusion and recommendations** are rule-based (not LLM).
- **`met_targets`** (yes / partial / no) is **derived server-side** when saving (not manual radio buttons).
- **30-day** history grid and stats (e.g. on-target rate).

### Health profile

- **Calories:** TDEE from Mifflin–St Jeor × activity; goal-specific adjustments.
- **Weight loss:** goal weight + weeks → deficit from ~7,700 kcal/kg over the timeline, with caps (see `controllers/webUserController.js`).

### Legal copy

- `views/partials/health-disclaimer.ejs` — not medical advice (profile + tracking).

### Admin accounts

- **`role: "admin"`** (set in MongoDB) unlocks `/admin` and food CRUD web routes.
- **Consumer routes** (`/dashboard`, `/meal-plan`, `/tracking`, profile, etc.) redirect to **`/admin`** (`redirectAdminFromConsumer` in `middleware/webAuth.js`).
- **Chatbot widget** is not rendered for admins (`footer.ejs`).

---

## 2. Functional & security testing

Automated smoke tests: `npm run test:security` → `tests/security.test.js` (unauthenticated redirects, API 401/400). Requires a runnable app; MongoDB may be needed for some paths depending on setup.

**Manual checks** (recommended before demos):

| Area | Check |
|------|--------|
| Auth | `/dashboard`, `/tracking`, `/meal-plan` redirect to login when logged out |
| API | `POST /api/foods` without JWT → 401 |
| Profile | Save profile → meal plan regenerates on next visit |
| Tracking | Save check-in → flash success, calendar updates |
| Admin | Non-admin → 403 on `/admin` |

---

## 3. Backend optimizations

### MongoDB indexes

**Food** (`models/Food.js`): compound `gi_tier` + `gi_value`, `category` + `gi_tier`, text index on `name`/`tags`/`notes`, `is_featured`.

**User** (`models/User.js`): `email`, `tracking_log.date`.

### Queries

- `Promise.all` for parallel counts/fetches where used in food listing.
- `.lean()` on read-only user/food loads where appropriate.
- AI food pool capped (e.g. **60** foods) before the Groq meal-plan call.

### Meal plan service

- **TTL:** `PLAN_MAX_AGE_MS` (7 days) in `services/mealPlanService.js`.
- **Hydration:** stored ids → live `Food` documents for rendering.

---

## 4. Frontend & delivery

- **`compression`** — gzip responses.
- **Static files:** `maxAge: 7d` in production (`app.js`).
- **Pagination** on food lists / admin tables where implemented (reduces payload size).

---

## 5. Security

- **Helmet** (`config/security.js`), **CORS** (strict in production when origins set), optional **HTTPS redirect** (`ENFORCE_HTTPS`).
- **`express-mongo-sanitize`**, JSON body limit (**10kb**), rate limits on `/api` and stricter on `/api/chatbot`.
- **Session cookie:** `httpOnly`, `sameSite: lax`, `secure` when `SESSION_COOKIE_SECURE=true` (use behind HTTPS).
- **Trust proxy:** `TRUST_PROXY=1` when deployed behind Render/nginx so rate limits and HTTPS behave correctly.
- **Passwords:** bcrypt (schema pre-save).

---

## 6. Deployment (Render + Atlas)

1. **Atlas:** cluster, database user, network access (e.g. `0.0.0.0/0` for PaaS), connection string.
2. **GitHub:** push this repo.
3. **Render:** New Web Service → connect repo; **Build** `npm install`; **Start** `node app.js`.
4. **Environment variables** (minimum):

   | Key | Notes |
   |-----|--------|
   | `MONGODB_URI` | Atlas connection string |
   | `JWT_SECRET` | Long random string |
   | `SESSION_SECRET` | Long random string |
   | `GROQ_API_KEY` | From [Groq Console](https://console.groq.com/) |
   | `NODE_ENV` | `production` |
   | `PORT` | Often set by Render automatically |
   | `SESSION_COOKIE_SECURE` | `true` if HTTPS |
   | `TRUST_PROXY` | `1` on Render |

5. **Seed:** run `node seed.js` once (Render shell or local pointed at production DB — be careful).

6. **CORS:** set `CLIENT_URL` or `CORS_ORIGINS` to your public site URL if the browser calls the API from another origin.

---

## 7. Post-deploy checks

- `GET /api/health` → `{ "success": true, "version": "4.0.0", ... }`
- Log in, open **Dashboard** and **Tracking**; confirm no 500s.
- Confirm **meal plan** loads or shows a clear error if `GROQ_API_KEY` is missing/invalid.

---

## 8. Known limitations

| Topic | Detail |
|-------|--------|
| **Free Render** | Cold starts; first request after sleep can be slow. |
| **Groq** | Rate limits; malformed JSON from the model is possible — errors should surface in logs/UI flash. |
| **Meal plan refresh** | Regenerates on **visit** after 7 days, not on a cron; first hit may wait for AI. |
| **Tracking water goal** | Fixed default (e.g. 2.5 L) in tracking logic unless you extend profile. |
| **Tests** | `npm test` script may need explicit file glob; use `npm run test:security` for the smoke file. |
| **Nutrition gaps** | Some foods may lack macros; UI shows placeholders where applicable. |

---

*Last aligned with codebase structure and behaviour as of Phase 4 maintenance docs rewrite.*
