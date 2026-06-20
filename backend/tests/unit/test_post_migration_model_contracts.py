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


def test_scan_result_upsert_uses_existing_constraint():
    """The area-scan score-write upserts on a constraint that exists post-detenant.

    Regression: the k0 de-tenant migration dropped ``uq_scan_results_org_parcel``
    and replaced it with ``uq_scan_results_parcel`` (parcel_id only). The upsert in
    area_scan.py still named the dropped constraint, so every scan failed with
    ``UndefinedObjectError: constraint "uq_scan_results_org_parcel" ... does not exist``.
    This pins the conflict-target constant to a constraint that really exists on the model.
    """
    from app.jobs.area_scan import SCAN_RESULT_CONFLICT_CONSTRAINT

    model_constraint_names = {
        c.name for c in ScanResult.__table__.constraints if c.name is not None
    }
    assert SCAN_RESULT_CONFLICT_CONSTRAINT in model_constraint_names, (
        f"{SCAN_RESULT_CONFLICT_CONSTRAINT!r} is not a constraint on scan_results; "
        f"available: {sorted(model_constraint_names)}"
    )
    # The dropped org-scoped constraint must never reappear in active code.
    assert SCAN_RESULT_CONFLICT_CONSTRAINT != "uq_scan_results_org_parcel"

