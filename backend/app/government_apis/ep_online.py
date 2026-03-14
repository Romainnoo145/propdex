"""EP-Online V5 API client for energy label data.

This module provides access to the EP-Online (RVO) API for fetching registered
energy labels (energielabels) for Dutch properties by BAG VBO ID.

Authentication: Plain API key in Authorization header (EP_ONLINE_API_KEY setting).

Three-state contract:
- Data found    -> return EnergyLabel with is_geregistreerd=True
- Not registered (404) -> return EnergyLabel with is_geregistreerd=False (NRG-03)
- API error/timeout   -> raise GovernmentAPIError
- API unconfigured    -> return None (section hidden in UI)

Rate limiting: ep_online_limiter (3 concurrent, 500/hour)
"""

import logging
from datetime import datetime

import httpx

from app.core.config import settings
from app.government_apis.base import (
    APINotFoundError,
    GovernmentAPIError,
    handle_api_response,
    retry_with_backoff,
)
from app.government_apis.rate_limiter import ep_online_limiter
from app.schemas.energy_label import EnergyLabel

logger = logging.getLogger(__name__)


class EPOnlineClient:
    """Client for EP-Online V5 API (energielabels).

    Fetches registered energy labels for Dutch properties by BAG VBO ID.
    Returns EnergyLabel on success, EnergyLabel(is_geregistreerd=False) on 404,
    None when unconfigured, raises GovernmentAPIError on API errors.

    Endpoint: https://public.ep-online.nl/api/v5
    Auth: Bearer token (EP_ONLINE_API_KEY)
    """

    BASE_URL = "https://public.ep-online.nl/api/v5"

    def _is_configured(self) -> bool:
        """Check if EP_ONLINE_API_KEY is set."""
        return bool(settings.EP_ONLINE_API_KEY)

    @property
    def _headers(self) -> dict[str, str]:
        """Return auth headers for EP-Online API."""
        return {"Authorization": settings.EP_ONLINE_API_KEY}

    async def get_by_vbo_id(
        self, vbo_id: str, client: httpx.AsyncClient
    ) -> EnergyLabel | None:
        """Fetch energy label by BAG verblijfsobject ID.

        Args:
            vbo_id: BAG VBO ID (e.g., "0363010000000001")
            client: httpx AsyncClient for making requests

        Returns:
            EnergyLabel with is_geregistreerd=True if label found.
            EnergyLabel with is_geregistreerd=False if no label registered (NRG-03).
            None if EP_ONLINE_API_KEY is not configured (section hidden in UI).

        Raises:
            GovernmentAPIError: On API errors or timeout.
        """
        if not self._is_configured():
            logger.debug("EP-Online not configured, skipping energy label fetch")
            return None

        url = f"{self.BASE_URL}/PandEnergielabel/AdresseerbaarObject/{vbo_id}"
        logger.info("EP-Online get_by_vbo_id: %s", vbo_id)

        try:
            async with ep_online_limiter:
                response = await retry_with_backoff(
                    lambda: client.get(url, headers=self._headers),
                    source="ep-online",
                )
            data = handle_api_response(response, source="ep-online")
        except APINotFoundError:
            # 404 is normal for ~20-30% of properties (NRG-03)
            logger.info("EP-Online: no label registered for VBO %s", vbo_id)
            return EnergyLabel(
                is_geregistreerd=False,
                niet_geregistreerd_reden="Niet geregistreerd",
                bag_vbo_id=vbo_id,
            )
        except httpx.TimeoutException as e:
            raise GovernmentAPIError("ep-online", "Request timed out") from e

        # EP-Online may return a list of labels per VBO; take the first
        if isinstance(data, list):
            if not data:
                return EnergyLabel(
                    is_geregistreerd=False,
                    niet_geregistreerd_reden="Niet geregistreerd",
                    bag_vbo_id=vbo_id,
                )
            data = data[0]

        return _parse_energy_label(data, vbo_id)


def _parse_energy_label(data: dict, vbo_id: str) -> EnergyLabel:
    """Map EP-Online V5 API response to EnergyLabel schema.

    NOTE: All field names below are MEDIUM confidence — EP-Online field names
    are provisional based on swagger docs. Phase 53 executor should make a live
    test call and correct field names if the mapping produces None values.

    Args:
        data: Parsed JSON dict from EP-Online API
        vbo_id: BAG VBO ID used for the lookup (echoed back in model)

    Returns:
        EnergyLabel with is_geregistreerd=True and mapped fields
    """
    geldig_tot = data.get("Geldig_tot")

    # Compute is_geldig: compare geldig_tot date string to today
    is_geldig: bool | None = None
    if geldig_tot:
        try:
            # EP-Online returns ISO datetime: "2026-05-25T00:00:00"
            expiry = datetime.fromisoformat(geldig_tot)
            is_geldig = expiry > datetime.utcnow()
        except ValueError:
            logger.warning("EP-Online: could not parse Geldig_tot '%s'", geldig_tot)

    return EnergyLabel(
        energieklasse=data.get("Energieklasse"),
        registratie_datum=data.get("Registratiedatum"),
        geldig_tot=geldig_tot,
        is_geldig=is_geldig,
        berekenings_type=data.get("Berekeningstype"),
        soort_opname=data.get("Gebouwklasse"),
        opname_datum=data.get("Opnamedatum"),
        bag_vbo_id=vbo_id,
        is_geregistreerd=True,
    )


# Module-level singleton
ep_online_client = EPOnlineClient()
