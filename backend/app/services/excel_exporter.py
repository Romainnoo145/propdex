"""Excel export service for scan results."""

from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill

from app.models.area_scan import AreaScan
from app.models.parcel_cache import ParcelCache
from app.models.scan_result import ScanResult


async def export_scan_results_to_excel(
    results: list[tuple[ScanResult, ParcelCache]],
    scan: AreaScan,
    filters_applied: dict,
) -> BytesIO:
    """
    Export scan results to Excel .xlsx format.

    Creates a formatted Excel file with:
    - Metadata rows (gemeente, scan date, active filters)
    - Styled header row (bold white text on dark blue background)
    - Dutch column names
    - Score transparency columns (score + category)
    - Numeric types for sorting

    Args:
        results: List of (ScanResult, ParcelCache) tuples from service.list_scan_results
        scan: AreaScan record for metadata
        filters_applied: Dict of active filters to display

    Returns:
        BytesIO: Excel file buffer ready for streaming
    """
    # Create workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Scan Resultaten"

    # Add metadata rows
    ws.append([f"Gemeente: {scan.gemeente_naam} ({scan.gemeente_code})"])
    ws.append([f"Scandatum: {scan.created_at.strftime('%d-%m-%Y')}"])
    ws.append([f"Filters: {_format_filters(filters_applied)}"])
    ws.append([])  # Empty spacer row

    # Add header row with styling
    headers = [
        "Adres",
        "Gemeente",
        "Oppervlakte (m²)",
        "Bestemming",
        "Bebouwd",
        "Score",
        "Categorie",
    ]
    ws.append(headers)

    # Style header row (row 5)
    header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
    header_font = Font(bold=True, color="FFFFFF")

    for cell in ws[5]:
        cell.fill = header_fill
        cell.font = header_font

    # Add data rows
    for scan_result, parcel in results:
        # Extract bestemming types
        bestemmingen_text = ""
        if parcel.bestemmingen:
            types = [b.get("type", "") for b in parcel.bestemmingen if b.get("type")]
            bestemmingen_text = ", ".join(types)

        # Extract score category from flags
        category = "Low"
        if scan_result.flags:
            category = scan_result.flags.get("category", "Low")

        ws.append([
            parcel.address or "Onbekend",
            parcel.gemeente_code or "",
            parcel.area_m2 or 0,  # Numeric for Excel sorting
            bestemmingen_text,
            "Ja" if parcel.has_pand else "Nee",
            round(scan_result.score, 1) if scan_result.score else 0.0,  # Numeric
            category,
        ])

    # Auto-size columns
    for column_cells in ws.columns:
        # Find max content length in column
        max_length = 0
        column_letter = column_cells[0].column_letter

        for cell in column_cells:
            if cell.value:
                cell_length = len(str(cell.value))
                max_length = max(max_length, cell_length)

        # Set column width (cap at 50)
        adjusted_width = min(max_length + 2, 50)
        ws.column_dimensions[column_letter].width = adjusted_width

    # Save to BytesIO
    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    return buffer


def _format_filters(filters: dict) -> str:
    """
    Format active filters for display in Excel metadata.

    Args:
        filters: Dict of filter key-value pairs

    Returns:
        str: Comma-separated filter description or "Geen filters"
    """
    if not filters:
        return "Geen filters"

    parts = []

    if "has_pand" in filters:
        value = "Ja" if filters["has_pand"] else "Nee"
        parts.append(f"Bebouwd={value}")

    if "bestemming_type" in filters:
        parts.append(f"Bestemming={filters['bestemming_type']}")

    if "min_area_m2" in filters:
        parts.append(f"Min oppervlakte={filters['min_area_m2']}m²")

    if "max_area_m2" in filters:
        parts.append(f"Max oppervlakte={filters['max_area_m2']}m²")

    if "score_category" in filters:
        parts.append(f"Score={filters['score_category']}")

    return ", ".join(parts) if parts else "Geen filters"
