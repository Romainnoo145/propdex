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

SOURCE_KEY_TO_PROVIDER: dict[str, str] = {
    "brk-eigendom": "brk",
    "brk-hypotheken": "brk",
    "brk-beslagen": "brk",
    "nvm-transactiedata": "nvm",
    "vindsubsidies-database": "vindsubsidies",
}


def provider_for(source_key: str) -> str:
    """Resolve a catalog row source_key to its credential provider key.

    Type-C rows in the data-sources catalog use canonical long kebab-case keys
    (e.g. ``brk-eigendom``) while the CREDENTIAL_FIELDS registry is keyed by
    provider (``brk``). All BRK variants share one set of auth credentials at
    Haal-Centraal, so they all map to the same provider entry.
    Returns the input unchanged if no alias is registered.
    """
    return SOURCE_KEY_TO_PROVIDER.get(source_key, source_key)


def valid_names_for(source_key: str) -> set[str]:
    """Return the set of credential_name values valid for ``source_key``."""
    return {f.name for f in CREDENTIAL_FIELDS.get(provider_for(source_key), [])}
