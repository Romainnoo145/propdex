"""PDF export service for property intelligence reports using WeasyPrint."""

from app.reports.due_diligence_export import generate_due_diligence_pdf


def generate_report_pdf(report_data: dict, report_name: str) -> bytes:
    """Generate PDF report — delegates to due diligence dossier template.

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
    return generate_due_diligence_pdf(report_data, report_name)
