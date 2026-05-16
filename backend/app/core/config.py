"""Application configuration using pydantic-settings."""

from pathlib import Path
from urllib.parse import urlparse
from uuid import UUID

from pydantic import Field, model_validator
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
        env_file=Path(__file__).resolve().parents[2] / ".env",
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
    ENVIRONMENT: str = Field(
        default="development",
        description="Application environment name (development, staging, production)",
    )
    SECRET_KEY: str = Field(
        default="CHANGE_ME_IN_PRODUCTION",
        description="Secret key for JWT token signing (MUST be changed in production)",
    )
    INTEGRATION_CREDENTIAL_KEY: str = Field(
        ...,
        description=(
            "Fernet symmetric key for integration_credentials encryption. "
            "Generate via Fernet.generate_key().decode(). MUST be urlsafe-b64 "
            "encoding of a 32-byte key."
        ),
    )
    INTEGRATION_CREDENTIAL_KEY_OLD: str | None = Field(
        default=None,
        description=(
            "Previous Fernet key during rotation. When set, MultiFernet "
            "decrypts via NEW first then OLD. Unset after re-encrypt script."
        ),
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
    COOKIE_SECURE: bool | None = Field(
        default=None,
        description="Override refresh cookie secure flag. Defaults to HTTPS-aware auto-detection.",
    )
    COOKIE_SAMESITE: str = Field(
        default="lax",
        description="Refresh cookie SameSite policy (lax, strict, none)",
    )
    COOKIE_DOMAIN: str = Field(
        default="",
        description="Optional cookie domain for auth refresh cookies",
    )
    AUTH_COOKIE_PATH: str = Field(
        default="/api/auth",
        description="Path scope for auth refresh cookies",
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
    AI_MODEL_CHAT: str | None = Field(
        default=None,
        description="Model ID for chat classifier (falls back to AI_MODEL if not set)",
    )
    GOOGLE_AI_API_KEY: str = Field(
        default="",
        description="Google AI API key for Gemini",
    )
    GEMINI_MODEL: str = Field(
        default="gemini-2.5-pro",
        description="Gemini model ID for agent chat",
    )
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis URL for ARQ task queue",
    )

    # Sentry / Observability
    SENTRY_DSN: str = Field(
        default="",
        description="Sentry DSN for error and performance monitoring (leave empty to disable)",
    )
    SENTRY_TRACES_SAMPLE_RATE: float = Field(
        default=0.2,
        ge=0.0,
        le=1.0,
        description="Sentry traces sample rate (0.0–1.0)",
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

    # M045 — Document model configuration
    VENDOR_ORG_ID: UUID | None = Field(
        default=None,
        description=(
            "Organization UUID of the Propdex vendor (Klarifai). Only users "
            "belonging to this org can upload policy_documents; the service "
            "layer auto-sets is_global=true on their uploads. Bootstrap: "
            "SELECT id FROM organizations WHERE name = 'Klarifai' LIMIT 1 "
            "and set VENDOR_ORG_ID=<uuid> in backend/.env. Required in "
            "non-development environments."
        ),
    )

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS_ORIGINS string into a list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @model_validator(mode="after")
    def _reject_default_secret_key(self) -> "Settings":
        """Reject the default SECRET_KEY in non-development environments."""
        if (
            self.SECRET_KEY == "CHANGE_ME_IN_PRODUCTION"
            and self.ENVIRONMENT not in ("development", "test", "testing")
        ):
            raise ValueError(
                f"SECRET_KEY must be changed from the default value in "
                f"'{self.ENVIRONMENT}' environment"
            )
        return self

    @model_validator(mode="after")
    def _require_vendor_org_id_in_production(self) -> "Settings":
        """Require VENDOR_ORG_ID outside development/test.

        M045 introduces policy_documents upload restricted to the vendor org.
        Missing this in production means the service layer guard cannot
        distinguish vendor uploads from customer uploads — fail loud instead.
        """
        if (
            self.VENDOR_ORG_ID is None
            and self.ENVIRONMENT not in ("development", "test", "testing")
        ):
            raise ValueError(
                f"VENDOR_ORG_ID must be set in '{self.ENVIRONMENT}' environment. "
                f"Run: SELECT id FROM organizations WHERE name = 'Klarifai' LIMIT 1"
            )
        return self

    @model_validator(mode="after")
    def _validate_integration_credential_key(self) -> "Settings":
        """Ensure INTEGRATION_CREDENTIAL_KEY (and OLD, if set) is a valid Fernet key.

        Fernet keys MUST be urlsafe-base64 encoding of exactly 32 bytes.
        Mirrors the spirit of _reject_default_secret_key but is stricter:
        Fernet itself crashes hard on malformed keys, so we fail at startup
        instead of at first encrypt/decrypt call.
        """
        from base64 import urlsafe_b64decode

        def _check(label: str, value: str) -> None:
            if value in ("", "changeme", "default", "CHANGE_ME_IN_PRODUCTION"):
                raise ValueError(
                    f"{label} must not be empty or a default sentinel value"
                )
            try:
                raw = urlsafe_b64decode(value.encode())
            except Exception as exc:
                raise ValueError(
                    f"{label} is not valid urlsafe-base64: {exc}"
                ) from exc
            if len(raw) != 32:
                raise ValueError(
                    f"{label} must decode to 32 bytes (got {len(raw)}) - "
                    f"Fernet requires a 32-byte key"
                )

        _check("INTEGRATION_CREDENTIAL_KEY", self.INTEGRATION_CREDENTIAL_KEY)
        if self.INTEGRATION_CREDENTIAL_KEY_OLD is not None:
            _check(
                "INTEGRATION_CREDENTIAL_KEY_OLD",
                self.INTEGRATION_CREDENTIAL_KEY_OLD,
            )
        return self

    @property
    def cookie_secure(self) -> bool:
        """Resolve secure-cookie behavior from env override or frontend URL."""
        if self.COOKIE_SECURE is not None:
            return self.COOKIE_SECURE
        return urlparse(self.FRONTEND_URL).scheme == "https"

    @property
    def cookie_samesite(self) -> str:
        """Normalize SameSite value to a safe allowed option."""
        value = self.COOKIE_SAMESITE.strip().lower()
        if value not in {"lax", "strict", "none"}:
            return "lax"
        return value

    @property
    def cookie_domain(self) -> str | None:
        """Return optional cookie domain if configured."""
        value = self.COOKIE_DOMAIN.strip()
        return value or None

    @property
    def auth_cookie_path(self) -> str:
        """Return a normalized auth cookie path."""
        path = self.AUTH_COOKIE_PATH.strip() or "/api/auth"
        return path if path.startswith("/") else f"/{path}"

    @property
    def migration_database_url(self) -> str:
        """Return migration URL, falling back to DATABASE_URL."""
        return self.MIGRATION_DATABASE_URL or self.DATABASE_URL


# Singleton settings instance
settings = Settings()
