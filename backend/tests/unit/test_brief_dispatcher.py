"""M052/S04 — BriefDispatcher + FakeBriefDispatcher unit-tests."""

from app.services.brief_dispatcher import FakeBriefDispatcher, resolve_dispatcher


def test_fake_dispatcher_returns_verzonden():
    d = FakeBriefDispatcher()
    result = d.dispatch(markdown="brief", parcel_id="X")
    assert result.status == "verzonden"
    assert result.sent_at  # ISO-string aanwezig


def test_resolver_returns_fake_for_hauzer_demo():
    assert isinstance(resolve_dispatcher(hauzer_demo=True), FakeBriefDispatcher)


def test_resolver_returns_fake_for_non_demo():
    # Documenteert huidig gedrag: ook zonder demo komt de fake-dispatcher terug.
    # M051 mag dit bewust omzetten naar een echte dispatcher.
    assert isinstance(resolve_dispatcher(hauzer_demo=False), FakeBriefDispatcher)
