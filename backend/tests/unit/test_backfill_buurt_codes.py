"""Unit tests M053/S12 — buurt-backfill helpers (geen netwerk/DB)."""
import pytest

from app.tools.backfill_buurt_codes import build_buurt_filter, parse_buurt_features


def test_build_buurt_filter_strips_gm_prefix():
    f = build_buurt_filter("GM0983")
    assert "<Literal>BU0983%</Literal>" in f
    assert "statcode" in f


def test_parse_buurt_features_returns_code_geometry_pairs():
    fc = {
        "features": [
            {
                "properties": {"statcode": "BU09831401", "statnaam": "Craneveld"},
                "geometry": {"type": "MultiPolygon", "coordinates": [[[[1, 1], [2, 1], [2, 2], [1, 1]]]]},
            },
            {"properties": {"statcode": "WK098314"}, "geometry": None},  # geen buurt / geen geom → skip
        ]
    }
    out = parse_buurt_features(fc)
    assert len(out) == 1
    assert out[0][0] == "BU09831401"
    assert out[0][1]["type"] == "MultiPolygon"


def test_build_buurt_filter_without_gm_prefix():
    """Input without GM prefix should also produce a valid filter."""
    f = build_buurt_filter("0983")
    assert "<Literal>BU0983%</Literal>" in f
    assert "statcode" in f


def test_build_buurt_filter_invalid_code_raises():
    """Non-digit or wrong-length code raises ValueError."""
    with pytest.raises(ValueError):
        build_buurt_filter("GM098")  # too short

    with pytest.raises(ValueError):
        build_buurt_filter("GM09abc")  # non-digits

    with pytest.raises(ValueError):
        build_buurt_filter("INVALID")  # no digits at all
