"""RCE Linked Data client for detailed monument information.

Fetches rich monument detail (omschrijving, oorspronkelijke functie, bouwperiode,
architect, bouwstijl) by rijksmonumentnummer from the RCE Linked Data API.

This client enriches existing monument data already detected via PDOK spatial search.
The JSON-LD response format requires specialized parsing with namespace URI keys.

Live API validation findings (2026-02-24):
- REST API (rest-api-rijksmonumenten) returns: rijksmonumentnummer (as full URL),
  cultuurhistorischObjectnummer, datumInschrijvingInMonumentenregister
- Dereference (cho-kennis/id/rijksmonument/{chn}) returns monument with linked node IRIs:
  heeftOmschrijving -> omschrijving/{id} node has ceo:omschrijving literal text
  heeftOorspronkelijkeFunctie -> functie/{id} node has heeftFunctieNaam -> SKOS prefLabel
  No Bouwperiode or architect data in test monument (farm house, may lack bouwperiode)
- SPARQL endpoint not available (serviceCount=0 on all public RCE datasets)
- Fallback: fetch omschrijving and functie nodes directly after dereference

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

# SKOS namespace — used for prefLabel on terminology nodes
SKOS_NS = "http://www.w3.org/2004/02/skos/core#"

# REST API endpoint — returns basic fields + cultuurhistorischObjectnummer (no detail)
REST_API_URL = "https://api.linkeddata.cultureelerfgoed.nl/queries/rce/rest-api-rijksmonumenten/run"

# Dereference URL template — fetches monument node with linked-detail IRIs
DEREFERENCE_URL = "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/rijksmonument/{chn}"

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


def _get_literal(node: dict, predicate: str, ns: str = CEO_NS) -> str | None:
    """Extract @value from a JSON-LD predicate."""
    values = node.get(ns + predicate, [])
    return values[0].get("@value") if values else None


def _get_all_literals(node: dict, predicate: str) -> list[str]:
    """Extract all @value entries for a multi-valued predicate."""
    values = node.get(CEO_NS + predicate, [])
    return [v.get("@value") for v in values if "@value" in v]


def _get_linked_id(node: dict, predicate: str) -> str | None:
    """Extract the @id of a linked node from a JSON-LD predicate."""
    values = node.get(CEO_NS + predicate, [])
    return values[0].get("@id") if values else None


def _get_all_linked_ids(node: dict, predicate: str) -> list[str]:
    """Extract all @id values from a multi-valued linked predicate."""
    values = node.get(CEO_NS + predicate, [])
    return [v["@id"] for v in values if "@id" in v]


def _resolve_uri_to_label(uri: str) -> str:
    """Convert RCE URI to human-readable Dutch label.

    Examples:
        'https://.../id/bouwstijl/neoclassicisme' -> 'Neoclassicisme'
        '116634' (local id) -> '116634' (fallback)
    """
    parts = [p for p in uri.rstrip("/").split("/") if p]
    if not parts:
        return uri
    label = parts[-1]
    label = label.replace("-", " ").replace("_", " ")
    return label.capitalize()


class RCELinkedDataClient:
    """Client for RCE Linked Data API — monument detail by rijksmonumentnummer.

    Uses a two-step fetch strategy with linked-node resolution:
    1. REST API query -> get cultuurhistorischObjectnummer
    2. Dereference the monument resource -> get linked node IRIs (omschrijving, functie)
    3. Fetch linked nodes directly -> extract actual text/labels

    Gracefully degrades to basic-fields-only when detail unavailable.
    Note: SPARQL endpoint not available on public RCE Linked Data datasets.
    """

    async def get_detail_by_monument_number(
        self,
        rijksmonumentnummer: str,
        client: httpx.AsyncClient,
    ) -> RCEMonumentDetail | None:
        """Fetch monument detail by rijksmonumentnummer.

        Args:
            rijksmonumentnummer: RCE monument registration number (e.g. "12340")
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
        """Internal fetch: REST API + dereference + linked-node resolution."""
        # Step 1: REST API query — get cultuurhistorischObjectnummer
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

        # Step 2: Dereference the monument resource — returns monument node with linked IRIs
        deref_nodes = await self._dereference_monument(chn, client)
        if not deref_nodes:
            logger.warning(
                "RCE detail fields unavailable for monument %s (dereference failed)",
                rijksmonumentnummer,
            )
            return RCEMonumentDetail(
                rijksmonumentnummer=rijksmonumentnummer,
                monument_register_url=REGISTER_URL.format(nr=rijksmonumentnummer),
            )

        deref_monument = _find_node_by_type(deref_nodes, "Rijksmonument")
        if not deref_monument:
            return RCEMonumentDetail(
                rijksmonumentnummer=rijksmonumentnummer,
                monument_register_url=REGISTER_URL.format(nr=rijksmonumentnummer),
            )

        # Step 3: Resolve linked nodes (omschrijving + functie) to get actual text/labels
        omschrijving = await self._fetch_omschrijving(deref_monument, client)
        functie_label = await self._fetch_functie_label(deref_monument, client)

        # Extract bouwperiode from dereference graph (Bouwperiode node if present)
        bouwjaar_van, bouwjaar_tot = self._extract_bouwperiode(deref_nodes)

        # bouwstijl and architect: may be URI-based terms in dereference graph
        bouwstijl = _get_uri_label_from_node(deref_monument, "heeftBouwstijl", deref_nodes)
        architect = _get_uri_label_from_node(deref_monument, "heeftOntwerper", deref_nodes)

        found_fields = [f for f, v in [
            ("omschrijving", omschrijving),
            ("functie", functie_label),
            ("bouwjaar_van", bouwjaar_van),
        ] if v is not None]
        logger.info(
            "RCE Linked Data: monument %s — detail fields found: %s",
            rijksmonumentnummer,
            found_fields or "none (basic fields only)",
        )

        return RCEMonumentDetail(
            rijksmonumentnummer=rijksmonumentnummer,
            redengevende_omschrijving=omschrijving,
            oorspronkelijke_functie=functie_label,
            bouwjaar_van=bouwjaar_van,
            bouwjaar_tot=bouwjaar_tot,
            architect=architect,
            bouwstijl=bouwstijl,
            monument_register_url=REGISTER_URL.format(nr=rijksmonumentnummer),
        )

    async def _dereference_monument(
        self,
        cultuurhistorisch_objectnummer: str,
        client: httpx.AsyncClient,
    ) -> list[dict]:
        """Dereference monument resource to get linked-detail node IRIs.

        Returns:
            List of JSON-LD nodes (empty list on failure).
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
            if response.status_code != 200:
                return []
            nodes = response.json()
            if isinstance(nodes, dict):
                nodes = nodes.get("@graph", [nodes])
            return nodes if isinstance(nodes, list) else []
        except Exception:
            logger.debug(
                "RCE dereference failed for CHO %s", cultuurhistorisch_objectnummer, exc_info=True
            )
            return []

    async def _fetch_omschrijving(
        self,
        monument_node: dict,
        client: httpx.AsyncClient,
    ) -> str | None:
        """Fetch omschrijving text by dereferencing the Omschrijving node.

        The dereference response links heeftOmschrijving -> omschrijving/{id}.
        That node has ceo:omschrijving with the monument description text.
        """
        omschrijving_iri = _get_linked_id(monument_node, "heeftOmschrijving")
        if not omschrijving_iri:
            return None
        try:
            response = await retry_with_backoff(
                lambda: client.get(
                    omschrijving_iri,
                    headers={"Accept": "application/ld+json"},
                    follow_redirects=True,
                    timeout=30.0,
                ),
                source="rce-linked-data-omschrijving",
            )
            if response.status_code != 200:
                return None
            nodes = response.json()
            if isinstance(nodes, dict):
                nodes = nodes.get("@graph", [nodes])
            omschrijving_node = _find_node_by_type(nodes, "Omschrijving")
            if omschrijving_node:
                return _get_literal(omschrijving_node, "omschrijving")
        except Exception:
            logger.debug("RCE omschrijving fetch failed", exc_info=True)
        return None

    async def _fetch_functie_label(
        self,
        monument_node: dict,
        client: httpx.AsyncClient,
    ) -> str | None:
        """Fetch oorspronkelijke functie label by dereferencing the Functie node.

        The dereference response links heeftOorspronkelijkeFunctie -> functie/{id}.
        That node has heeftFunctieNaam -> SKOS term with prefLabel (Dutch label).
        """
        functie_iri = _get_linked_id(monument_node, "heeftOorspronkelijkeFunctie")
        if not functie_iri:
            return None
        try:
            response = await retry_with_backoff(
                lambda: client.get(
                    functie_iri,
                    headers={"Accept": "application/ld+json"},
                    follow_redirects=True,
                    timeout=30.0,
                ),
                source="rce-linked-data-functie",
            )
            if response.status_code != 200:
                return None
            nodes = response.json()
            if isinstance(nodes, dict):
                nodes = nodes.get("@graph", [nodes])
            functie_node = _find_node_by_type(nodes, "Functie")
            if not functie_node:
                return None
            # heeftFunctieNaam links to a SKOS term with prefLabel
            term_iri = _get_linked_id(functie_node, "heeftFunctieNaam")
            if not term_iri:
                return None
            # Find the SKOS term in the graph and get its prefLabel
            for node in nodes:
                if node.get("@id") == term_iri:
                    labels = node.get(SKOS_NS + "prefLabel", [])
                    nl_labels = [lbl.get("@value") for lbl in labels if lbl.get("@language") == "nl"]
                    if nl_labels:
                        return nl_labels[0]
                    # Fallback to first label without language tag
                    plain_labels = [lbl.get("@value") for lbl in labels if lbl.get("@language") is None and "@value" in lbl]
                    if plain_labels:
                        return plain_labels[0]
        except Exception:
            logger.debug("RCE functie fetch failed", exc_info=True)
        return None

    def _extract_bouwperiode(
        self,
        nodes: list[dict],
    ) -> tuple[int | None, int | None]:
        """Extract bouwperiode van/tot from graph nodes (Bouwperiode node if present)."""
        bouwperiode_node = _find_node_by_type(nodes, "Bouwperiode")
        if not bouwperiode_node:
            return None, None
        van_str = _get_literal(bouwperiode_node, "bouwjaarVan")
        tot_str = _get_literal(bouwperiode_node, "bouwjaarTot")
        try:
            bouwjaar_van = int(van_str) if van_str else None
            bouwjaar_tot = int(tot_str) if tot_str else None
        except (ValueError, TypeError):
            bouwjaar_van = None
            bouwjaar_tot = None
        return bouwjaar_van, bouwjaar_tot


def _get_uri_label_from_node(
    monument_node: dict,
    predicate: str,
    all_nodes: list[dict],
) -> str | None:
    """Resolve a linked URI to a human-readable label.

    Looks up the linked node in the graph and returns its SKOS prefLabel (NL)
    or falls back to resolving the URI path segment.
    """
    linked_id = _get_linked_id(monument_node, predicate)
    if not linked_id:
        return None
    # Try to find the term node in the graph for a SKOS label
    for node in all_nodes:
        if node.get("@id") == linked_id:
            labels = node.get(SKOS_NS + "prefLabel", [])
            nl_labels = [lbl.get("@value") for lbl in labels if lbl.get("@language") == "nl"]
            if nl_labels:
                return nl_labels[0]
    # Fallback: resolve URI path segment to label
    return _resolve_uri_to_label(linked_id)


# Module-level singleton for reuse across requests
rce_linked_data_client = RCELinkedDataClient()
