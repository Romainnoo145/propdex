"""Tests voor build_splitsing_report assembler (M055/S01)."""

import uuid

import pytest

from app.reports_v2.splitsing_report import build_splitsing_report


@pytest.mark.asyncio
async def test_build_report_for_parcel_with_vergunningplicht(
    db_session, seed_parcel, seed_huisvestingsverordening
):
    parcel = await seed_parcel(
        gemeente_code="0983", buurt_code="BU09831401", bestemmingen=[{"type": "wonen"}]
    )
    await seed_huisvestingsverordening(
        gemeente_code="0983", vergunningplichten=["splitsing", "omzetting"]
    )

    report = await build_splitsing_report(
        db_session, parcel_id=parcel.parcel_id, organization_id=uuid.UUID(int=1)
    )

    assert report.perceel.gemeente_code == "0983"
    assert report.beleid is not None
    assert "splitsing" in report.beleid.vergunningplichten
    assert len(report.jurisprudentie) >= 1
    assert any("Omgevingsloket" in d or "vraag" in d.lower() for d in [report.aanvraag_url])
    assert report.disclaimers  # niet leeg


@pytest.mark.asyncio
async def test_build_report_unknown_parcel_raises(db_session):
    with pytest.raises(LookupError):
        await build_splitsing_report(
            db_session, parcel_id="DOES-NOT-EXIST", organization_id=uuid.UUID(int=1)
        )
