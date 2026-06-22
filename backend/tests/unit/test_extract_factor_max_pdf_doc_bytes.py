"""M054/S07: extract_factor exposes max_pdf_doc_bytes (forwarded to live path)."""
import inspect

from app.services.factor_extraction_service import extract_factor


def test_extract_factor_accepts_max_pdf_doc_bytes():
    params = inspect.signature(extract_factor).parameters
    assert "max_pdf_doc_bytes" in params
    assert params["max_pdf_doc_bytes"].default is None
