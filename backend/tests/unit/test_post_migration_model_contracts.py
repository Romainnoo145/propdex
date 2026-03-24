"""Guards for models moved away from organization-scoped storage.

These tests protect the contract introduced by the j0/k0/l0/m0 migration chain:
- shared data tables no longer define organization_id on the ORM model
- user-scoped tables no longer define organization_id on the ORM model

This catches the exact class of regression where a model still selects a column
that was removed by migration, which otherwise only shows up at runtime.
"""

from app.models.area_scan import AreaScan
from app.models.cached_response import CachedAPIResponse
from app.models.change_read_state import ChangeReadState
from app.models.change_record import ChangeRecord
from app.models.funda_listing_snapshot import FundaListingSnapshot
from app.models.generated_dossier import GeneratedDossier
from app.models.jurisprudence_job import JuridischAnalyseJob
from app.models.parcel_cache import ParcelCache
from app.models.parcel_document import ParcelDocument
from app.models.parcel_favorite import ParcelFavorite
from app.models.parsing_job import ParsingJob
from app.models.pdf_document import PDFDocument
from app.models.report import SavedReport
from app.models.scan_result import ScanResult
from app.models.user_notification_state import UserNotificationState


USER_SCOPED_MODELS = [
    ParcelFavorite,
    SavedReport,
    ParcelDocument,
    GeneratedDossier,
    ChangeReadState,
    UserNotificationState,
]


SHARED_MODELS = [
    CachedAPIResponse,
    PDFDocument,
    ParsingJob,
    JuridischAnalyseJob,
    FundaListingSnapshot,
    AreaScan,
    ScanResult,
    ParcelCache,
    ChangeRecord,
]


def test_user_scoped_models_do_not_define_organization_id():
    """User-scoped models rely on user_id, not organization_id."""
    for model in USER_SCOPED_MODELS:
        assert "organization_id" not in model.__table__.columns.keys(), model.__name__


def test_shared_models_do_not_define_organization_id():
    """Shared reference/cache/scan models must stay de-tenanted."""
    for model in SHARED_MODELS:
        assert "organization_id" not in model.__table__.columns.keys(), model.__name__

