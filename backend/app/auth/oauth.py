"""Google OAuth2 client configuration."""

import logging

from httpx import AsyncClient
from httpx_oauth.clients.google import GoogleOAuth2

from app.core.config import settings

logger = logging.getLogger(__name__)

# Initialize Google OAuth client if credentials are configured
google_oauth_client: GoogleOAuth2 | None = None

if settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET:
    google_oauth_client = GoogleOAuth2(
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
    )
    logger.info("Google OAuth client initialized")
else:
    logger.warning("Google OAuth not configured (missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET)")


async def get_google_user_info(access_token: str) -> dict:
    """
    Fetch user profile information from Google.

    Args:
        access_token: Google access token

    Returns:
        Dictionary with user info (email, name, google_id)

    Raises:
        HTTPException: If fetching user info fails
    """
    async with AsyncClient() as client:
        response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        response.raise_for_status()
        return response.json()
