"""Unit tests for brk_bevragen.build_brk_client factory (M050/S02 D6).

The factory is the persist-channel client construction point. Today the returned
BRKBevragenClient still reads settings.BRK_API_KEY for the X-Api-Key header;
the `creds` arg is accepted now to lock the callsite contract so a future
hardening pass can flip the implementation without touching callers (cert/key
remain on disk per D7 — deferred to InfoSec-review hardening phase).
"""
from __future__ import annotations

import pytest

from app.government_apis.brk_bevragen import BRKBevragenClient, build_brk_client
from app.services.credential_resolver import BrkCredentials


def test_build_brk_client_returns_brk_client() -> None:
    creds = BrkCredentials(api_key="test-key")
    client = build_brk_client(creds)
    assert isinstance(client, BRKBevragenClient)


def test_build_brk_client_requires_creds_arg() -> None:
    with pytest.raises(TypeError):
        build_brk_client()  # type: ignore[call-arg]


def test_build_brk_client_does_not_block_unconfigured_state() -> None:
    """D6 + D7: factory accepts creds; cert/key validation lives elsewhere.

    The returned client is the project-singleton-equivalent BRKBevragenClient.
    Whether mTLS env vars are configured is orthogonal to the factory contract:
    callsite locked, hardening deferred per ENG-PLAN §NOT in scope.
    """
    creds = BrkCredentials(api_key="test-key")
    client = build_brk_client(creds)
    assert client is not None
