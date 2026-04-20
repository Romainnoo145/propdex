"""SQLAlchemy models for Propdex API."""

from app.models.ai_usage_log import AIUsageLog  # noqa: F401
from app.models.area_scan import AreaScan  # noqa: F401
from app.models.base import Base
from app.models.bulk_query import BulkQuery  # noqa: F401
from app.models.bulk_request import BulkRequest  # noqa: F401
from app.models.cached_response import CachedAPIResponse
from app.models.change_read_state import ChangeReadState  # noqa: F401
from app.models.change_record import ChangeRecord  # noqa: F401
from app.models.chat_conversation import ChatConversation  # noqa: F401
from app.models.chat_message import ChatMessage  # noqa: F401
from app.models.checklist_progress import ChecklistProgress  # noqa: F401
from app.models.favorite_note import FavoriteNote  # noqa: F401
from app.models.funda_listing_snapshot import FundaListingSnapshot  # noqa: F401
from app.models.gemeente_provincie_map import GemeenteProvincieMap  # noqa: F401
from app.models.generated_dossier import GeneratedDossier  # noqa: F401
from app.models.jurisprudence_job import JuridischAnalyseJob  # noqa: F401
from app.models.organization import Organization
from app.models.parcel_cache import ParcelCache  # noqa: F401
from app.models.parcel_document import ParcelDocument  # noqa: F401
from app.models.parcel_favorite import ParcelFavorite  # noqa: F401
from app.models.parcel_project_type import ParcelProjectType  # noqa: F401
from app.models.parcel_task import ParcelTask  # noqa: F401
from app.models.parsing_job import ParsingJob  # noqa: F401
from app.models.pdf_document import PDFDocument  # noqa: F401
from app.models.policy_document import PolicyDocument  # noqa: F401
from app.models.project import Project  # noqa: F401
from app.models.refresh_token import RefreshToken
from app.models.report import SavedReport  # noqa: F401
from app.models.ruling_cache import RulingCache  # noqa: F401
from app.models.scan_result import ScanResult  # noqa: F401
from app.models.user import User
from app.models.user_notification_state import UserNotificationState  # noqa: F401

__all__ = [
    "AIUsageLog",
    "Base",
    "ChatConversation",
    "ChatMessage",
    "Organization",
    "User",
    "RefreshToken",
    "CachedAPIResponse",
    "AreaScan",
    "BulkQuery",
    "BulkRequest",
    "ParcelCache",
    "ScanResult",
    "ParcelDocument",
    "ParcelFavorite",
    "ParcelProjectType",
    "PDFDocument",
    "PolicyDocument",
    "ParsingJob",
    "Project",
    "SavedReport",
    "ChangeRecord",
    "ChangeReadState",
    "ChecklistProgress",
    "UserNotificationState",
    "FundaListingSnapshot",
    "GeneratedDossier",
    "GemeenteProvincieMap",
    "JuridischAnalyseJob",
    "RulingCache",
]
