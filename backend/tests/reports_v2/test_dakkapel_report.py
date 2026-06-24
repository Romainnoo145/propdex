"""Tests voor build_dakkapel_report assembler (M055/S02)."""

import pytest

from app.reports_v2.dakkapel_report import build_dakkapel_report


@pytest.mark.asyncio
async def test_build_dakkapel_report_venlo(db_session, seed_parcel):
    parcel = await seed_parcel(gemeente_code="0983", bestemmingen=[{"type": "wonen"}])
    rep = await build_dakkapel_report(
        db_session, parcel_id=parcel.parcel_id, today="2026-06-24"
    )
    assert rep.perceel.gemeente_code == "0983"
    assert "mits" in rep.oordeel.achterdakvlak.lower()      # conditioneel
    assert rep.welstand is not None                          # Venlo gecureerd
    assert rep.geldigheidsdatum == "2026-06-24"
    assert rep.disclaimers and "omgevingswet.overheid.nl" in rep.aanvraag_url


@pytest.mark.asyncio
async def test_build_dakkapel_report_onbekende_gemeente_zonder_welstand(
    db_session, seed_parcel
):
    parcel = await seed_parcel(gemeente_code="9999", bestemmingen=[{"type": "wonen"}])
    rep = await build_dakkapel_report(
        db_session, parcel_id=parcel.parcel_id, today="2026-06-24"
    )
    assert rep.welstand is None                              # graceful
    assert rep.oordeel.bepalende_factoren                    # landelijke laag blijft


@pytest.mark.asyncio
async def test_build_dakkapel_report_unknown_parcel_raises(db_session):
    with pytest.raises(LookupError):
        await build_dakkapel_report(db_session, parcel_id="NOPE", today="2026-06-24")
