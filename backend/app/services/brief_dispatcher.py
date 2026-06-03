"""M052/S04 — brief-dispatch met M051-naad.

FakeBriefDispatcher = demo-shim. M051 voegt PostNLBriefDispatcher (zelfde Protocol)
toe en breidt resolve_dispatcher uit; het send-endpoint + de persistence blijven gelijk.
"""
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass
class DispatchResult:
    status: str
    sent_at: str


class BriefDispatcher(Protocol):
    def dispatch(self, *, markdown: str, parcel_id: str) -> DispatchResult: ...


class FakeBriefDispatcher:
    """Demo-shim: doet niets echts, bevestigt 'verzonden'."""

    def dispatch(self, *, markdown: str, parcel_id: str) -> DispatchResult:
        return DispatchResult(status="verzonden", sent_at=datetime.utcnow().isoformat())


def resolve_dispatcher(*, hauzer_demo: bool) -> BriefDispatcher:
    # M051: return PostNLBriefDispatcher() wanneer postnl_enabled, anders Fake.
    return FakeBriefDispatcher()
