"""Funda listing ingestion for market-friction signals (Phase 59 PoC)."""

from __future__ import annotations

import asyncio
import json
import logging
import re
import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime
from urllib.parse import urlencode, urljoin

import httpx
from lxml import html as lxml_html
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.funda_listing_snapshot import FundaListingSnapshot
from app.models.parcel_cache import ParcelCache

logger = logging.getLogger(__name__)

_FUNDA_BASE_URL = "https://www.funda.nl"
_FUNDA_BLOCK_MARKER = "Je bent bijna op de pagina die je zoekt"
_FUNDA_DETAIL_URL_RE = re.compile(
    r"https://www\.funda\.nl/detail/koop/[^\"' <>\n\r]+/\d+/?",
    re.IGNORECASE,
)
_FUNDA_DETAIL_ID_RE = re.compile(r"/(\d{6,})/?$")
_ADDRESS_POSTCODE_RE = re.compile(
    r"^(?P<street_house>.+?)\s+(?P<postcode>\d{4}\s?[A-Z]{2})\s+(?P<city>.+)$"
)
_STREET_HOUSE_RE = re.compile(r"^(?P<street>.+?)\s+(?P<house>\d+[A-Za-z0-9/-]*)$")
_HUISNUMMER_FROM_ADDRESS_RE = re.compile(r"(\d+)")

try:
    from scrapling.fetchers import Fetcher

    SCRAPLING_AVAILABLE = True
except Exception:  # pragma: no cover - environment-dependent
    Fetcher = None
    SCRAPLING_AVAILABLE = False


@dataclass
class ParsedFundaListing:
    """Normalized listing fields extracted from one detail page."""

    listing_external_id: str
    listing_url: str
    street: str | None
    house_number: str | None
    postcode: str | None
    city: str | None
    price_eur: int | None
    price_text: str | None
    listing_status: str | None
    offered_since_text: str | None
    raw_title: str | None


def build_funda_search_url(area_name: str) -> str:
    """Build Funda search URL for one selected area."""
    selected_area = json.dumps([area_name.lower().strip()])
    params = urlencode({"selected_area": selected_area})
    return f"{_FUNDA_BASE_URL}/zoeken/koop/?{params}"


def _normalize_postcode(postcode: str | None) -> str | None:
    if not isinstance(postcode, str):
        return None
    cleaned = postcode.upper().replace(" ", "").strip()
    return cleaned if len(cleaned) == 6 else None


def _extract_price_eur(price_text: str | None) -> int | None:
    if not isinstance(price_text, str):
        return None
    digits = re.sub(r"[^0-9]", "", price_text)
    if not digits:
        return None
    try:
        return int(digits)
    except ValueError:
        return None


def _extract_huisnummer_from_address(address: str | None) -> int | None:
    if not isinstance(address, str):
        return None
    first_line = address.split(",")[0].strip()
    match = _HUISNUMMER_FROM_ADDRESS_RE.search(first_line)
    if not match:
        return None
    try:
        return int(match.group(1))
    except ValueError:
        return None


def _fetch_html_with_scrapling(url: str, timeout_ms: int = 30000) -> tuple[str, int]:
    if not SCRAPLING_AVAILABLE or Fetcher is None:
        raise RuntimeError("scrapling fetcher unavailable")

    page = Fetcher.get(url, timeout=timeout_ms)
    body = page.body.decode("utf-8", errors="ignore")
    return body, int(page.status)


def _fetch_html_with_httpx(url: str, timeout_s: float = 30.0) -> tuple[str, int]:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
        "Referer": "https://www.google.com/",
    }
    with httpx.Client(timeout=timeout_s, follow_redirects=True, headers=headers) as client:
        response = client.get(url)
        return response.text, response.status_code


async def fetch_html(url: str, timeout_ms: int = 30000) -> tuple[str, int, str]:
    """Fetch URL body using Scrapling first, fallback to plain HTTPX."""
    if SCRAPLING_AVAILABLE:
        try:
            html, status = await asyncio.to_thread(_fetch_html_with_scrapling, url, timeout_ms)
            return html, status, "scrapling"
        except Exception as exc:  # pragma: no cover - network/runtime-dependent
            logger.warning("Scrapling fetch failed for %s, fallback to httpx: %s", url, exc)

    html, status = await asyncio.to_thread(_fetch_html_with_httpx, url, timeout_ms / 1000)
    return html, status, "httpx"


def extract_funda_detail_links(search_html: str) -> list[str]:
    """Extract and normalize Funda detail listing URLs from search HTML."""
    links: set[str] = set(_FUNDA_DETAIL_URL_RE.findall(search_html))

    try:
        doc = lxml_html.fromstring(search_html)
        for href in doc.xpath("//a[@href]/@href"):
            if not isinstance(href, str) or "/detail/koop/" not in href:
                continue
            normalized = urljoin(_FUNDA_BASE_URL, href)
            if normalized.startswith(f"{_FUNDA_BASE_URL}/detail/koop/"):
                links.add(normalized)
    except Exception:
        return sorted(links)

    return sorted(links)


def _extract_field_from_def_list(doc: lxml_html.HtmlElement, label: str) -> str | None:
    needle = label.casefold()
    for dt in doc.xpath("//dt"):
        dt_text = " ".join(dt.text_content().split()).casefold()
        if dt_text != needle:
            continue
        dd = dt.getnext()
        if dd is None:
            continue
        value = " ".join(dd.text_content().split()).strip()
        return value or None
    return None


def parse_funda_detail_page(listing_url: str, detail_html: str) -> ParsedFundaListing | None:
    """Parse one listing detail page into normalized snapshot fields."""
    id_match = _FUNDA_DETAIL_ID_RE.search(listing_url)
    if not id_match:
        return None
    listing_external_id = id_match.group(1)

    try:
        doc = lxml_html.fromstring(detail_html)
    except Exception:
        return None

    raw_title = doc.xpath("string(//title)").strip() or None
    title_without_brand = (raw_title or "").split("|", 1)[0].strip()
    if ":" in title_without_brand:
        title_without_brand = title_without_brand.split(":", 1)[1].strip()

    street: str | None = None
    house_number: str | None = None
    postcode: str | None = None
    city: str | None = None

    address_match = _ADDRESS_POSTCODE_RE.match(title_without_brand)
    if address_match:
        street_house = address_match.group("street_house").strip()
        postcode = _normalize_postcode(address_match.group("postcode"))
        city = address_match.group("city").strip() or None

        house_match = _STREET_HOUSE_RE.match(street_house)
        if house_match:
            street = house_match.group("street").strip()
            house_number = house_match.group("house").strip()
        else:
            street = street_house or None

    price_text = _extract_field_from_def_list(doc, "Vraagprijs")
    offered_since_text = _extract_field_from_def_list(doc, "Aangeboden sinds")
    status_text = _extract_field_from_def_list(doc, "Status")

    page_text = detail_html.casefold()
    listing_status = status_text
    if not listing_status:
        if "verkocht onder voorbehoud" in page_text:
            listing_status = "verkocht onder voorbehoud"
        elif "verkocht" in page_text:
            listing_status = "verkocht"
        elif "onder bod" in page_text:
            listing_status = "onder bod"
        elif "te koop" in page_text:
            listing_status = "te koop"

    return ParsedFundaListing(
        listing_external_id=listing_external_id,
        listing_url=listing_url,
        street=street,
        house_number=house_number,
        postcode=postcode,
        city=city,
        price_eur=_extract_price_eur(price_text),
        price_text=price_text,
        listing_status=listing_status,
        offered_since_text=offered_since_text,
        raw_title=raw_title,
    )


async def _match_parcel_for_listing(
    listing: ParsedFundaListing,
    session: AsyncSession,
) -> uuid.UUID | None:
    """Best-effort textual match from listing address to parcel_cache.address."""
    if not listing.street:
        return None

    query = select(ParcelCache.id, ParcelCache.address).where(
        ParcelCache.address.is_not(None),
        func.lower(ParcelCache.address).contains(listing.street.lower()),
    )

    if listing.postcode:
        query = query.where(
            func.upper(func.regexp_replace(ParcelCache.address, r"\s+", "", "g")).contains(
                listing.postcode
            )
        )
    elif listing.city:
        query = query.where(func.lower(ParcelCache.address).contains(listing.city.lower()))

    rows = (await session.execute(query.limit(80))).all()
    if not rows:
        return None

    listing_huisnummer = _extract_huisnummer_from_address(
        f"{listing.street} {listing.house_number or ''}"
    )

    if listing_huisnummer is not None:
        exact_rows = [
            row
            for row in rows
            if _extract_huisnummer_from_address(row[1]) == listing_huisnummer
        ]
        if exact_rows:
            return exact_rows[0][0]

    if len(rows) == 1:
        return rows[0][0]
    return None


async def ingest_funda_area_snapshots(
    *,
    area_name: str,
    max_listings: int,
    session: AsyncSession,
) -> dict[str, int | str | bool]:
    """
    Ingest Funda listings for one area and persist daily snapshots.

    Returns area-level stats for monitoring/logging.
    """
    search_url = build_funda_search_url(area_name)
    search_html, search_status, fetch_engine = await fetch_html(search_url)

    blocked = _FUNDA_BLOCK_MARKER in search_html
    if search_status >= 400 or blocked:
        logger.warning(
            "Funda search blocked/failed for area=%s status=%s engine=%s blocked=%s",
            area_name,
            search_status,
            fetch_engine,
            blocked,
        )
        return {
            "area_name": area_name,
            "search_status": search_status,
            "fetch_engine": fetch_engine,
            "blocked": blocked,
            "detail_links": 0,
            "snapshots_upserted": 0,
            "matched_parcels": 0,
        }

    detail_links = extract_funda_detail_links(search_html)[:max_listings]
    snapshot_date = datetime.now(UTC).date()
    upserted = 0
    matched = 0

    for listing_url in detail_links:
        detail_html, detail_status, _ = await fetch_html(listing_url)
        if detail_status >= 400 or _FUNDA_BLOCK_MARKER in detail_html:
            continue

        parsed = parse_funda_detail_page(listing_url, detail_html)
        if parsed is None:
            continue

        matched_parcel_id = await _match_parcel_for_listing(parsed, session)
        if matched_parcel_id:
            matched += 1

        payload = {
            "source": "funda",
            "listing_external_id": parsed.listing_external_id,
            "listing_url": parsed.listing_url,
            "area_name": area_name,
            "snapshot_date": snapshot_date,
            "street": parsed.street,
            "house_number": parsed.house_number,
            "postcode": parsed.postcode,
            "city": parsed.city,
            "price_eur": parsed.price_eur,
            "price_text": parsed.price_text,
            "listing_status": parsed.listing_status,
            "offered_since_text": parsed.offered_since_text,
            "matched_parcel_id": matched_parcel_id,
            "metadata_json": {
                "raw_title": parsed.raw_title,
            },
        }

        stmt = pg_insert(FundaListingSnapshot).values(payload)
        stmt = stmt.on_conflict_do_update(
            constraint="uq_funda_listing_snapshots_source_listing_day",
            set_={
                "listing_url": stmt.excluded.listing_url,
                "area_name": stmt.excluded.area_name,
                "street": stmt.excluded.street,
                "house_number": stmt.excluded.house_number,
                "postcode": stmt.excluded.postcode,
                "city": stmt.excluded.city,
                "price_eur": stmt.excluded.price_eur,
                "price_text": stmt.excluded.price_text,
                "listing_status": stmt.excluded.listing_status,
                "offered_since_text": stmt.excluded.offered_since_text,
                "matched_parcel_id": stmt.excluded.matched_parcel_id,
                "metadata_json": stmt.excluded.metadata_json,
                "updated_at": func.now(),
            },
        )
        await session.execute(stmt)
        upserted += 1

    return {
        "area_name": area_name,
        "search_status": search_status,
        "fetch_engine": fetch_engine,
        "blocked": False,
        "detail_links": len(detail_links),
        "snapshots_upserted": upserted,
        "matched_parcels": matched,
    }


async def build_funda_listing_signal_map(
    parcel_ids: list[uuid.UUID],
    session: AsyncSession,
) -> dict[uuid.UUID, dict[str, int]]:
    """Aggregate listing duration and price-change proxies per parcel."""
    if not parcel_ids:
        return {}

    rows = await session.execute(
        select(
            FundaListingSnapshot.matched_parcel_id,
            FundaListingSnapshot.snapshot_date,
            FundaListingSnapshot.price_eur,
        ).where(
            FundaListingSnapshot.source == "funda",
            FundaListingSnapshot.matched_parcel_id.in_(parcel_ids),
        )
    )

    grouped: dict[uuid.UUID, dict[str, object]] = {}
    for matched_parcel_id, snapshot_date, price_eur in rows.all():
        if matched_parcel_id is None or snapshot_date is None:
            continue

        state = grouped.setdefault(
            matched_parcel_id,
            {
                "first_seen": snapshot_date,
                "last_seen": snapshot_date,
                "prices": set(),
                "snapshots": 0,
            },
        )
        if snapshot_date < state["first_seen"]:
            state["first_seen"] = snapshot_date
        if snapshot_date > state["last_seen"]:
            state["last_seen"] = snapshot_date
        if isinstance(price_eur, int) and price_eur > 0:
            state["prices"].add(price_eur)
        state["snapshots"] = int(state["snapshots"]) + 1

    today = date.today()
    signals: dict[uuid.UUID, dict[str, int]] = {}
    for parcel_id, state in grouped.items():
        first_seen = state["first_seen"]
        last_seen = state["last_seen"]
        prices: set[int] = state["prices"]
        snapshots = int(state["snapshots"])

        duration_days = (last_seen - first_seen).days + 1
        price_change_count = max(0, len(prices) - 1)
        days_since_last_seen = max(0, (today - last_seen).days)

        signals[parcel_id] = {
            "listing_duration_days": duration_days,
            "price_change_count": price_change_count,
            "listing_snapshots_count": snapshots,
            "days_since_last_seen": days_since_last_seen,
        }

    return signals
