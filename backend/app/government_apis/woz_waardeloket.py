"""WOZ Waardeloket API client for property valuation data.

This module provides access to the Kadaster WOZ Waardeloket public API for fetching
WOZ (Waardering Onroerende Zaken) property valuations by nummeraanduiding ID.

Authentication: None required (public endpoint).
Input: nummeraanduiding_id (NOT vbo_id — these are different BAG identifiers).

Three-state contract:
- Data found    -> return WOZData with low_confidence=True (always)
- Not found (404)    -> return None (no WOZ object for this address — normal)
- API error/unexpected format -> raise GovernmentAPIError (never silent None)

Note: low_confidence is always True because WOZ Waardeloket is a public display
endpoint, not the authoritative WOZ Bevragen API (which is municipality-only).

Rate limiting: woz_waardeloket_limiter (3 concurrent, 500/hour)
"""

import logging

import httpx

from app.government_apis.base import (
    APINotFoundError,
    GovernmentAPIError,
    handle_api_response,
    retry_with_backoff,
)
from app.government_apis.rate_limiter import woz_waardeloket_limiter
from app.schemas.woz import WOZData, WOZWaarde

logger = logging.getLogger(__name__)


class WOZWaardeloketClient:
    """Client for Kadaster WOZ Waardeloket API (property valuations).

    Fetches WOZ assessments for Dutch properties by nummeraanduiding ID.
    Returns WOZData(low_confidence=True) on success, None on 404,
    raises GovernmentAPIError on API errors or unexpected response format.

    IMPORTANT: low_confidence is always True (WOZ-04) — data is from public
    display endpoint, not the authoritative WOZ Bevragen API.

    Endpoint: https://api.kadaster.nl/lvwoz/wozwaardeloket-api/v1
    Auth: None (public endpoint)
    """

    BASE_URL = "https://api.kadaster.nl/lvwoz/wozwaardeloket-api/v1"

    async def get_by_nummeraanduiding_id(
        self, nummeraanduiding_id: str, client: httpx.AsyncClient
    ) -> WOZData | None:
        """Fetch WOZ valuation data by BAG nummeraanduiding ID.

        Args:
            nummeraanduiding_id: BAG nummeraanduiding ID (NOT vbo_id)
            client: httpx AsyncClient for making requests

        Returns:
            WOZData with low_confidence=True if WOZ object found.
            None if no WOZ object exists for this address (normal).

        Raises:
            GovernmentAPIError: On API errors, timeout, or unexpected response format.
        """
        url = f"{self.BASE_URL}/wozwaarde/nummeraanduiding/{nummeraanduiding_id}"
        logger.info("WOZ Waardeloket get_by_nummeraanduiding_id: %s", nummeraanduiding_id)

        try:
            async with woz_waardeloket_limiter:
                response = await retry_with_backoff(
                    lambda: client.get(url),
                    source="woz-waardeloket",
                )
            data = handle_api_response(response, source="woz-waardeloket")
        except APINotFoundError:
            # No WOZ object for this address — normal for some properties
            logger.info(
                "WOZ Waardeloket: no object found for nummeraanduiding %s",
                nummeraanduiding_id,
            )
            return None
        except httpx.TimeoutException as e:
            raise GovernmentAPIError("woz-waardeloket", "Request timed out") from e

        return _parse_woz_data(data, nummeraanduiding_id)


def _parse_woz_data(data: dict, nummeraanduiding_id: str) -> WOZData:
    """Map WOZ Waardeloket API response to WOZData schema.

    NOTE: Field names below are LOW confidence — WOZ Waardeloket response structure
    is based on public API docs only. Phase 53 executor should make a live test call
    and correct field names if the mapping produces None values.

    CRITICAL: Always raises GovernmentAPIError instead of returning None when
    required fields are missing (user decision from CONTEXT.md — WOZ-04).

    Args:
        data: Parsed JSON dict from WOZ Waardeloket API
        nummeraanduiding_id: ID used for the lookup (for error logging)

    Returns:
        WOZData with low_confidence=True and mapped fields

    Raises:
        GovernmentAPIError: If response is missing required fields (not silent None)
    """
    # LOW confidence field names — verify against live API response in Phase 53
    woz_objectnummer = data.get("wozObjectnummer")  # LOW confidence

    # Extract WOZ value list — may be nested under "wozWaarden" or similar key
    # LOW confidence: response structure is based on public API docs only
    waarden_raw: list[dict] = data.get("wozWaarden") or data.get("waarden") or []  # LOW confidence

    # Build WOZWaarde list from historical values
    waarden: list[WOZWaarde] = []
    for item in waarden_raw:
        waarden.append(
            WOZWaarde(
                vastgestelde_waarde=item.get("vastgesteldeWaarde"),  # LOW confidence
                peildatum=item.get("peildatum"),  # LOW confidence
                toestandspeildatum=item.get("toestandspeildatum"),  # LOW confidence
            )
        )

    # Identify the most recent valuation (highest peildatum)
    meest_recente_waarde: int | None = None
    meest_recente_peildatum: str | None = None

    if waarden:
        # Sort by peildatum descending and take the first
        sorted_waarden = sorted(
            [w for w in waarden if w.peildatum is not None],
            key=lambda w: w.peildatum or "",
            reverse=True,
        )
        if sorted_waarden:
            meest_recente_waarde = sorted_waarden[0].vastgestelde_waarde
            meest_recente_peildatum = sorted_waarden[0].peildatum

    # CRITICAL: Raise instead of silent None if required fields are missing (WOZ-04)
    # A 200 response without any value data is unexpected and should be monitored
    if not waarden and woz_objectnummer is None:
        logger.warning(
            "WOZ Waardeloket: unexpected response format for nummeraanduiding — "
            "missing required fields. Raw response: %s",
            data,
        )
        raise GovernmentAPIError(
            "woz-waardeloket",
            "Unexpected response format: missing required fields",
            status_code=200,
        )

    # Grondoppervlakte may be at top level or nested
    grondoppervlakte: int | None = data.get("grondoppervlakte")  # LOW confidence

    return WOZData(
        woz_objectnummer=woz_objectnummer,
        meest_recente_waarde=meest_recente_waarde,
        meest_recente_peildatum=meest_recente_peildatum,
        waarden=waarden,
        grondoppervlakte=grondoppervlakte,
        # Always set per WOZ-04 user decision
        low_confidence=True,
        low_confidence_reden="Bron: WOZ Waardeloket (indicatief)",
        bron="WOZ Waardeloket",
    )


# Module-level singleton
woz_waardeloket_client = WOZWaardeloketClient()
