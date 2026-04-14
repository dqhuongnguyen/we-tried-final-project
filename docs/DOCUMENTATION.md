# GI Smart — Technical Documentation

**Product:** GI Smart — glycemic-aware nutrition and tracking  
**Version:** 4.x  
**Stack:** Node.js · Express · EJS · MongoDB (Mongoose) · JWT (in server session) · Groq (Llama) for AI features  

This document describes the **current** codebase. For deployment, performance tuning, and security testing notes, see [`PHASE4_DOCUMENTATION.md`](./PHASE4_DOCUMENTATION.md).

---

## 1. Architecture

| Layer | Role |
|--------|------|
| `app.js` | Express app: security middleware, sessions, JSON/urlencoded limits, static files, route mounting |
| `routes/*.js` | HTTP routing; web (EJS) vs `/api/*` REST |
| `controllers/*.js` | Request handling, `res.render` / `res.json` |
| `models/*.js` | Mongoose schemas |
| `services/mealPlanService.js` | Weekly AI meal plan: load, hydrate, TTL, cache |
| `middleware/webAuth.js` | `setLocals`, JWT from `req.session.token`, `requireLogin`, `requireAdmin` |
| `config/` | DB, secrets, security (Helmet, CORS, HTTPS redirect) |

**Auth model:** On login/register, a JWT is stored **only** in `express-session` (`req.session.token`). The browser gets an **httpOnly** session cookie. `setLocals` verifies the JWT and loads `User` into `res.locals.currentUser` for every request.

---

## 2. Main user-facing features

### Health profile (`/user/profile`)

- Collects age, gender, weight, height, activity, **goal**.
- **BMI** from weight and height; **TDEE** / daily calories from **Mifflin–St Jeor** × activity, then goal-specific rules.
- **Weight loss:** optional **goal weight (kg)** and **timeline (weeks)**; calorie target uses a deficit derived from kg to lose and duration, with safety caps (see `webUserController.js`).
- Saving the profile **clears** `weekly_meal_plan` so the next meal plan is regenerated.
- **Disclaimer:** `views/partials/health-disclaimer.ejs` on profile and tracking.

### Weekly meal plan (`/meal-plan`) & dashboard (`/dashboard`)

- AI (`utils/aiMealPlanner.js`, Groq) builds a **Monday–Sunday** JSON plan; stored on the user as `weekly_meal_plan` (summary + `generatedAt` + food ids per meal).
- **Session cache** avoids repeated DB hydration on the same visit.
- **Auto-refresh:** if the stored plan is **older than 7 days**, the next `ensureWeeklyMealPlan` call **regenerates** via AI (see `services/mealPlanService.js`).
- Dashboard shows **today’s** slice of that plan plus a link to the full weekly page.

### Tracking (`/tracking`)

- **Step 1:** Manual food log (search foods, portion, meal slot) for a selected date; **edit** and **remove** entries.
- **Step 2 (today):** Snapshot (calories vs goal, kcal-weighted GI, water), **app-derived** conclusion and recommendations, water slider + notes, **save** persists check-in and derives `met_targets` for the calendar.
- **30-day history** calendar uses stored `tracking_log` entries.

### Foods (`/foods`, `/foods/:id`)

- Public browse; admin can add/edit/delete via existing admin + food routes.

### Chatbot (`POST /api/chatbot/message`)

- Login required; rate-limited; uses Groq per `chatbotController`.

---

## 3. Views layout

```
views/
├── partials/
│   ├── header.ejs      # Nav, flash, opens <main class="container">
│   ├── footer.ejs
│   └── health-disclaimer.ejs
└── pages/
    ├── home.ejs, dashboard/index.ejs, meal-plan.ejs, tracking/index.ejs
    ├── user/profile.ejs
    ├── auth/login.ejs, register.ejs
    ├── foods*.ejs, food-detail.ejs
    └── admin/...
```

EJS uses `<%= %>` for escaped output (XSS-safe). Partials are included with `<%- include(...) %>`.

---

## 4. Environment variables

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | MongoDB connection string (Atlas) |
| `JWT_SECRET` | Signs JWTs |
| `SESSION_SECRET` | Signs session cookie (can match JWT secret in dev) |
| `GROQ_API_KEY` | Groq API for meal plan + chatbot |
| `PORT` | Listen port (default 3000) |
| `NODE_ENV` | `production` enables stricter caching, Helmet CSP, etc. |
| `CLIENT_URL` / `CORS_ORIGINS` | Allowed CORS origins in production |
| `SESSION_COOKIE_SECURE` | Set `true` when behind HTTPS |
| `TRUST_PROXY` | `1` when behind a reverse proxy (e.g. Render) |
| `ENFORCE_HTTPS` | Optional redirect to HTTPS |

Copy `.env.example` to `.env` and fill values.

---

## 5. API (REST)

Protected routes use **`Authorization: Bearer <JWT>`** via `middleware/auth.js` (`protect` / `authorize`). Web pages use the **session JWT** instead (see `middleware/webAuth.js`).

- **Auth:** `/api/auth/register`, `/api/auth/login`, `/api/auth/me`
- **Foods:** CRUD under `/api/foods`
- **Users:** profile, meal log under `/api/users`
- **Health:** `GET /api/health` (public)

See `routes/*.js` for the exact list.

---

## 6. Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | `nodemon app.js` |
| `npm start` | `node app.js` |
| `npm run seed` | Seed foods (`seed.js`) |
| `npm run test:security` | Security smoke tests (`tests/security.test.js`) |

---

## 7. Legal / product note

Automated calorie, GI, and BMI outputs are **wellness estimates**, not medical advice. The UI includes a short disclaimer on profile and tracking.
