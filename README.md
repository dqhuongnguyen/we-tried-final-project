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

See `docs/PHASE4_DOCUMENTATION.md` → Section 7 for full steps.

**Summary:**
1. Push to GitHub
2. New Web Service on Render → connect repo
3. Add env vars in Render dashboard
4. Deploy — auto-deploys on every push

## Environment Variables

```
MONGODB_URI=mongodb+srv://...
JWT_SECRET=...
SESSION_SECRET=...
GROQ_API_KEY=...
NODE_ENV=production
PORT=3000
```

Optional (production): `SESSION_COOKIE_SECURE=true`, `TRUST_PROXY=1`, `ENFORCE_HTTPS=true`, `CORS_ORIGINS` (comma-separated).

## Full Documentation

- [`docs/DOCUMENTATION.md`](docs/DOCUMENTATION.md) — architecture, features, env vars  
- [`docs/PHASE4_DOCUMENTATION.md`](docs/PHASE4_DOCUMENTATION.md) — Phase 4 details, deployment, limitations  
