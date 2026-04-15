# GI Smart — Phase 4

**Phase 4** adds monthly meal plans, a daily tracking system, performance optimizations, and deployment readiness.

## Quick Start

```bash
npm install
cp .env.example .env   # fill in your keys
npm run seed           # seed food data
npm run dev            # http://localhost:3000
```

## What's New

| Feature | Route |
|---|---|
| 7-day rotating monthly meal plan | `/meal-plan` |
| Daily tracking (meals + water + app-scored daily conclusion) | `/tracking` |
| 30-day history calendar | `/tracking` |
| Nutrition always visible on food detail | `/foods/:id` |
| Chatbot answers in bullet points | 💬 bubble |

## Deployment (Render)

### 1. MongoDB Atlas (required)

1. Create a cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. **Database Access:** add a user with read/write on your database.
3. **Network Access:** add `0.0.0.0/0` (all IPs) so Render can connect, or Render’s outbound IPs if you prefer a tighter rule.
4. **Connect** → Drivers → copy the **connection string** (replace `<password>` with your user’s password). Use a database name in the path, e.g. `...mongodb.net/gismart?retryWrites=true&w=majority`.

### 2. Push the repo to GitHub

Render deploys from GitHub, GitLab, or Bitbucket.

### 3. Create the web service on Render

**Option A — Blueprint (uses `render.yaml` in this repo)**  
[Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint** → connect the repo → apply. Then open the new service → **Environment** and add the **secret** variables below.

**Option B — Manual Web Service**  
**New** → **Web Service** → connect the repo → **Runtime:** Node → **Build command:** `npm install` → **Start command:** `npm start` → create. Add environment variables in the service **Environment** tab.

### 4. Environment variables (dashboard)

| Key | Value |
|-----|--------|
| `MONGODB_URI` | Your Atlas connection string (secret) |
| `JWT_SECRET` | Long random string, 32+ chars (secret) |
| `SESSION_SECRET` | Another long random string (secret) |
| `GROQ_API_KEY` | From [Groq Console](https://console.groq.com/) (secret) |
| `NODE_ENV` | `production` |
| `TRUST_PROXY` | `1` |
| `SESSION_COOKIE_SECURE` | `true` |

Render sets `PORT` automatically — do **not** override it unless you know you need to.

Optional: `ENFORCE_HTTPS=true` (redirect HTTP→HTTPS behind Render), `CLIENT_URL=https://your-app.onrender.com` if you need strict CORS for the API from another origin.

### 5. Seed the database (once)

After the first successful deploy, load food data into the **same** Atlas DB:

- **Render Shell** (service → **Shell**): run `node seed.js`,  
  **or**
- Locally: set `MONGODB_URI` to production in `.env` and run `npm run seed` (be careful not to wipe data you care about).

### 6. Verify

- Open `https://<your-service>.onrender.com/api/health` — should return JSON with `"success": true`.
- Sign up / log in and open **Dashboard** and **Meal plan**.

Auto-deploy: enabled by default on push to the connected branch. Free tier may **spin down** after idle; the first request can take ~30–60s.

More detail: [`docs/PHASE4_DOCUMENTATION.md`](docs/PHASE4_DOCUMENTATION.md) (sections 6–7).

## Environment Variables (local)

```
MONGODB_URI=mongodb+srv://...
JWT_SECRET=...
SESSION_SECRET=...
GROQ_API_KEY=...
NODE_ENV=development
PORT=3000
```

Production on Render: use the table above; `PORT` is usually provided by Render.

## Full Documentation

- [`docs/DOCUMENTATION.md`](docs/DOCUMENTATION.md) — architecture, features, env vars  
- [`docs/PHASE4_DOCUMENTATION.md`](docs/PHASE4_DOCUMENTATION.md) — Phase 4 details, deployment, limitations  
