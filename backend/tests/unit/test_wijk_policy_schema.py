"""M048/Phase 6 — WijkPolicy + extended WoonvisiePayload Pydantic validation (WOON-04, WOON-05).

Wave-0 stubs: these tests will fail with ImportError until Plan 06-02 adds WijkPolicy
and the new fields to WoonvisiePayload.
"""
import pytest
from pydantic import ValidationError

from app.ai.factors.woonvisie_match import WijkPolicy, WoonvisiePayload


def test_wijk_policy_accepts_valid_input() -> None:
    wp = WijkPolicy(
        wijk_naam="Blerick",
        prioriteit="groei",
        gewenste_segmenten=["sociaal", "midden"],
        citaat="Blerick blijft groeigebied. 400 woningen tot 2030.",
        pagina=24,
    )
    dumped = wp.model_dump()
    assert dumped["wijk_naam"] == "Blerick"
    assert dumped["prioriteit"] == "groei"
    assert dumped["pagina"] == 24


def test_wijk_policy_rejects_empty_citaat() -> None:
    with pytest.raises(ValidationError):
        WijkPolicy(
            wijk_naam="Blerick",
            prioriteit="groei",
            gewenste_segmenten=["sociaal"],
            citaat="",  # min_length=1 must reject
            pagina=24,
        )


def test_wijk_policy_rejects_invalid_prioriteit() -> None:
    with pytest.raises(ValidationError):
        WijkPolicy(
            wijk_naam="Blerick",
            prioriteit="expansie",  # not in literal union
            gewenste_segmenten=["sociaal"],
            citaat="x",
            pagina=None,
        )


def test_wijk_policy_rejects_invalid_segment() -> None:
    with pytest.raises(ValidationError):
        WijkPolicy(
            wijk_naam="Blerick",
            prioriteit="groei",
            gewenste_segmenten=["studentenkamer"],  # invalid literal
            citaat="x",
        )


def test_wijk_policy_accepts_none_pagina() -> None:
    wp = WijkPolicy(
        wijk_naam="Tegelen",
        prioriteit="herstructurering",
        gewenste_segmenten=[],
        citaat="Tegelen herstructureert.",
        pagina=None,
    )
    assert wp.pagina is None


def test_payload_roundtrip() -> None:
    payload = WoonvisiePayload(
        periode_start=2024,
        periode_einde=2030,
        wijk_policies=[
            WijkPolicy(
                wijk_naam="Blerick",
                prioriteit="groei",
                gewenste_segmenten=["sociaal"],
                citaat="Blerick groeit.",
                pagina=24,
            ),
        ],
        algemeen_citaat="Gemeente Venlo bouwt 2800 woningen.",
        confidence=0.9,
    )
    dumped = payload.model_dump()
    assert dumped["wijk_policies"][0]["wijk_naam"] == "Blerick"
    assert dumped["algemeen_citaat"].startswith("Gemeente Venlo")
    # roundtrip
    assert WoonvisiePayload.model_validate(dumped).confidence == 0.9


def test_payload_defaults_for_new_fields() -> None:
    payload = WoonvisiePayload(periode_start=2024, periode_einde=2030, confidence=0.8)
    assert payload.wijk_policies == []
    assert payload.algemeen_citaat == ""
