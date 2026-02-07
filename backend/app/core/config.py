"""Application configuration using pydantic-settings."""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Cache TTL configuration (in seconds)
CACHE_TTL = {
    "bag": 86400,           # 24 hours
    "kadaster": 604800,     # 7 days
    "bestemmingsplan": 7776000,  # 90 days
    "dso": 7776000,         # 90 days (zoning data changes rarely)
    "rce": 2592000,         # 30 days (monument status changes infrequently)
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
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/crmplus",
        description="Async PostgreSQL connection URL",
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
        default="noreply@crmplus.nl",
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

    # Government API Configuration
    BAG_API_KEY: str = Field(
        default="",
        description="BAG API key for Kadaster Individuele Bevragingen (register at lvbag.github.io)",
    )
    DSO_API_KEY: str = Field(
        default="",
        description="DSO Ruimtelijke Plannen API key (register at developer.omgevingswet.overheid.nl)",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS_ORIGINS string into a list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]


# Singleton settings instance
settings = Settings()
