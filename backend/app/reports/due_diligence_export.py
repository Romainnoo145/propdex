"""PDF export for Locatie Due Diligence Dossier using WeasyPrint."""

from datetime import datetime
from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

_DUTCH_MONTHS = [
    "",  # index 0 unused
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


def _split_score_factors(score_breakdown: dict | None) -> tuple[list, list]:
    """Split score_breakdown dict into potentie_factors and risico_factors sorted by bijdrage desc."""
    if not score_breakdown:
        return [], []
    potentie: list[dict] = []
    risico: list[dict] = []
    for factor_name, factor_data in score_breakdown.items():
        if not isinstance(factor_data, dict):
            continue
        entry = {
            "naam": factor_name,
            "waarde": factor_data.get("waarde"),
            "genormaliseerde_score": factor_data.get("genormaliseerde_score"),
            "gewicht": factor_data.get("gewicht"),
            "bijdrage": factor_data.get("bijdrage"),
            "toelichting_kort": factor_data.get("toelichting_kort"),
            "toelichting_lang": factor_data.get("toelichting_lang"),
            "missing": factor_data.get("missing", False),
        }
        categorie = factor_data.get("categorie", "potentie")
        if categorie == "risico":
            risico.append(entry)
        else:
            potentie.append(entry)
    potentie.sort(key=lambda x: x["bijdrage"] or 0, reverse=True)
    risico.sort(key=lambda x: x["bijdrage"] or 0, reverse=True)
    return potentie, risico


def _build_section_sources_dict(section_sources: list | None) -> dict:
    """Build dict keyed by section name for easy template lookup."""
    if not section_sources:
        return {}
    result: dict = {}
    for section_source in section_sources:
        if isinstance(section_source, dict):
            key = section_source.get("section", "")
            result[key] = section_source
        else:
            # Pydantic model or object with .section attribute
            key = getattr(section_source, "section", "")
            result[key] = section_source
    return result


def generate_due_diligence_pdf(report_data: dict, report_name: str) -> bytes:
    """
    Generate a Locatie Due Diligence Dossier PDF from property intelligence data.

    This is a SYNCHRONOUS function (WeasyPrint is CPU-bound).
    Call via asyncio.to_thread() from async endpoints to avoid blocking the event loop.

    Args:
        report_data: PropertyReportResponse dict with all report sections
        report_name: Report name for the PDF title

    Returns:
        PDF bytes ready for streaming to client

    Raises:
        Exception: If template rendering or PDF generation fails
    """
    template_dir = Path(__file__).parent / "templates"
    env = Environment(loader=FileSystemLoader(str(template_dir)))
    template = env.get_template("due_diligence.html")

    now = datetime.utcnow()
    generated_at = _format_dutch_datetime(now)

    # Pre-process score factors
    score_breakdown = report_data.get("score_breakdown_v3")
    potentie_factors, risico_factors = _split_score_factors(score_breakdown)

    # Pre-process section sources
    section_sources_dict = _build_section_sources_dict(report_data.get("section_sources"))

    context = {
        "report_data": report_data,
        "report_name": report_name,
        "generated_at": generated_at,
        "potentie_factors": potentie_factors,
        "risico_factors": risico_factors,
        "section_sources_dict": section_sources_dict,
    }

    html_string = template.render(context)
    html = HTML(string=html_string)
    pdf_bytes = html.write_pdf()

    return pdf_bytes
