"""Unit tests for permit precedent benchmark helpers."""

from types import SimpleNamespace

from app.services.permit_precedent_benchmark import (
    _comparable_type_from_category,
    _extract_address_key,
    _normalize_postcode,
    _p75,
    _permit_outcome,
)


def test_permit_outcome_mapping():
    assert _permit_outcome("Omgevingsvergunning verleend") == "granted"
    assert _permit_outcome("Omgevingsvergunning geweigerd") == "rejected"
    assert _permit_outcome("Omgevingsvergunning ingetrokken") == "withdrawn"
    assert _permit_outcome("Omgevingsvergunning aangevraagd") == "requested"
    assert _permit_outcome("Omgevingsvergunning") == "other"


def test_comparable_type_mapping():
    assert _comparable_type_from_category("Kapvergunning") == "Kapvergunning"
    assert (
        _comparable_type_from_category("Sloop-/brandveiligheidmelding")
        == "Sloop-/brandveiligheidmelding"
    )
    assert (
        _comparable_type_from_category("Bezwaar ingediend")
        == "Bezwaar / besluitvorming"
    )
    assert _comparable_type_from_category("Omgevingsvergunning verleend") == "Omgevingsvergunning"


def test_p75_calculation():
    assert _p75([]) is None
    assert _p75([10]) == 10
    assert _p75([5, 10, 20, 40]) == 20


def test_normalize_postcode():
    assert _normalize_postcode("5911 aa") == "5911AA"
    assert _normalize_postcode("5911AA") == "5911AA"
    assert _normalize_postcode("invalid") is None


def test_extract_address_key_prefers_metadata_components():
    record = SimpleNamespace(
        metadata_json={"address_components": {"street": "Kerkstraat", "huisnummer": 12}},
        address="Andere straat 1, 5911AA Venlo",
    )
    assert _extract_address_key(record) == ("kerkstraat", 12)


def test_extract_address_key_falls_back_to_address_field():
    record = SimpleNamespace(
        metadata_json={},
        address="Grote Kerkstraat 34A, 5911CH Venlo",
    )
    assert _extract_address_key(record) == ("grote kerkstraat", 34)
