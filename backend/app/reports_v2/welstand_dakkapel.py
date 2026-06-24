"""Gecureerde welstand-laag voor dakkapellen, per gemeente.

Welstand is niet (auto-)geëxtraheerd; voor de demo handmatig gecureerd per
gemeente. Onbekende gemeente -> None (de view toont 'nog niet beschikbaar').

Bronnen Venlo (0983):
- Venlo Welstandsnota 2013 (PDF, geactualiseerd okt 2023 via venlo.nl):
  https://www.venlo.nl/sites/default/files/2023-10/Welstandsnota%202013%203.pdf
- Sneltoetscriteria dakkapellen via Geoinformatie gemeente Venlo:
  https://kaarten.venlo.nl/welstandsnota/sneltoetscriteria/dakkapellen
- Gemeentelink beschermd stadsgezicht Venlo (1 gezicht: Steyl/dorpsgezicht):
  https://www.gemeentelink.nl/gemeente/venlo/stadsgezichten/
- RCE Kennisbank gezicht 281 (Steyl, beschermd dorpsgezicht, aangewezen 2008):
  https://kennis.cultureelerfgoed.nl/index.php/Gezicht/281
- Adviescommissie Welstand en Erfgoed gemeente Venlo:
  https://www.venlo.nl/adviescommissie-welstand-en-erfgoed
"""

from app.reports_v2.schemas import WelstandBlok

# gemeente_code (zonder GM-prefix) -> gecureerde WelstandBlok
_WELSTAND: dict[str, WelstandBlok] = {
    "0983": WelstandBlok(
        samenvatting=(
            "In gemeente Venlo worden dakkapellen getoetst aan de Welstandsnota 2013. "
            "De sneltoetscriteria schrijven voor: maximale hoogte 150 cm (gemeten vanaf "
            "de voet van de dakkapel), maximale breedte de helft van het betreffende "
            "dakvlak, en minimale afstanden tot bouwmuur (50 cm), eindgevel (100 cm), "
            "nok (50 cm), hoekkeper/kilgoot (50 cm) en naburige dakkapel op hetzelfde "
            "pand (100 cm). Een dakkapel aan de voorzijde valt altijd onder een "
            "welstandstoets; de Adviescommissie Welstand en Erfgoed beoordeelt plannen "
            "die niet via sneltoets zijn goed te keuren. Het enige rijksbeschermd "
            "gezicht in de gemeente Venlo is het dorpsgezicht Steyl (aangewezen 2008); "
            "de Venlose binnenstad heeft geen rijksbeschermd stadsgezicht. Plannen "
            "binnen beschermd Steyl vereisen altijd advies van de welstandscommissie. "
            "Raadpleeg de volledige Welstandsnota 2013 voor gebiedsspecifieke eisen."
        ),
        beschermd_gezicht=False,  # Venlo binnenstad: GEEN rijksbeschermd stadsgezicht.
        # Beschermd gezicht in Venlo = Steyl (dorpsgezicht, 2008). Niet de binnenstad.
        bron_geldig_van="2013-01-01",
        bron_geldig_tot=None,  # Nota uit 2013, geactualiseerde PDF okt 2023; geen einddatum gepubliceerd.
        confidence=0.72,
        # Confidence-onderbouwing: sneltoetscriteria en Steyl-correctie direct
        # geverifieerd via gemeente Venlo + RCE-kennisbank. Geen dakkapel-paragraaf
        # letterlijk uit nota gelezen (PDF te groot om te fetchen); dimensies
        # bevestigd via Geoinformatie Venlo kaarten-portaal.
    ),
}


def welstand_dakkapel(gemeente_code: str | None) -> WelstandBlok | None:
    """Geef de gecureerde welstand-laag voor een gemeente, of None.

    Args:
        gemeente_code: CBS-gemeentecode, met of zonder GM-prefix. ParcelCache slaat
                       de code op MÉT prefix ("GM0983"); de cureerlaag is op de kale
                       code ("0983") gekeyd. Beide vormen worden genormaliseerd.
                       None of onbekende code geeft None terug.

    Returns:
        WelstandBlok voor gecureerde gemeenten, None voor de rest.
    """
    if not gemeente_code:
        return None
    # CBS GM-prefix-quirk: parcel_cache.gemeente_code = "GM0983", dict-key = "0983".
    return _WELSTAND.get(gemeente_code.removeprefix("GM"))
