"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.router import router as auth_router
from app.core.config import settings
from app.middleware.tenant import TenantContextMiddleware

app = FastAPI(
    title="CRM Plus API",
    version="0.1.0",
    description="Property Intelligence Platform for Dutch Real Estate Developers",
)

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

# Include routers
app.include_router(auth_router)


@app.get("/")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "crmplus-api",
    }
