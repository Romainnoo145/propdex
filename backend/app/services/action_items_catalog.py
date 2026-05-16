"""Backend-owned catalog of ActionItem content (M049/S06).

Migrated source-of-truth from frontend/src/components/documentation/ActionItems.tsx.
Entries with a `source_key` matching DATA_SOURCE_KEYS surface as a `view_action_item`
action-button on `/instellingen/data-bronnen/{gemeente_code}` rows.
Entries without a gemeente-bound source_key live in INFRASTRUCTURE_ACTION_ITEMS
and are NOT shown via data-bronnen (consumed by /instellingen/admin or similar
future surfaces).

The ActionItem DB entity is unchanged (DATA referential work preserved per MIG-03);
this module is the UI-content catalog only.

Drift caught by tests/unit/test_action_items_catalog.py.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

ActionItemCategory = Literal["api-config", "extern-contact", "roadmap", "bugfix"]
ActionItemPriority = Literal["hoog", "middel", "laag"]


@dataclass(frozen=True)
class ActionItemEntry:
    """One ActionItem migrated from the frontend ITEMS array."""

    id: str
    title: str
    description: str
    category: ActionItemCategory
    priority: ActionItemPriority
    contact: str | None = None
    url: str | None = None
    done: bool = False


# ── Entries bound to a DATA_SOURCE_KEYS source_key ───────────────────────────
# key = source_key from data_source_keys.py
# These surface as the `view_action_item` action-button on data-bronnen rows.
ACTION_ITEMS_CATALOG: dict[str, ActionItemEntry] = {
    "brk-eigendom": ActionItemEntry(
        id="brk-eigendom",
        title="Kadaster BRK API activeren",
        description=(
            "BRK Bevragen staat op 'niet geconfigureerd'. Kadaster API-key aanvragen "
            "via Kadaster.nl developer portal. Nodig voor eigendomsdata, hypotheek "
            "en beslaginfo. Tier 3 — kost per request. Mapped under 'brk-eigendom' "
            "(most user-visible BRK source); brk-hypotheek + brk-beslag share the "
            "same Kadaster API auth, so a single ActionItem covers all three."
        ),
        category="api-config",
        priority="hoog",
        url="https://developer.kadaster.nl",
    ),
    "vindsubsidies": ActionItemEntry(
        id="vindsubsidies",
        title="Vindsubsidies.nl / Cocoon.nl contacten",
        description=(
            "Gemeentelijke subsidies zijn niet beschikbaar via een open API. "
            "Vindsubsidies.nl en Cocoon.nl bieden betaalde API's met gemeente-"
            "specifieke subsidies."
        ),
        category="extern-contact",
        priority="hoog",
        contact="Vindsubsidies.nl / Cocoon.nl",
        url="https://www.vindsubsidies.nl",
    ),
    "nvm-transactiedata": ActionItemEntry(
        id="nvm-transactiedata",
        title="NVM contacten voor transactiedata",
        description=(
            "VON-prijs voorspelling en transactiecijfers vereisen NVM data. "
            "Dit is een betaalde API. Contact opnemen voor developer access en pricing."
        ),
        category="extern-contact",
        priority="middel",
        contact="NVM",
        url="https://www.nvm.nl",
    ),
    "welstandsnota": ActionItemEntry(
        id="welstandsnota",
        title="Welstandsnota AI-parsing",
        description=(
            "Shipped in M045/S05. Welstandsnota PDFs worden via /instellingen/beleid-"
            "beheer geüpload en automatisch door Claude samengevat (document_summary_job). "
            "Samenvatting zichtbaar in rapport + parcel dossier."
        ),
        category="roadmap",
        priority="laag",
        done=True,
    ),
    "omgevingsvisie": ActionItemEntry(
        id="omgevingsvisie",
        title="Omgevingsvisie per gemeente",
        description=(
            "Shipped in M045/S05 + S06. Omgevingsvisies worden wekelijks auto-geïmporteerd "
            "uit KOOP/CVDR voor elke gemeente, plus handmatige upload via admin. "
            "AI-summary + cascade-zichtbaarheid op alle relevante surfaces."
        ),
        category="roadmap",
        priority="laag",
        done=True,
    ),
    "parkeerbeleid": ActionItemEntry(
        id="parkeerbeleid",
        title="Parkeerbeleid — CROW-381 calculator",
        description=(
            "PDF-upload van gemeentelijk parkeerbeleid werkt al (source_key parkeerbeleid). "
            "Nog te doen: CROW-381 parkeernorm-calculator die op basis van projecttype + "
            "wijktype een parkeereis voorspelt. Impact op bouwkosten."
        ),
        category="roadmap",
        priority="laag",
    ),
}


# ── INFRASTRUCTURE entries (NOT gemeente-bound) ──────────────────────────────
# Future surface: /instellingen/admin or a dedicated infra-actions widget.
# For M049/S06 these are MIGRATED to the catalog but not yet wired to a UI surface.
# (Frontend keeps a static informational view at /instellingen — see 06-02.)
INFRASTRUCTURE_ACTION_ITEMS: list[ActionItemEntry] = [
    ActionItemEntry(
        id="google-oauth",
        title="Google OAuth configureren",
        description=(
            "Google login staat op 'not configured'. Google Cloud Console project "
            "aanmaken, OAuth consent screen instellen, client ID + secret toevoegen aan .env."
        ),
        category="api-config",
        priority="middel",
        url="https://console.cloud.google.com/apis/credentials",
    ),
    ActionItemEntry(
        id="mail-server",
        title="Mailserver configureren",
        description=(
            "Email verificatie en wachtwoord reset werken niet — mailserver is niet "
            "geconfigureerd. SMTP credentials toevoegen aan .env (bijv. via Resend, "
            "Postmark of AWS SES)."
        ),
        category="api-config",
        priority="hoog",
    ),
    ActionItemEntry(
        id="stripe",
        title="Stripe subscription webhook verifiëren",
        description=(
            "Subscription endpoints bestaan in de backend maar Stripe webhook signing "
            "secret moet geconfigureerd worden voor productie."
        ),
        category="api-config",
        priority="middel",
        url="https://dashboard.stripe.com/webhooks",
    ),
    ActionItemEntry(
        id="kadaster-nhr",
        title="Kadaster NHR data voor eigenaarinformatie",
        description=(
            "Het Nationaal Handelsregister (via KVK) kan bedrijfsinformatie leveren voor "
            "eigenaren die rechtspersonen zijn. Vereist aparte API-overeenkomst."
        ),
        category="extern-contact",
        priority="laag",
        contact="KVK",
        url="https://developers.kvk.nl",
    ),
    ActionItemEntry(
        id="gemeente-subsidies",
        title="Gemeente-specifieke subsidies",
        description=(
            "Momenteel tonen we alleen landelijke RVO subsidies. Per gemeente zijn er vaak "
            "lokale subsidies. Vereist externe API of handmatige inventarisatie."
        ),
        category="roadmap",
        priority="hoog",
    ),
    ActionItemEntry(
        id="subsidie-matching",
        title="Subsidie matching per perceel",
        description=(
            "Automatisch matchen welke subsidies van toepassing zijn op een specifiek "
            "perceel op basis van locatie, type project, en eigendomssituatie."
        ),
        category="roadmap",
        priority="middel",
    ),
    ActionItemEntry(
        id="von-prijs",
        title="VON-prijs voorspelling per wijk",
        description=(
            "Op basis van NVM transactiedata de verwachte verkoopprijs per woningtype "
            "voorspellen. Vereist NVM API access."
        ),
        category="roadmap",
        priority="middel",
    ),
    ActionItemEntry(
        id="wws-punten",
        title="WWS huurpunten calculator",
        description=(
            "Automatisch berekenen of een woning in het vrije of gereguleerde huursegment "
            "valt op basis van oppervlakte, energielabel, WOZ-waarde."
        ),
        category="roadmap",
        priority="middel",
    ),
    ActionItemEntry(
        id="rendement-calc",
        title="Rendementscalculator bouwen",
        description=(
            "Bruto/netto rendement, belastingdruk (Box 1/3/BV), terugverdientijd. "
            "Kan met huidige data + configureerbare aannames."
        ),
        category="roadmap",
        priority="laag",
    ),
    ActionItemEntry(
        id="raadsinformatie-cache",
        title="Raadsinformatie DB-cache",
        description=(
            "De raadsinformatie service gebruikt nu een in-memory dict als cache die bij "
            "elke Railway restart verdampt. Migreren naar cache_manager (DB-backed)."
        ),
        category="roadmap",
        priority="laag",
    ),
    ActionItemEntry(
        id="funda-enrichment",
        title="Funda enrichment draaien",
        description=(
            "Het funda-summary endpoint bestaat en de wijkkaart toont de data, maar alle "
            "waarden zijn null omdat de funda-enrichment nog niet is uitgevoerd voor enige "
            "scan. Enrichment moet handmatig getriggerd worden om looptijd- en prijsmutatie-"
            "data te vullen."
        ),
        category="api-config",
        priority="middel",
    ),
    ActionItemEntry(
        id="chat-model-upgrade",
        title="Verkenner chat model upgrade",
        description=(
            "De AI-chat in de Verkenner gebruikt momenteel Haiku, wat matige Nederlandse "
            "antwoorden oplevert. Upgrade naar Sonnet voor betere kwaliteit, of vereenvoudig "
            "de intent-classificatie om verwarring te verminderen."
        ),
        category="roadmap",
        priority="middel",
    ),
]


# ── Module-load drift guard ───────────────────────────────────────────────────
# Mirrors data_source_keys.py self-check pattern. Reads DATA_SOURCE_KEYS lazily
# to avoid circular import; tests/unit/test_action_items_catalog.py exercises this.
def _validate_catalog() -> None:
    """Assert every ACTION_ITEMS_CATALOG key exists in DATA_SOURCE_KEYS."""
    from app.policy_documents.data_source_keys import DATA_SOURCE_KEYS

    catalog_keys = {e.key for e in DATA_SOURCE_KEYS}
    offenders = [k for k in ACTION_ITEMS_CATALOG if k not in catalog_keys]
    assert not offenders, (
        f"ACTION_ITEMS_CATALOG keys not in DATA_SOURCE_KEYS: {offenders}. "
        f"Either add them to data_source_keys.py or move to INFRASTRUCTURE_ACTION_ITEMS."
    )
