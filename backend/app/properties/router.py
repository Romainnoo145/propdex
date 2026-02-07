"""Property lookup API endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user, get_current_organization_id
from app.core.database import get_db
from app.government_apis.base import APINotFoundError, GovernmentAPIError
from app.government_apis.pdok_locatieserver import PDOKLocatieserver
from app.middleware.rate_limit import limiter
from app.models.user import User
from app.schemas.address import AddressInput
from app.schemas.property import PropertyReportResponse
from app.services.property_aggregator import aggregate_property_data

router = APIRouter(prefix="/api/properties", tags=["properties"])

# Module-level PDOK client instance
_pdok_client = PDOKLocatieserver()


@router.post("/lookup", response_model=PropertyReportResponse)
@limiter.limit("30/minute")
async def lookup_property(
    request: Request,
    input_data: AddressInput,
    force_refresh: bool = False,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> PropertyReportResponse:
    """
    Look up property data by Dutch address.

    Aggregates data from multiple government APIs:
    - BAG API: Address and building data
    - PDOK Cadastral API: Parcel/ownership data
    - DSO Ruimtelijke Plannen API: Zoning and building dimensions
    - RCE Rijksmonument API: Monument status

    Returns complete property intelligence report with zoning rules,
    monument status, map data with geometries, section-level source
    attribution, cache metadata, and completeness scoring. Supports
    partial failures (returns partial data if some APIs fail).

    Requires JWT authentication. Rate limited to 30 requests per minute.

    Args:
        request: FastAPI request object
        input_data: Address input (postcode + huisnummer)
        force_refresh: If True, bypass all caches and fetch fresh data (for "Vernieuwen" button)
        current_user: Authenticated user
        organization_id: Tenant ID for cache isolation
        db: Database session

    Returns:
        PropertyReportResponse: Aggregated property intelligence report

    Raises:
        HTTPException 404: Address not found in BAG registry
        HTTPException 502: Upstream API failure
        HTTPException 500: Internal server error
    """
    # Get shared httpx client from app state
    client = request.app.state.http_client

    try:
        result = await aggregate_property_data(
            input_data=input_data,
            client=client,
            organization_id=organization_id,
            session=db,
            force_refresh=force_refresh,
        )
        return result

    except HTTPException:
        # Re-raise HTTPExceptions from aggregator (already formatted)
        raise
    except APINotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Address not found in BAG registry",
        ) from e
    except GovernmentAPIError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Upstream API error: {e.message}",
        ) from e
    except Exception as e:
        # Catch-all for unexpected errors
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during property lookup",
        ) from e


@router.get("/suggest")
@limiter.limit("60/minute")
async def suggest_addresses(
    request: Request,
    q: str,
    current_user: User = Depends(get_current_active_user),
) -> list[dict]:
    """
    Get address autocomplete suggestions.

    Provides real-time address suggestions for user input using PDOK Locatieserver.
    Useful for frontend address input forms.

    Requires JWT authentication. Rate limited to 60 requests per minute
    (higher than lookup since autocomplete needs responsive UX).

    Args:
        request: FastAPI request object
        q: Search query (minimum 2 characters)
        current_user: Authenticated user

    Returns:
        list[dict]: List of address suggestions with metadata

    Raises:
        HTTPException 400: Query too short
        HTTPException 502: Upstream API failure
    """
    if len(q) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query must be at least 2 characters",
        )

    # Get shared httpx client from app state
    client = request.app.state.http_client

    try:
        suggestions = await _pdok_client.suggest(query=q, client=client)
        return suggestions
    except GovernmentAPIError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Address suggestion service unavailable: {e.message}",
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during address suggestion",
        ) from e
