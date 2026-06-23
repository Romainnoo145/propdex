from app.jurisprudentie.models import JurisprudentieCase

# Gecureerde, echte uitspraken. duiding moet door de curator geverifieerd
# worden tegen de uitspraaktekst op bron_url voordat ze aan een klant getoond
# wordt. Begin klein; breid uit per gemeente/thema.
SPLITSING_CASES: list[JurisprudentieCase] = [
    JurisprudentieCase(
        ecli="ECLI:NL:RVS:2022:1427",
        verbouwingstype="splitsing",
        gemeente_code=None,
        instantie="Raad van State",
        datum="2022-05-18",
        themas=["omzettingsvergunning", "schaarste", "leefbaarheid"],
        uitkomst="geweigerd",
        duiding=(
            "TE VERIFIËREN tegen bron: omzettings-/onttrekkingsvergunning, "
            "toetsing schaarste- en leefbaarheidsonderbouwing."
        ),
        bron_url="https://uitspraken.rechtspraak.nl/details?id=ECLI:NL:RVS:2022:1427",
    ),
    JurisprudentieCase(
        ecli="ECLI:NL:RBDHA:2023:447",
        verbouwingstype="splitsing",
        gemeente_code="0518",
        instantie="Rechtbank Den Haag",
        datum="2023-01-20",
        themas=["omzettingsvergunning", "leefbaarheid"],
        uitkomst="gemengd",
        duiding="TE VERIFIËREN tegen bron: kamerverhuur/omzetting, leefbaarheidsweging.",
        bron_url="https://uitspraken.rechtspraak.nl/details?id=ECLI:NL:RBDHA:2023:447",
    ),
]
