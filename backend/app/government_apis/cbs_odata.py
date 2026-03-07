"""CBS OData v4 API client for neighborhood statistics."""

import logging

import httpx

from app.core.config import settings
from app.government_apis.base import GovernmentAPIError, retry_with_backoff
from app.government_apis.rate_limiter import cbs_odata_limiter

logger = logging.getLogger(__name__)

BASE_URL = "https://datasets.cbs.nl/odata/v1/CBS"

# Measure codes for the 'Kerncijfers wijken en buurten' Observations entity
MEASURE_CODES: dict[str, str] = {
    # --- Core (v11.0) ---
    "woz": "M001642",            # Gemiddelde WOZ-waarde van woningen
    "stedelijkheid": "ST0001",   # Mate van stedelijkheid (1-5)
    "oad": "ST0003",             # Omgevingsadressendichtheid
    "inwoners": "T001036",       # Aantal inwoners
    "woningvoorraad": "M000297", # Woningvoorraad
    "koopwoningen": "1014800",   # Koopwoningen
    "huurwoningen": "1014850_2", # Huurwoningen totaal
    "dichtheid": "M000100",      # Bevolkingsdichtheid
    "inkomen": "M000223",        # Gemiddeld inkomen per inkomensontvanger
    # --- Age distribution (Phase 78) ---
    "leeftijd_0_14": "10680",    # % 0-14 jaar
    "leeftijd_15_24": "53050",   # % 15-24 jaar
    "leeftijd_25_44": "53310",   # % 25-44 jaar
    "leeftijd_45_64": "53715",   # % 45-64 jaar
    "leeftijd_65_plus": "80200", # % 65+ jaar
    # --- Households (Phase 78) ---
    "huishoudens_totaal": "1050010_2",       # Totaal aantal huishoudens
    "huishoudens_eenpersoons": "1050015",    # Eenpersoons huishoudens
    "huishoudens_zonder_kinderen": "1016040",  # Meerpersoonshuishoudens zonder kinderen
    "huishoudens_met_kinderen": "1016030",   # Huishoudens met kinderen
    "gem_huishoudensgrootte": "M000114",     # Gemiddelde huishoudensgrootte
    # --- Income extended (Phase 78) ---
    "inkomen_per_inwoner": "M000224",        # Gemiddeld inkomen per inwoner
    "inkomen_gestandaardiseerd": "M000222",  # Gemiddeld gestandaardiseerd huishoudinkomen
    # --- Income distribution (Phase 78) ---
    "inkomen_laagste_40_personen": "D000187",  # % personen in laagste 40% inkomens
    "inkomen_hoogste_20_personen": "D000185",  # % personen in hoogste 20% inkomens
}

# Reverse lookup: CBS code -> human key
_MEASURE_CODE_TO_KEY: dict[str, str] = {v: k for k, v in MEASURE_CODES.items()}

# Dataset ID -> reference year mapping
DATASET_PEILJAAR: dict[str, int] = {
    "85318NED": 2022,
    "85618NED": 2023,
    "85984NED": 2024,
    "86165NED": 2025,
}

# Stedelijkheid class -> description
STEDELIJKHEID_MAP: dict[int, str] = {
    1: "Zeer sterk stedelijk",
    2: "Sterk stedelijk",
    3: "Matig stedelijk",
    4: "Weinig stedelijk",
    5: "Niet stedelijk",
}


class CBSODataClient:
    """
    Client for CBS (Centraal Bureau voor de Statistiek) OData v4 API.

    Queries the 'Kerncijfers wijken en buurten' dataset for neighborhood
    quality metrics like average WOZ value, urban density, and demographics.

    Uses the v4 endpoint (datasets.cbs.nl/odata/v1/CBS) with the Observations
    entity and WijkenEnBuurtenCodes for region lookup. Dataset ID is configurable
    via Settings.cbs_dataset_id (env: CBS_DATASET_ID).
    """

    def __init__(self) -> None:
        self.dataset_id: str = settings.cbs_dataset_id
        self.peiljaar: int = DATASET_PEILJAAR.get(self.dataset_id, 2025)

    @property
    def _headers(self) -> dict[str, str]:
        """Headers for CBS API requests."""
        return {
            "Accept": "application/json",
            "User-Agent": "Propdex/1.0",
        }

    async def _resolve_wijk_identifier(
        self,
        client: httpx.AsyncClient,
        gemeente_code: str,
        wijk_naam: str,
    ) -> str | None:
        """
        Resolve a wijk name within a gemeente to a CBS WijkenEnBuurtenCodes Identifier.

        Uses startswith(Identifier, 'WK{gemeente_code}') to scope the lookup to the
        correct municipality, preventing ambiguous name-only matches across the country.

        Args:
            client: Async httpx client
            gemeente_code: CBS municipality code (e.g. '0363' for Amsterdam)
            wijk_naam: Name of the district/wijk (case-insensitive match)

        Returns:
            CBS Identifier string (e.g. 'WK036300') or None if not found
        """
        url = f"{BASE_URL}/{self.dataset_id}/WijkenEnBuurtenCodes"
        params = {
            "$filter": f"startswith(Identifier, 'WK{gemeente_code}')",
            "$top": 50,
        }
        try:
            async with cbs_odata_limiter:
                response = await retry_with_backoff(
                    lambda: client.get(url, headers=self._headers, params=params, timeout=10.0),
                    source="cbs",
                )
            if response.status_code == 200:
                results = response.json().get("value", [])
                wijk_lower = wijk_naam.lower()
                for record in results:
                    if wijk_lower in record.get("Title", "").lower():
                        return record["Identifier"]
            else:
                logger.warning(
                    "CBS wijk lookup returned status %s for gemeente_code=%s",
                    response.status_code, gemeente_code,
                )
        except Exception as exc:
            logger.warning("CBS wijk lookup failed (non-fatal): %s", exc)
        return None

    async def _resolve_gemeente_identifier(
        self,
        client: httpx.AsyncClient,
        gemeente_code: str,
    ) -> str | None:
        """
        Resolve a gemeente code to its CBS WijkenEnBuurtenCodes Identifier.

        Args:
            client: Async httpx client
            gemeente_code: CBS municipality code (e.g. '0363' for Amsterdam)

        Returns:
            CBS Identifier string (e.g. 'GM0363') or None if not found
        """
        url = f"{BASE_URL}/{self.dataset_id}/WijkenEnBuurtenCodes"
        params = {
            "$filter": f"startswith(Identifier, 'GM{gemeente_code}')",
            "$top": 1,
        }
        try:
            async with cbs_odata_limiter:
                response = await retry_with_backoff(
                    lambda: client.get(url, headers=self._headers, params=params, timeout=10.0),
                    source="cbs",
                )
            if response.status_code == 200:
                results = response.json().get("value", [])
                if results:
                    return results[0]["Identifier"]
            else:
                logger.warning(
                    "CBS gemeente lookup returned status %s for gemeente_code=%s",
                    response.status_code, gemeente_code,
                )
        except Exception as exc:
            logger.warning("CBS gemeente lookup failed (non-fatal): %s", exc)
        return None

    async def _fetch_observations(
        self,
        client: httpx.AsyncClient,
        region_identifier: str,
    ) -> dict[str, float | None]:
        """
        Fetch Observations for a region and return a dict keyed by human measure names.

        Only includes values where ValueAttribute is empty string (valid data).
        Cells with missing/suppressed data have a non-empty ValueAttribute.

        Args:
            client: Async httpx client
            region_identifier: CBS Identifier (e.g. 'WK036300' or 'GM0363')

        Returns:
            Dict mapping human keys (e.g. 'woz', 'inwoners') to float values or None

        Raises:
            GovernmentAPIError: If the HTTP request fails
        """
        url = f"{BASE_URL}/{self.dataset_id}/Observations"
        measure_filter = " or ".join(
            f"Measure eq '{code}'" for code in MEASURE_CODES.values()
        )
        params = {
            "$filter": (
                f"WijkenEnBuurten eq '{region_identifier}' and ({measure_filter})"
            ),
            "$select": "Measure,Value,ValueAttribute",
        }
        try:
            async with cbs_odata_limiter:
                response = await retry_with_backoff(
                    lambda: client.get(url, headers=self._headers, params=params, timeout=10.0),
                    source="cbs",
                )
        except Exception as exc:
            raise GovernmentAPIError(
                "cbs", f"Failed to fetch observations: {exc}"
            ) from exc

        if response.status_code != 200:
            raise GovernmentAPIError(
                "cbs",
                f"Failed to fetch observations: HTTP {response.status_code} from {url}",
                status_code=response.status_code,
            )

        observations = response.json().get("value", [])
        result: dict[str, float | None] = {}
        for obs in observations:
            measure_code = obs.get("Measure", "")
            human_key = _MEASURE_CODE_TO_KEY.get(measure_code)
            if human_key is None:
                continue
            # Only use the value if ValueAttribute is empty string (valid data point)
            value_attr = obs.get("ValueAttribute", "")
            if value_attr == "":
                raw = obs.get("Value")
                result[human_key] = float(raw) if raw is not None else None
            else:
                result[human_key] = None
        return result

    async def get_neighborhood_data(
        self,
        client: httpx.AsyncClient,
        gemeente_naam: str,
        wijk_naam: str | None = None,
        gemeente_code: str | None = None,
    ) -> dict | None:
        """
        Fetch neighborhood metrics for a given gemeente/wijk.

        Lookup strategy:
        1. If gemeente_code + wijk_naam: try wijk-level lookup (WK prefix)
        2. If no wijk found or no wijk_naam: try gemeente-level lookup (GM prefix)
        3. If no gemeente_code: cannot do safe lookup — log warning and return None

        Args:
            client: Async httpx client
            gemeente_naam: Name of municipality (used for logging only in v4)
            wijk_naam: Optional name of the district/wijk
            gemeente_code: CBS municipality code (required for safe lookup)

        Returns:
            dict: Structured metrics payload, or None if no data found
        """
        if not gemeente_code:
            logger.warning(
                "CBS lookup skipped: gemeente_code required for safe wijk/gemeente lookup "
                "(gemeente_naam='%s'). Cannot rely on name-only matching nationally.",
                gemeente_naam,
            )
            return None

        identifier: str | None = None

        # Try wijk-level first if wijk_naam is provided
        if wijk_naam:
            identifier = await self._resolve_wijk_identifier(client, gemeente_code, wijk_naam)
            if identifier:
                logger.info(
                    "CBS resolved wijk '%s' (gemeente_code=%s) -> %s",
                    wijk_naam, gemeente_code, identifier,
                )

        # Fall back to gemeente-level
        if not identifier:
            identifier = await self._resolve_gemeente_identifier(client, gemeente_code)
            if identifier:
                logger.info(
                    "CBS resolved gemeente (gemeente_code=%s) -> %s",
                    gemeente_code, identifier,
                )

        if not identifier:
            logger.warning(
                "CBS could not resolve any identifier for gemeente_code=%s wijk_naam='%s'",
                gemeente_code, wijk_naam,
            )
            return None

        data = await self._fetch_observations(client, identifier)

        # Build stedelijkheid value safely
        mvs_raw = data.get("stedelijkheid")
        mvs = int(mvs_raw) if mvs_raw is not None else None

        return {
            "bron": "CBS StatLine OData v4",
            "dataset": f"{self.dataset_id} - Kerncijfers wijken en buurten",
            "peiljaar": self.peiljaar,
            "data": {
                "gemiddelde_woz_waarde": data.get("woz"),
                "stedelijkheid": {
                    "klasse": mvs,
                    "omschrijving": STEDELIJKHEID_MAP.get(mvs, "Onbekend") if mvs is not None else "Onbekend",
                    "omgevingsadressendichtheid": data.get("oad"),
                },
                "demografie": {
                    "aantal_inwoners": data.get("inwoners"),
                    "percentage_huurwoningen": data.get("huurwoningen"),
                    "percentage_koopwoningen": data.get("koopwoningen"),
                },
                "bouwjaar_distributie": {
                    # v4 measure codes M008209/M008210 use a rolling 10-year window
                    # (not pre-2000/post-2000), so these fields are omitted to avoid
                    # misleading users with mislabelled data.
                    "percentage_bouwjaar_voor_2000": None,
                    "percentage_bouwjaar_vanaf_2000": None,
                },
                # Phase 78: Extended demographics & income
                "leeftijdsverdeling": {
                    "perc_0_14": data.get("leeftijd_0_14"),
                    "perc_15_24": data.get("leeftijd_15_24"),
                    "perc_25_44": data.get("leeftijd_25_44"),
                    "perc_45_64": data.get("leeftijd_45_64"),
                    "perc_65_plus": data.get("leeftijd_65_plus"),
                },
                "huishoudens": {
                    "totaal": data.get("huishoudens_totaal"),
                    "eenpersoons": data.get("huishoudens_eenpersoons"),
                    "zonder_kinderen": data.get("huishoudens_zonder_kinderen"),
                    "met_kinderen": data.get("huishoudens_met_kinderen"),
                    "gemiddelde_grootte": data.get("gem_huishoudensgrootte"),
                },
                "inkomen": {
                    "gem_per_ontvanger": data.get("inkomen"),
                    "gem_per_inwoner": data.get("inkomen_per_inwoner"),
                    "gem_gestandaardiseerd": data.get("inkomen_gestandaardiseerd"),
                    "perc_laagste_40": data.get("inkomen_laagste_40_personen"),
                    "perc_hoogste_20": data.get("inkomen_hoogste_20_personen"),
                },
            },
        }


cbs_client = CBSODataClient()
