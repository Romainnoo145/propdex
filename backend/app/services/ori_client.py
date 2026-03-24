"""Open Raadsinformatie (ORI) Elasticsearch client.

Queries the public ORI API at https://api.openraadsinformatie.nl/v1/elastic/
to search council documents (vergaderstukken) for Dutch municipalities.
No authentication required.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)

ORI_BASE_URL = "https://api.openraadsinformatie.nl/v1/elastic"

# Development-relevant search keywords for real estate / construction
DEVELOPMENT_KEYWORDS = [
    "omgevingsvergunning",
    "bestemmingsplan",
    "woningbouw",
    "bouwplan",
    "woonvisie",
    "omgevingsvisie",
    "grondbeleid",
    "ruimtelijke ordening",
    "woningbouwprogramma",
    "buitenplanse omgevingsplanactiviteit",
    "transformatie",
    "herbestemming",
    "gebiedsontwikkeling",
]


def _normalize_ori_source_url(ori_id: str | None) -> str | None:
    """Normalize ORI @id values into browser-openable URLs."""
    if not ori_id:
        return None

    value = str(ori_id).strip()
    if not value:
        return None

    duplicated_prefix_match = re.match(
        r"^https?://id\.openraadsinformatie\.nl/(https?://.+)$",
        value,
        re.IGNORECASE,
    )
    if duplicated_prefix_match:
        return duplicated_prefix_match.group(1)

    if re.match(r"^https?://", value, re.IGNORECASE):
        return value

    if value.startswith("/"):
        return f"https://openraadsinformatie.nl{value}"

    return f"https://id.openraadsinformatie.nl/{value.lstrip('/')}"


def _gemeente_to_ori_index(gemeente_naam: str) -> str:
    """Convert gemeente display name to ORI index prefix.

    ORI uses lowercase names with underscores for spaces, hyphens preserved.
    Examples:
        "Venlo" → "venlo"
        "Stichtse Vecht" → "stichtse_vecht"
        "Bergen (L.)" → "bergen_l"
        "'s-Hertogenbosch" → "s-hertogenbosch"
    """
    name = gemeente_naam.lower().strip()
    # Remove parenthetical suffixes like "(L.)" → keep just the letter
    name = re.sub(r"\(([^)]*)\)", lambda m: m.group(1).rstrip("."), name)
    # Replace spaces with underscores
    name = name.replace(" ", "_")
    # Remove characters that aren't alphanumeric, underscore, or hyphen
    name = re.sub(r"[^a-z0-9_\-]", "", name)
    # Collapse multiple underscores
    name = re.sub(r"_+", "_", name).strip("_")
    return name


@dataclass
class ORIDocument:
    """A document from Open Raadsinformatie."""

    doc_id: str
    name: str
    description: str | None
    date: str | None  # ISO 8601
    doc_type: str | None  # @type from ORI: AgendaItem, Meeting, etc.
    source_url: str | None
    organization: str | None


async def search_raadsinformatie(
    gemeente_naam: str,
    *,
    keywords: list[str] | None = None,
    limit: int = 10,
    timeout: float = 15.0,
) -> tuple[bool, list[ORIDocument]]:
    """Search ORI Elasticsearch for development-relevant council documents.

    Args:
        gemeente_naam: Municipality display name (e.g., "Venlo")
        keywords: Search keywords (defaults to DEVELOPMENT_KEYWORDS)
        limit: Max results to return
        timeout: HTTP timeout in seconds

    Returns:
        Tuple of (dekking: bool, documents: list[ORIDocument]).
        dekking is True if the gemeente has an ORI index.
    """
    index_prefix = _gemeente_to_ori_index(gemeente_naam)
    search_terms = keywords or DEVELOPMENT_KEYWORDS
    query_string = " ".join(search_terms)

    url = f"{ORI_BASE_URL}/ori_{index_prefix}*/_search"

    body = {
        "size": limit,
        "query": {
            "bool": {
                "must": {
                    "multi_match": {
                        "query": query_string,
                        "fields": ["name^3", "description^2", "text"],
                        "type": "best_fields",
                        "minimum_should_match": "30%",
                    }
                },
                "filter": [
                    {
                        "bool": {
                            "must_not": {
                                "match": {"classification": "municipality"}
                            }
                        }
                    }
                ],
            }
        },
        "sort": [
            {"_score": "desc"},
            {"start_date": {"order": "desc", "unmapped_type": "date"}},
        ],
        "_source": [
            "name",
            "description",
            "start_date",
            "date",
            "@type",
            "@id",
            "has_organization_name",
            "classification",
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                url,
                json=body,
                headers={"Content-Type": "application/json"},
            )

        if resp.status_code == 404:
            # Index doesn't exist → gemeente not in ORI
            logger.info("ORI index not found for %s (index: ori_%s*)", gemeente_naam, index_prefix)
            return False, []

        if resp.status_code != 200:
            logger.warning(
                "ORI search failed for %s: HTTP %d — %s",
                gemeente_naam,
                resp.status_code,
                resp.text[:300],
            )
            return False, []

        data = resp.json()
        hits = data.get("hits", {}).get("hits", [])

        if not hits:
            # Index exists but no matching documents
            return True, []

        documents: list[ORIDocument] = []
        seen_names: set[str] = set()

        for hit in hits:
            source = hit.get("_source", {})
            name = source.get("name", "").strip()

            # Deduplicate by name (ORI often has duplicate entries)
            if not name or name in seen_names:
                continue
            seen_names.add(name)

            # Extract description, strip HTML tags
            description = source.get("description")
            if isinstance(description, str):
                description = re.sub(r"<[^>]+>", " ", description)
                description = re.sub(r"\s+", " ", description).strip()
                if len(description) > 1000:
                    description = description[:1000] + "..."

            # Get date from start_date or date field
            date = source.get("start_date") or source.get("date")

            # Build source URL from @id
            doc_id = str(hit.get("_id", ""))
            ori_id = source.get("@id")
            source_url = _normalize_ori_source_url(
                ori_id if isinstance(ori_id, str) else None
            )

            documents.append(
                ORIDocument(
                    doc_id=doc_id,
                    name=name,
                    description=description if description else None,
                    date=date,
                    doc_type=source.get("@type"),
                    source_url=source_url,
                    organization=None,
                )
            )

        logger.info(
            "ORI search for %s: %d hits, %d unique documents",
            gemeente_naam,
            len(hits),
            len(documents),
        )
        return True, documents

    except httpx.TimeoutException:
        logger.warning("ORI search timed out for %s", gemeente_naam)
        return False, []
    except Exception:
        logger.exception("ORI search error for %s", gemeente_naam)
        return False, []
