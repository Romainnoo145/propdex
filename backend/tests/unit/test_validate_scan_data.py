"""Unit tests for validate_scan_data module.

Tests cover the WijkValidation dataclass rate properties and the
gemeente code normalization helper. No database required.
"""

from app.tools.validate_scan_data import WijkValidation, normalize_gemeente_code


def _make_validation(**overrides) -> WijkValidation:
    defaults: dict = {
        "wijk_naam": "Test Wijk",
        "scan_status": "completed",
        "total_parcels": 100,
        "parcels_with_buildings": 50,
        "bouwjaar_populated": 40,
        "bouwjaar_null": 10,
        "addresses_resolved": 30,
        "addresses_missing": 20,
        "pand_status_populated": 45,
        "pand_status_null": 5,
        "avg_score": 55.0,
        "coverage_ratio": 0.5,
        "address_resolution_ratio": 0.6,
    }
    defaults.update(overrides)
    return WijkValidation(**defaults)


class TestWijkValidation:
    def test_bouwjaar_rate_computed_from_building_parcels_only(self):
        v = _make_validation(parcels_with_buildings=100, bouwjaar_populated=80, bouwjaar_null=20)
        assert abs(v.bouwjaar_rate - 0.8) < 1e-9

    def test_address_rate_computed_from_building_parcels_only(self):
        v = _make_validation(parcels_with_buildings=100, addresses_resolved=60, addresses_missing=40)
        assert abs(v.address_rate - 0.6) < 1e-9

    def test_rates_zero_when_no_building_parcels(self):
        v = _make_validation(
            parcels_with_buildings=0,
            bouwjaar_populated=0,
            bouwjaar_null=0,
            addresses_resolved=0,
            addresses_missing=0,
            pand_status_populated=0,
            pand_status_null=0,
        )
        assert v.bouwjaar_rate == 0.0
        assert v.address_rate == 0.0
        assert v.pand_status_rate == 0.0

    def test_pand_status_rate_computed_correctly(self):
        v = _make_validation(parcels_with_buildings=200, pand_status_populated=190, pand_status_null=10)
        assert abs(v.pand_status_rate - 0.95) < 1e-9

    def test_perfect_rates(self):
        v = _make_validation(
            parcels_with_buildings=50,
            bouwjaar_populated=50,
            bouwjaar_null=0,
            addresses_resolved=50,
            addresses_missing=0,
            pand_status_populated=50,
            pand_status_null=0,
        )
        assert v.bouwjaar_rate == 1.0
        assert v.address_rate == 1.0
        assert v.pand_status_rate == 1.0


class TestGemeenteCodeNormalization:
    def test_strips_gm_prefix(self):
        with_prefix, bare = normalize_gemeente_code("GM0983")
        assert with_prefix == "GM0983"
        assert bare == "0983"

    def test_bare_code_unchanged(self):
        with_prefix, bare = normalize_gemeente_code("0983")
        assert with_prefix == "GM0983"
        assert bare == "0983"

    def test_gm_prefix_case_insensitive(self):
        with_prefix, bare = normalize_gemeente_code("gm0983")
        assert with_prefix == "gm0983"
        assert bare == "0983"

    def test_bare_amsterdam_code(self):
        with_prefix, bare = normalize_gemeente_code("0363")
        assert with_prefix == "GM0363"
        assert bare == "0363"
