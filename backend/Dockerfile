# ---- Build stage ----
FROM python:3.11-slim-bookworm AS builder

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1

# Install build-time system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    # asyncpg
    libpq-dev \
    # GeoAlchemy2 / Shapely / pyproj
    libgdal-dev \
    libgeos-dev \
    libproj-dev \
    # lxml
    libxml2-dev \
    libxslt1-dev \
    # WeasyPrint (cairo/pango)
    libcairo2-dev \
    libpango1.0-dev \
    libgdk-pixbuf2.0-dev \
    libffi-dev \
    # build tooling
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Install uv (fast Python package manager)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY pyproject.toml uv.lock ./

# Install production dependencies into a virtual-env at /app/.venv
RUN uv sync --frozen --no-dev --no-install-project

# ---- Runtime stage ----
FROM python:3.11-slim-bookworm AS runtime

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install runtime-only system libraries (no -dev headers)
RUN apt-get update && apt-get install -y --no-install-recommends \
    # asyncpg
    libpq5 \
    # GeoAlchemy2 / Shapely / pyproj
    libgdal32 \
    libgeos3.11.1 \
    libproj25 \
    # lxml
    libxml2 \
    libxslt1.1 \
    # WeasyPrint runtime
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libffi8 \
    # WeasyPrint font rendering
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy virtual-env from build stage
COPY --from=builder /app/.venv /app/.venv

# Put the venv on PATH so python / pip resolve from it
ENV PATH="/app/.venv/bin:$PATH" \
    VIRTUAL_ENV="/app/.venv"

# Copy application source
COPY app/ ./app/
COPY scripts/ ./scripts/
COPY alembic/ ./alembic/ 
COPY alembic.ini ./

# Make scripts executable
RUN chmod +x scripts/*.sh

# Railway injects PORT at runtime
EXPOSE ${PORT:-8000}

# APP_MODE selects the start script: "web" (default) or "worker"
ENV APP_MODE=web

# Entrypoint dispatches based on APP_MODE
CMD ["bash", "-c", "if [ \"$APP_MODE\" = 'worker' ]; then exec bash scripts/start_worker.sh; else exec bash scripts/start_web.sh; fi"]
