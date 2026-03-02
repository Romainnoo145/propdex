"""PDF export for Risicobeoordeling Startdossier using WeasyPrint."""

from datetime import datetime
from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML


def generate_dossier_pdf(
    report_data: dict,
    report_name: str,
    generated_by: str,
) -> bytes:
    """
    Generate a Risicobeoordeling Startdossier PDF from property intelligence data.

    This is a SYNCHRONOUS function (WeasyPrint is CPU-bound).
    Call via asyncio.to_thread() from async endpoints to avoid blocking the event loop.

    Args:
        report_data: PropertyReportResponse dict with all report sections
        report_name: Report name for the PDF title
        generated_by: Name or email of the user generating the dossier

    Returns:
        PDF bytes ready for streaming to client

    Raises:
        Exception: If template rendering or PDF generation fails
    """
    # Load Jinja2 template
    template_dir = Path(__file__).parent / "templates"
    env = Environment(loader=FileSystemLoader(str(template_dir)))
    template = env.get_template("wkb_kwaliteitsborger.html")

    # Prepare context for template
    generated_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    context = {
        "report_name": report_name,
        "report_data": report_data,
        "generated_at": generated_at,
        "generated_by": generated_by,
    }

    # Render HTML
    html_string = template.render(context)

    # Generate PDF
    html = HTML(string=html_string)
    pdf_bytes = html.write_pdf()

    return pdf_bytes
