"""SQLAlchemy models for Propdex API."""

from app.models.area_scan import AreaScan  # noqa: F401
from app.models.base import Base
from app.models.cached_response import CachedAPIResponse
from app.models.change_read_state import ChangeReadState  # noqa: F401
from app.models.change_record import ChangeRecord  # noqa: F401
from app.models.funda_listing_snapshot import FundaListingSnapshot  # noqa: F401
from app.models.generated_dossier import GeneratedDossier  # noqa: F401
from app.models.jurisprudence_job import JuridischAnalyseJob  # noqa: F401
from app.models.organization import Organization
from app.models.parcel_cache import ParcelCache  # noqa: F401
from app.models.parcel_document import ParcelDocument  # noqa: F401
from app.models.parcel_favorite import ParcelFavorite  # noqa: F401
from app.models.parsing_job import ParsingJob  # noqa: F401
from app.models.pdf_document import PDFDocument  # noqa: F401
from app.models.project import Project  # noqa: F401
from app.models.refresh_token import RefreshToken
from app.models.report import SavedReport  # noqa: F401
from app.models.ruling_cache import RulingCache  # noqa: F401
from app.models.scan_result import ScanResult  # noqa: F401
from app.models.user import User
from app.models.user_notification_state import UserNotificationState  # noqa: F401

__all__ = [
    "Base",
    "Organization",
    "User",
    "RefreshToken",
    "CachedAPIResponse",
    "AreaScan",
    "ParcelCache",
    "ScanResult",
    "ParcelDocument",
    "ParcelFavorite",
    "PDFDocument",
    "ParsingJob",
    "Project",
    "SavedReport",
    "ChangeRecord",
    "ChangeReadState",
    "UserNotificationState",
    "FundaListingSnapshot",
    "GeneratedDossier",
    "JuridischAnalyseJob",
    "RulingCache",
]
