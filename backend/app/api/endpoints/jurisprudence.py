"""Jurisprudence API endpoints — Rechtspraak Open Data integration.

Endpoints are scoped to omgevingsrecht (environmental/planning law) domain.
Authentication uses the standard project auth dependency (JWT bearer token).
HTTP client is retrieved from request.app.state.http_client (shared AsyncClient).
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from starlette.requests import Request

from app.auth.dependencies import get_current_active_user
from app.government_apis.base import GovernmentAPIError
from app.government_apis.rechtspraak import rechtspraak_client, validate_ecli

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/search")
async def search_jurisprudence(
    request: Request,
    q: str = Query(..., description="Search query string"),
    max_results: int = Query(10, description="Max results to fetch", le=50),
    sort: str = Query("DESC", description="Sort order (ASC or DESC)"),
    current_user=Depends(get_current_active_user),
):
    """Search jurisprudentie via the Rechtspraak Open Data API.

    Results are automatically filtered to the omgevingsrecht domain.
    Returns up to `max_results` entries sorted by date.
    """
    client = request.app.state.http_client
    try:
        results = await rechtspraak_client.search_jurisprudence(
            query=q,
            client=client,
            max_results=max_results,
            sort=sort,
        )
        return {"status": "success", "results": results}
    except GovernmentAPIError as exc:
        logger.warning("Rechtspraak search error: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Unexpected error in search_jurisprudence: %s", exc)
        raise HTTPException(status_code=500, detail="Internal server error") from exc


@router.get("/doc/{ecli:path}")
async def get_jurisprudence_doc(
    ecli: str,
    request: Request,
    current_user=Depends(get_current_active_user),
):
    """Fetch full jurisprudentie document content by ECLI identifier.

    Validates ECLI format before making any HTTP request.
    Returns 400 for invalid ECLI, 404 if not found, 502 on upstream error.
    """
    if not validate_ecli(ecli):
        raise HTTPException(status_code=400, detail="Invalid ECLI format")

    client = request.app.state.http_client
    try:
        doc = await rechtspraak_client.get_jurisprudence_document(
            ecli=ecli,
            client=client,
        )
        if doc is None:
            raise HTTPException(status_code=404, detail="Document not found")

        return {"status": "success", "document": doc}
    except GovernmentAPIError as exc:
        logger.warning("Rechtspraak document error for %s: %s", ecli, exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Unexpected error in get_jurisprudence_doc for %s: %s", ecli, exc)
        raise HTTPException(status_code=500, detail="Internal server error") from exc
