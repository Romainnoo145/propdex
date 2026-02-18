"""FastAPI application entry point."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from arq import create_pool
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.auth.router import router as auth_router
from app.core.config import settings
from app.core.http_client import create_government_api_client
from app.jobs.worker import get_redis_settings
from app.middleware.rate_limit import limiter
from app.middleware.tenant import TenantContextMiddleware
from app.monitoring.router import router as monitoring_router
from app.projects.router import router as projects_router
from app.properties.router import router as properties_router
from app.reports.router import router as reports_router
from app.scans.router import router as scans_router
from app.users.router import router as users_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """
    FastAPI lifespan context manager for startup/shutdown.

    Startup: Creates shared httpx AsyncClient for government API requests
             and ARQ Redis pool for background job enqueueing.
    Shutdown: Closes the httpx client and ARQ pool to release connections.
    """
    # Startup: create shared HTTP client
    app.state.http_client = create_government_api_client()

    # Startup: create ARQ Redis pool for job enqueueing
    app.state.arq_pool = await create_pool(get_redis_settings())

    yield

    # Shutdown: close ARQ pool
    await app.state.arq_pool.close()

    # Shutdown: close HTTP client
    await app.state.http_client.aclose()


app = FastAPI(
    title="Propdex API",
    version="0.1.0",
    description="Property Intelligence Platform for Dutch Real Estate Developers",
    lifespan=lifespan,
)

# Add rate limiter to app state
app.state.limiter = limiter

# Configure CORS (must be first for proper request handling)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add tenant context middleware (after CORS)
app.add_middleware(TenantContextMiddleware)


# Custom rate limit exceeded handler
@app.exception_handler(RateLimitExceeded)
async def custom_rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Handle rate limit exceeded errors with custom response."""
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Too many requests. Please try again later.",
            "retry_after": 60,
        },
    )


# Include routers
app.include_router(auth_router)
app.include_router(properties_router)
app.include_router(reports_router)
app.include_router(projects_router)
app.include_router(scans_router)
app.include_router(monitoring_router)
app.include_router(users_router)


@app.get("/")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "propdex-api",
    }
