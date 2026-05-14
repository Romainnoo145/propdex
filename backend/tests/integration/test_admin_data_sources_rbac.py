"""Superuser-RBAC pattern proof for M049 admin routes.

Phase 2 will register the real /admin/data-sources router with
`Depends(get_current_superuser)`. This test asserts the dependency raises 403 for
non-superusers and 200 for superusers using a minimal dummy router.

Uses project fixture pattern: create_test_user + create_access_token (inline JWT),
matching tests/conftest.py `auth_headers` precedent.
"""
import pytest
from fastapi import APIRouter, Depends, FastAPI
from httpx import ASGITransport, AsyncClient

from app.auth.dependencies import get_current_superuser
from app.core.database import get_db
from app.models.user import User


def _build_dummy_app(db_override) -> FastAPI:
    """Build a minimal FastAPI app exposing /admin/data-sources/ping behind
    Depends(get_current_superuser). Uses the same get_db override pattern as the
    real app to bind to the test database session.
    """
    app = FastAPI()
    router = APIRouter(prefix="/admin/data-sources")

    @router.get("/ping")
    async def ping(_su: User = Depends(get_current_superuser)) -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(router)
    app.dependency_overrides[get_db] = db_override
    return app


@pytest.mark.asyncio
async def test_dummy_admin_route_403_for_regular_user(test_db, create_test_user):
    """Non-superuser hitting superuser-gated route -> 403."""
    from app.auth.jwt import create_access_token

    user, org = await create_test_user(
        email="regular@m049.test", is_superuser=False,
    )
    token = create_access_token(str(user.id), str(org.id))

    async def db_override():
        yield test_db

    app = _build_dummy_app(db_override)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            "/admin/data-sources/ping",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403, resp.text


@pytest.mark.asyncio
async def test_dummy_admin_route_200_for_superuser(test_db, create_test_user):
    """Superuser hitting superuser-gated route -> 200."""
    from app.auth.jwt import create_access_token

    user, org = await create_test_user(
        email="super@m049.test", is_superuser=True,
    )
    token = create_access_token(str(user.id), str(org.id))

    async def db_override():
        yield test_db

    app = _build_dummy_app(db_override)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            "/admin/data-sources/ping",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200, resp.text
        assert resp.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_dummy_admin_route_401_without_token(test_db):
    """No bearer token -> 401."""
    async def db_override():
        yield test_db

    app = _build_dummy_app(db_override)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/admin/data-sources/ping")
        assert resp.status_code == 401
