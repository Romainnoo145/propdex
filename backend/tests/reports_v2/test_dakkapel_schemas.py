"""Schema-tests voor het dakkapel-rapport (M055/S02)."""

from app.reports_v2.schemas import (
    DakkapelReport,
    PerceelFeiten,
    VergunningOordeel,
    WelstandBlok,
)


def test_vergunning_oordeel_is_conditioneel() -> None:
    o = VergunningOordeel(
        achterdakvlak="Meestal vergunningvrij mits aan de Bbl-criteria voldaan.",
        voor_zijdakvlak="Vergunningplichtig; welstandstoets van toepassing.",
        bepalende_factoren=["hoogte <= 1,75 m", ">= 0,5 m onder de nok"],
    )
    assert "mits" in o.achterdakvlak.lower()
    assert o.bepalende_factoren


def test_dakkapel_report_serialiseert() -> None:
    rep = DakkapelReport(
        perceel=PerceelFeiten(
            parcel_id="P1",
            adres="Teststraat 1",
            gemeente_code="0983",
            buurt_code=None,
            oppervlakte_m2=120.0,
            bouwjaar=1975,
            bestemmingen=["wonen"],
        ),
        oordeel=VergunningOordeel(
            achterdakvlak="x", voor_zijdakvlak="y", bepalende_factoren=["z"]
        ),
        welstand=None,
        jurisprudentie=[],
        onzekerheden=["exacte maten onbekend"],
        bronnen=["Bbl (landelijk)"],
        geldigheidsdatum="2026-06-24",
        aanvraag_url="https://omgevingswet.overheid.nl/aanvragen",
        disclaimers=["Indicatief."],
    )
    dumped = rep.model_dump()
    assert dumped["welstand"] is None
    assert dumped["oordeel"]["bepalende_factoren"] == ["z"]


def test_welstand_blok_validation() -> None:
    wb = WelstandBlok(
        samenvatting="Beschermde buurt",
        beschermd_gezicht=True,
        bron_geldig_van="2020-01-01",
        bron_geldig_tot=None,
        confidence=0.95,
    )
    assert wb.samenvatting == "Beschermde buurt"
    assert wb.beschermd_gezicht is True
    assert wb.confidence == 0.95
