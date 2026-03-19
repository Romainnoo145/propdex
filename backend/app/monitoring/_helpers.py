"""Shared private helpers for monitoring sub-routers."""

import re
import uuid

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.government_apis.pdok_locatieserver import PDOKLocatieserver
from app.models.change_record import ChangeRecord
from app.models.parcel_cache import ParcelCache
from app.services.bekendmaking_matcher import find_parcel_at_point

locatieserver = PDOKLocatieserver()


def _normalize_postcode(value: str | None) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = value.upper().replace(" ", "").strip()
    return cleaned if len(cleaned) == 6 else None


def _normalize_gemeente_code(value: str | None) -> str | None:
    if not isinstance(value, str):
        return None
    code = value.strip().upper()
    if not code:
        return None
    if re.fullmatch(r"GM\d{4}", code):
        return code
    digits = code[2:] if code.startswith("GM") else code
    if re.fullmatch(r"\d{4}", digits):
        return f"GM{digits}"
    return None


def _coerce_huisnummer(value: object) -> int | None:
    if isinstance(value, int):
        return value if value > 0 else None
    if isinstance(value, str):
        m = re.search(r"(\d+)", value)
        if m:
            try:
                parsed = int(m.group(1))
                return parsed if parsed > 0 else None
            except ValueError:
                return None
    return None


def _normalize_street_hint(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    street = value.strip()
    if not street:
        return None

    # Some SRU titles leak prefix text into the extracted street:
    # "Verlenging beslistermijn ... - Wylrehofweg" -> "Wylrehofweg"
    if " - " in street:
        parts = [p.strip() for p in street.split(" - ") if p.strip()]
        if parts:
            street = parts[-1]

    return street or None


def _extract_huisnummer_from_address(address: str | None) -> int | None:
    if not address:
        return None
    first_line = address.split(",")[0].strip()
    m = re.search(r"(\d+)", first_line)
    if not m:
        return None
    try:
        return int(m.group(1))
    except ValueError:
        return None


def _extract_street_huisnummer(address_like: str | None) -> tuple[str, int] | None:
    if not address_like:
        return None

    first_line = address_like.split(",")[0].strip()
    if " - " in first_line:
        first_line = first_line.rsplit(" - ", 1)[-1].strip()

    # Match: "<street words> <number>[suffix]"
    m = re.search(r"(.+?)\s+(\d+)(?:[A-Za-z]|-[A-Za-z0-9]+)?\b", first_line)
    if not m:
        return None

    street = _normalize_street_hint(m.group(1))
    if not street:
        return None
    try:
        huisnummer = int(m.group(2))
    except ValueError:
        return None

    if huisnummer <= 0:
        return None
    return street, huisnummer


def _extract_city_from_address_like(address_like: str | None) -> str | None:
    if not isinstance(address_like, str):
        return None

    parts = [p.strip() for p in address_like.split(",") if p.strip()]
    if len(parts) >= 2:
        candidate = parts[-1]
        candidate = re.sub(r"\b\d{4}\s?[A-Z]{2}\b", "", candidate).strip()
        if candidate and not any(ch.isdigit() for ch in candidate):
            words = candidate.split()
            if words and len(words) <= 4 and words[0][0].isupper():
                return " ".join(words)

    # Fallback for "Straat 12 Venlo" style (no comma/postcode).
    match = re.search(
        r"\b\d+[A-Za-z]?(?:-[A-Za-z0-9]+)?\b\s*,?\s*(.+)$",
        address_like.strip(),
    )
    if not match:
        return None

    tail = match.group(1).split(",")[0].strip()
    if not tail:
        return None

    words = [w.strip(" .;:-") for w in tail.split() if w.strip(" .;:-")]
    if not words:
        return None

    permit_words = {
        "omgevingsvergunning",
        "bouwvergunning",
        "sloopvergunning",
        "aanvraag",
        "verleende",
        "verleend",
        "geweigerde",
        "geweigerd",
        "ingetrokken",
        "kennisgeving",
        "besluit",
        "vergunning",
        "bekendmaking",
        "beschikking",
        "reguliere",
        "regulier",
        "ontwerpbesluit",
        "ontwerp",
        "aangevraagde",
        "aangevraagd",
        "mededeling",
    }
    if words[0].lower() in permit_words:
        return None

    connectors = {"aan", "de", "den", "der", "het", "op", "te", "ter", "ten", "van", "bij"}
    picked: list[str] = []
    for idx, word in enumerate(words):
        normalized = word.replace("'", "'").strip()
        if not normalized or any(ch.isdigit() for ch in normalized):
            break
        is_upper_start = normalized.startswith("'") or normalized[0].isupper()
        if idx == 0:
            if not is_upper_start:
                return None
            picked.append(word)
            continue
        if len(picked) >= 4:
            break
        if is_upper_start or normalized.lower() in connectors:
            picked.append(word)
            continue
        break

    if not picked:
        return None
    return " ".join(picked)


def _build_address_from_hints(
    street: str,
    huisnummer: int,
    postcode: str | None,
    city: str | None,
    gemeente_naam: str | None,
) -> str:
    first_line = f"{street} {huisnummer}".strip()
    normalized_postcode = _normalize_postcode(postcode)
    city_hint = city.strip() if isinstance(city, str) and city.strip() else None
    if not city_hint:
        city_hint = gemeente_naam.strip() if isinstance(gemeente_naam, str) and gemeente_naam.strip() else None

    parts = [first_line]
    if normalized_postcode and city_hint:
        parts.append(f"{normalized_postcode} {city_hint}")
    elif normalized_postcode:
        parts.append(normalized_postcode)
    elif city_hint:
        parts.append(city_hint)
    return ", ".join(parts)


def _extract_match_hints(
    change: ChangeRecord,
    effective_postcode: str | None,
) -> tuple[str, int, str | None, str | None] | None:
    components = (change.metadata_json or {}).get("address_components")
    if isinstance(components, dict):
        street = _normalize_street_hint(components.get("street"))
        huisnummer = _coerce_huisnummer(components.get("huisnummer"))
        postcode = _normalize_postcode(
            effective_postcode or components.get("postcode")
        )
        city = _normalize_street_hint(components.get("city"))
        if street and huisnummer:
            return street, huisnummer, postcode, city

    parsed = _extract_street_huisnummer(change.address)
    if parsed:
        return (
            parsed[0],
            parsed[1],
            _normalize_postcode(effective_postcode),
            _extract_city_from_address_like(change.address),
        )

    # Last fallback: try parsing from title tail after last " - "
    title_tail = (
        change.title.rsplit(" - ", 1)[-1]
        if isinstance(change.title, str) and " - " in change.title
        else change.title
    )
    # Guard against non-address numbers in titles (e.g., "sectie A 4807").
    if isinstance(title_tail, str) and re.search(r"\bsectie\b", title_tail, re.IGNORECASE):
        return None
    parsed_from_title = _extract_street_huisnummer(title_tail)
    if parsed_from_title:
        return (
            parsed_from_title[0],
            parsed_from_title[1],
            _normalize_postcode(effective_postcode),
            _extract_city_from_address_like(title_tail),
        )

    return None


async def _find_parcel_by_address_hint(
    street: str,
    huisnummer: int,
    db: AsyncSession,
    postcode: str | None = None,
    city: str | None = None,
) -> uuid.UUID | None:
    """Best-effort parcel lookup from textual address hints in ParcelCache.address."""
    normalized_street = street.strip().lower()
    if not normalized_street:
        return None

    normalized_postcode = _normalize_postcode(postcode)
    normalized_city = city.lower().strip() if isinstance(city, str) and city.strip() else None

    query = select(ParcelCache.id, ParcelCache.address).where(
        ParcelCache.address.is_not(None),
        func.lower(ParcelCache.address).contains(normalized_street),
    )
    if normalized_postcode:
        query = query.where(
            func.upper(
                func.regexp_replace(ParcelCache.address, r"\s+", "", "g")
            ).contains(normalized_postcode)
        )
    elif normalized_city:
        query = query.where(func.lower(ParcelCache.address).contains(normalized_city))

    rows = (await db.execute(query.limit(60))).all()
    if not rows:
        return None

    exact = [
        row
        for row in rows
        if _extract_huisnummer_from_address(row[1]) == huisnummer
    ]
    if exact:
        return exact[0][0]

    # Safe fallback only when there is exactly one candidate.
    if len(rows) == 1:
        return rows[0][0]
    return None


async def _try_match_parcel_from_metadata(
    change: ChangeRecord,
    client: httpx.AsyncClient,
    db: AsyncSession,
) -> uuid.UUID | None:
    """Try geocode + spatial parcel match using address_components metadata."""
    components = (change.metadata_json or {}).get("address_components")
    if not isinstance(components, dict):
        return None

    street = _normalize_street_hint(components.get("street"))
    huisnummer = _coerce_huisnummer(components.get("huisnummer"))
    if not street or not huisnummer:
        return None

    coords = await locatieserver.geocode_address(
        street=street,
        huisnummer=huisnummer,
        client=client,
        postcode=_normalize_postcode(components.get("postcode")),
        city=components.get("city"),
        gemeente_naam=change.gemeente_naam,
    )

    if coords is not None:
        matched = await find_parcel_at_point(coords[0], coords[1], db)
        if matched is not None:
            return matched

    # Fallback when PDOK geocoding returns nothing or point-in-polygon misses.
    return await _find_parcel_by_address_hint(
        street=street,
        huisnummer=huisnummer,
        db=db,
        postcode=_normalize_postcode(components.get("postcode")),
        city=_normalize_street_hint(components.get("city")),
    )


def _build_address_from_components(
    components: dict | None,
    normalized_postcode: str | None = None,
) -> str | None:
    """Build a display address from extracted address components."""
    if not isinstance(components, dict):
        return None

    street = str(components.get("street") or "").strip()
    huisnummer = str(components.get("huisnummer") or "").strip()
    toevoeging = str(components.get("huisnummer_toevoeging") or "").strip()
    city = str(components.get("city") or "").strip()

    if not street or not huisnummer:
        return None

    first_line = f"{street} {huisnummer}{toevoeging}".strip()
    postcode = normalized_postcode or (
        str(components.get("postcode") or "").upper().replace(" ", "")
    )

    address_parts = [first_line]
    if postcode:
        address_parts.append(postcode)
    if city:
        address_parts.append(city)

    return ", ".join(address_parts)
