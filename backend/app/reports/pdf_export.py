"""PDF export service for property intelligence reports using WeasyPrint."""

from datetime import datetime
from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML


def generate_report_pdf(report_data: dict, report_name: str) -> bytes:
    """
    Generate a professional PDF report from property intelligence data.

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
    # Load Jinja2 template
    template_dir = Path(__file__).parent / "templates"
    env = Environment(loader=FileSystemLoader(str(template_dir)))
    template = env.get_template("report.html")

    # Prepare context for template
    generated_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    # Create mock report object for template (template expects report.report_name)
    class ReportMock:
        def __init__(self, name: str):
            self.report_name = name

    context = {
        "report": ReportMock(report_name),
        "report_data": report_data,
        "generated_at": generated_at,
    }

    # Render HTML
    html_string = template.render(context)

    # Generate PDF
    html = HTML(string=html_string)
    pdf_bytes = html.write_pdf()

    return pdf_bytes
