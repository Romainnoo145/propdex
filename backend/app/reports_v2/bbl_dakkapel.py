"""Landelijke Bbl-vergunningvrij-toets voor dakkapellen.

Puur en perceel-onafhankelijk: encodeert de landelijke criteria waaronder een
dakkapel vergunningvrij is (achterdakvlak) versus vergunningplichtig (voor-/
zijdakvlak naar openbaar gebied). Geeft een CONDITIONEEL oordeel (optie A) —
nooit een absoluut ja/nee, want de exacte maten van de geplande dakkapel zijn
hier niet bekend.

⚠️ Verifieer de criteria tegen de actuele Bbl/Omgevingsloket-tekst.
"""

from app.reports_v2.schemas import VergunningOordeel

BBL_CRITERIA: list[str] = [
    "Op het achterdakvlak of een niet naar openbaar gebied gekeerd zijdakvlak",
    "Hoogte van de dakkapel ten hoogste 1,75 m (gemeten vanaf de voet)",
    "Onderzijde ten minste 0,5 m boven de dakvoet",
    "Bovenzijde ten minste 0,5 m onder de nok",
    "Zijkanten ten minste 0,5 m van de zijkanten van het dakvlak",
    "Voorzien van een plat dak",
]


def bbl_vergunningvrij_toets() -> VergunningOordeel:
    """Geef het conditionele landelijke vergunningsoordeel voor een dakkapel."""
    return VergunningOordeel(
        achterdakvlak=(
            "Aan de achterkant is een dakkapel meestal vergunningvrij, mits aan "
            "alle landelijke Bbl-criteria hiernaast wordt voldaan."
        ),
        voor_zijdakvlak=(
            "Aan de voorkant of een naar openbaar gebied gekeerde zijkant is een "
            "dakkapel vergunningplichtig; dan geldt ook de gemeentelijke welstandstoets."
        ),
        bepalende_factoren=list(BBL_CRITERIA),
    )
