"""BRK Bevragen API client for property ownership data.

This module provides access to Kadaster's BRK (Basisregistratie Kadaster) Bevragen API
for fetching eigendomsdata (ownership information) on cadastral objects.

CRITICAL: Eigendomsdata must NEVER be cached or stored per Kadaster Tier 3 terms.
All data is returned directly to the caller for immediate display only.

Authentication: Requires mTLS (PKIOverheid client certificate) + API key.
Rate limiting: Conservative limits (2 concurrent, 200/hour) as this is a paid API.
"""

import logging
import ssl
from pathlib import Path

import httpx

from app.core.config import settings
from app.government_apis.base import GovernmentAPIError, handle_api_response
from app.government_apis.rate_limiter import brk_limiter

logger = logging.getLogger(__name__)


def _create_brk_ssl_context() -> ssl.SSLContext:
    """Create SSL context for BRK mTLS authentication.

    Returns:
        ssl.SSLContext: Configured SSL context with client certificate and CA bundle

    Raises:
        RuntimeError: If certificate or key files are missing
        ssl.SSLError: If certificate loading fails
    """
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)

    # Load CA bundle for server verification
    context.load_verify_locations(settings.BRK_CA_BUNDLE_PATH)

    # Load client certificate and private key for mTLS
    context.load_cert_chain(
        certfile=settings.BRK_CLIENT_CERT_PATH,
        keyfile=settings.BRK_CLIENT_KEY_PATH,
    )

    # Enforce strict certificate verification
    context.check_hostname = True
    context.verify_mode = ssl.CERT_REQUIRED

    return context


class BRKBevragenClient:
    """Client for Kadaster BRK Bevragen API (eigendomsdata).

    Provides access to property ownership and cadastral object data via mTLS:
    - Kadastraal object: Cadastral parcel details (geometry, area, municipality)
    - Eigendom: Ownership and rights data (eigenaren, zakelijke rechten)

    CRITICAL: This client NEVER caches or stores eigendomsdata (Kadaster Tier 3 terms).
    All data is returned directly to caller for immediate display only.

    Authentication: PKIOverheid mTLS certificate + X-Api-Key header
    Endpoint: https://api.brk.kadaster.nl/esd-eto/bevragen/v2
    """

    BASE_URL = "https://api.brk.kadaster.nl/esd-eto/bevragen/v2"

    def __init__(self) -> None:
        """Initialize BRK client with optional mTLS configuration.

        Gracefully handles missing configuration (logs warning, disables queries).
        Validates certificate file paths if configured.

        Raises:
            RuntimeError: If configured but certificate files are missing
        """
        # Check if BRK is configured
        self._configured = bool(
            settings.BRK_API_KEY
            and settings.BRK_CLIENT_CERT_PATH
            and settings.BRK_CLIENT_KEY_PATH
            and settings.BRK_CA_BUNDLE_PATH
        )

        if not self._configured:
            logger.warning(
                "BRK Bevragen not configured -- eigendomsdata queries disabled. "
                "Set BRK_API_KEY, BRK_CLIENT_CERT_PATH, BRK_CLIENT_KEY_PATH, "
                "and BRK_CA_BUNDLE_PATH to enable."
            )
            self._ssl_context = None
            return

        # Validate certificate file paths exist
        cert_path = Path(settings.BRK_CLIENT_CERT_PATH)
        key_path = Path(settings.BRK_CLIENT_KEY_PATH)
        ca_path = Path(settings.BRK_CA_BUNDLE_PATH)

        missing_files = []
        if not cert_path.exists():
            missing_files.append(f"Client certificate: {cert_path}")
        if not key_path.exists():
            missing_files.append(f"Client key: {key_path}")
        if not ca_path.exists():
            missing_files.append(f"CA bundle: {ca_path}")

        if missing_files:
            raise RuntimeError(
                "BRK configuration error - missing certificate files:\n"
                + "\n".join(f"  - {f}" for f in missing_files)
            )

        # Create SSL context for mTLS
        self._ssl_context = _create_brk_ssl_context()
        logger.info("BRK Bevragen client configured with mTLS authentication")

    @property
    def is_configured(self) -> bool:
        """Return True if BRK mTLS certificates and API key are configured."""
        return self._configured

    def create_client(self) -> httpx.AsyncClient:
        """Create httpx AsyncClient with mTLS SSL context.

        IMPORTANT: Caller must use as async context manager:
            async with brk_client.create_client() as client:
                data = await brk_client.get_eigendom(identificatie, client)

        Returns:
            httpx.AsyncClient: Configured client with mTLS support

        Raises:
            RuntimeError: If BRK is not configured
        """
        if not self._configured:
            raise RuntimeError(
                "BRK Bevragen not configured. Cannot create client without "
                "BRK_API_KEY and PKIOverheid certificates."
            )

        return httpx.AsyncClient(verify=self._ssl_context, timeout=30.0)

    async def get_kadastraal_object(
        self, identificatie: str, client: httpx.AsyncClient
    ) -> dict:
        """Fetch cadastral object details by identificatie.

        Args:
            identificatie: Kadaster object identificatie (e.g., "NL.IMKAD.KadastraalObject.12345")
            client: httpx AsyncClient created via create_client()

        Returns:
            dict: Cadastral object data (geometry, area, municipality, etc.)

        Raises:
            RuntimeError: If BRK is not configured
            GovernmentAPIError: If API request fails
        """
        if not self._configured:
            raise GovernmentAPIError(
                "brk-bevragen",
                "BRK not configured - cannot fetch kadastraal object",
            )

        async with brk_limiter:
            url = f"{self.BASE_URL}/kadastraalonroerendezaken/{identificatie}"
            headers = {
                "X-Api-Key": settings.BRK_API_KEY,
                "Accept-Crs": "epsg:28992",  # Dutch RD coordinate system
            }

            logger.info(f"BRK get_kadastraal_object: {identificatie}")
            response = await client.get(url, headers=headers)
            return handle_api_response(response, source="brk-bevragen")

    async def get_eigendom(
        self, identificatie: str, client: httpx.AsyncClient
    ) -> dict:
        """Fetch ownership and rights data for cadastral object.

        CRITICAL: NEVER cache or store this data (Kadaster Tier 3 never-store terms).
        Return directly to caller for immediate display only.

        Args:
            identificatie: Kadaster object identificatie (e.g., "NL.IMKAD.KadastraalObject.12345")
            client: httpx AsyncClient created via create_client()

        Returns:
            dict: Ownership data (eigenaren, zakelijke rechten) with expanded person details

        Raises:
            RuntimeError: If BRK is not configured
            GovernmentAPIError: If API request fails
        """
        if not self._configured:
            raise GovernmentAPIError(
                "brk-bevragen",
                "BRK not configured - cannot fetch eigendomsdata",
            )

        async with brk_limiter:
            url = f"{self.BASE_URL}/kadastraalonroerendezaken/{identificatie}/zakelijkegerechtigden"
            headers = {
                "X-Api-Key": settings.BRK_API_KEY,
                "Accept-Crs": "epsg:28992",  # Dutch RD coordinate system
            }
            params = {
                "expand": "true",  # Include person (owner) details in response
            }

            logger.info(f"BRK get_eigendom: {identificatie}")
            response = await client.get(url, headers=headers, params=params)
            return handle_api_response(response, source="brk-bevragen")

    async def get_hypotheken(
        self, identificatie: str, client: httpx.AsyncClient
    ) -> dict:
        """Fetch mortgage data for cadastral object.

        CRITICAL: NEVER cache or store this data (Kadaster Tier 3 never-store terms).

        Args:
            identificatie: Kadaster object identificatie
            client: httpx AsyncClient created via create_client()

        Returns:
            dict: Mortgage data (hypotheekhouder, bedrag, aard)
        """
        if not self._configured:
            raise GovernmentAPIError(
                "brk-bevragen",
                "BRK not configured - cannot fetch hypotheekdata",
            )

        async with brk_limiter:
            url = f"{self.BASE_URL}/kadastraalonroerendezaken/{identificatie}/hypotheken"
            headers = {
                "X-Api-Key": settings.BRK_API_KEY,
                "Accept-Crs": "epsg:28992",
            }

            logger.info(f"BRK get_hypotheken: {identificatie}")
            response = await client.get(url, headers=headers)
            return handle_api_response(response, source="brk-bevragen")

    async def get_beslagen(
        self, identificatie: str, client: httpx.AsyncClient
    ) -> dict:
        """Fetch seizure data for cadastral object.

        CRITICAL: NEVER cache or store this data (Kadaster Tier 3 never-store terms).

        Args:
            identificatie: Kadaster object identificatie
            client: httpx AsyncClient created via create_client()

        Returns:
            dict: Seizure data (aard, datum)
        """
        if not self._configured:
            raise GovernmentAPIError(
                "brk-bevragen",
                "BRK not configured - cannot fetch beslagdata",
            )

        async with brk_limiter:
            url = f"{self.BASE_URL}/kadastraalonroerendezaken/{identificatie}/beslagen"
            headers = {
                "X-Api-Key": settings.BRK_API_KEY,
                "Accept-Crs": "epsg:28992",
            }

            logger.info(f"BRK get_beslagen: {identificatie}")
            response = await client.get(url, headers=headers)
            return handle_api_response(response, source="brk-bevragen")


# Module-level singleton instance
# Gracefully handles missing configuration (logs warning, disables queries)
brk_client = BRKBevragenClient()
