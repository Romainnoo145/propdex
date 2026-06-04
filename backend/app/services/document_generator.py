"""Document generation service — AI-assisted concept documents from parcel data.

Generates eigenaar briefs and vooroverleg requests using Jinja2 templates
filled with parcel data. Optionally enriched by Claude for natural language.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from jinja2 import BaseLoader, Environment

logger = logging.getLogger(__name__)

# ── Templates ────────────────────────────────────────────────────

EIGENAAR_BRIEF_TEMPLATE = """\
**{{ bedrijfsnaam }}**
{{ bedrijfsadres }}

{{ datum }}

{{ eigenaar_aanhef }}
{{ eigenaar_adres }}

Betreft: Interesse in uw pand aan {{ pand_adres }}

{{ eigenaar_aanhef }},

Met grote interesse hebben wij uw pand aan **{{ pand_adres }}** bekeken. \
Als ontwikkelaar van vastgoedprojecten zijn wij actief op zoek naar locaties met \
ontwikkelpotentieel in de regio.

{% if use_case == "optoppen" -%}
Wij zien mogelijkheden om het pand te **optoppen** — het toevoegen van extra woonlagen \
bovenop de bestaande constructie. Dit biedt een unieke kans om woningen toe te voegen \
zonder extra grondgebruik.
{% elif use_case == "splitsen" -%}
Wij zien mogelijkheden om het pand te **splitsen** in meerdere zelfstandige wooneenheden. \
De huidige indeling en het beschikbare oppervlak lenen zich hier goed voor.
{% elif use_case == "transformatie" -%}
Wij zien mogelijkheden voor **transformatie** van het huidige gebruik naar woningen. \
De locatie en het gebouw bieden interessante mogelijkheden voor herontwikkeling.
{% elif use_case == "nieuwbouw" -%}
Wij zien mogelijkheden voor **sloop-nieuwbouw** op deze locatie. \
Het perceel biedt ruimte voor een nieuwbouwproject dat past binnen de ambities van de gemeente.
{% else -%}
Wij zien ontwikkelmogelijkheden voor deze locatie en willen graag de opties met u bespreken.
{% endif %}

Graag komen wij vrijblijvend met u in gesprek over de mogelijkheden. \
U kunt ons bereiken via onderstaande contactgegevens.

Met vriendelijke groet,

**{{ contactpersoon }}**
{{ bedrijfsnaam }}
{{ contact_email }}
{{ contact_telefoon }}
"""

EIGENAAR_BRIEF_BODY_TEMPLATE = """\
**Betreft: interesse in uw eigendom aan {{ pand_adres }}**

{{ eigenaar_aanhef }},

Met grote interesse hebben wij uw pand aan **{{ pand_adres }}** bekeken. \
Als ontwikkelaar van vastgoedprojecten zijn wij actief op zoek naar locaties met \
ontwikkelpotentieel in de regio.

{% if use_case == "optoppen" -%}
Wij zien mogelijkheden om het pand te **optoppen** — het toevoegen van extra woonlagen \
bovenop de bestaande constructie. Dit biedt een unieke kans om woningen toe te voegen \
zonder extra grondgebruik.
{% elif use_case == "splitsen" -%}
Wij zien mogelijkheden om het pand te **splitsen** in meerdere zelfstandige wooneenheden. \
De huidige indeling en het beschikbare oppervlak lenen zich hier goed voor.
{% elif use_case == "transformatie" -%}
Wij zien mogelijkheden voor **transformatie** van het huidige gebruik naar woningen. \
De locatie en het gebouw bieden interessante mogelijkheden voor herontwikkeling.
{% elif use_case == "nieuwbouw" -%}
Wij zien mogelijkheden voor **sloop-nieuwbouw** op deze locatie. \
Het perceel biedt ruimte voor een nieuwbouwproject dat past binnen de ambities van de gemeente.
{% else -%}
Wij zien ontwikkelmogelijkheden voor deze locatie en willen graag de opties met u bespreken.
{% endif %}

Graag komen wij vrijblijvend met u in gesprek over de mogelijkheden. \
U kunt ons bereiken via onderstaande contactgegevens.
"""

VOOROVERLEG_TEMPLATE = """\
# Verzoek vooroverleg — {{ pand_adres }}

**Aan:** College van B&W gemeente {{ gemeente_naam }}
**Van:** {{ bedrijfsnaam }}
**Datum:** {{ datum }}
**Betreft:** Verzoek tot vooroverleg omgevingsvergunning

---

## 1. Aanleiding

{{ bedrijfsnaam }} is voornemens een ontwikkeling te realiseren op de locatie \
**{{ pand_adres }}** te {{ gemeente_naam }}{% if kadastraal_nummer %} ({{ kadastraal_nummer }}){% endif %}.

Alvorens een formele aanvraag omgevingsvergunning in te dienen, verzoeken wij \
om een vooroverleg met de gemeente om de haalbaarheid van het plan te toetsen.

## 2. Locatie

- **Adres:** {{ pand_adres }}
- **Gemeente:** {{ gemeente_naam }}
{% if kadastraal_nummer %}- **Kadastrale aanduiding:** {{ kadastraal_nummer }}{% endif %}
{% if bouwjaar %}- **Bouwjaar:** {{ bouwjaar }}{% endif %}
{% if oppervlakte_m2 %}- **Perceeloppervlakte:** {{ oppervlakte_m2 }} m²{% endif %}
{% if bestemming %}- **Huidige bestemming:** {{ bestemming }}{% endif %}

## 3. Voorgenomen ontwikkeling

{% if use_case == "optoppen" -%}
Het voornemen is om het bestaande pand te **optoppen** met één of meerdere bouwlagen \
ten behoeve van woningbouw. Het bestaande pand blijft gehandhaafd.
{% elif use_case == "splitsen" -%}
Het voornemen is om het bestaande pand te **splitsen** in meerdere zelfstandige \
wooneenheden, met inachtneming van de geldende huisvestingsverordening.
{% elif use_case == "transformatie" -%}
Het voornemen is om het bestaande pand te **transformeren** van de huidige \
(niet-woon)functie naar woningen. Dit vergt mogelijk een wijziging van het omgevingsplan.
{% elif use_case == "nieuwbouw" -%}
Het voornemen is om het bestaande pand te slopen en **nieuwbouw** te realiseren \
ten behoeve van woningen.
{% else -%}
Het voornemen is om een herontwikkeling te realiseren op deze locatie.
{% endif %}

## 4. Vraagstelling

Wij verzoeken de gemeente om:

1. Een indicatie of het voorgenomen plan past binnen het geldende omgevingsplan
2. Eventuele belemmeringen of aandachtspunten te benoemen
3. Advies over de te volgen vergunningprocedure (regulier / uitgebreid / BOPA)
4. Een indicatie van de te verwachten doorlooptijd

## 5. Bijlagen

_Nader aan te leveren:_
- Situatieschets / concepttekening
- Kadastrale kaart
{% if use_case == "optoppen" %}- Constructief vooronderzoek{% endif %}
{% if use_case == "transformatie" %}- Haalbaarheidsanalyse{% endif %}

---

{{ contactpersoon }}
{{ bedrijfsnaam }}
{{ contact_email }} | {{ contact_telefoon }}
"""


# ── Template registry ────────────────────────────────────────────

TEMPLATES: dict[str, str] = {
    "eigenaar_brief": EIGENAAR_BRIEF_TEMPLATE,
    "eigenaar_brief_body": EIGENAAR_BRIEF_BODY_TEMPLATE,
    "vooroverleg_request": VOOROVERLEG_TEMPLATE,
}


def generate_document(
    template_id: str,
    parcel_data: dict[str, Any],
    user_context: dict[str, Any] | None = None,
) -> str | None:
    """Generate a concept document from a template + parcel data.

    Args:
        template_id: Template key (eigenaar_brief, vooroverleg_request)
        parcel_data: Parcel flags/info dict
        user_context: Optional user/company info overrides

    Returns:
        Rendered Markdown string, or None if template not found
    """
    template_str = TEMPLATES.get(template_id)
    if not template_str:
        return None

    env = Environment(loader=BaseLoader(), autoescape=False)
    template = env.from_string(template_str)

    # Build context from parcel data + user context
    ctx = _build_template_context(parcel_data, user_context)

    try:
        return template.render(**ctx)
    except Exception:
        logger.exception("Document generation failed for template %s", template_id)
        return None


def _build_template_context(
    parcel_data: dict[str, Any],
    user_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build Jinja2 template context from parcel data."""
    uc = user_context or {}
    now = datetime.utcnow()

    # Dutch date formatting
    dutch_months = [
        "", "januari", "februari", "maart", "april", "mei", "juni",
        "juli", "augustus", "september", "oktober", "november", "december",
    ]
    datum = f"{now.day} {dutch_months[now.month]} {now.year}"

    # Extract best use case from use_case_scores
    use_case_scores = parcel_data.get("use_case_scores") or {}
    best_uc = None
    best_score = -1
    for uc_id, uc_data in use_case_scores.items():
        if isinstance(uc_data, dict):
            s = uc_data.get("score", 0)
            if s > best_score:
                best_score = s
                best_uc = uc_id

    # Extract bestemming
    bestemmingen = parcel_data.get("bestemmingen") or []
    bestemming = None
    if bestemmingen and isinstance(bestemmingen[0], dict):
        bestemming = bestemmingen[0].get("naam") or bestemmingen[0].get("type")
    elif bestemmingen and isinstance(bestemmingen[0], str):
        bestemming = bestemmingen[0]

    scores = parcel_data.get("scores", {})

    return {
        "datum": datum,
        "pand_adres": parcel_data.get("address", "Adres onbekend"),
        "gemeente_naam": parcel_data.get("gemeente_naam", ""),
        "kadastraal_nummer": parcel_data.get("kadastraal_nummer"),
        "bouwjaar": parcel_data.get("bouwjaar"),
        "oppervlakte_m2": parcel_data.get("area_m2"),
        "bestemming": bestemming,
        "use_case": uc.get("use_case") or best_uc,
        "score": round(scores.get("overall", 0)) if scores.get("overall") else None,
        # User/company info with defaults
        "bedrijfsnaam": uc.get("bedrijfsnaam", "[Uw bedrijfsnaam]"),
        "bedrijfsadres": uc.get("bedrijfsadres", "[Uw bedrijfsadres]"),
        "contactpersoon": uc.get("contactpersoon", "[Uw naam]"),
        "contact_email": uc.get("contact_email", "[uw@email.nl]"),
        "contact_telefoon": uc.get("contact_telefoon", "[uw telefoonnummer]"),
        "eigenaar_aanhef": uc.get("eigenaar_aanhef", "Geachte eigenaar"),
        "eigenaar_adres": uc.get("eigenaar_adres", "[Adres eigenaar]"),
    }


def list_templates() -> list[dict[str, str]]:
    """List available document templates."""
    return [
        {
            "id": "eigenaar_brief",
            "name": "Brief aan eigenaar",
            "description": "Concept-aanschrijving aan de eigenaar van het pand met ontwikkelvoorstel",
        },
        {
            "id": "vooroverleg_request",
            "name": "Vooroverleg verzoek",
            "description": "Verzoek aan gemeente voor vooroverleg over een ontwikkelplan",
        },
    ]
