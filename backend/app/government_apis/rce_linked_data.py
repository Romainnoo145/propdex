"""RCE Linked Data client for detailed monument information.

Fetches rich monument detail (redengevende omschrijving, oorspronkelijke functie,
bouwperiode, architect, bouwstijl) by rijksmonumentnummer from the RCE Linked Data API.

This client enriches existing monument data already detected via PDOK spatial search.
The JSON-LD response format requires specialized parsing with namespace URI keys.

Three-state contract:
- Data found -> return RCEMonumentDetail (with as many fields as available)
- Not found in API (404/empty) -> return None (PDOK match still confirms monument)
- API error/timeout -> raise GovernmentAPIError
"""

from __future__ import annotations

import logging

import httpx

from app.government_apis.base import (
    APINotFoundError,
    GovernmentAPIError,
    handle_api_response,
    retry_with_backoff,
)
from app.government_apis.rate_limiter import rce_detail_limiter
from app.schemas.monument import RCEMonumentDetail

logger = logging.getLogger(__name__)

# CEO ontology namespace — all RCE Linked Data predicates use this prefix
CEO_NS = "https://linkeddata.cultureelerfgoed.nl/def/ceo#"

# REST API endpoint — returns basic fields + cultuurhistorischObjectnummer (no detail)
REST_API_URL = "https://api.linkeddata.cultureelerfgoed.nl/queries/rce/rest-api-rijksmonumenten/run"

# Dereference URL template — fetches full CEO ontology representation with detail fields
DEREFERENCE_URL = "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/rijksmonument/{chn}"

# SPARQL endpoint — fallback for detail fields when dereference fails
SPARQL_URL = "https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/cho-kennis/services/cho-kennis/sparql"

# Monumentenregister URL for linking to official register entry
REGISTER_URL = "https://monumentenregister.cultureelerfgoed.nl/monumenten/{nr}"


# --- JSON-LD Parsing Helpers ---


def _find_node_by_type(nodes: list[dict], type_suffix: str) -> dict | None:
    """Find a node in JSON-LD graph by type URI suffix."""
    for node in nodes:
        types = node.get("@type", [])
        if any(type_suffix in t for t in types):
            return node
    return None


def _get_literal(node: dict, predicate: str) -> str | None:
    """Extract @value from a JSON-LD predicate. Uses CEO_NS prefix."""
    values = node.get(CEO_NS + predicate, [])
    return values[0].get("@value") if values else None


def _get_all_literals(node: dict, predicate: str) -> list[str]:
    """Extract all @value entries for a multi-valued predicate."""
    values = node.get(CEO_NS + predicate, [])
    return [v.get("@value") for v in values if "@value" in v]


def _get_uri_label(node: dict, predicate: str) -> str | None:
    """Extract last path segment from a URI value and convert to Dutch label."""
    values = node.get(CEO_NS + predicate, [])
    if not values:
        return None
    uri_value = values[0].get("@id") or values[0].get("@value")
    if not uri_value:
        return None
    return _resolve_uri_to_label(uri_value)


def _resolve_uri_to_label(uri: str) -> str:
    """Convert RCE URI to human-readable Dutch label.

    Examples:
        'https://.../id/functie/woonhuis' -> 'Woonhuis'
        'https://.../id/bouwstijl/neoclassicisme' -> 'Neoclassicisme'
    """
    # Extract last non-empty path segment
    parts = [p for p in uri.rstrip("/").split("/") if p]
    if not parts:
        return uri
    label = parts[-1]
    # Replace hyphens/underscores with spaces and capitalize
    label = label.replace("-", " ").replace("_", " ")
    return label.capitalize()


class RCELinkedDataClient:
    """Client for RCE Linked Data API — monument detail by rijksmonumentnummer.

    Uses a two-step fetch strategy + SPARQL fallback:
    1. REST API query -> get cultuurhistorischObjectnummer
    2. Dereference the monument resource -> get full CEO ontology detail
    3. SPARQL fallback -> if dereference lacks detail fields

    Gracefully degrades to basic-fields-only when detail unavailable.
    """

    async def get_detail_by_monument_number(
        self,
        rijksmonumentnummer: str,
        client: httpx.AsyncClient,
    ) -> RCEMonumentDetail | None:
        """Fetch monument detail by rijksmonumentnummer.

        Args:
            rijksmonumentnummer: RCE monument registration number
            client: httpx AsyncClient for connection pooling

        Returns:
            RCEMonumentDetail with available fields, or None if not in Linked Data API.

        Raises:
            GovernmentAPIError: On timeout or unexpected API error.
        """
        async with rce_detail_limiter:
            logger.info("RCE Linked Data: fetching detail for monument %s", rijksmonumentnummer)
            try:
                return await self._fetch_detail(rijksmonumentnummer, client)
            except APINotFoundError:
                logger.info(
                    "RCE Linked Data: monument %s not found in Linked Data API",
                    rijksmonumentnummer,
                )
                return None
            except httpx.TimeoutException as e:
                raise GovernmentAPIError(
                    "rce-linked-data", "Request timed out"
                ) from e

    async def _fetch_detail(
        self,
        rijksmonumentnummer: str,
        client: httpx.AsyncClient,
    ) -> RCEMonumentDetail | None:
        """Internal fetch: REST API + dereference + SPARQL fallback."""
        # Step 1: REST API query — get basic fields + cultuurhistorischObjectnummer
        response = await retry_with_backoff(
            lambda: client.get(
                REST_API_URL,
                params={"rijksmonumentnummer": rijksmonumentnummer},
                headers={"Accept": "application/ld+json"},
                timeout=30.0,
            ),
            source="rce-linked-data",
        )
        data = handle_api_response(response, source="rce-linked-data")
        nodes: list[dict] = data if isinstance(data, list) else data.get("@graph", [])

        monument_node = _find_node_by_type(nodes, "Rijksmonument")
        if not monument_node:
            return None

        # Extract basic fields from Step 1
        chn = _get_literal(monument_node, "cultuurhistorischObjectnummer")

        if not chn:
            logger.warning(
                "RCE Linked Data: no cultuurhistorischObjectnummer for monument %s",
                rijksmonumentnummer,
            )
            return RCEMonumentDetail(
                rijksmonumentnummer=rijksmonumentnummer,
                monument_register_url=REGISTER_URL.format(nr=rijksmonumentnummer),
            )

        # Step 2: Dereference the monument resource for full detail
        detail_fields = await self._dereference_monument(chn, client)

        # Step 3: SPARQL fallback if dereference returned no detail fields
        has_detail = any(
            v is not None
            for v in [
                detail_fields.get("redengevende_omschrijving"),
                detail_fields.get("oorspronkelijke_functie"),
                detail_fields.get("bouwjaar_van"),
            ]
        )
        if not has_detail:
            logger.info(
                "RCE Linked Data: dereference returned no detail fields for monument %s, trying SPARQL",
                rijksmonumentnummer,
            )
            sparql_fields = await self._sparql_fallback(rijksmonumentnummer, client)
            detail_fields.update({k: v for k, v in sparql_fields.items() if v is not None})

        # Check if we got any detail after SPARQL fallback
        has_detail_final = any(
            v is not None
            for v in [
                detail_fields.get("redengevende_omschrijving"),
                detail_fields.get("oorspronkelijke_functie"),
                detail_fields.get("bouwjaar_van"),
            ]
        )
        if not has_detail_final:
            # RCE-03 partially undeliverable for this monument via both dereference and SPARQL
            logger.warning(
                "RCE detail fields unavailable for monument %s via both dereference and SPARQL",
                rijksmonumentnummer,
            )

        logger.info(
            "RCE Linked Data: monument %s — fields found: %s",
            rijksmonumentnummer,
            [k for k, v in detail_fields.items() if v is not None],
        )

        return RCEMonumentDetail(
            rijksmonumentnummer=rijksmonumentnummer,
            redengevende_omschrijving=detail_fields.get("redengevende_omschrijving"),
            oorspronkelijke_functie=detail_fields.get("oorspronkelijke_functie"),
            bouwjaar_van=detail_fields.get("bouwjaar_van"),
            bouwjaar_tot=detail_fields.get("bouwjaar_tot"),
            architect=detail_fields.get("architect"),
            bouwstijl=detail_fields.get("bouwstijl"),
            monument_register_url=REGISTER_URL.format(nr=rijksmonumentnummer),
        )

    async def _dereference_monument(
        self,
        cultuurhistorisch_objectnummer: str,
        client: httpx.AsyncClient,
    ) -> dict[str, str | int | None]:
        """Dereference monument resource for full CEO ontology detail.

        Args:
            cultuurhistorisch_objectnummer: The CHO number from Step 1 REST API call
            client: httpx AsyncClient

        Returns:
            Dict of extracted field values (empty dict on failure).
        """
        url = DEREFERENCE_URL.format(chn=cultuurhistorisch_objectnummer)
        try:
            response = await retry_with_backoff(
                lambda: client.get(
                    url,
                    headers={"Accept": "application/ld+json"},
                    follow_redirects=True,
                    timeout=30.0,
                ),
                source="rce-linked-data-deref",
            )
            if response.status_code in (404, 410):
                return {}
            if response.status_code != 200:
                return {}

            nodes = response.json()
            if isinstance(nodes, dict):
                nodes = nodes.get("@graph", [nodes])

            monument_node = _find_node_by_type(nodes, "Rijksmonument")
            if not monument_node:
                return {}

            # Extract redengevendeOmschrijving from kennisregistratie node
            redengevende = None
            kennisreg_node = _find_node_by_type(nodes, "Kennisregistratie")
            if kennisreg_node:
                redengevende = _get_literal(kennisreg_node, "redengevendeOmschrijving")

            # Extract bouwperiode from bouwperiode node
            bouwjaar_van: int | None = None
            bouwjaar_tot: int | None = None
            bouwperiode_node = _find_node_by_type(nodes, "Bouwperiode")
            if bouwperiode_node:
                van_str = _get_literal(bouwperiode_node, "bouwjaarVan")
                tot_str = _get_literal(bouwperiode_node, "bouwjaarTot")
                bouwjaar_van = int(van_str) if van_str else None
                bouwjaar_tot = int(tot_str) if tot_str else None

            return {
                "redengevende_omschrijving": redengevende,
                "oorspronkelijke_functie": _get_uri_label(monument_node, "heeftOorspronkelijkeFunctie"),
                "bouwjaar_van": bouwjaar_van,
                "bouwjaar_tot": bouwjaar_tot,
                "architect": _get_uri_label(monument_node, "heeftOntwerper"),
                "bouwstijl": _get_uri_label(monument_node, "heeftBouwstijl"),
            }
        except Exception:
            logger.debug(
                "RCE dereference failed for CHO %s",
                cultuurhistorisch_objectnummer,
                exc_info=True,
            )
            return {}

    async def _sparql_fallback(
        self,
        rijksmonumentnummer: str,
        client: httpx.AsyncClient,
    ) -> dict[str, str | int | None]:
        """SPARQL fallback for detail fields when dereference fails.

        Args:
            rijksmonumentnummer: RCE monument registration number
            client: httpx AsyncClient

        Returns:
            Dict of extracted field values (empty dict on failure).
        """
        query = f"""
PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>
SELECT ?omschrijving ?functie ?bouwjaarVan ?bouwjaarTot ?stijl ?ontwerper
WHERE {{
  ?monument a ceo:Rijksmonument ;
            ceo:rijksmonumentnummer ?nr .
  FILTER(STR(?nr) = "{rijksmonumentnummer}")
  OPTIONAL {{ ?monument ceo:heeftKennisregistratie/ceo:redengevendeOmschrijving ?omschrijving }}
  OPTIONAL {{ ?monument ceo:heeftOorspronkelijkeFunctie ?functieUri .
              BIND(REPLACE(STR(?functieUri), "^.*/", "") AS ?functie) }}
  OPTIONAL {{ ?monument ceo:heeftBouwperiode/ceo:bouwjaarVan ?bouwjaarVan }}
  OPTIONAL {{ ?monument ceo:heeftBouwperiode/ceo:bouwjaarTot ?bouwjaarTot }}
  OPTIONAL {{ ?monument ceo:heeftBouwstijl ?stijlUri .
              BIND(REPLACE(STR(?stijlUri), "^.*/", "") AS ?stijl) }}
  OPTIONAL {{ ?monument ceo:heeftOntwerper ?ontwerperUri .
              BIND(REPLACE(STR(?ontwerperUri), "^.*/", "") AS ?ontwerper) }}
}}
LIMIT 1
"""
        try:
            response = await retry_with_backoff(
                lambda: client.post(
                    SPARQL_URL,
                    content=query,
                    headers={
                        "Content-Type": "application/sparql-query",
                        "Accept": "application/json",
                    },
                    timeout=30.0,
                ),
                source="rce-linked-data-sparql",
            )
            if response.status_code != 200:
                return {}

            results = response.json()
            bindings = results.get("results", {}).get("bindings", [])
            if not bindings:
                return {}

            b = bindings[0]

            def _val(key: str) -> str | None:
                entry = b.get(key)
                return entry["value"] if entry else None

            van_str = _val("bouwjaarVan")
            tot_str = _val("bouwjaarTot")
            functie = _val("functie")
            stijl = _val("stijl")

            found_count = sum(1 for v in [_val("omschrijving"), functie, van_str] if v)
            logger.info(
                "RCE SPARQL fallback for monument %s: found %d detail fields",
                rijksmonumentnummer,
                found_count,
            )

            return {
                "redengevende_omschrijving": _val("omschrijving"),
                "oorspronkelijke_functie": functie.capitalize() if functie else None,
                "bouwjaar_van": int(van_str) if van_str else None,
                "bouwjaar_tot": int(tot_str) if tot_str else None,
                "architect": _val("ontwerper"),
                "bouwstijl": stijl.capitalize() if stijl else None,
            }
        except Exception:
            logger.debug(
                "RCE SPARQL fallback failed for monument %s",
                rijksmonumentnummer,
                exc_info=True,
            )
            return {}


# Module-level singleton for reuse across requests
rce_linked_data_client = RCELinkedDataClient()
