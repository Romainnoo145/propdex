"""Pydantic schemas voor factor-extraction pipeline (M047/S04).

Generic typing via a pluggable Pydantic validator — callers (S06 woonvisie_match,
M050+ andere cascade-factoren) leveren hun eigen schema. factor_extractor
verifieert dat Claude's tool_use.input dict tegen die validator valideert;
falen → expliciete FactorExtractionError (geen silent default-pass).
"""

from datetime import datetime
from typing import Any, Final, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

PayloadT = TypeVar("PayloadT", bound=BaseModel)


class FactorDefinition(BaseModel, Generic[PayloadT]):
    """Contract waarmee een caller een factor-extractie definieert.

    - factor_id: stabiele string, single source of truth voor cache-key + registry
      (S03). Convention: snake_case, matching factor-function name (bv.
      'woonvisie_match' voor S06's score_woonvisie_match).
    - tool_name: naam van het Anthropic tool dat Claude invokes. Convention:
      `extract_{factor_id}` — nodig omdat Claude's tool-use API naming strict is.
    - description: wordt aan Claude doorgegeven als tool-description; bepaalt
      waarop Claude focust in het document. Bij falen: scherpper maken.
    - input_schema: JSON Schema dict zoals door Anthropic vereist. Moet matchen
      met de Pydantic `payload_model` (handmatig — Pydantic's model_json_schema()
      output is bijna compatibel maar Anthropic wil 'type: object' + 'properties'
      + 'required' zónder $defs-indirection voor eenvoudige cases).
    - payload_model: Pydantic BaseModel subclass die Claude's tool_use.input dict
      valideert. Single source of truth voor type-safety.
    - prompt_instructions: user-message text achter het PDF-blok. Beknopt; de
      tool-description doet het zware werk.
    """

    model_config = ConfigDict(arbitrary_types_allowed=True)

    factor_id: str = Field(min_length=1, max_length=100, pattern=r"^[a-z][a-z0-9_]*$")
    tool_name: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=10, max_length=2000)
    input_schema: dict[str, Any]
    payload_model: type[PayloadT]
    prompt_instructions: str = Field(min_length=1, max_length=5000)


class ExtractedFactor(BaseModel, Generic[PayloadT]):
    """Output van extract_factor(). Caller krijgt typed payload + metadata."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    factor_id: str
    parcel_id: str
    policy_document_id: str  # uuid als str, matcht policy_documents.id format
    payload: PayloadT
    extracted_at: datetime
    from_cache: bool = Field(
        description=(
            "True als resultaat uit factor_extraction_cache kwam; "
            "False als live Claude-call."
        )
    )
    schema_version: int = Field(
        default=3,
        description=(
            "Bump bij backwards-incompat schema-wijziging; cache-entries "
            "met lagere versie worden genegeerd (re-extract)."
        ),
    )


class FactorExtractionError(Exception):
    """Raised wanneer factor-extraction faalt. NOOIT silently swallow.

    error_code values (stable contract voor S05 cascade-job logging):
    - SCHEMA_VALIDATION_FAILED: Claude's tool_use.input mismatch met payload_model
    - CLAUDE_API_ERROR: HTTP/network/rate-limit failure
    - NO_TOOL_USE_BLOCK: Claude retourneerde response zonder tool_use block
      (ondanks tool_choice=forced — indicatie model-regressie of quota-error)
    - EMPTY_RESPONSE: response.content leeg
    - DOCUMENT_MISSING: policy_document.file_data is None/empty
    """

    def __init__(
        self,
        error_code: str,
        message: str,
        *,
        factor_id: str | None = None,
        parcel_id: str | None = None,
        policy_document_id: str | None = None,
        claude_response_snippet: str | None = None,
    ) -> None:
        super().__init__(f"[{error_code}] {message}")
        self.error_code = error_code
        self.factor_id = factor_id
        self.parcel_id = parcel_id
        self.policy_document_id = policy_document_id
        self.claude_response_snippet = claude_response_snippet


ERROR_CODES: frozenset[str] = frozenset(
    {
        "SCHEMA_VALIDATION_FAILED",
        "CLAUDE_API_ERROR",
        "NO_TOOL_USE_BLOCK",
        "EMPTY_RESPONSE",
        "DOCUMENT_MISSING",
    }
)
"""Iron-rule constant: uitbreiding vereist schema-versie-bump + S05-logging update."""


SCHEMA_VERSION: int = 3
"""Current cache-schema versie. Bump bij: (a) payload-shape change in >=1 factor,
(b) toevoeging nieuwe required metadata-veld, (c) cache-key component change.
Oude cache-entries met lagere SCHEMA_VERSION worden bij read als miss behandeld.

Bumped to 3 in M048/Phase 5: document-level cache sentinel for woonvisie_match.
Old v2 entries (parcel-keyed) become cache-misses and are superseded on next
access via on_conflict_do_update; no cleanup migration required."""


DOCUMENT_SENTINEL: Final[str] = "__document__"
"""Use as parcel_id in extract_factor() when the factor extracts document-level
signals that do not vary per parcel. Ensures exactly 1 Claude call per unique
(policy_document_id, factor_id, SCHEMA_VERSION) tuple across all parcels.

Introduced in M048/Phase 5 for woonvisie_match. At Venlo scale (100k+ parcelen)
the previous parcel-keyed cache would fire 100k Claude calls per woonvisie —
each returning the same document-scoped payload. The sentinel collapses that
to 1 call per (doc, factor, schema_version) tuple."""
