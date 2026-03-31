"""Checklist document PDF generation — mapping config, data sufficiency, and base generator.

Maps checklist item IDs to PropertyReportResponse fields and PDF templates.
Each document type has a confidence level, optional disclaimer, and required fields
that must be present in the report data for generation.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Literal

from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

logger = logging.getLogger(__name__)

_DUTCH_MONTHS = [
    "",
    "januari",
    "februari",
    "maart",
    "april",
    "mei",
    "juni",
    "juli",
    "augustus",
    "september",
    "oktober",
    "november",
    "december",
]


def _format_dutch_datetime(dt: datetime) -> str:
    """Format datetime as Dutch locale string, e.g. '12 maart 2026, 14:30'."""
    month = _DUTCH_MONTHS[dt.month]
    return f"{dt.day} {month} {dt.year}, {dt.hour:02d}:{dt.minute:02d}"


# ---------------------------------------------------------------------------
# Config dataclass
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class ChecklistDocConfig:
    """Configuration for a single checklist document type."""

    template_name: str
    confidence: Literal["high", "medium"]
    title: str
    required_fields: list[str] = field(default_factory=list)
    checklist_item_ids: list[str] = field(default_factory=list)
    disclaimer: str | None = None


# ---------------------------------------------------------------------------
# Mapping: document type → config  (from M020-CONTEXT research table)
# ---------------------------------------------------------------------------

CHECKLIST_DOC_CONFIGS: dict[str, ChecklistDocConfig] = {
    # --- HIGH confidence (definitive / official data) ---
    "kadaster": ChecklistDocConfig(
        template_name="kadaster.html",
        confidence="high",
        title="Kadaster & Eigendomsoverzicht",
        required_fields=["cadastral_parcels"],
        checklist_item_ids=["opt-02", "spl-02", "tra-02", "nbw-03"],
    ),
    "bestemmingsplan": ChecklistDocConfig(
        template_name="bestemmingsplan.html",
        confidence="high",
        title="Bestemmingsplan Toetsing",
        required_fields=["zoning"],
        checklist_item_ids=["opt-09", "spl-11", "nbw-10", "tra-10"],
    ),
    "energielabel": ChecklistDocConfig(
        template_name="energielabel.html",
        confidence="high",
        title="Energielabel Samenvatting",
        required_fields=["energy_label"],
        checklist_item_ids=["opt-17", "spl-16", "tra-17", "nbw-17"],
    ),
    "wkb_precheck": ChecklistDocConfig(
        template_name="wkb_precheck.html",
        confidence="high",
        title="Wkb Pre-check",
        required_fields=["wkb_precheck"],
        checklist_item_ids=["opt-18", "nbw-16", "tra-16"],
    ),
    "monumenten": ChecklistDocConfig(
        template_name="monumenten.html",
        confidence="high",
        title="Monumentenstatus",
        required_fields=["monuments"],
        checklist_item_ids=["tra-13"],
    ),
    "risicoprofiel": ChecklistDocConfig(
        template_name="risicoprofiel.html",
        confidence="high",
        title="Fysiek Risicoprofiel",
        required_fields=["fysiek_risico_profiel"],
        checklist_item_ids=[],
    ),
    "woz": ChecklistDocConfig(
        template_name="woz.html",
        confidence="high",
        title="WOZ Taxatieoverzicht",
        required_fields=["woz_data"],
        checklist_item_ids=[],
    ),
    # --- MEDIUM confidence (indicative — disclaimer required) ---
    "bodem": ChecklistDocConfig(
        template_name="bodem.html",
        confidence="medium",
        title="Bodemkwaliteit Screening",
        required_fields=["bodem_data"],
        checklist_item_ids=["tra-06", "nbw-06"],
        disclaimer="Indicatief — vervangt geen NEN 5740 bodemonderzoek",
    ),
    "fundering": ChecklistDocConfig(
        template_name="fundering.html",
        confidence="medium",
        title="Funderingsrisico Screening",
        required_fields=["funderingsrisicogebied"],
        checklist_item_ids=["opt-06"],
        disclaimer="Indicatief — vervangt geen funderingsinspectie",
    ),
    "asbest": ChecklistDocConfig(
        template_name="asbest.html",
        confidence="medium",
        title="Asbestrisico Screening",
        required_fields=["asbest_indicator"],
        checklist_item_ids=["opt-07", "tra-07"],
        disclaimer="Indicatief — vervangt geen gecertificeerde asbestinventarisatie",
    ),
    "vergunningen": ChecklistDocConfig(
        template_name="vergunningen.html",
        confidence="medium",
        title="Vergunningenhistorie",
        required_fields=["permit_precedents"],
        checklist_item_ids=["opt-11", "nbw-11"],
        disclaimer="Gebaseerd op bekendmakingen — vervangt geen formele vergunningaanvraag",
    ),
    "haalbaarheid": ChecklistDocConfig(
        template_name="haalbaarheid.html",
        confidence="medium",
        title="Haalbaarheidsinschatting",
        required_fields=["zoning", "scores_v3"],
        checklist_item_ids=["opt-01", "tra-01"],
        disclaimer="Indicatieve haalbaarheidsinschatting op basis van openbare databronnen",
    ),
}


# ---------------------------------------------------------------------------
# Data sufficiency check
# ---------------------------------------------------------------------------

def _field_is_present(report_data: dict, field_name: str) -> bool:
    """Check if a report field is present and non-empty.

    Special cases:
    - brk_ownership: must have status != 'unavailable'
    - list/dict fields: must be truthy (non-empty)
    - scalar fields: must be not None
    """
    value = report_data.get(field_name)
    if value is None:
        return False

    # Special case: brk_ownership
    if field_name == "brk_ownership":
        if isinstance(value, dict):
            return value.get("status") != "unavailable"
        return False

    # Lists / dicts must be non-empty
    if isinstance(value, (list, dict)):
        return bool(value)

    # Scalars: present if not None (already checked above)
    return True


def get_available_docs(report_data: dict) -> list[str]:
    """Determine which checklist documents can be generated from the available data.

    Iterates all configured document types and checks that every required field
    is present and non-empty in ``report_data``.

    Args:
        report_data: PropertyReportResponse as a dict.

    Returns:
        List of doc_type keys (e.g. ``['kadaster', 'energielabel', ...]``)
        for which all required fields are satisfied.
    """
    available: list[str] = []
    for doc_type, config in CHECKLIST_DOC_CONFIGS.items():
        if all(_field_is_present(report_data, f) for f in config.required_fields):
            available.append(doc_type)
        else:
            missing = [f for f in config.required_fields if not _field_is_present(report_data, f)]
            logger.debug(
                "checklist_pdf: %s skipped — missing fields: %s",
                doc_type,
                missing,
            )
    return available


# ---------------------------------------------------------------------------
# PDF generation
# ---------------------------------------------------------------------------

_TEMPLATE_DIR = Path(__file__).parent / "templates" / "checklist"


def generate_checklist_pdf(doc_type: str, report_data: dict, report_name: str) -> bytes:
    """Generate a checklist document PDF for the given type.

    This is a SYNCHRONOUS function (WeasyPrint is CPU-bound).
    Call via ``asyncio.to_thread()`` from async endpoints to avoid blocking
    the event loop.

    Args:
        doc_type: Key in ``CHECKLIST_DOC_CONFIGS`` (e.g. ``'kadaster'``).
        report_data: PropertyReportResponse as a dict.
        report_name: Human-readable report / address name for the header.

    Returns:
        PDF file bytes.

    Raises:
        KeyError: If ``doc_type`` is not in ``CHECKLIST_DOC_CONFIGS``.
        Exception: If template rendering or PDF generation fails.
    """
    config = CHECKLIST_DOC_CONFIGS[doc_type]

    env = Environment(loader=FileSystemLoader(str(_TEMPLATE_DIR)))
    template = env.get_template(config.template_name)

    now = datetime.utcnow()
    generated_at = _format_dutch_datetime(now)

    context = {
        "report_data": report_data,
        "report_name": report_name,
        "config": config,
        "generated_at": generated_at,
    }

    html_string = template.render(context)
    pdf_bytes: bytes = HTML(string=html_string).write_pdf()

    logger.info(
        "checklist_pdf: generated %s (%d bytes) for %s",
        doc_type,
        len(pdf_bytes),
        report_name,
    )
    return pdf_bytes
