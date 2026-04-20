"""HTTP-level integration tests voor parcel_project_type_router (M047/S01)."""

import pytest


@pytest.mark.asyncio
async def test_get_returns_default_for_new_parcel(async_client, auth_headers):
    """Unseeded parcel → 200 met 'onbepaald'."""
    response = await async_client.get(
        "/api/parcels/NL.IMBAG.Pand.0983100000000010/project-type",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["project_type"] == "onbepaald"
    assert data["set_at"] is None


@pytest.mark.asyncio
async def test_put_then_get_roundtrip(async_client, auth_headers):
    """PUT + GET (zelfde user) → getter retourneert zojuist gezette waarde."""
    parcel = "NL.IMBAG.Pand.0983100000000011"
    put_resp = await async_client.put(
        f"/api/parcels/{parcel}/project-type",
        json={"project_type": "nieuwbouw_wonen"},
        headers=auth_headers,
    )
    assert put_resp.status_code == 200
    assert put_resp.json()["project_type"] == "nieuwbouw_wonen"
    assert put_resp.json()["set_at"] is not None
    assert put_resp.json()["set_by_user_id"] is not None

    get_resp = await async_client.get(
        f"/api/parcels/{parcel}/project-type",
        headers=auth_headers,
    )
    assert get_resp.status_code == 200
    assert get_resp.json()["project_type"] == "nieuwbouw_wonen"
    assert get_resp.json()["set_by_user_id"] == put_resp.json()["set_by_user_id"]


@pytest.mark.asyncio
async def test_put_rejects_unknown_project_type_with_422(async_client, auth_headers):
    """Pydantic Literal-validatie pakt onbekende waarde BEFORE DB."""
    parcel = "NL.IMBAG.Pand.0983100000000012"
    response = await async_client.put(
        f"/api/parcels/{parcel}/project-type",
        json={"project_type": "kantoor"},
        headers=auth_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_put_rejects_empty_body_with_422(async_client, auth_headers):
    parcel = "NL.IMBAG.Pand.0983100000000013"
    response = await async_client.put(
        f"/api/parcels/{parcel}/project-type",
        json={},
        headers=auth_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_unauthenticated_request_is_401(async_client):
    """Zonder auth-header → 401."""
    response = await async_client.get(
        "/api/parcels/NL.IMBAG.Pand.0983100000000014/project-type",
    )
    assert response.status_code == 401
    # Ook PUT moet 401 geven
    response_put = await async_client.put(
        "/api/parcels/NL.IMBAG.Pand.0983100000000014/project-type",
        json={"project_type": "onbepaald"},
    )
    assert response_put.status_code == 401


@pytest.mark.asyncio
async def test_upsert_second_put_updates_not_duplicates(async_client, auth_headers):
    """Tweede PUT → zelfde rij, nieuwe waarde. Geen 409."""
    parcel = "NL.IMBAG.Pand.0983100000000015"
    for project_type in ["nieuwbouw_wonen", "transformatie_wonen", "optoppen"]:
        resp = await async_client.put(
            f"/api/parcels/{parcel}/project-type",
            json={"project_type": project_type},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["project_type"] == project_type

    # Final state is 'optoppen'
    get_resp = await async_client.get(
        f"/api/parcels/{parcel}/project-type",
        headers=auth_headers,
    )
    assert get_resp.json()["project_type"] == "optoppen"
