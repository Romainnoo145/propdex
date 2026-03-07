"""CBS OData v3 crime data client for dataderden.cbs.nl (47018NED)."""

import logging

import httpx

from app.government_apis.base import GovernmentAPIError, retry_with_backoff
from app.government_apis.rate_limiter import cbs_crime_limiter

logger = logging.getLogger(__name__)

CRIME_BASE_URL = "https://dataderden.cbs.nl/ODataApi/odata/47018NED"
LATEST_PERIOD = "2024JJ00"

# Crime type codes (space-padded to 6 chars for OData v3 filter matching)
VERMOGENSDELICTEN_CODES = ["1.1.1 ", "1.1.2 ", "1.2.1 ", "1.2.2 ", "1.2.3 ", "1.2.4 ", "1.6.2 "]
VERNIELING_CODES = ["2.2.1 "]
GEWELD_CODES = ["1.4.3 ", "1.4.4 ", "1.4.5 ", "1.4.6 ", "1.4.7 "]
ALL_CRIME_CODES = ["0.0.0 "] + VERMOGENSDELICTEN_CODES + VERNIELING_CODES + GEWELD_CODES


def _pad_key(value: str, width: int) -> str:
    """Pad a key value with trailing spaces to fixed width for OData v3."""
    return value.ljust(width)


def _per_1000(count: int | None, inwoners: float | None) -> float | None:
    """Compute crimes per 1000 residents."""
    if count is None or inwoners is None or inwoners <= 0:
        return None
    return round(count / inwoners * 1000, 1)


class CbsCrimeClient:
    """Client for CBS crime data on dataderden.cbs.nl (OData v3).

    Queries dataset 47018NED (Geregistreerde misdrijven; soort misdrijf,
    wijk, buurt, jaarcijfers) for wijk-level crime statistics.

    This is a SEPARATE client from CBSODataClient because dataderden.cbs.nl
    uses OData v3 with different base URL, TypedDataSet entity, and
    space-padded keys.
    """

    @property
    def _headers(self) -> dict[str, str]:
        return {
            "Accept": "application/json",
            "User-Agent": "Propdex/1.0",
        }

    async def _resolve_wijk_key(
        self,
        client: httpx.AsyncClient,
        gemeente_code: str,
        wijk_naam: str,
    ) -> str | None:
        """Resolve wijk name to space-padded WijkenEnBuurten Key.

        Queries the WijkenEnBuurten entity with startswith filter on Key,
        then matches by Title (case-insensitive).

        Args:
            client: Async httpx client
            gemeente_code: CBS municipality code (e.g. '0983')
            wijk_naam: Name of the district/wijk

        Returns:
            Space-padded Key (10 chars, e.g. 'WK098311  ') or None
        """
        url = f"{CRIME_BASE_URL}/WijkenEnBuurten"
        params = {
            "$filter": f"startswith(Key, 'WK{gemeente_code}')",
            "$format": "json",
        }
        try:
            async with cbs_crime_limiter:
                response = await retry_with_backoff(
                    lambda: client.get(url, headers=self._headers, params=params, timeout=10.0),
                    source="cbs_crime",
                )
            if response.status_code == 200:
                results = response.json().get("value", [])
                wijk_lower = wijk_naam.lower()
                for record in results:
                    title = record.get("Title", "")
                    if wijk_lower in title.lower():
                        return record["Key"]
            else:
                logger.warning(
                    "CBS crime wijk lookup returned status %s for gemeente_code=%s",
                    response.status_code, gemeente_code,
                )
        except Exception as exc:
            logger.warning("CBS crime wijk lookup failed (non-fatal): %s", exc)
        return None

    async def get_crime_data(
        self,
        client: httpx.AsyncClient,
        gemeente_code: str,
        wijk_naam: str | None = None,
        inwoners: float | None = None,
    ) -> dict | None:
        """Fetch crime data for a wijk and compute per-1000 rates.

        Resolves wijk key, queries TypedDataSet for all crime codes in the
        latest period, aggregates subcategory counts, and computes per-1000
        rates using the provided inwoners count.

        Args:
            client: Async httpx client
            gemeente_code: CBS municipality code
            wijk_naam: Name of the district/wijk
            inwoners: Number of residents (from Kerncijfers demografie)

        Returns:
            Crime data dict or None if wijk not found / no data
        """
        if not wijk_naam:
            logger.warning("CBS crime lookup skipped: wijk_naam required")
            return None

        wijk_key = await self._resolve_wijk_key(client, gemeente_code, wijk_naam)
        if not wijk_key:
            logger.warning(
                "CBS crime: could not resolve wijk '%s' (gemeente_code=%s)",
                wijk_naam, gemeente_code,
            )
            return None

        # Build filter for all crime codes
        crime_filter = " or ".join(
            f"SoortMisdrijf eq '{code}'" for code in ALL_CRIME_CODES
        )
        url = f"{CRIME_BASE_URL}/TypedDataSet"
        params = {
            "$filter": (
                f"WijkenEnBuurten eq '{wijk_key}' and "
                f"Perioden eq '{_pad_key(LATEST_PERIOD, 8)}' and "
                f"({crime_filter})"
            ),
            "$format": "json",
        }

        try:
            async with cbs_crime_limiter:
                response = await retry_with_backoff(
                    lambda: client.get(url, headers=self._headers, params=params, timeout=15.0),
                    source="cbs_crime",
                )
        except Exception as exc:
            raise GovernmentAPIError(
                "cbs_crime", f"Failed to fetch crime data: {exc}"
            ) from exc

        if response.status_code != 200:
            raise GovernmentAPIError(
                "cbs_crime",
                f"Failed to fetch crime data: HTTP {response.status_code}",
                status_code=response.status_code,
            )

        rows = response.json().get("value", [])

        # Parse into code -> count dict
        crime_counts: dict[str, int | None] = {}
        for row in rows:
            code = row.get("SoortMisdrijf", "")
            count = row.get("GeregistreerdeMisdrijven_1")
            crime_counts[code] = int(count) if count is not None else None

        # Get totaal
        totaal = crime_counts.get("0.0.0 ")

        # Aggregate subcategories (sum non-None values, None if all None)
        def _sum_codes(codes: list[str]) -> int | None:
            vals = [crime_counts.get(c) for c in codes]
            non_none = [v for v in vals if v is not None]
            return sum(non_none) if non_none else None

        vermogensdelicten = _sum_codes(VERMOGENSDELICTEN_CODES)
        vernieling = _sum_codes(VERNIELING_CODES)
        geweld = _sum_codes(GEWELD_CODES)

        return {
            "bron": "CBS Politie dataderden OData v3",
            "dataset": "47018NED",
            "peiljaar": 2024,
            "totaal_misdrijven": totaal,
            "per_1000_inwoners": _per_1000(totaal, inwoners),
            "categorien": {
                "vermogensdelicten": {
                    "aantal": vermogensdelicten,
                    "per_1000": _per_1000(vermogensdelicten, inwoners),
                },
                "vernieling": {
                    "aantal": vernieling,
                    "per_1000": _per_1000(vernieling, inwoners),
                },
                "geweld": {
                    "aantal": geweld,
                    "per_1000": _per_1000(geweld, inwoners),
                },
            },
        }


cbs_crime_client = CbsCrimeClient()
