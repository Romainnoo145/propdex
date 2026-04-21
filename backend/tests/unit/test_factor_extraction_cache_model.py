"""Unit tests voor FactorExtractionCache SQLAlchemy model (M047/S04 T02).

Pure introspection tests — géén live DB, géén INSERT/SELECT. Valideert dat
de SQLAlchemy mapped_column + __table_args__ structuur correct is opgezet.
Actuele migration (T03) is gated op S01 merge — niet in deze slice-sessie.
"""


def test_model_tablename() -> None:
    from app.models.factor_extraction_cache import FactorExtractionCache

    assert FactorExtractionCache.__tablename__ == "factor_extraction_cache"


def test_unique_constraint_on_4_column_key() -> None:
    """Iron-rule: cache-key is (parcel_id, policy_document_id, factor_id, schema_version)."""
    from sqlalchemy import UniqueConstraint

    from app.models.factor_extraction_cache import FactorExtractionCache

    uqs = [
        c
        for c in FactorExtractionCache.__table__.constraints
        if isinstance(c, UniqueConstraint) and c.name == "uq_factor_extraction_cache_key"
    ]
    assert len(uqs) == 1
    cols = {c.name for c in uqs[0].columns}
    assert cols == {"parcel_id", "policy_document_id", "factor_id", "schema_version"}


def test_policy_document_fk_cascades() -> None:
    """Document-delete cleant cache automatisch (geen dangling refs)."""
    from app.models.factor_extraction_cache import FactorExtractionCache

    col = FactorExtractionCache.__table__.c.policy_document_id
    fk = next(iter(col.foreign_keys))
    assert fk.ondelete == "CASCADE"


def test_payload_column_is_jsonb() -> None:
    """Postgres JSONB garandeert efficient key-lookup + index mogelijkheden."""
    from sqlalchemy.dialects.postgresql import JSONB

    from app.models.factor_extraction_cache import FactorExtractionCache

    col_type = FactorExtractionCache.__table__.c.extracted_payload.type
    assert isinstance(col_type, JSONB)


def test_indexes_on_doc_factor_and_parcel() -> None:
    """Indexes voor (a) S05 cascade lookup by document_id + factor_id,
    (b) future parcel-scoped enumeratie."""
    from app.models.factor_extraction_cache import FactorExtractionCache

    index_names = {idx.name for idx in FactorExtractionCache.__table__.indexes}
    assert "ix_factor_extraction_cache_doc_factor" in index_names
    assert "ix_factor_extraction_cache_parcel" in index_names
