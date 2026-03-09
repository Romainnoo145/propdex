"""Application configuration using pydantic-settings."""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Cache TTL configuration (in seconds)
CACHE_TTL = {
    "ai_parsed": 7776000,   # 90 days (parsed plan data reused across addresses)
    "bag": 86400,           # 24 hours
    "bestemmingsplan": 7776000,  # 90 days
    "dso": 7776000,         # 90 days (zoning data changes rarely)
    "ep_online": 2592000,   # 30 days (energielabels change infrequently)
    "kadaster": 604800,     # 7 days
    "rce": 2592000,         # 30 days (monument status changes infrequently)
    "rce_detail": 2592000,  # 30 days (monument descriptions are stable)
    "woz": 31536000,        # 365 days (WOZ values set once per year on Jan 1)
    "bodemloket": 2592000,  # 30 days (soil contamination status changes rarely)
    "bag_3d": 604800,       # 7 days (3D BAG updated quarterly)
    "cbs": 2592000,         # 30 days (CBS data updates annually)
    "ai_juridisch": 604800, # 7 days (AI jurisprudence analysis)
    "bro_bodemkaart": 31536000,        # 365 days (soil map updated ~every 5 years)
    "pdok_funderingsrisico": 15552000,  # 180 days (dataset updated ~annually)
    # NOTE: "brk" intentionally absent — BRK data is never cached (Kadaster Tier 3 terms)
}


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Database
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/propdex",
        description="Async PostgreSQL connection URL",
    )
    MIGRATION_DATABASE_URL: str = Field(
        default="",
        description="Superuser database URL for Alembic migrations (falls back to DATABASE_URL if empty)",
    )

    # JWT Configuration
    SECRET_KEY: str = Field(
        default="CHANGE_ME_IN_PRODUCTION",
        description="Secret key for JWT token signing (MUST be changed in production)",
    )
    ALGORITHM: str = Field(
        default="HS256",
        description="JWT signing algorithm",
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=15,
        description="Access token expiration time in minutes",
    )
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(
        default=7,
        description="Refresh token expiration time in days",
    )

    # OAuth Configuration
    GOOGLE_CLIENT_ID: str = Field(
        default="",
        description="Google OAuth client ID (leave empty to disable Google auth)",
    )
    GOOGLE_CLIENT_SECRET: str = Field(
        default="",
        description="Google OAuth client secret",
    )

    # Email Configuration
    MAIL_USERNAME: str = Field(
        default="",
        description="SMTP username for sending emails",
    )
    MAIL_PASSWORD: str = Field(
        default="",
        description="SMTP password",
    )
    MAIL_FROM: str = Field(
        default="noreply@propdex.nl",
        description="Default sender email address",
    )
    MAIL_SERVER: str = Field(
        default="localhost",
        description="SMTP server hostname",
    )
    MAIL_PORT: int = Field(
        default=587,
        description="SMTP server port (587 for TLS, 465 for SSL)",
    )

    # Frontend Configuration
    FRONTEND_URL: str = Field(
        default="http://localhost:9300",
        description="Frontend URL for CORS and email links",
    )
    CORS_ORIGINS: str = Field(
        default="http://localhost:9300",
        description="Allowed CORS origins (comma-separated in env)",
    )

    # Freshness Configuration
    MIN_FRESHNESS_THRESHOLD_HOURS: int = Field(
        default=1,
        ge=1,
        description="Minimum freshness threshold in hours to prevent external API abuse (BAG, PDOK, DSO, RCE)",
    )

    # Government API Configuration
    BAG_API_KEY: str = Field(
        default="",
        description="BAG API key for Kadaster Individuele Bevragingen (register at lvbag.github.io)",
    )
    DSO_API_KEY: str = Field(
        default="",
        description="DSO Ruimtelijke Plannen API key (register at developer.omgevingswet.overheid.nl)",
    )
    EP_ONLINE_API_KEY: str = Field(
        default="",
        description="EP-Online API key for energy label lookup (register at public.ep-online.nl)",
    )
    RUIMTELIJKE_PLANNEN_API_KEY: str = Field(
        default="",
        description="Ruimtelijke Plannen API key for extended plan data (teksten, functieaanduidingen)",
    )
    BRK_API_KEY: str = Field(
        default="",
        description="Kadaster BRK Bevragen API key",
    )
    BRK_CLIENT_CERT_PATH: str = Field(
        default="",
        description="Path to PKIOverheid client certificate for BRK mTLS",
    )
    BRK_CLIENT_KEY_PATH: str = Field(
        default="",
        description="Path to PKIOverheid private key for BRK mTLS",
    )
    BRK_CA_BUNDLE_PATH: str = Field(
        default="",
        description="Path to PKIOverheid CA bundle for BRK server verification",
    )

    # 3D BAG (TU Delft) — HTTP Basic Auth for building height/floor data
    BAG_3D_USERNAME: str = Field(
        default="",
        description="3D BAG username for HTTP Basic Auth (register at 3dbag.nl — free)",
    )
    BAG_3D_PASSWORD: str = Field(
        default="",
        description="3D BAG password for HTTP Basic Auth (register at 3dbag.nl — free)",
    )

    # AI Configuration
    ANTHROPIC_API_KEY: str = Field(
        default="",
        description="Anthropic API key for Claude AI parsing (direct Anthropic)",
    )
    OPENROUTER_API_KEY: str = Field(
        default="",
        description="OpenRouter API key (alternative to direct Anthropic)",
    )
    AI_MODEL: str = Field(
        default="claude-sonnet-4-5-20250929",
        description="Model ID for AI analysis (Anthropic or OpenRouter model ID)",
    )
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis URL for ARQ task queue",
    )

    # Tile Server Configuration
    MARTIN_TILE_URL: str = Field(
        default="http://localhost:3000",
        description="Martin tile server URL (optional, PostGIS ST_AsMVT is primary tile path)",
    )

    # CBS Configuration
    cbs_dataset_id: str = Field(
        default="86165NED",
        description=(
            "CBS Kerncijfers wijken en buurten dataset ID. "
            "Annual series: 2022=85318NED, 2023=85618NED, 2024=85984NED, 2025=86165NED. "
            "Update when CBS publishes new annual dataset (typically Q2 each year)."
        ),
    )

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS_ORIGINS string into a list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    @property
    def migration_database_url(self) -> str:
        """Return migration URL, falling back to DATABASE_URL."""
        return self.MIGRATION_DATABASE_URL or self.DATABASE_URL


# Singleton settings instance
settings = Settings()
