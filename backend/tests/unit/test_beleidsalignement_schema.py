import pytest
from pydantic import ValidationError

from app.ai.factors.beleidsalignement import (
    OMGEVINGSVISIE_FACTOR_DEF,
    GebiedPolicy,
    OmgevingsvisiePayload,
)


def test_gebiedpolicy_requires_citaat():
    with pytest.raises(ValidationError):
        GebiedPolicy(
            gebied_naam="Transformatiegebieden",
            karakter="transformatie",
            woningbouwprioriteit="hoog",
            transformatie_kansgebied=True,
            gebonden_plaatsen=["Middengebied"],
            citaat="",  # min_length=1 → fail
        )


def test_payload_minimal_valid():
    p = OmgevingsvisiePayload(tijdshorizon=2040, confidence=0.9)
    assert p.gebied_policies == []
    assert p.algemeen_citaat == ""


def test_payload_full_roundtrip():
    p = OmgevingsvisiePayload(
        tijdshorizon=2040,
        gebied_policies=[
            GebiedPolicy(
                gebied_naam="Dorpen",
                karakter="dorp",
                woningbouwprioriteit="gemiddeld",
                transformatie_kansgebied=False,
                gebonden_plaatsen=["Arcen", "Lomm", "Velden", "Belfeld"],
                citaat="bouwen als sociaal investeren",
                pagina=42,
            )
        ],
        algemeen_citaat="We kiezen voor de compacte stad.",
        confidence=0.95,
    )
    assert OmgevingsvisiePayload.model_validate(p.model_dump()) == p


def test_randvoorwaarde_on_payload():
    from app.ai.factors.beleidsalignement import OmgevingsvisiePayload, Randvoorwaarde

    rv = Randvoorwaarde(
        categorie="programmering",
        titel="70/30 verdeling",
        samenvatting="Bij projecten vanaf 30 woningen geldt 70% vrije sector / 30% sociaal.",
        citaat="70% vrije sector en 30% sociale huur",
        pagina=18,
    )
    p = OmgevingsvisiePayload(tijdshorizon=2040, confidence=0.9, randvoorwaarden=[rv])
    assert p.randvoorwaarden[0].categorie == "programmering"
    # default is empty list (back-compat with v4 payloads)
    p2 = OmgevingsvisiePayload(tijdshorizon=2040, confidence=0.9)
    assert p2.randvoorwaarden == []


def test_factor_def_contract():
    assert OMGEVINGSVISIE_FACTOR_DEF.factor_id == "beleidsalignement"
    assert OMGEVINGSVISIE_FACTOR_DEF.tool_name == "extract_beleidsalignement"
    assert OMGEVINGSVISIE_FACTOR_DEF.payload_model is OmgevingsvisiePayload
