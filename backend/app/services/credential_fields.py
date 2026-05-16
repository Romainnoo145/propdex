"""CREDENTIAL_FIELDS registry — eng-review locked 2026-05-16.

Single source of truth for which credential_name values are valid per
source_key. Backend uses this to validate POST input; frontend will consume
the same shape via TS-sync (05-03).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

InputType = Literal["password", "textarea", "url", "text"]


@dataclass(frozen=True)
class CredentialField:
    name: str
    label: str
    input_type: InputType


CREDENTIAL_FIELDS: dict[str, list[CredentialField]] = {
    "brk": [
        CredentialField(name="api_key", label="API Key", input_type="password"),
        CredentialField(name="client_cert", label="Client Certificate (PEM)", input_type="textarea"),
    ],
    "vindsubsidies": [
        CredentialField(name="api_key", label="API Key", input_type="password"),
        CredentialField(name="endpoint_url", label="Endpoint URL", input_type="url"),
    ],
    "nvm": [
        CredentialField(name="client_secret", label="Client Secret", input_type="password"),
        CredentialField(name="endpoint_url", label="Endpoint URL", input_type="url"),
    ],
}


def valid_names_for(source_key: str) -> set[str]:
    """Return the set of credential_name values valid for ``source_key``."""
    return {f.name for f in CREDENTIAL_FIELDS.get(source_key, [])}
