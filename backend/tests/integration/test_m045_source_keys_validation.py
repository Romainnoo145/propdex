"""M045/S05 T01 — validate_upload rejects source_keys outside the catalog."""
from app.policy_documents.service import validate_upload


def test_validate_upload_rejects_unknown_source_key():
    """An invented source_key must be rejected with a 'niet toegestaan' message."""
    err = validate_upload("landelijk", "made-up-key", "application/pdf", 1024)
    assert err is not None
    assert "niet toegestaan" in err.lower()


def test_validate_upload_accepts_catalog_source_key():
    """A canonical catalog entry (gemeente/woonvisie) must validate cleanly.

    'woonvisie' is one of the 16 gemeente entries in beleid.tsx GEMEENTE_DATA_SOURCES
    mirrored into app.policy_documents.source_keys.
    """
    err = validate_upload("gemeente", "woonvisie", "application/pdf", 1024)
    assert err is None
