# DNS Configuration — propdex.nl

DNS is managed in **Siteground**. Add these records to connect propdex.nl to Vercel (frontend) and api.propdex.nl to Railway (backend).

## Frontend: propdex.nl → Vercel

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `propdex.nl` (or `@`) | `76.76.21.21` | 3600 |
| A | `www` | `76.76.21.21` | 3600 |

Both `propdex.nl` and `www.propdex.nl` are registered on the Vercel project "frontend". Vercel handles HTTPS certificates automatically once DNS propagates.

## Backend API: api.propdex.nl → Railway

| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | `api` | `dejaqra8.up.railway.app` | 3600 |

The custom domain `api.propdex.nl` is registered on the Railway "api" service. Railway handles HTTPS certificates automatically.

## Verification

After adding DNS records, allow 5–30 minutes for propagation. Verify with:

```bash
# Frontend
curl -sf https://propdex.nl | head -5

# Backend API (through Vercel proxy)
curl -sf https://propdex.nl/api/health

# Backend API (direct)
curl -sf https://api.propdex.nl/api/health
```

## Current Deployment URLs (before DNS propagation)

- **Frontend (Vercel):** https://frontend-beige-nine-30.vercel.app
- **Backend (Railway):** https://api-production-7f87.up.railway.app

## Notes

- Vercel rewrites in `vercel.json` proxy `/api/*` requests to the Railway backend. This means most API traffic goes through `propdex.nl/api/*` (same-origin), not directly to `api.propdex.nl`.
- The `api.propdex.nl` direct domain is useful for health checks, debugging, and any future direct-access needs.
- CORS_ORIGINS on Railway is set to `https://propdex.nl` for defense-in-depth.
