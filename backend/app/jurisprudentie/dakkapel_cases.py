"""Gecureerde dakkapel-jurisprudentie. Elke duiding geverifieerd tegen bron_url."""

from app.jurisprudentie.models import JurisprudentieCase

DAKKAPEL_CASES: list[JurisprudentieCase] = [
    JurisprudentieCase(
        ecli="ECLI:NL:RVS:2022:3992",
        verbouwingstype="dakkapel",
        gemeente_code=None,  # Helmond, maar landelijk relevant
        instantie="Raad van State",
        datum="2022-12-28",
        themas=["welstand", "voorgevel", "gelijkheidsbeginsel"],
        uitkomst="geweigerd",
        duiding=(
            "Dakkapel aan de voorzijde van een woning in Helmond geweigerd op grond van "
            "de gemeentelijke welstandsnota, die erop gericht is de voorgevels van woningen "
            "zoveel mogelijk vrij te houden van dakkapellen. De Afdeling bevestigde de "
            "weigering: het beroep op het gelijkheidsbeginsel (buurman had al een dakkapel) "
            "slaagde niet omdat die dakkapel van vóór het beleid dateerde. Persoonlijk belang "
            "(meer ruimte en daglicht voor een hobby) leverde geen zwaarwegend economisch of "
            "maatschappelijk belang op dat een uitzondering rechtvaardigde."
        ),
        bron_url="https://uitspraken.rechtspraak.nl/details?id=ECLI:NL:RVS:2022:3992",
    ),
]
