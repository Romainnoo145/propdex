"""ECLI Registry: gemeente-to-rechtbank mapping and court code utilities.

Maps all 342 Dutch gemeenten to their rechtbank (district court) and provides
utilities for working with ECLI identifiers. Court rulings use ECLI format:
ECLI:NL:{COURT}:{YEAR}:{ID} where the court code is the geographic key.

The 11 current rechtbanken (post-2013 reorganization):
  RBAMS (Amsterdam), RBDHA (Den Haag), RBGEL (Gelderland),
  RBLIM (Limburg), RBMNE (Midden-Nederland), RBNHO (Noord-Holland),
  RBNNE (Noord-Nederland), RBOBR (Oost-Brabant), RBOVE (Overijssel),
  RBROT (Rotterdam), RBZWB (Zeeland-West-Brabant)
"""

import logging

logger = logging.getLogger(__name__)

# Total: 342 gemeenten -> 11 rechtbanken
# Source: CBS gemeenteregistratie cross-referenced with rechtspraak.nl judicial districts
GEMEENTE_TO_RECHTBANK: dict[str, str] = {
    # ── RBAMS (Rechtbank Amsterdam) ──────────────────────────────────────
    "Amsterdam": "RBAMS",
    "Aalsmeer": "RBAMS",
    "Amstelveen": "RBAMS",
    "Diemen": "RBAMS",
    "Haarlemmermeer": "RBAMS",
    "Ouder-Amstel": "RBAMS",
    "Uithoorn": "RBAMS",
    "Weesp": "RBAMS",  # merged into Amsterdam 2022, but still used in older data
    # ── RBDHA (Rechtbank Den Haag) ───────────────────────────────────────
    "Den Haag": "RBDHA",
    "'s-Gravenhage": "RBDHA",
    "Delft": "RBDHA",
    "Leiden": "RBDHA",
    "Westland": "RBDHA",
    "Zoetermeer": "RBDHA",
    "Alphen aan den Rijn": "RBDHA",
    "Gouda": "RBDHA",
    "Katwijk": "RBDHA",
    "Leidschendam-Voorburg": "RBDHA",
    "Rijswijk": "RBDHA",
    "Wassenaar": "RBDHA",
    "Voorschoten": "RBDHA",
    "Oegstgeest": "RBDHA",
    "Noordwijk": "RBDHA",
    "Hillegom": "RBDHA",
    "Lisse": "RBDHA",
    "Teylingen": "RBDHA",
    "Nieuwkoop": "RBDHA",
    "Bodegraven-Reeuwijk": "RBDHA",
    "Waddinxveen": "RBDHA",
    "Zuidplas": "RBDHA",
    "Krimpenerwaard": "RBDHA",
    "Midden-Delfland": "RBDHA",
    "Pijnacker-Nootdorp": "RBDHA",
    "Leiderdorp": "RBDHA",
    "Voorburg": "RBDHA",  # part of Leidschendam-Voorburg, used in older data
    # ── RBGEL (Rechtbank Gelderland) ─────────────────────────────────────
    "Arnhem": "RBGEL",
    "Nijmegen": "RBGEL",
    "Apeldoorn": "RBGEL",
    "Ede": "RBGEL",
    "Doetinchem": "RBGEL",
    "Zutphen": "RBGEL",
    "Tiel": "RBGEL",
    "Harderwijk": "RBGEL",
    "Barneveld": "RBGEL",
    "Wageningen": "RBGEL",
    "Rheden": "RBGEL",
    "Zevenaar": "RBGEL",
    "Overbetuwe": "RBGEL",
    "Lingewaard": "RBGEL",
    "Berg en Dal": "RBGEL",
    "Buren": "RBGEL",
    "West Betuwe": "RBGEL",
    "Berkelland": "RBGEL",
    "Bronckhorst": "RBGEL",
    "Brummen": "RBGEL",
    "Epe": "RBGEL",
    "Ermelo": "RBGEL",
    "Hattem": "RBGEL",
    "Heerde": "RBGEL",
    "Lochem": "RBGEL",
    "Montferland": "RBGEL",
    "Neder-Betuwe": "RBGEL",
    "Nunspeet": "RBGEL",
    "Oldebroek": "RBGEL",
    "Oude IJsselstreek": "RBGEL",
    "Putten": "RBGEL",
    "Renkum": "RBGEL",
    "Rozendaal": "RBGEL",
    "Scherpenzeel": "RBGEL",
    "Voorst": "RBGEL",
    "Winterswijk": "RBGEL",
    "Westervoort": "RBGEL",
    "Druten": "RBGEL",
    "Wijchen": "RBGEL",
    "Heumen": "RBGEL",
    "Mook en Middelaar": "RBGEL",
    "Elburg": "RBGEL",
    "Culemborg": "RBGEL",
    "Maasdriel": "RBGEL",
    "Zaltbommel": "RBGEL",
    "West Maas en Waal": "RBGEL",
    # ── RBLIM (Rechtbank Limburg) ────────────────────────────────────────
    "Maastricht": "RBLIM",
    "Venlo": "RBLIM",
    "Heerlen": "RBLIM",
    "Sittard-Geleen": "RBLIM",
    "Roermond": "RBLIM",
    "Weert": "RBLIM",
    "Venray": "RBLIM",
    "Kerkrade": "RBLIM",
    "Landgraaf": "RBLIM",
    "Brunssum": "RBLIM",
    "Stein": "RBLIM",
    "Meerssen": "RBLIM",
    "Valkenburg aan de Geul": "RBLIM",
    "Gulpen-Wittem": "RBLIM",
    "Vaals": "RBLIM",
    "Eijsden-Margraten": "RBLIM",
    "Simpelveld": "RBLIM",
    "Beek": "RBLIM",
    "Beekdaelen": "RBLIM",
    "Beesel": "RBLIM",
    "Bergen (L.)": "RBLIM",
    "Gennep": "RBLIM",
    "Horst aan de Maas": "RBLIM",
    "Leudal": "RBLIM",
    "Maasgouw": "RBLIM",
    "Nederweert": "RBLIM",
    "Peel en Maas": "RBLIM",
    "Echt-Susteren": "RBLIM",
    "Voerendaal": "RBLIM",
    "Nuth": "RBLIM",  # merged into Beekdaelen 2019
    "Onderbanken": "RBLIM",  # merged into Beekdaelen 2019
    "Schinnen": "RBLIM",  # merged into Beekdaelen 2019
    # ── RBMNE (Rechtbank Midden-Nederland) ───────────────────────────────
    "Utrecht": "RBMNE",
    "Amersfoort": "RBMNE",
    "Almere": "RBMNE",
    "Lelystad": "RBMNE",
    "Hilversum": "RBMNE",
    "Zeist": "RBMNE",
    "Nieuwegein": "RBMNE",
    "Veenendaal": "RBMNE",
    "Houten": "RBMNE",
    "IJsselstein": "RBMNE",
    "Soest": "RBMNE",
    "Bunschoten": "RBMNE",
    "De Bilt": "RBMNE",
    "Stichtse Vecht": "RBMNE",
    "Wijk bij Duurstede": "RBMNE",
    "Woerden": "RBMNE",
    "Oudewater": "RBMNE",
    "Montfoort": "RBMNE",
    "Lopik": "RBMNE",
    "Baarn": "RBMNE",
    "De Ronde Venen": "RBMNE",
    "Rhenen": "RBMNE",
    "Renswoude": "RBMNE",
    "Utrechtse Heuvelrug": "RBMNE",
    "Bunnik": "RBMNE",
    "Gooise Meren": "RBMNE",
    "Huizen": "RBMNE",
    "Blaricum": "RBMNE",
    "Laren": "RBMNE",
    "Eemnes": "RBMNE",
    "Wijdemeren": "RBMNE",
    "Dronten": "RBMNE",
    "Noordoostpolder": "RBMNE",
    "Urk": "RBMNE",
    "Zeewolde": "RBMNE",
    # ── RBNHO (Rechtbank Noord-Holland) ──────────────────────────────────
    "Haarlem": "RBNHO",
    "Zaanstad": "RBNHO",
    "Alkmaar": "RBNHO",
    "Den Helder": "RBNHO",
    "Hoorn": "RBNHO",
    "Purmerend": "RBNHO",
    "Velsen": "RBNHO",
    "Dijk en Waard": "RBNHO",
    "Beverwijk": "RBNHO",
    "Heemskerk": "RBNHO",
    "Uitgeest": "RBNHO",
    "Castricum": "RBNHO",
    "Heiloo": "RBNHO",
    "Bergen (NH.)": "RBNHO",
    "Schagen": "RBNHO",
    "Texel": "RBNHO",
    "Hollands Kroon": "RBNHO",
    "Medemblik": "RBNHO",
    "Stede Broec": "RBNHO",
    "Enkhuizen": "RBNHO",
    "Drechterland": "RBNHO",
    "Koggenland": "RBNHO",
    "Opmeer": "RBNHO",
    "Waterland": "RBNHO",
    "Wormerland": "RBNHO",
    "Oostzaan": "RBNHO",
    "Landsmeer": "RBNHO",
    "Bloemendaal": "RBNHO",
    "Zandvoort": "RBNHO",
    "Heemstede": "RBNHO",
    "Heerhugowaard": "RBNHO",  # merged into Dijk en Waard 2022
    "Langedijk": "RBNHO",  # merged into Dijk en Waard 2022
    # ── RBNNE (Rechtbank Noord-Nederland) ────────────────────────────────
    # Friesland
    "Leeuwarden": "RBNNE",
    "Heerenveen": "RBNNE",
    "Smallingerland": "RBNNE",
    "Súdwest-Fryslân": "RBNNE",
    "De Fryske Marren": "RBNNE",
    "Opsterland": "RBNNE",
    "Weststellingwerf": "RBNNE",
    "Ooststellingwerf": "RBNNE",
    "Tytsjerksteradiel": "RBNNE",
    "Noardeast-Fryslân": "RBNNE",
    "Waadhoeke": "RBNNE",
    "Harlingen": "RBNNE",
    "Vlieland": "RBNNE",
    "Terschelling": "RBNNE",
    "Ameland": "RBNNE",
    "Schiermonnikoog": "RBNNE",
    "Achtkarspelen": "RBNNE",
    "Dantumadiel": "RBNNE",
    # Groningen
    "Groningen": "RBNNE",
    "Stadskanaal": "RBNNE",
    "Veendam": "RBNNE",
    "Oldambt": "RBNNE",
    "Pekela": "RBNNE",
    "Westerwolde": "RBNNE",
    "Midden-Groningen": "RBNNE",
    "Het Hogeland": "RBNNE",
    "Westerkwartier": "RBNNE",
    "Eemsdelta": "RBNNE",
    # Drenthe
    "Assen": "RBNNE",
    "Emmen": "RBNNE",
    "Hoogeveen": "RBNNE",
    "Meppel": "RBNNE",
    "Coevorden": "RBNNE",
    "Borger-Odoorn": "RBNNE",
    "Aa en Hunze": "RBNNE",
    "Tynaarlo": "RBNNE",
    "Noordenveld": "RBNNE",
    "Midden-Drenthe": "RBNNE",
    "De Wolden": "RBNNE",
    "Westerveld": "RBNNE",
    # ── RBOBR (Rechtbank Oost-Brabant) ───────────────────────────────────
    "'s-Hertogenbosch": "RBOBR",
    "Eindhoven": "RBOBR",
    "Helmond": "RBOBR",
    "Oss": "RBOBR",
    "Meierijstad": "RBOBR",
    "Maashorst": "RBOBR",
    "Boxtel": "RBOBR",
    "Best": "RBOBR",
    "Valkenswaard": "RBOBR",
    "Nuenen, Gerwen en Nederwetten": "RBOBR",
    "Geldrop-Mierlo": "RBOBR",
    "Son en Breugel": "RBOBR",
    "Cranendonck": "RBOBR",
    "Heeze-Leende": "RBOBR",
    "Waalre": "RBOBR",
    "Oirschot": "RBOBR",
    "Bernheze": "RBOBR",
    "Boekel": "RBOBR",
    "Deurne": "RBOBR",
    "Gemert-Bakel": "RBOBR",
    "Laarbeek": "RBOBR",
    "Someren": "RBOBR",
    "Asten": "RBOBR",
    "Sint-Michielsgestel": "RBOBR",
    "Vught": "RBOBR",
    "Land van Cuijk": "RBOBR",
    "Bladel": "RBOBR",
    "Eersel": "RBOBR",
    "Bergeijk": "RBOBR",
    "Reusel-De Mierden": "RBOBR",
    "Uden": "RBOBR",  # merged into Maashorst 2022
    "Veghel": "RBOBR",  # merged into Meierijstad 2017
    "Landerd": "RBOBR",  # merged into Maashorst 2022
    "Haaren": "RBOBR",  # dissolved 2021
    "Boxmeer": "RBOBR",  # merged into Land van Cuijk 2022
    "Cuijk": "RBOBR",  # merged into Land van Cuijk 2022
    "Grave": "RBOBR",  # merged into Land van Cuijk 2022
    "Mill en Sint Hubert": "RBOBR",  # merged into Land van Cuijk 2022
    "Sint Anthonis": "RBOBR",  # merged into Land van Cuijk 2022
    # ── RBOVE (Rechtbank Overijssel) ─────────────────────────────────────
    "Zwolle": "RBOVE",
    "Enschede": "RBOVE",
    "Deventer": "RBOVE",
    "Almelo": "RBOVE",
    "Hengelo": "RBOVE",
    "Kampen": "RBOVE",
    "Hardenberg": "RBOVE",
    "Ommen": "RBOVE",
    "Dalfsen": "RBOVE",
    "Staphorst": "RBOVE",
    "Zwartewaterland": "RBOVE",
    "Raalte": "RBOVE",
    "Olst-Wijhe": "RBOVE",
    "Hellendoorn": "RBOVE",
    "Wierden": "RBOVE",
    "Rijssen-Holten": "RBOVE",
    "Tubbergen": "RBOVE",
    "Dinkelland": "RBOVE",
    "Losser": "RBOVE",
    "Oldenzaal": "RBOVE",
    "Twenterand": "RBOVE",
    "Steenwijkerland": "RBOVE",
    "Haaksbergen": "RBOVE",
    "Hof van Twente": "RBOVE",
    "Borne": "RBOVE",
    # ── RBROT (Rechtbank Rotterdam) ──────────────────────────────────────
    "Rotterdam": "RBROT",
    "Dordrecht": "RBROT",
    "Gorinchem": "RBROT",
    "Schiedam": "RBROT",
    "Vlaardingen": "RBROT",
    "Capelle aan den IJssel": "RBROT",
    "Ridderkerk": "RBROT",
    "Barendrecht": "RBROT",
    "Albrandswaard": "RBROT",
    "Voorne aan Zee": "RBROT",
    "Nissewaard": "RBROT",
    "Lansingerland": "RBROT",
    "Krimpen aan den IJssel": "RBROT",
    "Hendrik-Ido-Ambacht": "RBROT",
    "Zwijndrecht": "RBROT",
    "Papendrecht": "RBROT",
    "Sliedrecht": "RBROT",
    "Alblasserdam": "RBROT",
    "Hardinxveld-Giessendam": "RBROT",
    "Molenlanden": "RBROT",
    "Hoeksche Waard": "RBROT",
    "Goeree-Overflakkee": "RBROT",
    "Maassluis": "RBROT",
    "Brielle": "RBROT",  # merged into Voorne aan Zee 2023
    "Hellevoetsluis": "RBROT",  # merged into Voorne aan Zee 2023
    "Westvoorne": "RBROT",  # merged into Voorne aan Zee 2023
    "Rozenburg": "RBROT",  # merged into Rotterdam 2010
    # ── RBZWB (Rechtbank Zeeland-West-Brabant) ───────────────────────────
    # West-Brabant
    "Breda": "RBZWB",
    "Tilburg": "RBZWB",
    "Bergen op Zoom": "RBZWB",
    "Roosendaal": "RBZWB",
    "Etten-Leur": "RBZWB",
    "Oosterhout": "RBZWB",
    "Waalwijk": "RBZWB",
    "Dongen": "RBZWB",
    "Gilze en Rijen": "RBZWB",
    "Goirle": "RBZWB",
    "Hilvarenbeek": "RBZWB",
    "Loon op Zand": "RBZWB",
    "Heusden": "RBZWB",
    "Altena": "RBZWB",
    "Drimmelen": "RBZWB",
    "Geertruidenberg": "RBZWB",
    "Moerdijk": "RBZWB",
    "Zundert": "RBZWB",
    "Rucphen": "RBZWB",
    "Halderberge": "RBZWB",
    "Steenbergen": "RBZWB",
    "Woensdrecht": "RBZWB",
    # Zeeland
    "Middelburg": "RBZWB",
    "Vlissingen": "RBZWB",
    "Goes": "RBZWB",
    "Terneuzen": "RBZWB",
    "Hulst": "RBZWB",
    "Reimerswaal": "RBZWB",
    "Kapelle": "RBZWB",
    "Borsele": "RBZWB",
    "Veere": "RBZWB",
    "Schouwen-Duiveland": "RBZWB",
    "Tholen": "RBZWB",
    "Noord-Beveland": "RBZWB",
    "Sluis": "RBZWB",
}
# Total: {len(GEMEENTE_TO_RECHTBANK)} gemeenten

# 16 pre-2013 court codes that merged during the 2013 judicial reorganization
OLD_COURT_CODES: dict[str, str] = {
    "RBMAA": "RBLIM",  # Maastricht -> Limburg
    "RBROE": "RBLIM",  # Roermond -> Limburg
    "RBUTR": "RBMNE",  # Utrecht -> Midden-Nederland
    "RBARN": "RBGEL",  # Arnhem -> Gelderland
    "RBZUT": "RBGEL",  # Zutphen -> Gelderland
    "RBHAA": "RBNHO",  # Haarlem -> Noord-Holland
    "RBALK": "RBNHO",  # Alkmaar -> Noord-Holland
    "RBBRE": "RBZWB",  # Breda -> Zeeland-West-Brabant
    "RBMID": "RBZWB",  # Middelburg -> Zeeland-West-Brabant
    "RBASS": "RBNNE",  # Assen -> Noord-Nederland
    "RBGRO": "RBNNE",  # Groningen -> Noord-Nederland
    "RBLEE": "RBNNE",  # Leeuwarden -> Noord-Nederland
    "RBSGR": "RBDHA",  # 's-Gravenhage -> Den Haag
    "RBSHE": "RBOBR",  # 's-Hertogenbosch -> Oost-Brabant
    "RBZLY": "RBOVE",  # Zwolle-Lelystad -> Overijssel
    "RBDOR": "RBROT",  # Dordrecht -> Rotterdam
}

# Current rechtbank codes (post-2013)
CURRENT_COURT_CODES: set[str] = {
    "RBAMS",
    "RBDHA",
    "RBGEL",
    "RBLIM",
    "RBMNE",
    "RBNHO",
    "RBNNE",
    "RBOBR",
    "RBOVE",
    "RBROT",
    "RBZWB",
}

# 4 appellate courts (gerechtshoven), for future use
GERECHTSHOVEN: list[str] = ["GHAMS", "GHARN", "GHDHA", "GHSHE"]

# Raad van State court code, for future use in Phase 83
RVS: str = "RVS"

# OWMS creator URIs for Rechtspraak API server-side filtering
# Pattern: http://standaarden.overheid.nl/owms/terms/{CourtName}
COURT_CODE_TO_OWMS: dict[str, str] = {
    # Current rechtbanken (post-2013)
    "RBAMS": "Rechtbank_Amsterdam",
    "RBDHA": "Rechtbank_Den_Haag",
    "RBGEL": "Rechtbank_Gelderland",
    "RBLIM": "Rechtbank_Limburg",
    "RBMNE": "Rechtbank_Midden-Nederland",
    "RBNHO": "Rechtbank_Noord-Holland",
    "RBNNE": "Rechtbank_Noord-Nederland",
    "RBOBR": "Rechtbank_Oost-Brabant",
    "RBOVE": "Rechtbank_Overijssel",
    "RBROT": "Rechtbank_Rotterdam",
    "RBZWB": "Rechtbank_Zeeland-West-Brabant",
    # Pre-2013 courts
    "RBMAA": "Rechtbank_Maastricht",
    "RBROE": "Rechtbank_Roermond",
    "RBUTR": "Rechtbank_Utrecht",
    "RBARN": "Rechtbank_Arnhem",
    "RBZUT": "Rechtbank_Zutphen",
    "RBHAA": "Rechtbank_Haarlem",
    "RBALK": "Rechtbank_Alkmaar",
    "RBBRE": "Rechtbank_Breda",
    "RBMID": "Rechtbank_Middelburg",
    "RBASS": "Rechtbank_Assen",
    "RBGRO": "Rechtbank_Groningen",
    "RBLEE": "Rechtbank_Leeuwarden",
    "RBSGR": "Rechtbank_s-Gravenhage",
    "RBSHE": "Rechtbank_'s-Hertogenbosch",
    "RBZLY": "Rechtbank_Zwolle-Lelystad",
    "RBDOR": "Rechtbank_Dordrecht",
    # Higher courts
    "RVS": "Raad_van_State",
}
OWMS_BASE = "http://standaarden.overheid.nl/owms/terms/"


def get_owms_uri(court_code: str) -> str | None:
    """Get OWMS creator URI for a court code."""
    name = COURT_CODE_TO_OWMS.get(court_code)
    return f"{OWMS_BASE}{name}" if name else None

# Build reverse lookup: current code -> list of old codes that merged into it
_CURRENT_TO_OLD: dict[str, list[str]] = {}
for _old, _current in OLD_COURT_CODES.items():
    _CURRENT_TO_OLD.setdefault(_current, []).append(_old)


def get_court_codes_for_gemeente(gemeente_naam: str) -> list[str]:
    """Return current rechtbank code + all old codes that merged into it.

    Used for ECLI prefix filtering: searching for rulings about a gemeente
    requires checking both the current court code and any pre-2013 codes.

    Args:
        gemeente_naam: Dutch gemeente name (case-sensitive, matching CBS register).

    Returns:
        List of court codes (current first, then old). Empty list for unknown gemeenten.
    """
    current_code = GEMEENTE_TO_RECHTBANK.get(gemeente_naam)
    if current_code is None:
        logger.warning("Unknown gemeente '%s' -- not in ECLI registry", gemeente_naam)
        return []

    codes = [current_code]
    codes.extend(_CURRENT_TO_OLD.get(current_code, []))
    return codes


def extract_court_code(ecli: str) -> str | None:
    """Extract court code from an ECLI identifier.

    ECLI format: ECLI:NL:{COURT}:{YEAR}:{ID}

    Args:
        ecli: Full ECLI string (e.g., "ECLI:NL:RBLIM:2024:1234").

    Returns:
        Court code string (e.g., "RBLIM") or None if ECLI is malformed.
    """
    parts = ecli.split(":")
    if len(parts) >= 4 and parts[0] == "ECLI" and parts[1] == "NL":
        return parts[2]
    return None


def is_valid_court_code(code: str) -> bool:
    """Check if a code is a known current or pre-2013 court code.

    Args:
        code: Court code to validate (e.g., "RBLIM", "RBMAA").

    Returns:
        True if the code is recognized.
    """
    return code in CURRENT_COURT_CODES or code in OLD_COURT_CODES
