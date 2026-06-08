"""Score v3.0 individual factor scoring functions.

21 factors: 8 potentie + 13 risico. Each returns a FactorResult.
All narrative templates are deterministic Dutch f-strings (no AI calls).
"""

from __future__ import annotations

import math
import unicodedata
from typing import TYPE_CHECKING, Any

from app.services.score_v3 import FactorResult

if TYPE_CHECKING:
    from app.ai.factors.beleidsalignement import GebiedPolicy, OmgevingsvisiePayload
    from app.ai.factors.woonvisie_match import WijkPolicy, WoonvisiePayload

# ---------------------------------------------------------------------------
# Normalization helpers
# ---------------------------------------------------------------------------

def normalize_log(value: float, max_value: float) -> float:
    """Log-scale normalization for continuous variables. Returns 0-1."""
    if value <= 0 or max_value <= 0:
        return 0.0
    return min(1.0, math.log1p(value) / math.log1p(max_value))


def normalize_linear(value: float, min_val: float, max_val: float) -> float:
    """Linear normalization clamped to 0-1."""
    if max_val <= min_val:
        return 0.0
    return max(0.0, min(1.0, (value - min_val) / (max_val - min_val)))


def normalize_binary(condition: bool) -> float:
    """Binary normalization: 0 or 1."""
    return 1.0 if condition else 0.0


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get(d: dict | None, *keys: str, default: Any = None) -> Any:
    """Safely traverse nested dicts."""
    obj = d
    for k in keys:
        if not isinstance(obj, dict):
            return default
        obj = obj.get(k, default)
    return obj


def _best_bestemming_type(parcel_data: dict) -> str:
    """Return primary bestemming type via count-voting + priority tie-breaker.

    M046/S04 BUG-1: previously "meest gunstige keyword-match" — any wonen-
    match in a mixed [verkeer, wonen] or [agrarisch, wonen] parcel dominated
    regardless of proportion. Systematisch optimistisch: een perceel met 2×
    verkeer + 1× wonen werd als "wonen" geklasseerd.

    Now: type that occurs most often wins. Ties broken by the existing
    priority list so transformatie-signaal blijft behouden — een 1× bedrijf
    + 1× wonen mapping blijft naar wonen gaan (developer-relevant).

    Normalizatie: types die een priority-keyword bevatten (bv. "wonen - 2",
    "verkeer - verblijfsgebied") worden genormaliseerd naar het keyword zodat
    "wonen" en "wonen - 2" samen tellen als 2× wonen.

    Fallback: zonder priority-match returns the type literally (niet "onbekend")
    zodat factors die types als "water"/"agrarisch" lezen correct geclassificeerd
    worden.
    """
    bestemmingen = parcel_data.get("bestemmingen") or []
    priority = {"wonen": 4, "centrum": 3, "gemengd": 3, "maatschappelijk": 2}

    counts: dict[str, int] = {}
    for b in bestemmingen:
        if not isinstance(b, dict):
            continue
        btype = str(b.get("type") or "").lower()
        if not btype:
            continue

        # Normalize:
        # 1. Priority keyword contained in btype → use the keyword ("wonen - 2" → "wonen")
        # 2. Else: strip suffix after " - " ("verkeer - verblijfsgebied" → "verkeer")
        #    Zo tellen "verkeer" + "verkeer - verblijfsgebied" als 2× verkeer.
        matched_key = None
        for keyword in priority:
            if keyword in btype:
                matched_key = keyword
                break
        if matched_key:
            key = matched_key
        else:
            key = btype.split(" - ", 1)[0].strip()
        counts[key] = counts.get(key, 0) + 1

    if not counts:
        return "onbekend"

    max_count = max(counts.values())
    candidates = [k for k, v in counts.items() if v == max_count]

    if len(candidates) == 1:
        return candidates[0]

    # Tie-breaker: highest priority among tied candidates (transformatie-favorable)
    return max(candidates, key=lambda k: priority.get(k, -1))


# ---------------------------------------------------------------------------
# POTENTIE FACTORS (8)
# ---------------------------------------------------------------------------

def score_vrije_grond(parcel_data: dict) -> FactorResult:
    """Factor P1: Vrije grond / onderbenutting. Gewicht=12."""
    area = parcel_data.get("area_m2") or 0
    bm = parcel_data.get("building_metrics") or {}
    pand_opp = bm.get("pand_oppervlakte_m2") or 0

    # M046/S02 BUG-2: shape-ratio guard. Langwerpige strook/wegvormige percelen
    # (shape_ratio = perimeter / sqrt(area) > 10) zijn in de praktijk niet
    # bebouwbaar — 2m brede stroken langs wegen, greppels, plantsoenen krijgen
    # anders 100% vrije-grond-score wat semantisch onzin is.
    # Legacy scans zonder perimeter_m key vallen door backward-compat pad.
    perimeter = parcel_data.get("perimeter_m")
    if area > 0 and perimeter is not None and perimeter > 0:
        shape_ratio = perimeter / math.sqrt(area)
        if shape_ratio > 10:
            return FactorResult(
                waarde=None, genormaliseerde_score=0.0, gewicht=12,
                bijdrage=0.0, categorie="potentie",
                toelichting_kort="Perceel lijkt strook/wegvorm — niet bebouwbaar",
                toelichting_lang=(
                    f"Shape-ratio {shape_ratio:.1f} (perimeter {perimeter:.0f}m / "
                    f"sqrt(area {area:.0f}m\u00b2)) wijst op een langwerpig strook- of "
                    f"wegvormig perceel. Deze vorm is in de praktijk ongeschikt voor "
                    f"zelfstandige bebouwing. De ontwikkelpotentie is op 0 gezet."
                ),
                data_bronnen=["Kadaster"],
                missing=True,
            )

    if area <= 0:
        ratio = 0.0
    else:
        ratio = max(0.0, (area - pand_opp) / area)

    score = normalize_log(ratio * 100, 100)
    vrij_m2 = max(0, area - pand_opp)
    pct = round(ratio * 100)

    if pct >= 60:
        kort = f"{pct}% vrije grond ({vrij_m2:.0f}m\u00b2) \u2014 geschikt voor zelfstandige nieuwbouw"
    elif pct >= 30:
        kort = f"{pct}% vrije grond ({vrij_m2:.0f}m\u00b2) \u2014 ruimte voor uitbreiding"
    else:
        kort = f"{pct}% vrije grond ({vrij_m2:.0f}m\u00b2) \u2014 beperkte uitbreidingsruimte"

    lang = (
        f"Dit perceel heeft een oppervlakte van {area:.0f}m\u00b2 waarvan {vrij_m2:.0f}m\u00b2 "
        f"({pct}%) onbebouwd is. "
        + (
            "De ruime vrije grond biedt mogelijkheden voor zelfstandige nieuwbouw of splitsing in meerdere kavels. "
            if pct >= 60 else
            "Er is enige ruimte voor uitbreiding naast de bestaande bebouwing. "
            if pct >= 30 else
            "De beschikbare vrije ruimte is beperkt; uitbreiding is alleen mogelijk in verticale richting of na sloop. "
        )
        + "Bron: Kadaster perceeloppervlakte en BAG pandgeometrie."
    )

    return FactorResult(
        waarde=round(ratio, 3),
        genormaliseerde_score=round(score, 4),
        gewicht=12,
        bijdrage=round(score * 12, 4),
        categorie="potentie",
        toelichting_kort=kort,
        toelichting_lang=lang,
        data_bronnen=["Kadaster", "BAG"],
        missing=False,
    )


def score_optoppotentie(parcel_data: dict) -> FactorResult:
    """Factor P2: Optoppotentie (lagen/hoogte headroom). Gewicht=10."""
    bm = parcel_data.get("building_metrics") or {}
    max_hoogte = bm.get("max_bouwhoogte")
    actual_hoogte = bm.get("actual_bouwhoogte")
    max_lagen = bm.get("max_bouwlagen")
    actual_lagen = bm.get("actual_bouwlagen")

    missing = (max_hoogte is None and max_lagen is None)

    if missing:
        return FactorResult(
            waarde=None, genormaliseerde_score=0.5, gewicht=10,
            bijdrage=round(0.5 * 10, 4), categorie="potentie",
            toelichting_kort="Optoppotentie onbekend \u2014 geen maximale bouwhoogte/bouwlagen beschikbaar",
            toelichting_lang="Er zijn geen gegevens over de maximaal toegestane bouwhoogte of bouwlagen beschikbaar in het omgevingsplan. Hierdoor kan de optoppotentie niet worden beoordeeld. De score is op neutraal gezet.",
            data_bronnen=["PLU WMS", "3D BAG"],
            missing=True,
        )

    # Calculate headroom ratio from best available data
    headroom = 0.0
    detail = ""
    if max_lagen is not None and actual_lagen is not None and max_lagen > 0:
        headroom = max(0.0, (max_lagen - actual_lagen) / max_lagen)
        detail = f"{actual_lagen} van {max_lagen} bouwlagen benut"
    elif max_hoogte is not None and actual_hoogte is not None and max_hoogte > 0:
        headroom = max(0.0, (max_hoogte - actual_hoogte) / max_hoogte)
        detail = f"{actual_hoogte:.1f}m van {max_hoogte:.1f}m bouwhoogte benut"
    elif max_hoogte is not None:
        headroom = 0.5  # have max but no actual
        detail = f"max bouwhoogte {max_hoogte:.1f}m, huidige hoogte onbekend"

    score = min(1.0, headroom)

    if headroom >= 0.4:
        kort = f"Hoge optoppotentie \u2014 {detail}"
    elif headroom > 0:
        kort = f"Beperkte optoppotentie \u2014 {detail}"
    else:
        kort = f"Geen optoppotentie \u2014 {detail}"

    lang = (
        f"De optoppotentie is beoordeeld op basis van het verschil tussen de huidige en "
        f"maximaal toegestane bouwhoogte/bouwlagen. {detail.capitalize()}. "
        + (
            "Er is aanzienlijke ruimte voor verticale uitbreiding (optoppen). Het Rijk stimuleert optoppen als oplossing voor woningnood."
            if headroom >= 0.4 else
            "Er is enige ruimte voor verticale uitbreiding."
            if headroom > 0 else
            "Het gebouw benut de maximaal toegestane hoogte volledig; verticale uitbreiding is niet mogelijk zonder bestemmingsplanwijziging."
        )
    )

    return FactorResult(
        waarde=round(headroom, 3), genormaliseerde_score=round(score, 4),
        gewicht=10, bijdrage=round(score * 10, 4), categorie="potentie",
        toelichting_kort=kort, toelichting_lang=lang,
        data_bronnen=["PLU WMS", "3D BAG"],
        missing=False,
    )


def score_bestemming(parcel_data: dict) -> FactorResult:
    """Factor P3: Bestemming compatibiliteit. Gewicht=12."""
    btype = _best_bestemming_type(parcel_data)

    scores_map = {"wonen": 1.0, "gemengd": 0.7, "centrum": 0.7, "maatschappelijk": 0.4}
    score = 0.2
    for keyword, s in scores_map.items():
        if keyword in btype:
            score = s
            break

    label_map = {1.0: "wonen", 0.7: "gemengd/centrum", 0.4: "maatschappelijk", 0.2: "overig"}
    label = label_map.get(score, btype)

    if score >= 0.7:
        kort = f"Bestemming '{label}' \u2014 woningbouw direct mogelijk"
    elif score >= 0.4:
        kort = f"Bestemming '{label}' \u2014 transformatie naar wonen vereist aanpassing"
    else:
        kort = f"Bestemming '{label}' \u2014 bestemmingswijziging nodig voor woningbouw"

    lang = (
        f"Het perceel heeft de bestemming '{btype}'. "
        + (
            "Woningbouw is direct mogelijk zonder bestemmingsplanwijziging. Dit bespaart maanden aan proceduretijd."
            if score >= 0.7 else
            "Transformatie naar woningbouw vereist een aanpassing van het bestemmingsplan, wat een formeel traject met inspraak inhoudt."
            if score >= 0.4 else
            "Voor woningbouw is een bestemmingsplanwijziging nodig. Dit is een formeel gemeentelijk traject dat maanden tot jaren kan duren."
        )
    )

    return FactorResult(
        waarde=btype, genormaliseerde_score=round(score, 4),
        gewicht=12, bijdrage=round(score * 12, 4), categorie="potentie",
        toelichting_kort=kort, toelichting_lang=lang,
        data_bronnen=["Bestemmingsplan", "Ruimtelijkeplannen.nl"],
        missing=False,
    )


def score_leegstand(parcel_data: dict) -> FactorResult:
    """Factor P4: Leegstand (acquisitiekans). Gewicht=8."""
    signal = parcel_data.get("vacancy_signal") or "onbekend"

    score_map = {"leeg_perceel": 1.0, "leegstaand_pand": 0.8, "onbekend": 0.3, "in_gebruik": 0.0}
    score = score_map.get(signal, 0.3)

    label_map = {
        "leeg_perceel": "Leeg perceel \u2014 maximale acquisitiekans",
        "leegstaand_pand": "Leegstaand pand \u2014 hoge acquisitiekans",
        "onbekend": "Gebruiksstatus onbekend",
        "in_gebruik": "Pand in gebruik \u2014 acquisitie vereist onderhandeling",
    }
    kort = label_map.get(signal, "Leegstandsignaal onbekend")

    lang_map = {
        "leeg_perceel": "Het perceel heeft geen geregistreerd pand in de BAG. Dit wijst op een leeg perceel dat direct beschikbaar is voor ontwikkeling zonder sloop- of verwervingskosten.",
        "leegstaand_pand": "Het pand op dit perceel staat geregistreerd als leegstaand of buiten gebruik. Leegstaande panden zijn gemakkelijker te verwerven en bieden mogelijkheden voor transformatie of herontwikkeling.",
        "onbekend": "De gebruiksstatus van het pand is niet eenduidig vast te stellen op basis van BAG-gegevens. Nader onderzoek ter plaatse wordt aanbevolen.",
        "in_gebruik": "Het pand is volgens de BAG in gebruik. Verwerving vereist onderhandeling met de huidige eigenaar/gebruiker.",
    }

    return FactorResult(
        waarde=signal, genormaliseerde_score=round(score, 4),
        gewicht=8, bijdrage=round(score * 8, 4), categorie="potentie",
        toelichting_kort=kort, toelichting_lang=lang_map.get(signal, ""),
        data_bronnen=["BAG"],
        missing=False,
    )


def score_funda_frictie(parcel_data: dict) -> FactorResult:
    """Factor P5: Funda-frictie / gemotiveerde verkoper. Gewicht=5.

    M046/S03: Funda-integratie is nog niet productief — `funda_snapshot.py`
    is alleen als PoC gedraaid (5 listings, 2026-02-27). Totdat de ingestion
    wordt opgeschaald blijft deze factor voor ~100% van scans missing=True.
    Narrative vermeldt expliciet de pilot-state zodat rapporten niet de
    neutrale 0.5 als legitiem Funda-signaal interpreteren.
    """
    ms = parcel_data.get("market_signals")
    if not ms or not isinstance(ms, dict):
        return FactorResult(
            waarde=None, genormaliseerde_score=0.5, gewicht=5,
            bijdrage=round(0.5 * 5, 4), categorie="potentie",
            toelichting_kort="Funda-data niet beschikbaar (pilot-fase)",
            toelichting_lang=(
                "De Funda-integratie is nog niet productief — de listing-ingestion "
                "draait alleen als proof-of-concept. Er zijn voor dit perceel geen "
                "marktgegevens (advertentieduur, prijswijzigingen) beschikbaar. "
                "De score is op neutraal gezet en telt niet als legitiem Funda-signaal; "
                "zodra de ingestion-pipeline wordt opgeschaald, activeert deze factor vanzelf."
            ),
            data_bronnen=["Funda (pilot)"],
            missing=True,
        )

    duration = ms.get("listing_duration_days") or 0
    price_changes = ms.get("price_change_count") or 0

    # Long duration + price drops = motivated seller
    duration_score = normalize_linear(duration, 0, 365)
    price_score = normalize_linear(price_changes, 0, 5)
    score = min(1.0, duration_score * 0.6 + price_score * 0.4)

    if score >= 0.6:
        kort = f"Hoge marktfrictie \u2014 {duration} dagen op Funda, {price_changes} prijswijzigingen"
    elif score >= 0.3:
        kort = f"Enige marktfrictie \u2014 {duration} dagen op Funda"
    else:
        kort = f"Lage marktfrictie \u2014 {duration} dagen op Funda"

    lang = (
        f"Het object staat {duration} dagen op Funda met {price_changes} prijswijziging(en). "
        + (
            "De lange advertentieduur en prijsaanpassingen wijzen op een gemotiveerde verkoper, wat onderhandelingsruimte biedt."
            if score >= 0.6 else
            "De advertentieduur is gemiddeld; er kan enige onderhandelingsruimte zijn."
            if score >= 0.3 else
            "Het object is recent geplaatst of snel verkocht; er is weinig indicatie van verkoopdruk."
        )
    )

    return FactorResult(
        waarde={"duration_days": duration, "price_changes": price_changes},
        genormaliseerde_score=round(score, 4), gewicht=5,
        bijdrage=round(score * 5, 4), categorie="potentie",
        toelichting_kort=kort, toelichting_lang=lang,
        data_bronnen=["Funda"],
        missing=False,
    )


def score_perceelgrootte(parcel_data: dict) -> FactorResult:
    """Factor P6: Perceelgrootte (schaal). Gewicht=12."""
    area = parcel_data.get("area_m2") or 0
    score = normalize_log(area, 10000)

    if area >= 2000:
        kort = f"Groot perceel ({area:.0f}m\u00b2) \u2014 hoog schaalpotentieel"
    elif area >= 500:
        kort = f"Middelgroot perceel ({area:.0f}m\u00b2) \u2014 voldoende schaal"
    else:
        kort = f"Klein perceel ({area:.0f}m\u00b2) \u2014 beperkt schaalpotentieel"

    lang = (
        f"Het perceel heeft een oppervlakte van {area:.0f}m\u00b2. "
        + (
            "Bij een groot perceel biedt het bestemmingsplan doorgaans ruimte voor meerdere woningen of een substantieel bouwvolume. Slimme beleggers zoeken actief naar percelen met onbenutte ontwikkelruimte."
            if area >= 2000 else
            "De perceelgrootte biedt voldoende schaal voor een bescheiden ontwikkeling of uitbreiding."
            if area >= 500 else
            "De beperkte perceelgrootte limiteert de ontwikkelmogelijkheden. Mogelijk geschikt voor een enkele woning of kleinschalige transformatie."
        )
    )

    return FactorResult(
        waarde=area, genormaliseerde_score=round(score, 4),
        gewicht=12, bijdrage=round(score * 12, 4), categorie="potentie",
        toelichting_kort=kort, toelichting_lang=lang,
        data_bronnen=["Kadaster"],
        missing=False,
    )


def score_demografie(neighborhood_metrics: dict | None) -> FactorResult:
    """Factor P7: Demografie (CBS). Gewicht=8."""
    data = _get(neighborhood_metrics, "data")
    if not data:
        return FactorResult(
            waarde=None, genormaliseerde_score=0.5, gewicht=8,
            bijdrage=round(0.5 * 8, 4), categorie="potentie",
            toelichting_kort="Geen demografische wijkgegevens beschikbaar",
            toelichting_lang="Er zijn geen CBS-wijkgegevens beschikbaar. De demografische score is op neutraal gezet.",
            data_bronnen=["CBS StatLine"],
            missing=True,
        )

    inwoners = _get(data, "demografie", "aantal_inwoners") or 0
    inkomen = _get(data, "inkomen", "gem_gestandaardiseerd") or 0
    huishoudens = _get(data, "huishoudens", "totaal") or 0

    # Higher population + income + households = more demand
    pop_score = normalize_linear(inwoners, 0, 25000)
    income_score = normalize_linear(inkomen, 20000, 45000)
    hh_score = normalize_linear(huishoudens, 0, 12000)

    score = pop_score * 0.3 + income_score * 0.4 + hh_score * 0.3
    score = min(1.0, score)

    kort = f"Wijk: {inwoners:,} inwoners, gem. inkomen \u20ac{inkomen:,.0f}"
    lang = (
        f"De wijk telt {inwoners:,} inwoners en {huishoudens:,} huishoudens met een gemiddeld "
        f"gestandaardiseerd inkomen van \u20ac{inkomen:,.0f}. "
        + (
            "De combinatie van bevolkingsomvang en inkomensniveau wijst op sterke woningvraag in dit gebied."
            if score >= 0.6 else
            "De demografische indicatoren duiden op gemiddelde woningvraag."
            if score >= 0.3 else
            "De demografische indicatoren duiden op beperkte woningvraag in dit gebied."
        )
    )

    return FactorResult(
        waarde={"inwoners": inwoners, "inkomen": inkomen, "huishoudens": huishoudens},
        genormaliseerde_score=round(score, 4), gewicht=8,
        bijdrage=round(score * 8, 4), categorie="potentie",
        toelichting_kort=kort, toelichting_lang=lang,
        data_bronnen=["CBS StatLine"],
        missing=False,
    )


def score_vergunning_succeskans(neighborhood_metrics: dict | None) -> FactorResult:
    """Factor P8: Vergunnings-succeskans (juridisch klimaat). Gewicht=13."""
    # Juridisch klimaat data is currently sparse (268/286 rulings unanalyzed)
    # Score neutral when unavailable
    jk = _get(neighborhood_metrics, "juridisch_klimaat")
    if not jk or not isinstance(jk, dict):
        return FactorResult(
            waarde=None, genormaliseerde_score=0.5, gewicht=13,
            bijdrage=round(0.5 * 13, 4), categorie="potentie",
            toelichting_kort="Juridisch klimaat onbekend \u2014 onvoldoende data voor beoordeling",
            toelichting_lang="Er zijn onvoldoende geanalyseerde uitspraken beschikbaar om het juridisch klimaat voor vergunningverlening te beoordelen. De score is op neutraal gezet.",
            data_bronnen=["Rechtspraak.nl"],
            missing=True,
            succeskans_missing=True,
            succeskans_reason="no_juridisch_klimaat_data",
            dev_type_ruling_count=0,
            total_ruling_count=0,
        )

    # M046/S01 RM-1: sparse-data signaal uit aggregator. Wanneer < 5 developer-
    # relevante uitspraken in de dataset zitten behandelt de factor dit als
    # missing — voorkomt dat 1-2 toevallige dev-rulings de 13-gewicht-factor
    # domineren.
    if jk.get("missing") is True:
        dev_count = jk.get("ruling_count_dev_types", 0)
        total_count = jk.get("ruling_count", 0)
        return FactorResult(
            waarde=None, genormaliseerde_score=0.5, gewicht=13,
            bijdrage=round(0.5 * 13, 4), categorie="potentie",
            toelichting_kort=f"Onvoldoende developer-relevante uitspraken ({dev_count} van 5 vereist)",
            toelichting_lang=(
                f"Op basis van {dev_count} developer-relevante uitspraken (nieuwbouw/"
                f"sloop/bestemmingswijziging/uitbreiding) uit {total_count} totaal "
                f"geanalyseerde uitspraken voor deze gemeente. Voor een betrouwbare "
                f"succeskans-inschatting zijn minimaal 5 developer-relevante uitspraken "
                f"nodig. De score is op neutraal gezet."
            ),
            data_bronnen=["Rechtspraak.nl"],
            missing=True,
            succeskans_missing=True,
            succeskans_reason="insufficient_dev_type_rulings",
            dev_type_ruling_count=dev_count,
            total_ruling_count=total_count,
        )

    approval_rate = jk.get("approval_rate", 0.5)
    score = normalize_linear(approval_rate, 0.2, 0.9)

    dev_count = jk.get("ruling_count_dev_types", 0)
    total_count = jk.get("ruling_count", 0)
    pct = round(approval_rate * 100)
    kort = f"Vergunnings-succeskans {pct}% in deze gemeente"
    lang = (
        f"Op basis van {total_count} geanalyseerde uitspraken heeft deze gemeente "
        f"een vergunnings-goedkeuringspercentage van {pct}%. "
        + (
            "Dit wijst op een gunstig juridisch klimaat voor bouw- en verbouwplannen."
            if score >= 0.6 else
            "Het juridisch klimaat is gemiddeld; vergunningaanvragen worden wisselend beoordeeld."
            if score >= 0.3 else
            "Het juridisch klimaat is ongunstig; een hoog percentage vergunningaanvragen wordt afgewezen."
        )
    )

    return FactorResult(
        waarde={"approval_rate": approval_rate},
        genormaliseerde_score=round(score, 4), gewicht=13,
        bijdrage=round(score * 13, 4), categorie="potentie",
        toelichting_kort=kort, toelichting_lang=lang,
        data_bronnen=["Rechtspraak.nl"],
        missing=False,
        succeskans_missing=False,
        succeskans_reason=None,
        dev_type_ruling_count=dev_count,
        total_ruling_count=total_count,
    )


# ---------------------------------------------------------------------------
# RISICO FACTORS (9)
# ---------------------------------------------------------------------------

def score_funderingsrisico(parcel_data: dict) -> FactorResult:
    """Factor R1: Funderingsrisico. Gewicht=15. Critical."""
    fr = parcel_data.get("funderingsrisico")
    bodemtype = parcel_data.get("bodemtype")
    bouwjaar = parcel_data.get("bouwjaar")

    if not fr or not isinstance(fr, dict):
        return FactorResult(
            waarde=None, genormaliseerde_score=0.5, gewicht=15,
            bijdrage=round(0.5 * 15, 4), categorie="risico",
            toelichting_kort="Funderingsrisico onbekend \u2014 geen gegevens beschikbaar (critical)",
            toelichting_lang="Er zijn geen funderingsrisicogegevens beschikbaar. Omdat funderingsproblemen tot hoge kosten kunnen leiden (\u20ac30.000-\u20ac80.000), wordt een lichte risicopremie toegepast. Een funderingsonderzoek wordt aanbevolen.",
            data_bronnen=["PDOK Funderingsrisicogebieden", "BAG"],
            missing=True,
        )

    fgr = str(fr.get("fgr") or "").lower()
    dominant = str(_get(bodemtype, "dominant_type") or "").lower() if bodemtype else ""
    pre_1970 = bouwjaar is not None and bouwjaar < 1970

    slappe_bodem = dominant in ("klei", "veen")

    if fgr == "hoog" and slappe_bodem and pre_1970:
        score = 1.0
    elif fgr == "hoog":
        score = 0.8
    elif fgr in ("gemiddeld", "middelmatig"):
        score = 0.5
    elif fgr == "laag":
        score = 0.2
    else:
        score = 0.4

    # Boost for compound risk
    if slappe_bodem and pre_1970 and score < 1.0:
        score = min(1.0, score + 0.15)

    risk_label = "Hoog" if score >= 0.7 else "Gemiddeld" if score >= 0.4 else "Laag"

    kort = f"{risk_label} funderingsrisico \u2014 {fgr}, {'slappe bodem' if slappe_bodem else 'stabiele bodem'}"
    lang = (
        f"Het funderingsrisico is ingeschat als '{fgr}' op basis van de PDOK funderingsrisicokaart. "
        f"De bodem is {dominant or 'onbekend'}"
        + (f" en het gebouw dateert van {bouwjaar}" if bouwjaar else "")
        + ". "
        + (
            "De combinatie van slappe bodem, bouwjaar v\u00f3\u00f3r 1970 en hoog indicatief risico wijst op waarschijnlijk houten paalfundering. Herstelkosten worden geschat op \u20ac30.000-\u20ac80.000."
            if score >= 0.8 and slappe_bodem else
            "Het risico is aanwezig maar beperkt. Een funderingsonderzoek wordt aanbevolen bij verbouwplannen."
        )
    )

    return FactorResult(
        waarde={"fgr": fgr, "bodemtype": dominant, "pre_1970": pre_1970},
        genormaliseerde_score=round(score, 4), gewicht=15,
        bijdrage=round(score * 15, 4), categorie="risico",
        toelichting_kort=kort, toelichting_lang=lang,
        data_bronnen=["PDOK Funderingsrisicogebieden", "BAG", "Bodemdata.nl"],
        missing=False,
    )


def score_asbest(parcel_data: dict) -> FactorResult:
    """Factor R2: Asbest-risico. Gewicht=6."""
    bouwjaar = parcel_data.get("bouwjaar")

    if bouwjaar is None:
        return FactorResult(
            waarde=None, genormaliseerde_score=0.5, gewicht=6,
            bijdrage=round(0.5 * 6, 4), categorie="risico",
            toelichting_kort="Asbestrisico onbekend \u2014 bouwjaar niet beschikbaar",
            toelichting_lang="Het bouwjaar is niet bekend. Omdat asbest tot 1993 veel werd gebruikt in Nederland, kan het risico niet worden beoordeeld. De score is op neutraal gezet met een lichte risicopremie.",
            data_bronnen=["BAG"],
            missing=True,
        )

    pre_1994 = bouwjaar < 1994
    # Check raw bestemming types for industrial function
    industrial = False
    for b in (parcel_data.get("bestemmingen") or []):
        if isinstance(b, dict):
            bt = str(b.get("type") or "").lower()
            if any(k in bt for k in ("bedrijf", "bedrijven", "industri")):
                industrial = True
                break

    if pre_1994 and industrial:
        score = 1.0
    elif pre_1994:
        score = 0.7
    elif bouwjaar < 2000:
        score = 0.2
    else:
        score = 0.0

    risk_label = "Hoog" if score >= 0.7 else "Beperkt" if score > 0 else "Verwaarloosbaar"
    kort = f"{risk_label} asbestrisico \u2014 bouwjaar {bouwjaar}"
    building_type = "industriële gebouwen" if industrial else "woningen en utiliteitsgebouwen"
    lang = (
        f"Het gebouw dateert van {bouwjaar}. "
        + (
            f"Asbest werd in Nederland tot 1993 veel gebruikt, vooral in {building_type}. Bij renovatie of sloop is een asbestinventarisatie verplicht. Overtreding kan leiden tot boetes tot \u20ac30.000."
            if pre_1994 else
            "Het bouwjaar valt na het asbestverbod van 1993. Het risico op asbesthoudende materialen is verwaarloosbaar."
        )
    )

    return FactorResult(
        waarde={"bouwjaar": bouwjaar, "pre_1994": pre_1994, "industrial": industrial},
        genormaliseerde_score=round(score, 4), gewicht=6,
        bijdrage=round(score * 6, 4), categorie="risico",
        toelichting_kort=kort, toelichting_lang=lang,
        data_bronnen=["BAG"],
        missing=False,
    )


def score_bodemverontreiniging(parcel_data: dict) -> FactorResult:
    """Factor R3: Bodemverontreiniging. Gewicht=7. Critical."""
    bodem = parcel_data.get("bodem")
    if not bodem or not isinstance(bodem, dict):
        return FactorResult(
            waarde=None, genormaliseerde_score=0.5, gewicht=7,
            bijdrage=round(0.5 * 7, 4), categorie="risico",
            toelichting_kort="Bodemkwaliteit onbekend \u2014 geen gegevens beschikbaar (critical)",
            toelichting_lang="Er zijn geen bodemgegevens beschikbaar van het Bodemloket. Omdat bodemsanering aanzienlijke kosten met zich mee kan brengen, wordt een lichte risicopremie toegepast.",
            data_bronnen=["Bodemloket"],
            missing=True,
        )

    contaminated = bool(bodem.get("has_known_contamination"))
    dossiers = bodem.get("dossiers_count") or 0

    if contaminated and dossiers >= 3:
        score = 1.0
    elif contaminated:
        score = 0.7
    elif dossiers >= 2:
        score = 0.4
    elif dossiers >= 1:
        score = 0.2
    else:
        score = 0.0

    risk_label = "Hoog" if score >= 0.7 else "Gemiddeld" if score >= 0.3 else "Laag"
    kort = f"{risk_label} bodemrisico \u2014 {dossiers} dossier(s), {'vervuiling bekend' if contaminated else 'geen bekende vervuiling'}"
    lang = (
        f"Het Bodemloket vermeldt {dossiers} dossier(s) voor deze locatie"
        + (", waarvan bekend is dat er verontreiniging aanwezig is" if contaminated else "")
        + ". "
        + (
            "Bij bekende verontreiniging moet de bodem worden gesaneerd voordat gebouwd kan worden. Dit kan de ontwikkelkosten aanzienlijk verhogen."
            if contaminated else
            "Er zijn geen bekende verontreinigingen. Bij bouwactiviteiten is een verkennend bodemonderzoek wel standaard vereist."
            if dossiers == 0 else
            "De aanwezigheid van bodemdossiers betekent niet per definitie dat er een probleem is, maar nader onderzoek wordt aanbevolen."
        )
    )

    return FactorResult(
        waarde={"has_known_contamination": contaminated, "dossiers_count": dossiers},
        genormaliseerde_score=round(score, 4), gewicht=7,
        bijdrage=round(score * 7, 4), categorie="risico",
        toelichting_kort=kort, toelichting_lang=lang,
        data_bronnen=["Bodemloket"],
        missing=False,
    )


def score_monument(parcel_data: dict) -> FactorResult:
    """Factor R4: Monument-/erfgoedstatus. Gewicht=5.

    M046/S05 BUG-3: RCE API structured data primair, bestemmingsplan keyword-match
    secundair (fallback wanneer RCE niet beschikbaar). Pre-S05 was alleen
    keyword-match, dat miste 30-40% rijksmonumenten die buiten erfgoed-bestemmingen
    staan. RCE is authoritatief voor rijksmonumenten (data.rijksmonumenten.info).

    Scope: alleen rijksmonumenten. Gemeentelijke monumenten (GEM-14) blijven
    buiten scope — die vereisen per-gemeente erfgoedverordening-data.
    """
    rce = parcel_data.get("rijksmonument")

    # Path 1: RCE structured data available (authoritative)
    if isinstance(rce, dict) and "is_monument" in rce:
        is_monument = bool(rce.get("is_monument"))
        score = normalize_binary(is_monument)
        if is_monument:
            naam = rce.get("rce_objnaam") or "onbekend monument"
            nr = rce.get("rce_objrijksnr")
            nr_txt = f" (rijksmonumentnummer {nr})" if nr else ""
            kort = f"Rijksmonument gedetecteerd: {naam}"
            lang = (
                f"Het perceel is onderdeel van het rijksmonument '{naam}'{nr_txt}. "
                f"Verbouw, renovatie of sloop zijn aan strikte regels gebonden "
                f"(Erfgoedwet + Omgevingswet) en vereisen een omgevingsvergunning "
                f"met monumenten-advies van de RCE of gemeente. Dit beperkt de "
                f"ontwikkelmogelijkheden aanzienlijk."
            )
        else:
            kort = "Geen rijksmonument-status"
            lang = (
                "Het perceel valt niet onder het rijksmonumenten-register (RCE). "
                "Eventuele gemeentelijke monumenten-status is buiten scope van "
                "deze check — raadpleeg de gemeentelijke erfgoedverordening."
            )
        return FactorResult(
            waarde=is_monument,
            genormaliseerde_score=round(score, 4),
            gewicht=5,
            bijdrage=round(score * 5, 4),
            categorie="risico",
            toelichting_kort=kort,
            toelichting_lang=lang,
            data_bronnen=["RCE API", "Bestemmingsplan"],
            missing=False,
        )

    # Path 2: RCE unavailable → fall back to bestemmingsplan keyword-match (legacy)
    bestemmingen = parcel_data.get("bestemmingen") or []
    is_monument = False
    for b in bestemmingen:
        if not isinstance(b, dict):
            continue
        btype = str(b.get("type") or "").lower()
        naam = str(b.get("naam") or "").lower()
        if "waarde" in btype or "erfgoed" in naam or "monument" in naam or "cultuurhistor" in naam:
            is_monument = True
            break

    score = normalize_binary(is_monument)
    if is_monument:
        kort = "Mogelijk monument-/erfgoedstatus (bestemmingsplan-indicator)"
        lang = (
            "Het perceel valt (deels) onder een beschermde waardebestemming. "
            "RCE-data was niet beschikbaar tijdens deze scan \u2014 status is "
            "gebaseerd op bestemmingsplan-keywords. Verbouw en sloop zijn "
            "mogelijk aan regels gebonden."
        )
    else:
        kort = "Geen monument-/erfgoedstatus gedetecteerd"
        lang = (
            "Er zijn geen aanwijzingen voor monument- of erfgoedstatus in de "
            "bestemmingsplangegevens. RCE-data was niet beschikbaar voor "
            "aanvullende check."
        )
    return FactorResult(
        waarde=is_monument,
        genormaliseerde_score=round(score, 4),
        gewicht=5,
        bijdrage=round(score * 5, 4),
        categorie="risico",
        toelichting_kort=kort,
        toelichting_lang=lang,
        data_bronnen=["Bestemmingsplan"],
        missing=True,
    )


def score_bestemmingswijziging(parcel_data: dict) -> FactorResult:
    """Factor R5: Bestemmingswijziging nodig. Gewicht=8."""
    btype = _best_bestemming_type(parcel_data)

    # Inverse of bestemming compatibiliteit
    if "wonen" in btype:
        score = 0.0
    elif "gemengd" in btype or "centrum" in btype:
        score = 0.3
    elif "maatschappelijk" in btype:
        score = 0.6
    else:
        score = 0.8

    if score <= 0.0:
        kort = "Geen bestemmingswijziging nodig \u2014 woonbestemming"
        lang = "Het perceel heeft een woonbestemming; woningbouw is direct mogelijk zonder bestemmingsplanwijziging."
    elif score <= 0.3:
        kort = "Beperkte bestemmingswijziging mogelijk nodig"
        lang = f"Het perceel heeft een '{btype}'-bestemming. Afhankelijk van het specifieke plan kan een beperkte aanpassing van het bestemmingsplan nodig zijn."
    else:
        kort = f"Bestemmingswijziging nodig \u2014 huidige bestemming '{btype}'"
        lang = f"Het perceel heeft de bestemming '{btype}'. Voor woningbouw is een bestemmingsplanwijziging nodig. Dit is een formeel gemeentelijk traject met inspraak dat maanden tot jaren kan duren, met risico op afwijzing."

    return FactorResult(
        waarde=btype, genormaliseerde_score=round(score, 4),
        gewicht=8, bijdrage=round(score * 8, 4), categorie="risico",
        toelichting_kort=kort, toelichting_lang=lang,
        data_bronnen=["Bestemmingsplan", "Ruimtelijkeplannen.nl"],
        missing=False,
    )


def score_constructieve_staat(parcel_data: dict) -> FactorResult:
    """Factor R6: Constructieve staat (bouwjaar + energie). Gewicht=7."""
    bouwjaar = parcel_data.get("bouwjaar")
    el = parcel_data.get("energielabel")
    energieklasse = _get(el, "energieklasse") if el else None

    if bouwjaar is None:
        return FactorResult(
            waarde=None, genormaliseerde_score=0.5, gewicht=7,
            bijdrage=round(0.5 * 7, 4), categorie="risico",
            toelichting_kort="Constructieve staat onbekend \u2014 geen bouwjaar beschikbaar",
            toelichting_lang="Het bouwjaar is niet bekend, waardoor de constructieve staat niet kan worden beoordeeld.",
            data_bronnen=["BAG", "EP-Online"],
            missing=True,
        )

    # Age component
    if bouwjaar < 1940:
        age_score = 1.0
    elif bouwjaar < 1970:
        age_score = 0.7
    elif bouwjaar < 1990:
        age_score = 0.4
    else:
        age_score = 0.1

    # Energy label component
    energy_scores = {"a++++": 0.0, "a+++": 0.0, "a++": 0.0, "a+": 0.0, "a": 0.1, "b": 0.2, "c": 0.4, "d": 0.6, "e": 0.7, "f": 0.8, "g": 1.0}
    if energieklasse:
        energy_score = energy_scores.get(str(energieklasse).lower(), 0.5)
    else:
        energy_score = 0.5  # neutral if unknown

    score = age_score * 0.6 + energy_score * 0.4
    score = min(1.0, score)

    label_str = f", energielabel {energieklasse}" if energieklasse else ""
    risk_label = "Hoog" if score >= 0.6 else "Gemiddeld" if score >= 0.3 else "Laag"
    kort = f"{risk_label} constructief risico \u2014 bouwjaar {bouwjaar}{label_str}"
    lang = (
        f"Het gebouw dateert van {bouwjaar}"
        + (f" en heeft energielabel {energieklasse}" if energieklasse else "")
        + ". "
        + (
            "Woningen van v\u00f3\u00f3r 1940 hebben vaak achterstallig onderhoud en lagere energieprestaties. Renovatiekosten kunnen aanzienlijk zijn."
            if bouwjaar < 1940 else
            "De leeftijd van het gebouw en de energieprestatie zijn meegewogen bij de risicobeoordeling."
        )
    )

    return FactorResult(
        waarde={"bouwjaar": bouwjaar, "energieklasse": energieklasse},
        genormaliseerde_score=round(score, 4), gewicht=7,
        bijdrage=round(score * 7, 4), categorie="risico",
        toelichting_kort=kort, toelichting_lang=lang,
        data_bronnen=["BAG", "EP-Online"],
        missing=False,
    )


def score_juridisch_klimaat(neighborhood_metrics: dict | None) -> FactorResult:
    """Factor R7: Juridisch klimaat ongunstig. Gewicht=8."""
    jk = _get(neighborhood_metrics, "juridisch_klimaat")
    if not jk or not isinstance(jk, dict):
        return FactorResult(
            waarde=None, genormaliseerde_score=0.5, gewicht=8,
            bijdrage=round(0.5 * 8, 4), categorie="risico",
            toelichting_kort="Juridisch klimaat onbekend \u2014 onvoldoende data",
            toelichting_lang="Er zijn onvoldoende gegevens om het juridisch klimaat te beoordelen. De risicoscore is op neutraal gezet.",
            data_bronnen=["Rechtspraak.nl"],
            missing=True,
            succeskans_missing=True,
            succeskans_reason="no_juridisch_klimaat_data",
            dev_type_ruling_count=0,
            total_ruling_count=0,
        )

    # M046/S01 RM-1: parallel pad aan score_vergunning_succeskans — sparse
    # dev-type sample (< 5) degradeert ook de inverse-risico-factor naar neutraal.
    if jk.get("missing") is True:
        dev_count = jk.get("ruling_count_dev_types", 0)
        total_count = jk.get("ruling_count", 0)
        return FactorResult(
            waarde=None, genormaliseerde_score=0.5, gewicht=8,
            bijdrage=round(0.5 * 8, 4), categorie="risico",
            toelichting_kort=f"Onvoldoende developer-relevante uitspraken voor risicobeoordeling ({dev_count} van 5 vereist)",
            toelichting_lang=(
                f"Op basis van {dev_count} developer-relevante uitspraken uit {total_count} "
                f"totaal geanalyseerde uitspraken voor deze gemeente. Voor een betrouwbare "
                f"risico-inschatting zijn minimaal 5 developer-relevante uitspraken nodig. "
                f"De risicoscore is op neutraal gezet."
            ),
            data_bronnen=["Rechtspraak.nl"],
            missing=True,
            succeskans_missing=True,
            succeskans_reason="insufficient_dev_type_rulings",
            dev_type_ruling_count=dev_count,
            total_ruling_count=total_count,
        )

    approval_rate = jk.get("approval_rate", 0.5)
    # Inverse: low approval = high risk
    score = 1.0 - normalize_linear(approval_rate, 0.2, 0.9)

    dev_count = jk.get("ruling_count_dev_types", 0)
    total_count = jk.get("ruling_count", 0)
    risk_label = "Hoog" if score >= 0.6 else "Gemiddeld" if score >= 0.3 else "Laag"
    pct = round(approval_rate * 100)
    kort = f"{risk_label} juridisch risico \u2014 {pct}% goedkeuring in gemeente"
    lang = (
        f"De gemeente heeft een vergunnings-goedkeuringspercentage van {pct}%. "
        + (
            "Het lage goedkeuringspercentage wijst op een streng vergunningsbeleid en een hoger risico op afwijzing van bouw- en verbouwplannen."
            if score >= 0.6 else
            "Het juridisch klimaat is gemiddeld."
        )
    )

    return FactorResult(
        waarde={"approval_rate": approval_rate},
        genormaliseerde_score=round(score, 4), gewicht=8,
        bijdrage=round(score * 8, 4), categorie="risico",
        toelichting_kort=kort, toelichting_lang=lang,
        data_bronnen=["Rechtspraak.nl"],
        missing=False,
        succeskans_missing=False,
        succeskans_reason=None,
        dev_type_ruling_count=dev_count,
        total_ruling_count=total_count,
    )


def score_criminaliteit(neighborhood_metrics: dict | None) -> FactorResult:
    """Factor R8: Criminaliteit in de wijk. Gewicht=6."""
    crim = _get(neighborhood_metrics, "criminaliteit")
    if not crim or not isinstance(crim, dict):
        return FactorResult(
            waarde=None, genormaliseerde_score=0.5, gewicht=6,
            bijdrage=round(0.5 * 6, 4), categorie="risico",
            toelichting_kort="Criminaliteitscijfers onbekend",
            toelichting_lang="Er zijn geen criminaliteitsgegevens beschikbaar voor deze wijk. De risicoscore is op neutraal gezet.",
            data_bronnen=["CBS dataderden"],
            missing=True,
        )

    per_1000 = crim.get("per_1000_inwoners") or 0
    # NL average ~50 per 1000; high = 100+
    score = normalize_linear(per_1000, 10, 100)

    risk_label = "Hoog" if score >= 0.6 else "Gemiddeld" if score >= 0.3 else "Laag"
    kort = f"{risk_label} criminaliteit \u2014 {per_1000:.0f} misdrijven per 1.000 inwoners"
    lang = (
        f"In deze wijk worden {per_1000:.0f} misdrijven per 1.000 inwoners geregistreerd. "
        + (
            "Verhoogde criminaliteit vermindert de verkoop- en verhuurpotentie en kan leiden tot hogere verzekeringspremies en leegstand."
            if score >= 0.6 else
            "Het criminaliteitsniveau is gemiddeld voor Nederland."
            if score >= 0.3 else
            "Het criminaliteitsniveau is laag, wat positief bijdraagt aan de aantrekkelijkheid van het gebied."
        )
    )

    return FactorResult(
        waarde={"per_1000_inwoners": per_1000},
        genormaliseerde_score=round(score, 4), gewicht=6,
        bijdrage=round(score * 6, 4), categorie="risico",
        toelichting_kort=kort, toelichting_lang=lang,
        data_bronnen=["CBS dataderden"],
        missing=False,
    )


def score_max_hoogte_bereikt(parcel_data: dict) -> FactorResult:
    """Factor R9: Maximale bouwhoogte bereikt. Gewicht=5."""
    bm = parcel_data.get("building_metrics") or {}
    max_hoogte = bm.get("max_bouwhoogte")
    actual_hoogte = bm.get("actual_bouwhoogte")
    max_lagen = bm.get("max_bouwlagen")
    actual_lagen = bm.get("actual_bouwlagen")

    missing = (max_hoogte is None and max_lagen is None)
    if missing:
        return FactorResult(
            waarde=None, genormaliseerde_score=0.5, gewicht=5,
            bijdrage=round(0.5 * 5, 4), categorie="risico",
            toelichting_kort="Maximale bouwhoogte onbekend",
            toelichting_lang="Er zijn geen gegevens beschikbaar over de maximaal toegestane bouwhoogte. De risicoscore is op neutraal gezet.",
            data_bronnen=["PLU WMS", "3D BAG"],
            missing=True,
        )

    at_max = False
    detail = ""
    if max_lagen is not None and actual_lagen is not None:
        at_max = actual_lagen >= max_lagen
        detail = f"{actual_lagen}/{max_lagen} bouwlagen"
    elif max_hoogte is not None and actual_hoogte is not None:
        at_max = actual_hoogte >= max_hoogte * 0.95  # 5% tolerance
        detail = f"{actual_hoogte:.1f}m/{max_hoogte:.1f}m bouwhoogte"

    score = 1.0 if at_max else 0.0

    if at_max:
        kort = f"Maximale bouwhoogte bereikt \u2014 {detail}"
        lang = f"Het gebouw benut de maximaal toegestane bouwhoogte volledig ({detail}). Verticale uitbreiding is niet mogelijk zonder bestemmingsplanwijziging."
    else:
        kort = f"Bouwhoogte niet bereikt \u2014 {detail}"
        lang = f"Het gebouw benut de maximaal toegestane bouwhoogte nog niet volledig ({detail}). Er is ruimte voor verticale uitbreiding."

    return FactorResult(
        waarde={"at_max": at_max, "detail": detail},
        genormaliseerde_score=round(score, 4), gewicht=5,
        bijdrage=round(score * 5, 4), categorie="risico",
        toelichting_kort=kort, toelichting_lang=lang,
        data_bronnen=["PLU WMS", "3D BAG"],
        missing=False,
    )


# ---------------------------------------------------------------------------
# ENVIRONMENTAL RISICO FACTORS (4) — R10-R13
# Pre-cached in scan_results.flags since Phase 99
# ---------------------------------------------------------------------------

def score_natura2000(parcel_data: dict) -> FactorResult:
    """Factor R10: Natura2000 proximity risk. Gewicht=5."""
    n2k = parcel_data.get("natura2000")
    if not n2k or not isinstance(n2k, dict):
        return FactorResult(
            waarde=None, genormaliseerde_score=0.5, gewicht=5,
            bijdrage=round(0.5 * 5, 4), categorie="risico",
            toelichting_kort="Natura2000-nabijheid onbekend — geen locatiedata beschikbaar",
            toelichting_lang="Er zijn geen gegevens beschikbaar over de nabijheid van Natura2000-gebieden. De score is op neutraal gezet.",
            data_bronnen=["PDOK Natura2000 WFS"],
            missing=True,
        )

    binnen_5km = bool(n2k.get("binnen_5km"))
    naam = n2k.get("naam") or "onbekend gebied"
    bescherming = n2k.get("bescherming") or ""

    score = 1.0 if binnen_5km else 0.0

    if binnen_5km:
        kort = f"Natura2000-gebied binnen 5km — {naam} ({bescherming})"
        lang = (
            f"Het perceel ligt binnen 5km van Natura2000-gebied '{naam}' ({bescherming}). "
            "Dit vereist een stikstofberekening via AERIUS voor elke bouwfase. "
            "Overschrijding van de stikstofdepositie kan de vergunning blokkeren of vertragen. "
            "Een ecologisch onderzoek wordt sterk aanbevolen bij de planvorming."
        )
    else:
        kort = "Geen Natura2000-gebied binnen 5km — stikstofrisico laag"
        lang = (
            "Het perceel ligt buiten een straal van 5km van Natura2000-gebieden. "
            "Het stikstofrisico voor de vergunningverlening is daarmee laag. "
            "Een AERIUS-berekening is doorgaans niet vereist bij standaard bouwprojecten."
        )

    return FactorResult(
        waarde={"binnen_5km": binnen_5km, "naam": naam, "bescherming": bescherming},
        genormaliseerde_score=round(score, 4), gewicht=5,
        bijdrage=round(score * 5, 4), categorie="risico",
        toelichting_kort=kort, toelichting_lang=lang,
        data_bronnen=["PDOK Natura2000 WFS"],
        missing=False,
    )


def score_overstromingsrisico(parcel_data: dict) -> FactorResult:
    """Factor R11: Overstromingsrisico. Gewicht=6."""
    ostr = parcel_data.get("overstromingsrisico")
    if not ostr or not isinstance(ostr, dict):
        return FactorResult(
            waarde=None, genormaliseerde_score=0.5, gewicht=6,
            bijdrage=round(0.5 * 6, 4), categorie="risico",
            toelichting_kort="Overstromingsrisico onbekend — geen locatiedata beschikbaar",
            toelichting_lang="Er zijn geen gegevens beschikbaar over het overstromingsrisico op deze locatie. De score is op neutraal gezet.",
            data_bronnen=["Rijkswaterstaat Overstromingen WMS"],
            missing=True,
        )

    in_risk_zone = bool(ostr.get("in_risk_zone"))
    description = ostr.get("description") or ""
    qualitative_value = ostr.get("qualitative_value") or ""

    score = 1.0 if in_risk_zone else 0.0

    if in_risk_zone:
        detail = description or qualitative_value or "risicozone"
        kort = f"Perceel in overstromingsrisicozone — {detail}"
        lang = (
            f"Dit perceel ligt in een gebied met overstromingsrisico ({detail}). "
            "Dit verhoogt de verzekeringspremies aanzienlijk en kan leiden tot beperkingen in het gemeentelijk beleid. "
            "Bij nieuwbouw worden hogere eisen gesteld aan fundering en drempelhoogten. "
            "Een klimaatadaptief ontwerp is sterk aan te raden."
        )
    else:
        kort = "Geen overstromingsrisico gedetecteerd"
        lang = (
            "Het perceel ligt niet in een door Rijkswaterstaat aangemerkte overstromingsrisicozone. "
            "De risico's voor verzekering en gemeentelijk beleid zijn daarmee beperkt."
        )

    return FactorResult(
        waarde={"in_risk_zone": in_risk_zone, "description": description, "qualitative_value": qualitative_value},
        genormaliseerde_score=round(score, 4), gewicht=6,
        bijdrage=round(score * 6, 4), categorie="risico",
        toelichting_kort=kort, toelichting_lang=lang,
        data_bronnen=["Rijkswaterstaat Overstromingen WMS"],
        missing=False,
    )


def score_geluid(parcel_data: dict) -> FactorResult:
    """Factor R12: Geluidbelasting Lden. Gewicht=5."""
    geluid = parcel_data.get("geluid")
    if not geluid or not isinstance(geluid, dict):
        return FactorResult(
            waarde=None, genormaliseerde_score=0.3, gewicht=5,
            bijdrage=round(0.3 * 5, 4), categorie="risico",
            toelichting_kort="Geluidbelasting onbekend — meeste NL-locaties zijn rustig",
            toelichting_lang="Er zijn geen geluidgegevens beschikbaar voor deze locatie. Nederland heeft grotendeels acceptabele geluidniveaus. De score is op licht neutraal gezet.",
            data_bronnen=["RIVM Geluidbelasting Lden WMS"],
            missing=True,
        )

    classification = str(geluid.get("classification") or "").lower()
    lden_db = geluid.get("lden_db")

    score_map = {
        "acceptabel": 0.0,
        "verhoogd": 0.4,
        "hoog": 0.7,
        "zeer_hoog": 1.0,
    }
    score = score_map.get(classification, 0.3)

    db_str = f" ({lden_db} dB Lden)" if lden_db is not None else ""
    risk_label = "Zeer hoog" if score >= 1.0 else "Hoog" if score >= 0.7 else "Verhoogd" if score >= 0.4 else "Acceptabel"
    kort = f"{risk_label} geluidrisico{db_str} — {classification or 'onbekend'}"

    lang = (
        f"De geluidbelasting op dit perceel is ingeschaald als '{classification}'{db_str}. "
        + (
            "Een geluidbelasting boven 50 dB Lden (Wet geluidhinder) vereist een maatwerkregel of geluidwerende voorzieningen bij nieuwbouw van gevoelige functies zoals woningen. Dit kan de bouwkosten verhogen en de realisatie vertragen."
            if score >= 0.7 else
            "De geluidbelasting is verhoogd. Afhankelijk van de geluidsbestemming kan nader akoestisch onderzoek nodig zijn."
            if score >= 0.4 else
            "De geluidbelasting is acceptabel. Er zijn geen akoestische belemmeringen voor woningbouw te verwachten."
        )
    )

    return FactorResult(
        waarde={"lden_db": lden_db, "classification": classification},
        genormaliseerde_score=round(score, 4), gewicht=5,
        bijdrage=round(score * 5, 4), categorie="risico",
        toelichting_kort=kort, toelichting_lang=lang,
        data_bronnen=["RIVM Geluidbelasting Lden WMS"],
        missing=False,
    )


def _normalize_wijk(s: str | None) -> str:
    """Casefold + strip diacritics + normalise hyphen variants for wijk-naam substring match.

    Handles PDOK/BAG casing differences ("blerick" vs "Blerick") and Unicode hyphen variants
    that can appear in woonvisie PDFs extracted via OCR ("Oud‐Blerick" with U+2010 vs ASCII "-").
    """
    if not s:
        return ""
    n = unicodedata.normalize("NFKD", s)
    n = "".join(c for c in n if not unicodedata.combining(c))
    # Normalise hyphen variants: soft hyphen U+00AD (strip), hyphen U+2010 → ASCII, non-breaking hyphen U+2011 → ASCII
    return n.casefold().replace("­", "").replace("‐", "-").replace("‑", "-").strip()


_PRIORITEIT_SCORE_DELTA: dict[str, float] = {
    "groei": 3.0,
    "herstructurering": 1.5,
    "neutraal": 0.0,
    "krimp": -2.5,
}


_PROJECTTYPE_SEGMENT_MAP: dict[str, list[str]] = {
    "nieuwbouw_wonen": ["sociaal", "midden"],
    "transformatie_wonen": ["sociaal", "midden", "gemengd"],
    "optoppen": ["midden", "duur"],
    "splitsen": ["sociaal", "midden"],
    "commercieel_naar_wonen": ["midden", "gemengd"],
    "onbepaald": [],
}


def score_woonvisie_match(
    payload: WoonvisiePayload | None,
    *,
    wijk_naam: str | None,
    project_type: str = "onbepaald",
) -> FactorResult:
    """M048/Phase 6: per-wijk differentiating scoring via WijkPolicy.

    Reads only wijk_policies + algemeen_citaat + confidence from payload.
    Deprecated fields (growth_wijken/shrink_wijken/etc.) are ignored — they exist on the
    model for cache-roundtrip backwards-compat only.
    """
    if payload is None:
        return FactorResult(
            waarde=None,
            genormaliseerde_score=0.0,
            gewicht=0,
            bijdrage=0.0,
            categorie="potentie",
            toelichting_kort="Geen woonvisie beschikbaar voor deze gemeente (factor niet meegewogen).",
            toelichting_lang="Geen gemeentelijke woonvisie beschikbaar. De factor wordt niet meegewogen.",
            data_bronnen=[],
            missing=True,
        )

    document_label = f"Woonvisie {payload.periode_start}–{payload.periode_einde}"
    algemeen_citaat = payload.algemeen_citaat or ""

    # 1. Find matching WijkPolicy — longest-normalised-name wins (deterministic over Claude's list-order)
    parcel_norm = _normalize_wijk(wijk_naam)
    matched: WijkPolicy | None = None
    if parcel_norm and payload.wijk_policies:
        candidates: list[tuple[int, WijkPolicy]] = []
        for p in payload.wijk_policies:
            pn = _normalize_wijk(p.wijk_naam)
            if pn and (pn in parcel_norm or parcel_norm in pn):
                candidates.append((len(pn), p))
        if candidates:
            candidates.sort(key=lambda t: -t[0])
            matched = candidates[0][1]

    # 2. No-match fallback: neutraal with algemeen_citaat
    if matched is None:
        raw_score = 5.0
        pulled = raw_score * payload.confidence + 5.0 * (1 - payload.confidence)
        pulled = max(0.0, min(10.0, pulled))
        uitleg_kort = (
            f"Geen wijk-specifiek beleid gevonden in {document_label}; gemeente-brede context gebruikt"
            if algemeen_citaat
            else f"Geen wijk-specifiek beleid gevonden in {document_label}"
        )
        uitleg_lang = uitleg_kort + (
            f". Citaat (gemeente-breed): {algemeen_citaat}" if algemeen_citaat else ""
        )
        uitleg_lang += f" (confidence {payload.confidence:.0%})"
        return FactorResult(
            waarde={
                "matched_wijk": None,
                "matched_policy": None,
                "prioritized_segment": payload.prioritized_segment,
                "algemeen_citaat": algemeen_citaat,
            },
            genormaliseerde_score=round(pulled / 10.0, 4),
            gewicht=0,
            bijdrage=0.0,
            categorie="potentie",
            toelichting_kort=uitleg_kort,
            toelichting_lang=uitleg_lang,
            data_bronnen=["Gemeentelijke woonvisie (LLM-extracted)"],
            missing=False,
        )

    # 3. Matched policy: prioriteit basis + segment × projecttype
    raw_score = 5.0 + _PRIORITEIT_SCORE_DELTA.get(matched.prioriteit, 0.0)
    preferred = _PROJECTTYPE_SEGMENT_MAP.get(project_type, [])
    segment_note = ""
    if preferred:
        overlap = set(preferred) & set(matched.gewenste_segmenten)
        if overlap:
            raw_score += 2.0
            segment_note = f"; projecttype past bij wijk-segment ({', '.join(sorted(overlap))})"
        elif matched.gewenste_segmenten:
            raw_score -= 1.0
            segment_note = f"; projecttype wijkt af van wijk-segment ({', '.join(matched.gewenste_segmenten)})"

    pulled = raw_score * payload.confidence + 5.0 * (1 - payload.confidence)
    pulled = max(0.0, min(10.0, pulled))

    pag_suffix = f", p.{matched.pagina}" if matched.pagina is not None else ""
    uitleg_kort = (
        f"Wijk '{matched.wijk_naam}' prioriteit '{matched.prioriteit}' in {document_label}{segment_note}"
    )
    uitleg_lang = (
        f"{uitleg_kort}. Citaat ({matched.wijk_naam}{pag_suffix}): {matched.citaat}"
        f" (confidence {payload.confidence:.0%})"
    )

    return FactorResult(
        waarde={
            "matched_wijk": wijk_naam,
            "matched_policy": matched.model_dump(),
            "prioritized_segment": (
                matched.gewenste_segmenten[0] if matched.gewenste_segmenten else payload.prioritized_segment
            ),
            "algemeen_citaat": algemeen_citaat,
        },
        genormaliseerde_score=round(pulled / 10.0, 4),
        gewicht=0,
        bijdrage=0.0,
        categorie="potentie",
        toelichting_kort=uitleg_kort,
        toelichting_lang=uitleg_lang,
        data_bronnen=["Gemeentelijke woonvisie (LLM-extracted)"],
        missing=False,
    )


def score_luchtkwaliteit(parcel_data: dict) -> FactorResult:
    """Factor R13: Luchtkwaliteit NO2/PM10. Gewicht=4."""
    lk = parcel_data.get("luchtkwaliteit")
    if not lk or not isinstance(lk, dict):
        return FactorResult(
            waarde=None, genormaliseerde_score=0.3, gewicht=4,
            bijdrage=round(0.3 * 4, 4), categorie="risico",
            toelichting_kort="Luchtkwaliteit onbekend — meeste NL-locaties voldoen aan EU-normen",
            toelichting_lang="Er zijn geen luchtkwaliteitsgegevens beschikbaar voor deze locatie. De meeste Nederlandse locaties voldoen aan de EU-grenswaarden. De score is op licht neutraal gezet.",
            data_bronnen=["RIVM Luchtkwaliteit NSL WMS"],
            missing=True,
        )

    no2_ugm3 = lk.get("no2_ugm3")
    pm10_ugm3 = lk.get("pm10_ugm3")
    boven_grenswaarde = bool(lk.get("boven_grenswaarde"))

    # Normalize on NO2: 20 µg/m³ = very clean (0.0), 50 µg/m³ = EU limit (1.0)
    if no2_ugm3 is not None:
        score = normalize_linear(float(no2_ugm3), 20.0, 50.0)
    elif boven_grenswaarde:
        score = 1.0
    else:
        score = 0.3

    risk_label = "Hoog" if score >= 0.7 else "Gemiddeld" if score >= 0.4 else "Laag"
    no2_str = f"NO2: {no2_ugm3} µg/m³" if no2_ugm3 is not None else ""
    pm10_str = f"PM10: {pm10_ugm3} µg/m³" if pm10_ugm3 is not None else ""
    pollutants = ", ".join(filter(None, [no2_str, pm10_str])) or "waarden onbekend"
    kort = f"{risk_label} luchtkwaliteitsrisico — {pollutants}"

    lang = (
        f"De luchtkwaliteit op deze locatie: {pollutants}. "
        + (
            "De luchtkwaliteit overschrijdt de EU-grenswaarden. Dit kan de realisatie van gevoelige bestemmingen (woningen, scholen) bemoeilijken en vereist aanvullend onderzoek in de omgevingsvergunningprocedure."
            if boven_grenswaarde or score >= 0.7 else
            "De luchtkwaliteit is redelijk; er zijn geen directe belemmeringen voor woningbouw, maar monitoring wordt aanbevolen in stedelijke context."
            if score >= 0.4 else
            "De luchtkwaliteit is goed en vormt geen belemmering voor de ontwikkeling van gevoelige functies."
        )
    )

    return FactorResult(
        waarde={"no2_ugm3": no2_ugm3, "pm10_ugm3": pm10_ugm3, "boven_grenswaarde": boven_grenswaarde},
        genormaliseerde_score=round(score, 4), gewicht=4,
        bijdrage=round(score * 4, 4), categorie="risico",
        toelichting_kort=kort, toelichting_lang=lang,
        data_bronnen=["RIVM Luchtkwaliteit NSL WMS"],
        missing=False,
    )


# ---------------------------------------------------------------------------
# M050/S03 — BRK risico-factors helpers
# ---------------------------------------------------------------------------


def _missing_brk(reason: str, weight: int) -> FactorResult:
    """DRY missing-BRK FactorResult builder for the 3 new S03 risico-factors (D3).

    Returns a ``missing=True`` FactorResult so ``compute_score_v3``'s D3
    runtime redistribution drops the factor from the risico-category total
    and rescales the remaining 13 active risico-factoren. The 3 S03 factors
    (hypotheek_risico, eigendoms_complexiteit, koopwaarde_trend) are NOT
    members of ``_CRITICAL_RISK_FACTORS`` — sparse BRK data therefore
    never triggers the −10% missing-critical penalty.

    Args:
        reason: Short Dutch narrative for ``toelichting_kort`` (e.g.
            ``"Geen BRK-data — eigendomspositie onbekend"``).
        weight: Default weight for the factor (10 / 6 / 4, see ENG-PLAN D2).

    Returns:
        ``FactorResult`` with ``missing=True``, score ``0.0``, bijdrage
        ``0.0``, categorie ``"risico"``, data_bronnen
        ``["brk_ownership_records"]``.
    """
    return FactorResult(
        waarde=None,
        genormaliseerde_score=0.0,
        gewicht=weight,
        bijdrage=0.0,
        categorie="risico",
        toelichting_kort=reason,
        toelichting_lang=f"{reason}. BRK-data nodig voor deze factor.",
        missing=True,
        data_bronnen=["brk_ownership_records"],
    )


# ---------------------------------------------------------------------------
# M050/S03 — BRK risico-factor functions
# ---------------------------------------------------------------------------


def score_hypotheek_risico(parcel_data: dict) -> FactorResult:
    """Factor R14: Hypotheek-risico. Default gewicht=10 (M050/S03 D2 + D4).

    D3: empty BRK records → _missing_brk (runtime redistribution kicks in).
    D4: binary on any-True. Multi-owner parcels: ANY mortgaged owner flags risico.
    Empty input keys (heeft_hypotheek=None) treated as falsy (F3 defensive).
    """
    records = parcel_data.get("brk_records") or []
    if not records:
        return _missing_brk(
            "Geen BRK-data — eigendomspositie onbekend",
            weight=10,
        )
    n_with = sum(1 for r in records if r.get("heeft_hypotheek"))
    n_total = len(records)
    score = 1.0 if n_with > 0 else 0.0
    return FactorResult(
        waarde={"n_with_hypotheek": n_with, "n_total": n_total},
        genormaliseerde_score=score,
        gewicht=10,
        bijdrage=score * 10,
        categorie="risico",
        toelichting_kort=(
            f"{n_with}/{n_total} eigenaren met hypotheek"
            if n_with else "Geen hypotheek geregistreerd"
        ),
        toelichting_lang=(
            f"BRK toont {n_with} van {n_total} eigenaren met hypotheek-vermelding. "
            "Onderhandeling vereist mogelijk hypotheek-vrije levering."
            if n_with else
            f"Geen van de {n_total} eigenaren heeft een hypotheek geregistreerd."
        ),
        missing=False,
        data_bronnen=["brk_ownership_records"],
    )


def score_eigendoms_complexiteit(parcel_data: dict) -> FactorResult:
    """Factor R15: Eigendoms-complexiteit. Default gewicht=6 (M050/S03 D2 + D5).

    D5 (user-locked): count distinct (eigenaar_naam, kvk_nummer). Ignores
    aandeel + zakelijk_recht_type (user-explicit decision).
    Buckets: 1 → 0.0, 2 → 0.5, ≥3 → 1.0.
    F4: all-NULL eigenaar_naam+kvk_nummer collapse to {(None, None)} → n_owners=1.
    """
    records = parcel_data.get("brk_records") or []
    if not records:
        return _missing_brk(
            "Geen BRK-data — eigendomspositie onbekend",
            weight=6,
        )
    unique_owners = {
        (r.get("eigenaar_naam"), r.get("kvk_nummer")) for r in records
    }
    n_owners = len(unique_owners)
    if n_owners <= 1:
        score = 0.0
    elif n_owners == 2:
        score = 0.5
    else:
        score = 1.0
    return FactorResult(
        waarde={"n_owners": n_owners},
        genormaliseerde_score=score,
        gewicht=6,
        bijdrage=score * 6,
        categorie="risico",
        toelichting_kort=f"{n_owners} verschillende eigenaren",
        toelichting_lang=(
            f"BRK toont {n_owners} unieke eigenaren. "
            "Eén eigenaar — eenvoudige onderhandelingspositie."
            if n_owners == 1 else
            f"BRK toont {n_owners} unieke eigenaren. "
            "Multi-owner deal vereist coördinatie met meerdere partijen."
        ),
        missing=False,
        data_bronnen=["brk_ownership_records"],
    )


def score_koopwaarde_trend(parcel_data: dict) -> FactorResult:
    """Factor R16: Koopsom-actualiteit (NOT 'tren'+'d' — M050/S03 D6 narrative honesty).

    Default gewicht=4 (D2). koopjaar-age proxy from most-recent record (fetched_at DESC).
    Buckets: <5y → 0.3, 5–15y → 0.5, 15–25y → 0.7, >25y → 0.9.
    NULL koopjaar OR no records → missing=True.
    F5: future-koopjaar (age<0, data error) → missing=True (chosen behaviour).

    NARRATIVE HONESTY RULE (D6, REGRESSION-CRITICAL test #4):
    toelichting_kort + toelichting_lang MUST NOT contain the banned substring
    (case-insensitive). This factor is a koopjaar-age proxy, not a real
    price-development signal. Use 'actualiteit' / 'koopsom-vermelding' /
    'verouderd' / 'recente koop' / 'waarde-ontwikkeling' — NEVER the banned word.
    """
    from datetime import datetime
    records = parcel_data.get("brk_records") or []
    if not records:
        return _missing_brk("Koopjaar onbekend — geen BRK-data", weight=4)
    most_recent = max(records, key=lambda r: r.get("fetched_at") or "")
    koopjaar = most_recent.get("koopjaar")
    if koopjaar is None:
        return _missing_brk("Geen koopjaar geregistreerd", weight=4)
    current_year = datetime.utcnow().year
    age = current_year - int(koopjaar)
    if age < 0:
        # F5: future koopjaar = data error
        return _missing_brk("Ongeldige koopjaar-data", weight=4)
    if age < 5:
        score, qualifier = 0.3, "recente koop"
    elif age < 15:
        score, qualifier = 0.5, "actuele koopsom-vermelding"
    elif age < 25:
        score, qualifier = 0.7, "koopsom mogelijk verouderd"
    else:
        score, qualifier = 0.9, "koopsom waarschijnlijk sterk verouderd"
    return FactorResult(
        waarde={
            "koopjaar": koopjaar,
            "age_jaar": age,
            "koopsom": most_recent.get("koopsom"),
        },
        genormaliseerde_score=score,
        gewicht=4,
        bijdrage=score * 4,
        categorie="risico",
        toelichting_kort=f"Koop in {koopjaar} ({age}j geleden) — {qualifier}",
        toelichting_lang=(
            f"Meest recente BRK-record toont koop in {koopjaar} "
            f"({age} jaar geleden). Dit is een actualiteits-proxy van de koopsom, "
            "geen waarde-ontwikkeling over tijd."
        ),
        missing=False,
        data_bronnen=["brk_ownership_records"],
    )


# ── beleidsalignement (M053/S01 cascade — Omgevingsvisie) ──────────────────

_KARAKTER_BASE_SCORE: dict[str, float] = {
    "centraal_stedelijk": 8.5,
    "transformatie": 9.0,
    "stedelijk_wonen": 6.0,
    "werklocatie": 3.0,
    "dorp": 6.5,
    "landschap": 2.5,
}

# project_type → karakters that align especially well (small bonus)
_PROJECTTYPE_KARAKTER_FIT: dict[str, set[str]] = {
    "transformatie_wonen": {"transformatie", "centraal_stedelijk"},
    "nieuwbouw_wonen": {"transformatie", "stedelijk_wonen", "dorp"},
    "commercieel_naar_wonen": {"transformatie", "centraal_stedelijk"},
    "optoppen": {"centraal_stedelijk", "stedelijk_wonen"},
    "splitsen": {"stedelijk_wonen", "centraal_stedelijk"},
    "onbepaald": set(),
}

_KARAKTER_LABEL: dict[str, str] = {
    "centraal_stedelijk": "centraal stedelijk gebied",
    "transformatie": "transformatiegebied",
    "stedelijk_wonen": "stedelijk woongebied",
    "werklocatie": "werklocatie",
    "dorp": "dorpskern",
    "landschap": "landschapszone",
}

# M053/S03: deterministic CBS-wijk → omgevingsvisie-gebied crosswalk for Venlo (GM0983).
# The omgevingsvisie gebonden_plaatsen ("Binnenstad Venlo", "Tradeport Venlo") don't
# substring-match the CBS wijk names ("Wijk 11 Venlo-Centrum"), so the high-value
# gebieden never matched. Keyed by _normalize_wijk(cbs_wijk_naam). Geocode-generic = todo.
_VENLO_WIJK_TO_GEBIED: dict[str, str] = {
    _normalize_wijk("Wijk 11 Venlo-Centrum"): "Hart van het Centraal stedelijk gebied",
    _normalize_wijk("Wijk 21 Blerick-Midden"): "Hart van het Centraal stedelijk gebied",
    _normalize_wijk("Wijk 28 Trade-Port"): "Werklocaties",
    _normalize_wijk("Wijk 12 Venlo-Zuid"): "Stedelijke woongebieden",
    _normalize_wijk("Wijk 13 Venlo-Oost-Noord"): "Stedelijke woongebieden",
    _normalize_wijk("Wijk 14 Venlo-Noord"): "Stedelijke woongebieden",
    _normalize_wijk("Wijk 15 Venlo-Oost-Zuid"): "Stedelijke woongebieden",
    _normalize_wijk("Wijk 16 Het Ven"): "Stedelijke woongebieden",
    _normalize_wijk("Wijk 23 Blerick-Zuid"): "Stedelijke woongebieden",
    _normalize_wijk("Wijk 24 Vossener"): "Stedelijke woongebieden",
    _normalize_wijk("Wijk 26 Hout-Blerick"): "Stedelijke woongebieden",
    _normalize_wijk("Wijk 27 Boekend"): "Stedelijke woongebieden",
    _normalize_wijk("Wijk 31 Tegelen-Centrum"): "Stedelijke woongebieden",
    _normalize_wijk("Wijk 32 Op de Hei"): "Stedelijke woongebieden",
    _normalize_wijk("Wijk 35 Steyl"): "Stedelijke woongebieden",
    _normalize_wijk("Wijk 41 Velden"): "Velden",
    _normalize_wijk("Wijk 43 Lomm"): "Lomm",
    _normalize_wijk("Wijk 44 Arcen"): "Arcen",
    _normalize_wijk("Wijk 51 Belfeld"): "Belfeld",
}

_RESTRICTIVE_KARAKTERS: frozenset[str] = frozenset({"landschap", "werklocatie"})
# Gebieden waar de gemeente expliciet op ontwikkeling stuurt: kansrijk los van
# projecttype (de meeste percelen worden gescoord met project_type="onbepaald").
_HIGH_VALUE_KARAKTERS: frozenset[str] = frozenset({"centraal_stedelijk", "transformatie"})


def _beleids_verdict(
    matched: GebiedPolicy | None, project_type: str
) -> tuple[str, bool]:
    """Return (verdict, strijdig_met_visie) for popup + card.

    verdict ∈ {kansrijk, neutraal, strijdig, geen_beleid}. Soft score is unchanged;
    this is the qualitative read a developer acts on (gemeente-medewerkingskans).

    Kansrijk fires two ways: (1) een high-value gebied (centraal-stedelijk/transformatie)
    met prioriteit hoog stuurt de gemeente actief op ontwikkeling — kansrijk ongeacht
    projecttype (default scoring gebruikt 'onbepaald'); (2) het projecttype past expliciet
    bij het gebied-karakter én de prioriteit is hoog/gemiddeld.
    """
    if matched is None:
        return "geen_beleid", False
    strijdig = matched.karakter in _RESTRICTIVE_KARAKTERS
    if strijdig:
        return "strijdig", True
    # Baseline only (no projecttype-lens): a high-value gebied + prioriteit hoog reads
    # kansrijk because the gemeente actively steers development there. When a real
    # projecttype IS set, respect the fit map instead — don't override the lens.
    high_value_baseline = (
        project_type == "onbepaald"
        and matched.karakter in _HIGH_VALUE_KARAKTERS
        and matched.woningbouwprioriteit == "hoog"
    )
    fits = matched.karakter in _PROJECTTYPE_KARAKTER_FIT.get(project_type, set())
    if high_value_baseline or (fits and matched.woningbouwprioriteit in ("hoog", "gemiddeld")):
        return "kansrijk", False
    return "neutraal", False


def score_beleidsalignement(
    payload: OmgevingsvisiePayload | None,
    *,
    wijk_naam: str | None,
    project_type: str = "onbepaald",
) -> FactorResult:
    """M053/S01: per-deelgebied alignement-scoring uit de gemeentelijke omgevingsvisie.

    Matcht het perceel-wijk/plaats tegen GebiedPolicy.gebonden_plaatsen. Cloned from
    score_woonvisie_match: weight=0 when missing/no-match (sparse factor P5).
    """
    if payload is None:
        return FactorResult(
            waarde=None,
            genormaliseerde_score=0.0,
            gewicht=0,
            bijdrage=0.0,
            categorie="potentie",
            toelichting_kort="Geen omgevingsvisie beschikbaar voor deze gemeente (factor niet meegewogen).",
            toelichting_lang="Geen gemeentelijke omgevingsvisie beschikbaar. De factor wordt niet meegewogen.",
            data_bronnen=[],
            missing=True,
        )

    document_label = f"Omgevingsvisie {payload.tijdshorizon}"
    algemeen_citaat = payload.algemeen_citaat or ""

    # 1. Match deelgebied — crosswalk first (deterministic), substring fallback.
    parcel_norm = _normalize_wijk(wijk_naam)
    matched: GebiedPolicy | None = None
    crosswalk_gebied = _VENLO_WIJK_TO_GEBIED.get(parcel_norm)
    if crosswalk_gebied:
        matched = next(
            (g for g in payload.gebied_policies if g.gebied_naam == crosswalk_gebied),
            None,
        )
    if matched is None and parcel_norm and payload.gebied_policies:
        candidates: list[tuple[int, GebiedPolicy]] = []
        for g in payload.gebied_policies:
            for plaats in g.gebonden_plaatsen:
                pn = _normalize_wijk(plaats)
                if pn and (pn in parcel_norm or parcel_norm in pn):
                    candidates.append((len(pn), g))
                    break
        if candidates:
            candidates.sort(key=lambda t: -t[0])
            matched = candidates[0][1]

    # 2. No-match: factor not weighed (was a +0.5 floor — that inflated every parcel).
    if matched is None:
        verdict, strijdig = _beleids_verdict(None, project_type)
        uitleg_kort = (
            f"Geen deelgebied-match in {document_label}; gemeente-brede context gebruikt"
            if algemeen_citaat
            else f"Geen deelgebied-match in {document_label}"
        )
        uitleg_lang = uitleg_kort + (
            f". Citaat (gemeente-breed): {algemeen_citaat}" if algemeen_citaat else ""
        )
        uitleg_lang += f" (confidence {payload.confidence:.0%})"
        return FactorResult(
            waarde={
                "matched_gebied": None,
                "matched_policy": None,
                "algemeen_citaat": algemeen_citaat,
                "tijdshorizon": payload.tijdshorizon,
                "verdict": verdict,
                "strijdig_met_visie": strijdig,
            },
            genormaliseerde_score=0.0,
            gewicht=0,
            bijdrage=0.0,
            categorie="potentie",
            toelichting_kort=uitleg_kort,
            toelichting_lang=uitleg_lang,
            data_bronnen=["Gemeentelijke omgevingsvisie (LLM-extracted)"],
            missing=True,
        )

    # 3. Matched: karakter base + transformatie/prioriteit bonus + projecttype-fit
    raw = _KARAKTER_BASE_SCORE.get(matched.karakter, 5.0)
    if matched.transformatie_kansgebied:
        raw += 0.5
    if matched.woningbouwprioriteit == "hoog":
        raw += 0.5
    elif matched.woningbouwprioriteit == "laag":
        raw -= 0.5
    fit_note = ""
    if matched.karakter in _PROJECTTYPE_KARAKTER_FIT.get(project_type, set()):
        raw += 1.0
        fit_note = f"; projecttype past bij {_KARAKTER_LABEL.get(matched.karakter, matched.karakter)}"

    pulled = raw * payload.confidence + 5.0 * (1 - payload.confidence)
    pulled = max(0.0, min(10.0, pulled))

    pag_suffix = f", p.{matched.pagina}" if matched.pagina is not None else ""
    uitleg_kort = (
        f"Gebied '{matched.gebied_naam}' ({_KARAKTER_LABEL.get(matched.karakter, matched.karakter)}) "
        f"in {document_label}{fit_note}"
    )
    uitleg_lang = (
        f"{uitleg_kort}. Citaat ({matched.gebied_naam}{pag_suffix}): {matched.citaat}"
        f" (confidence {payload.confidence:.0%})"
    )

    verdict, strijdig = _beleids_verdict(matched, project_type)
    return FactorResult(
        waarde={
            "matched_gebied": matched.gebied_naam,
            "matched_policy": matched.model_dump(),
            "algemeen_citaat": algemeen_citaat,
            "tijdshorizon": payload.tijdshorizon,
            "verdict": verdict,
            "strijdig_met_visie": strijdig,
        },
        genormaliseerde_score=round(pulled / 10.0, 4),
        gewicht=0,
        bijdrage=0.0,
        categorie="potentie",
        toelichting_kort=uitleg_kort,
        toelichting_lang=uitleg_lang,
        data_bronnen=["Gemeentelijke omgevingsvisie (LLM-extracted)"],
        missing=False,
    )
