# Smoke Test Results — Railway propdex-staging

> Last run: 2026-04-03

## Service Endpoints

| Endpoint | Method | Expected | Actual | Status |
|----------|--------|----------|--------|--------|
| `/api/health` | GET | 200 `{"status":"ok"}` | 200 `{"status":"ok","service":"propdex-api","environment":"production"}` | ✅ PASS |
| `/api/ready` | GET | 200 db=ok redis=ok | 200 `{"status":"ok","checks":{"database":"ok","redis":"ok"}}` | ✅ PASS |
| `/docs` | GET | 200 (Swagger UI) | 200 | ✅ PASS |
| `/auth/me` | GET | 401 (no credentials) | 401 `{"detail":"Could not validate credentials"}` | ✅ PASS |
| `/auth/login` | POST | Accessible | Route exists in OpenAPI | ✅ PASS |

## Infrastructure Checks

| Check | Result |
|-------|--------|
| PostGIS database connected | ✅ (ready endpoint reports database=ok) |
| Redis connected | ✅ (ready endpoint reports redis=ok) |
| API service running | ✅ (Uvicorn on port 8080) |
| Worker service | ⚠️ Shows only "Starting Container" — may be crashing silently on import |

## Custom Domain Configuration

### Railway Custom Domain

Custom domain `api.propdex.nl` registered on Railway:
- Domain ID: `3e0bc7eb-df72-41e1-a6b5-0b16133afaaa`
- Status: Awaiting DNS configuration
- Certificate: Validating ownership (will auto-provision after DNS)

### Required DNS Record (Siteground)

Add this CNAME record in Siteground DNS management for `propdex.nl`:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | `api` | `dejaqra8.up.railway.app` | 3600 |

This will make `api.propdex.nl` resolve to the Railway service.
Railway will auto-provision an SSL certificate once DNS propagates.

### Verification After DNS Setup

```bash
# Check DNS propagation
dig api.propdex.nl CNAME +short
# Expected: dejaqra8.up.railway.app.

# Test health endpoint
curl -sf https://api.propdex.nl/api/health
# Expected: {"status":"ok","service":"propdex-api","environment":"production"}

# Test readiness
curl -sf https://api.propdex.nl/api/ready
# Expected: {"status":"ok",...,"checks":{"database":"ok","redis":"ok"}}
```

## Railway URLs (Direct Access)

- **API**: `https://api-production-7f87.up.railway.app`
- **Worker**: `https://worker-production-3a858.up.railway.app` (internal only)

## Known Issues

1. **Worker service** shows only "Starting Container" in logs — likely crashing on startup before producing output. Needs investigation (possible import error in `app.jobs.worker`).
2. **Missing env vars**: ANTHROPIC_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, MAIL_USERNAME, MAIL_PASSWORD — non-critical for core functionality.
