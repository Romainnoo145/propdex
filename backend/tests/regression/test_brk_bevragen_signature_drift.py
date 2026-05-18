"""REGRESSION-CRITICAL: pin BRKBevragenClient + fetch_brk_ownership signatures (D14).

Per M050-S02-ENG-PLAN.md D14: ``BRKBevragenClient.get_eigendom`` is the
load-bearing contract for BOTH Phase 105 ephemeral channel
(``property_aggregator.fetch_brk_ownership``) AND M050/S02 persist channel
(``brk_fetch_service.fetch_and_persist``). Any drift breaks both pads.

This file is the STANDALONE D14 pin — the EXTENSION pin lives in
``tests/regression/test_phase105_brk_modal_still_works.py`` (D14 guards d+e).
Two-file defense: if anyone deletes the Phase 105 file by accident, this
standalone file still catches the drift.
"""
from __future__ import annotations

import inspect

from app.government_apis.brk_bevragen import BRKBevragenClient
from app.services.property_aggregator import fetch_brk_ownership


def test_brk_bevragen_get_eigendom_signature_pinned() -> None:
    """D14 IRON RULE: get_eigendom signature MUST NOT drift."""
    sig = inspect.signature(BRKBevragenClient.get_eigendom)
    params = list(sig.parameters.keys())
    assert params == ["self", "identificatie", "client"], (
        f"D14 IRON RULE VIOLATED: BRKBevragenClient.get_eigendom signature "
        f"drifted to {params}. Phase 105 (property_aggregator.fetch_brk_ownership) "
        f"AND M050/S02 (brk_fetch_service.fetch_and_persist) BOTH depend on the "
        f"original shape."
    )
    assert sig.parameters["identificatie"].annotation is str


def test_brk_bevragen_get_kadastraal_object_signature_pinned() -> None:
    sig = inspect.signature(BRKBevragenClient.get_kadastraal_object)
    params = list(sig.parameters.keys())
    assert params == ["self", "identificatie", "client"], (
        f"D14 IRON RULE VIOLATED: get_kadastraal_object drifted to {params}"
    )


def test_brk_bevragen_get_hypotheken_signature_pinned() -> None:
    sig = inspect.signature(BRKBevragenClient.get_hypotheken)
    params = list(sig.parameters.keys())
    assert params == ["self", "identificatie", "client"], (
        f"D14 IRON RULE VIOLATED: get_hypotheken drifted to {params}"
    )


def test_brk_bevragen_get_beslagen_signature_pinned() -> None:
    sig = inspect.signature(BRKBevragenClient.get_beslagen)
    params = list(sig.parameters.keys())
    assert params == ["self", "identificatie", "client"], (
        f"D14 IRON RULE VIOLATED: get_beslagen drifted to {params}"
    )


def test_fetch_brk_ownership_signature_pinned() -> None:
    """D14 guard (d): Phase 105 aggregator entry-point signature pinned.

    fetch_brk_ownership(cadastral_parcels: list[CadastralParcel]) -> BRKOwnership
    The persist channel (M050/S02 brk_router) returns list[BRKOwnershipRecordRead];
    Phase 105 stays on BRKOwnership shape forever.
    """
    sig = inspect.signature(fetch_brk_ownership)
    params = list(sig.parameters.keys())
    assert params == ["cadastral_parcels"], (
        f"D14 IRON RULE VIOLATED: property_aggregator.fetch_brk_ownership "
        f"signature drifted to {params}. Phase 105 modal depends on this shape."
    )
